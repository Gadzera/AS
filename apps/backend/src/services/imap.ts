import { prisma } from '../lib/prisma';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { Readable } from 'stream';

import { config } from '../config';
import { redis } from '../worker/queue';
import { decrypt } from '../utils/encryption';
import { upsertHubSpotContact } from './hubspot';
import { upsertPipedriveContact } from './pipedrive';
import { createNotification, updateOnboardingStep } from './onboarding';
import { handleInterestedReply, handleFollowUpReply, incrementReplied } from './autopilot';



const BOUNCE_PATTERNS = [
  /delivery.{0,20}fail/i,
  /undeliverable/i,
  /failed to deliver/i,
  /mail delivery failed/i,
  /returned mail/i,
  /delivery status notification/i,
  /permanent failure/i,
  /user unknown/i,
  /no such user/i,
  /mailbox.{0,10}not found/i,
];

const BOUNCE_FROM = [/mailer-daemon/i, /postmaster/i, /mail-daemon/i];

function isBounce(from: string, subject: string): boolean {
  return BOUNCE_FROM.some(p => p.test(from)) || BOUNCE_PATTERNS.some(p => p.test(subject));
}

function normalizeId(id: string): string {
  return id.replace(/[<>]/g, '').trim();
}

interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

async function pollSingleInbox(creds: ImapCredentials, label: string): Promise<void> {
  const client = new ImapFlow({
    host:   creds.host,
    port:   creds.port,
    secure: creds.port === 993,
    auth:   { user: creds.user, pass: creds.pass },
    logger: false,
    connectionTimeout: 30_000,
    greetingTimeout:   15_000,
    socketTimeout:     60_000,
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    for await (const msg of client.fetch({ seen: false }, { source: true, flags: true })) {
      try {
        const source = msg.source;
        if (!source) continue;

        let parsed: ParsedMail;
        try {
          parsed = await simpleParser(Readable.from(source));
        } catch {
          continue;
        }

        const from    = parsed.from?.text ?? '';
        const subject = parsed.subject ?? '';
        const inReplyTo = parsed.inReplyTo ? normalizeId(parsed.inReplyTo) : null;
        const references: string[] = Array.isArray(parsed.references)
          ? parsed.references.map(normalizeId)
          : (typeof parsed.references === 'string' ? [normalizeId(parsed.references)] : []);

        if (isBounce(from, subject)) {
          await handleBounce(parsed);
        } else if (inReplyTo || references.length > 0) {
          await handleReply(inReplyTo, references, parsed);
        }
      } catch (msgErr) {
        console.error(`[IMAP:${label}] Error processing message:`, (msgErr as Error).message);
      } finally {
        await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']).catch(() => null);
      }
    }
  } catch (err) {
    console.error(`[IMAP:${label}] Poll error:`, err instanceof Error ? err.message : String(err));
  } finally {
    await client.logout().catch(() => null);
  }
}

export async function pollInbox(): Promise<void> {
  const lockKey = 'imap:poll:lock';
  const lockTtl = 4 * 60_000 + 50_000;

  const acquired = await redis.set(lockKey, '1', 'PX', lockTtl, 'NX');
  if (!acquired) {
    console.log('[IMAP] Poll already running, skipping');
    return;
  }

  try {
    // 1. Global IMAP (backward-compat for single-tenant setups)
    if (config.smtp.user && config.imap.host) {
      await pollSingleInbox(
        { host: config.imap.host, port: config.imap.port, user: config.smtp.user, pass: config.smtp.pass },
        'global'
      );
    }

    // 2. Per-org SMTP accounts with IMAP enabled
    const accounts = await prisma.smtpAccount.findMany({
      where: { imapEnabled: true, active: true },
      select: { id: true, imapHost: true, imapPort: true, imapUser: true, imapPass: true, user: true, pass: true },
    });

    for (const account of accounts) {
      const host = account.imapHost;
      const port = account.imapPort ?? 993;
      const user = account.imapUser ?? account.user;
      const pass = account.imapPass ? decrypt(account.imapPass) : decrypt(account.pass);

      if (!host) continue;

      await pollSingleInbox({ host, port, user, pass }, account.id);
    }
  } finally {
    await redis.del(lockKey).catch(() => null);
  }
}

async function handleBounce(parsed: ParsedMail): Promise<void> {
  const bodyText = typeof parsed.text === 'string' ? parsed.text : '';
  const match = bodyText.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
  if (!match) return;

  const bouncedEmail = match[0].toLowerCase();

  const result = await prisma.lead.updateMany({
    where: { email: bouncedEmail, bounced: false },
    data:  { bounced: true, status: 'LOST' },
  });
  if (result.count === 0) return;

  const lead = await prisma.lead.findFirst({ where: { email: bouncedEmail }, select: { id: true } });
  if (!lead) return;

  await prisma.campaignLead.updateMany({
    where: { leadId: lead.id, status: { notIn: ['CONVERTED', 'LOST', 'UNSUBSCRIBED'] } },
    data:  { status: 'LOST', nextSendAt: null },
  });
  await prisma.message.updateMany({
    where: { leadId: lead.id, direction: 'OUTBOUND', bounced: false },
    data:  { bounced: true },
  });
  console.log(`[IMAP] Bounce: ${bouncedEmail}`);
}

async function handleReply(
  inReplyTo: string | null,
  references: string[],
  parsed: ParsedMail
): Promise<void> {
  const candidates = [...(inReplyTo ? [inReplyTo] : []), ...references];

  const original = await prisma.message.findFirst({
    where: { smtpMessageId: { in: candidates }, direction: 'OUTBOUND' },
    include: { lead: true },
  });

  if (!original || original.repliedAt) return;

  const replyBody  = typeof parsed.text === 'string' ? parsed.text : '';
  const replyClass = await classifyReply(replyBody);
  const lead       = original.lead;

  await prisma.message.create({
    data: {
      leadId:    lead.id,
      direction: 'INBOUND',
      channel:   'EMAIL',
      subject:   parsed.subject ?? '',
      body:      replyBody,
      replyClass,
      sentAt:    parsed.date ?? new Date(),
    },
  });

  await prisma.message.update({ where: { id: original.id }, data: { repliedAt: new Date() } });

  const newStatus =
    replyClass === 'INTERESTED'     ? 'HOT'          :
    replyClass === 'UNSUBSCRIBE'    ? 'UNSUBSCRIBED'  :
    replyClass === 'NOT_INTERESTED' ? 'LOST'          :
    'REPLIED' as const;

  await prisma.lead.update({ where: { id: lead.id }, data: { status: newStatus } });

  await prisma.campaignLead.updateMany({
    where: { leadId: lead.id, status: { notIn: ['CONVERTED', 'LOST', 'UNSUBSCRIBED'] } },
    data:  {
      status:    newStatus === 'UNSUBSCRIBED' ? 'UNSUBSCRIBED' :
                 newStatus === 'LOST' ? 'LOST' : 'REPLIED',
      nextSendAt: null,
    },
  });

  if (newStatus === 'HOT') {
    upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: 'HOT', orgId: lead.orgId }).catch(() => null);
    upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, orgId: lead.orgId }).catch(() => null);
    createNotification(lead.orgId, {
      type: 'HOT_LEAD',
      title: `Горячий лид: ${lead.firstName} ${lead.lastName}`,
      body: `${lead.company ?? lead.email} заинтересован. Ответьте как можно скорее.`,
      link: `/inbox?leadId=${lead.id}`,
    }).catch(() => null);
    updateOnboardingStep(lead.orgId, 'firstReply').catch(() => null);
  } else if (newStatus === 'REPLIED') {
    updateOnboardingStep(lead.orgId, 'firstReply').catch(() => null);
    createNotification(lead.orgId, {
      type: 'REPLY_RECEIVED',
      title: `Ответ от ${lead.firstName} ${lead.lastName}`,
      body: `${lead.company ?? lead.email} ответил на вашу кампанию.`,
      link: `/inbox?leadId=${lead.id}`,
    }).catch(() => null);
  }

  await incrementReplied(lead.orgId).catch(() => null);

  if (replyClass === 'INTERESTED') {
    await handleInterestedReply({
      leadId: lead.id,
      orgId:  lead.orgId,
      originalMessageBody: original.body ?? '',
      replyText: replyBody,
    }).catch(() => null);
  } else if (replyClass === 'FOLLOW_UP') {
    await handleFollowUpReply({
      leadId: lead.id,
      orgId:  lead.orgId,
      originalMessageBody: original.body ?? '',
      replyText: replyBody,
    }).catch(() => null);
  }

  console.log(`[IMAP] Reply from ${lead.email}: class=${replyClass} status=${newStatus}`);
}

async function classifyReply(text: string): Promise<'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE'> {
  const clean = text
    .replace(/^>.*$/gm, '')
    .replace(/On .+wrote:/gs, '')
    .replace(/_{10,}.*$/s, '')
    .trim();

  const lower = clean.toLowerCase();

  if (/out.of.office|i.?m (away|on vacation|on leave)|auto.?reply|автоответ|нет на месте|в отпуске/i.test(lower))
    return 'FOLLOW_UP';

  if (/unsubscribe|remove me|stop email|opt.?out|don.?t (contact|email)|take me off/i.test(lower))
    return 'UNSUBSCRIBE';
  if (/not interested|no thanks|not relevant|wrong person|please remove|stop contacting/i.test(lower))
    return 'NOT_INTERESTED';
  if (/yes|interested|tell me more|sounds good|let.?s chat|schedule|book|demo|call|meeting|pricing|how much|love to/i.test(lower))
    return 'INTERESTED';

  try {
    const { default: AIProvider } = await import('@anthropic-ai/sdk');
    const client = new AIProvider({ apiKey: config.ai.apiKey });
    const resp = await client.messages.create({
      model: process.env.AI_CLASSIFY_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Classify this email reply into exactly one word: INTERESTED, NOT_INTERESTED, FOLLOW_UP, or UNSUBSCRIBE.\n\nReply: "${text.slice(0, 500)}"`,
      }],
    });
    const word = (resp.content[0] as { text: string }).text.trim().toUpperCase();
    if (['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'].includes(word))
      return word as 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';
  } catch { /* fallback */ }

  return 'FOLLOW_UP';
}
