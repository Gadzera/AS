import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

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
import { config } from '../config';

const router = Router();


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
        res.json({
          plan: org.plan,
          status: 'free',
          subscription: null,
        });
        return;
      }

      const sub = await getSubscription(org.stripeSubId);

      res.json({
        plan: org.plan,
        status: sub.status,
        currentPeriodEnd: new Date((sub as { current_period_end: number }).current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/billing/usage — current usage vs limits
router.get('/usage', authenticate, requireOrg, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, leadsLimit: true, bonusLeads: true },
    });
    if (!org) { res.status(404).json({ error: 'Not found' }); return; }

    const [leadsCount, campaignsCount, activeCampaigns] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.campaign.count({ where: { orgId } }),
      prisma.campaign.count({ where: { orgId, status: 'ACTIVE' } }),
    ]);

    const PLAN_LIMITS: Record<string, { campaigns: number; leadsLimit: number }> = {
      STARTER: { campaigns: 3, leadsLimit: 500 },
      GROWTH: { campaigns: 10, leadsLimit: 5000 },
      AGENCY: { campaigns: 999, leadsLimit: 100000 },
    };

    const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.STARTER;
    const effectiveLeadLimit = org.leadsLimit + org.bonusLeads;

    res.json({
      plan: org.plan,
      leads: { used: leadsCount, limit: effectiveLeadLimit, percent: Math.round(leadsCount / effectiveLeadLimit * 100) },
      campaigns: { used: campaignsCount, limit: limits.campaigns, active: activeCampaigns },
    });
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
    } catch {
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as {
            metadata?: { orgId?: string; plan?: string };
            customer?: string;
            subscription?: string;
          };
          const orgId = session.metadata?.orgId;
          const plan = session.metadata?.plan;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (orgId && plan && subscriptionId) {
            const planLimits: Record<string, number> = {
              STARTER: 500,
              GROWTH: 5000,
              AGENCY: 100000,
            };

            await prisma.organization.update({
              where: { id: orgId },
              data: {
                plan: plan as 'STARTER' | 'GROWTH' | 'AGENCY',
                stripeCustomerId: customerId as string,
                stripeSubId: subscriptionId as string,
                leadsLimit: planLimits[plan] ?? 500,
              },
            });
          } else {
            console.error('[Billing] checkout.session.completed missing metadata — orgId, plan, or subscriptionId absent. Session:', session);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as {
            id: string;
            status: string;
            items: { data: Array<{ price: { id: string } }> };
          };
          const priceId = sub.items.data[0]?.price?.id;
          const plan = getPlanFromPriceId(priceId);

          const org = await prisma.organization.findFirst({
            where: { stripeSubId: sub.id },
          });

          if (org) {
            const planLimits: Record<string, number> = {
              STARTER: 500,
              GROWTH: 5000,
              AGENCY: 100000,
            };

            await prisma.organization.update({
              where: { id: org.id },
              data: {
                plan: plan as 'STARTER' | 'GROWTH' | 'AGENCY',
                leadsLimit: planLimits[plan] ?? 500,
              },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as { id: string };
          await prisma.organization.updateMany({
            where: { stripeSubId: sub.id },
            data: {
              plan: 'STARTER',
              stripeSubId: null,
              leadsLimit: 500,
            },
          });
          break;
        }

        default:
          // Unhandled event type — ignore
          break;
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
