/**
 * M16-2: Stripe subscription sync. processStripeEvent — ИДЕМПОТЕНТНАЯ обработка вебхуков через StripeEvent со
 * СТАТУСОМ (PROCESSING→PROCESSED; дубль PROCESSED→skip; FAILED/зависший PROCESSING→reprocess; падение→FAILED+throw,
 * webhook отдаёт 500 → Stripe ретраит). Эффекты идемпотентны вторым слоем (ledger business-keys): invoice.paid —
 * ЕДИНСТВЕННЫЙ источник месячного reset/top-up; subscription.updated синкает plan/status/period БЕЗ безусловных
 * кредитов (reset только при смене плана, stable business-key); cancel_at_period_end не даунгрейдит сразу.
 */
import { PrismaClient } from '@prisma/client';
import { resetMonthly } from './ledger';
import { PLAN_MONTHLY_CREDITS } from '../ai/credits';
import { getPlanFromPriceId } from '../stripe';

const prisma = new PrismaClient();

const PLAN_LEADS: Record<string, number> = { STARTER: 500, GROWTH: 2000, AGENCY: 10000 };
const toDate = (unixSec?: number | null) => (unixSec ? new Date(unixSec * 1000) : undefined);

export interface StripeEventLike { id: string; type: string; data: { object: Record<string, any> } }
export type ProcessResult = { ok: boolean; status: 'processed' | 'duplicate' | 'reprocessed' };

/** Идемпотентная обработка одного Stripe-события (dedup со статусом). Бросает → webhook 500 (Stripe ретраит). */
export async function processStripeEvent(event: StripeEventLike): Promise<ProcessResult> {
  const existing = await prisma.stripeEvent.findUnique({ where: { eventId: event.id }, select: { status: true } });
  if (existing?.status === 'PROCESSED') return { ok: true, status: 'duplicate' }; // уже применено — skip

  // claim: PROCESSING (новый) или reprocess (FAILED/зависший PROCESSING).
  if (!existing) await prisma.stripeEvent.create({ data: { eventId: event.id, type: event.type, status: 'PROCESSING', attempts: 1, payload: event.data?.object as any } });
  else await prisma.stripeEvent.update({ where: { eventId: event.id }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });

  try {
    await applyEffects(event);
    await prisma.stripeEvent.update({ where: { eventId: event.id }, data: { status: 'PROCESSED', processedAt: new Date(), error: null } });
    return { ok: true, status: existing ? 'reprocessed' : 'processed' };
  } catch (e) {
    await prisma.stripeEvent.update({ where: { eventId: event.id }, data: { status: 'FAILED', error: (e instanceof Error ? e.message : String(e)).slice(0, 500) } });
    throw e; // → 500 → Stripe retry; эффекты идемпотентны (re-apply ровно раз)
  }
}

async function applyEffects(event: StripeEventLike): Promise<void> {
  const o = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      const orgId = o.metadata?.orgId as string | undefined;
      const plan = (o.metadata?.plan as string | undefined) ?? undefined;
      if (!orgId || !plan) throw new Error('checkout: missing orgId/plan');
      await prisma.organization.update({ where: { id: orgId }, data: { plan: plan as any, stripeCustomerId: o.customer ?? null, stripeSubId: o.subscription ?? null, subscriptionStatus: 'active', leadsLimit: PLAN_LEADS[plan] ?? 500 } });
      // начальный месячный грант по плану — идемпотентно по сессии.
      await resetMonthly({ orgId, planCredits: PLAN_MONTHLY_CREDITS[plan] ?? 1500, idempotencyKey: `stripe:checkout:${o.id}`, reason: `checkout ${plan}` });
      break;
    }
    case 'customer.subscription.updated': {
      const org = await prisma.organization.findFirst({ where: { stripeSubId: o.id }, select: { id: true, plan: true } });
      if (!org) throw new Error(`subscription.updated: no org for sub ${o.id}`);
      const priceId = o.items?.data?.[0]?.price?.id as string | undefined;
      const newPlan = getPlanFromPriceId(priceId ?? '');
      const periodStart = toDate(o.current_period_start);
      const periodEnd = toDate(o.current_period_end);
      // синк plan/status/period БЕЗ безусловных кредитов.
      await prisma.organization.update({ where: { id: org.id }, data: { plan: newPlan as any, subscriptionStatus: o.status ?? null, currentPeriodEnd: periodEnd ?? null, cancelAtPeriodEnd: !!o.cancel_at_period_end, leadsLimit: PLAN_LEADS[newPlan] ?? undefined } });
      // reset кредитов ТОЛЬКО при реальной смене плана, stable business-key (один reset на план+период).
      if (newPlan !== org.plan && o.status === 'active') {
        await resetMonthly({ orgId: org.id, planCredits: PLAN_MONTHLY_CREDITS[newPlan] ?? 1500, periodStart, periodEnd, idempotencyKey: `stripe:subscription:${o.id}:plan:${priceId}:period:${o.current_period_start ?? 0}`, reason: `plan change → ${newPlan}` });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const org = await prisma.organization.findFirst({ where: { stripeSubId: o.id }, select: { id: true } });
      if (!org) return; // нечего даунгрейдить
      // реальная отмена → downgrade STARTER (cancel_at_period_end обрабатывается в updated, не здесь).
      await prisma.organization.update({ where: { id: org.id }, data: { plan: 'STARTER' as any, subscriptionStatus: 'canceled', stripeSubId: null, cancelAtPeriodEnd: false, leadsLimit: PLAN_LEADS.STARTER } });
      break;
    }
    case 'invoice.paid': {
      // ЕДИНСТВЕННЫЙ источник месячного reset/top-up. Идемпотентно по invoice id.
      const org = await prisma.organization.findFirst({ where: { stripeCustomerId: o.customer }, select: { id: true, plan: true } });
      if (!org) throw new Error(`invoice.paid: no org for customer ${o.customer}`);
      const line = o.lines?.data?.[0];
      const periodStart = toDate(line?.period?.start);
      const periodEnd = toDate(line?.period?.end);
      await resetMonthly({ orgId: org.id, planCredits: PLAN_MONTHLY_CREDITS[org.plan] ?? 1500, periodStart, periodEnd, idempotencyKey: `stripe:invoice:${o.id}`, reason: 'invoice.paid monthly reset' });
      await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: 'active' } });
      break;
    }
    case 'invoice.payment_failed': {
      const org = await prisma.organization.findFirst({ where: { stripeCustomerId: o.customer }, select: { id: true } });
      if (org) await prisma.organization.update({ where: { id: org.id }, data: { subscriptionStatus: 'past_due' } }); // soft-флаг (без мгновенного блока)
      break;
    }
    default:
      break; // прочие события просто помечаем PROCESSED
  }
}
