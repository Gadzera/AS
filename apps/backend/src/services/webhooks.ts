import { prisma } from '../lib/prisma';
import axios from 'axios';
import crypto from 'crypto';

export type WebhookEvent =
  | 'reply'
  | 'open'
  | 'bounce'
  | 'unsubscribe'
  | 'interested'
  | 'converted'
  | 'sent';

function isInternalUrl(urlStr: string): boolean {
  try {
    const { hostname } = new URL(urlStr);
    if (['localhost', '::1'].includes(hostname)) return true;
    if (/^127\./.test(hostname)) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^169\.254\./.test(hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

export interface WebhookPayload {
  event:     WebhookEvent;
  timestamp: string;
  lead: {
    id:        string;
    email:     string | null;
    firstName: string;
    lastName:  string;
    company:   string | null;
    status:    string;
  };
  campaign?: { id: string; name: string };
  message?:  { id: string; subject: string | null };
}

export async function fireWebhooks(orgId: string, payload: WebhookPayload): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { orgId, active: true, events: { has: payload.event } },
  });

  if (webhooks.length === 0) return;

  await Promise.allSettled(
    webhooks
      .filter(wh => !isInternalUrl(wh.url))
      .map(wh => {
        const body = JSON.stringify(payload);
        const sig = wh.secret
          ? crypto.createHmac('sha256', wh.secret).update(body).digest('hex')
          : null;

        return axios.post(wh.url, body, {
          timeout: 8_000,
          headers: {
            'Content-Type': 'application/json',
            'X-SDR-Event': payload.event,
            ...(sig ? { 'X-SDR-Signature-256': `sha256=${sig}` } : {}),
          },
        }).catch(err => {
          console.warn(`[Webhook] Failed to deliver to ${wh.url}: ${err.message}`);
        });
      })
  );
}
