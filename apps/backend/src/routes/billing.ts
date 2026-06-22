import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import {
  stripe,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  getPlanFromPriceId,
  getSubscription,
} from '../services/stripe';
import { reconcileBalance } from '../services/billing/ledger';
import { processStripeEvent } from '../services/billing/stripeSync';
import { getUsage } from '../services/billing/usage';
import { getOrCreateBalance, PLAN_MONTHLY_CREDITS } from '../services/ai/credits';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

const checkoutSchema = z.object({
  plan: z.enum(['STARTER', 'GROWTH', 'AGENCY']),
});

// POST /api/billing/checkout
router.post(
  '/checkout',
  authenticate,
  requireOrg,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.orgId!;
      const { plan } = checkoutSchema.parse(req.body);

      // ЧЕСТНЫЙ DEMO-GATE: без ключа Stripe реальной оплаты нет. Не подделываем успех,
      // не меняем план/баланс — возвращаем явный demo-ответ для UI.
      if (!config.stripe.secretKey) {
        res.json({ demo: true, message: 'Billing runs in demo mode — connect Stripe to enable real upgrades. No charge was made and your plan is unchanged.' });
        return;
      }

      const [org, user] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId } }),
        prisma.user.findUnique({ where: { id: req.user!.userId } }),
      ]);

      if (!org || !user) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const customer = await getOrCreateCustomer({
        orgId,
        email: user.email,
        name: org.name,
        existingCustomerId: org.stripeCustomerId,
      });

      // Save customer ID if new
      if (!org.stripeCustomerId) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { stripeCustomerId: customer.id },
        });
      }

      const sessionUrl = await createCheckoutSession({
        customerId: customer.id,
        plan,
        successUrl: `${config.frontendUrl}/settings?checkout=success`,
        cancelUrl: `${config.frontendUrl}/settings?checkout=cancel`,
        orgId,
      });

      res.json({ url: sessionUrl });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/billing/portal
router.get(
  '/portal',
  authenticate,
  requireOrg,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.orgId!;
      const org = await prisma.organization.findUnique({ where: { id: orgId } });

      if (!org?.stripeCustomerId) {
        res.status(400).json({ error: 'No billing account found' });
        return;
      }

      const url = await createPortalSession({
        customerId: org.stripeCustomerId,
        returnUrl: `${config.frontendUrl}/settings`,
      });

      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/billing/subscription
router.get(
  '/subscription',
  authenticate,
  requireOrg,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.orgId!;
      const org = await prisma.organization.findUnique({ where: { id: orgId } });

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      if (!org.stripeSubId) {
        // Тариф назначен (GROWTH и т.п.), но реальной оплаты Stripe нет → честный demo-статус (не «free»).
        res.json({
          plan: org.plan,
          status: org.subscriptionStatus ?? 'demo',
          demo: true,
          subscription: null,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: org.cancelAtPeriodEnd,
        });
        return;
      }

      // M16-3: Stripe может быть не настроен/недоступен — НЕ роняем эндпоинт (иначе 401/500 разлогинивает UI).
      // Деградируем к синхронизированному из webhook статусу на org (источник истины и так webhook).
      try {
        const sub = await getSubscription(org.stripeSubId);
        res.json({
          plan: org.plan,
          status: sub.status,
          currentPeriodEnd: new Date((sub as { current_period_end: number }).current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      } catch {
        res.json({
          plan: org.plan,
          status: org.subscriptionStatus ?? 'active',
          subscription: null,
          degraded: true,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: org.cancelAtPeriodEnd,
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

// M16-3: GET /api/billing/overview — всё для Settings → Billing & Credits (plan/status/period + credits + ledger).
router.get('/overview', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    await getOrCreateBalance(orgId); // гарантируем строку баланса
    const [org, bal, ledger, usage] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, subscriptionStatus: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeSubId: true } }),
      prisma.creditBalance.findUnique({ where: { orgId }, select: { monthlyCredits: true, purchasedCredits: true, usedCredits: true, remainingCredits: true, periodStart: true, periodEnd: true } }),
      prisma.creditTransaction.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, source: true, type: true, amount: true, reason: true, balanceAfter: true, aiRunId: true, bulkRunId: true, replyDraftId: true, createdAt: true } }),
      getUsage(orgId), // M16-5: единый источник usage/audit-тоталов
    ]);
    res.json({
      plan: org?.plan ?? 'STARTER',
      subscriptionStatus: org?.subscriptionStatus ?? (org?.stripeSubId ? 'active' : 'demo'),
      hasSubscription: !!org?.stripeSubId,
      currentPeriodEnd: org?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: !!org?.cancelAtPeriodEnd,
      planMonthly: PLAN_MONTHLY_CREDITS[org?.plan ?? ''] ?? 1500,
      credits: bal ? { monthly: bal.monthlyCredits, purchased: bal.purchasedCredits, used: bal.usedCredits, remaining: bal.remainingCredits, periodStart: bal.periodStart?.toISOString() ?? null, periodEnd: bal.periodEnd?.toISOString() ?? null } : null,
      ledger: ledger.map((t) => ({ id: t.id, source: t.source, type: t.type, amount: t.amount, reason: t.reason, balanceAfter: t.balanceAfter, link: t.aiRunId ? `ai-run:${t.aiRunId}` : t.bulkRunId ? `bulk:${t.bulkRunId}` : t.replyDraftId ? `reply-draft:${t.replyDraftId}` : null, createdAt: t.createdAt.toISOString() })),
      usage, // M16-5: breakdown by module + grants + adjustments (из CreditTransaction; spend=DEBIT)
    });
  } catch (err) { next(err); }
});

// M16-5: GET /api/billing/ledger/export?format=csv|json — полный ledger (date/type/source/amount/reason/balanceAfter/link/idempotencyKey).
router.get('/ledger/export', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const rows = await prisma.creditTransaction.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 5000, select: { createdAt: true, type: true, source: true, amount: true, reason: true, balanceAfter: true, aiRunId: true, bulkRunId: true, replyDraftId: true, idempotencyKey: true } });
    const link = (t: typeof rows[number]) => t.aiRunId ? `ai-run:${t.aiRunId}` : t.bulkRunId ? `bulk:${t.bulkRunId}` : t.replyDraftId ? `reply-draft:${t.replyDraftId}` : '';
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="credit_ledger.json"');
      res.send(JSON.stringify(rows.map((t) => ({ date: t.createdAt.toISOString(), type: t.type, source: t.source, amount: t.amount, reason: t.reason, balanceAfter: t.balanceAfter, link: link(t) || null, idempotencyKey: t.idempotencyKey })), null, 2));
      return;
    }
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const header = ['date', 'type', 'source', 'amount', 'reason', 'balanceAfter', 'link', 'idempotencyKey'];
    const lines = [header.join(','), ...rows.map((t) => [t.createdAt.toISOString(), t.type, t.source, t.amount, t.reason ?? '', t.balanceAfter, link(t), t.idempotencyKey ?? ''].map(esc).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="credit_ledger.csv"');
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
});

// M16-5: GET /api/billing/webhook-events — Stripe webhook audit (eventId/type/status/attempts/processedAt/error). ТОЛЬКО менеджер.
router.get('/webhook-events', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === 'MEMBER') { res.status(403).json({ error: 'Only the owner or an admin can view webhook audit' }); return; }
    const events = await prisma.stripeEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { eventId: true, type: true, status: true, attempts: true, processedAt: true, error: true, createdAt: true } });
    res.json({ events: events.map((e) => ({ ...e, processedAt: e.processedAt?.toISOString() ?? null, createdAt: e.createdAt.toISOString() })) });
  } catch (err) { next(err); }
});

// M16-1/M16-3: POST /api/billing/reconcile — period-aware сверка (расхождение → ADJUSTMENT). ТОЛЬКО менеджер.
router.post('/reconcile', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === 'MEMBER') { res.status(403).json({ error: 'Only the owner or an admin can reconcile billing' }); return; }
    const r = await reconcileBalance(req.user!.orgId!);
    res.json(r);
  } catch (err) { next(err); }
});

// POST /api/billing/webhook — Stripe webhook handler
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event;
    try {
      event = constructWebhookEvent(req.body as Buffer, sig as string);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: `Webhook signature verification failed: ${msg}` });
      return;
    }

    // M16-2: идемпотентная обработка (StripeEvent dedup со статусом) + ledger business-keys. Падение → 500,
    // эффекты НЕ применены частично (FAILED) → Stripe ретраит → повтор применяет ровно раз.
    try {
      const r = await processStripeEvent({ id: event.id, type: event.type, data: { object: event.data.object as unknown as Record<string, unknown> } });
      res.json({ received: true, status: r.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[stripe:webhook] processing failed (will retry):', msg);
      res.status(500).json({ error: 'webhook processing failed' });
    }
  }
);

export default router;
