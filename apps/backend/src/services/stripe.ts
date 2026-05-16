import Stripe from 'stripe';
import { config } from '../config';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
});

export { stripe };

const PLAN_PRICE_MAP: Record<string, string> = {
  STARTER: config.stripe.prices.starter,
  GROWTH: config.stripe.prices.growth,
  AGENCY: config.stripe.prices.agency,
};

const PRICE_PLAN_MAP: Record<string, string> = {
  [config.stripe.prices.starter]: 'STARTER',
  [config.stripe.prices.growth]: 'GROWTH',
  [config.stripe.prices.agency]: 'AGENCY',
};

/**
 * Create or retrieve Stripe customer for an organization
 */
export async function getOrCreateCustomer(params: {
  orgId: string;
  email: string;
  name: string;
  existingCustomerId?: string | null;
}): Promise<Stripe.Customer> {
  if (params.existingCustomerId) {
    const customer = await stripe.customers.retrieve(params.existingCustomerId);
    if (!customer.deleted) {
      return customer as Stripe.Customer;
    }
  }

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      orgId: params.orgId,
    },
  });
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
  orgId: string;
}): Promise<string> {
  const priceId = PLAN_PRICE_MAP[params.plan];
  if (!priceId) {
    throw new Error(`Unknown plan: ${params.plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      orgId: params.orgId,
      plan: params.plan,
    },
  });

  return session.url ?? '';
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

/**
 * Construct and verify a Stripe webhook event
 */
export function constructWebhookEvent(
  payload: Buffer | string,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret
  );
}

/**
 * Get plan name from Stripe price ID
 */
export function getPlanFromPriceId(priceId: string): string {
  return PRICE_PLAN_MAP[priceId] ?? 'STARTER';
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId);
}
