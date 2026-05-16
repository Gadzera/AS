import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type WebhookEvent =
  | 'reply'
  | 'open'
  | 'bounce'
  | 'unsubscribe'
  | 'interested'
  | 'converted';

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
    webhooks.map(wh =>
      axios.post(wh.url, payload, {
        timeout: 8_000,
        headers: { 'Content-Type': 'application/json', 'X-AI-SDR-Event': payload.event },
      }).catch(err => {
        console.warn(`[Webhook] Failed to deliver to ${wh.url}: ${err.message}`);
      })
    )
  );
}
