import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { Readable } from 'stream';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { upsertHubSpotContact } from './hubspot';
import { upsertPipedriveContact } from './pipedrive';

const prisma = new PrismaClient();

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

export async function pollInbox(): Promise<void> {
  if (!config.smtp.user || !config.imap.host) return;

  const client = new ImapFlow({
    host:   config.imap.host,
    port:   config.imap.port,
    secure: config.imap.port === 993,
    auth:   { user: config.smtp.user, pass: config.smtp.pass },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const since = new Date(Date.now() - 7 * 86_400_000);

    for await (const msg of client.fetch({ since }, { source: true })) {
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
    }
  } catch (err) {
    console.error('[IMAP] Poll error:', err instanceof Error ? err.message : String(err));
  } finally {
    await client.logout().catch(() => null);
  }
}

async function handleBounce(parsed: ParsedMail): Promise<void> {
  const bodyText = typeof parsed.text === 'string' ? parsed.text : '';
  const match = bodyText.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/);
  if (!match) return;

  const bouncedEmail = match[0].toLowerCase();
  const lead = await prisma.lead.findFirst({ where: { email: bouncedEmail } });
  if (!lead || lead.bounced) return;

  await prisma.lead.update({ where: { id: lead.id }, data: { bounced: true, status: 'LOST' } });
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

  // Push to CRM when lead becomes HOT (interested reply)
  if (newStatus === 'HOT') {
    upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: 'HOT' }).catch(() => null);
    upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title }).catch(() => null);
  }

  console.log(`[IMAP] Reply from ${lead.email}: class=${replyClass} status=${newStatus}`);
}

async function classifyReply(text: string): Promise<'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE'> {
  const lower = text.toLowerCase();

  if (/unsubscribe|remove me|stop email|opt.?out|don.?t (contact|email)|take me off/i.test(lower))
    return 'UNSUBSCRIBE';
  if (/not interested|no thanks|not relevant|wrong person|please remove|stop contacting/i.test(lower))
    return 'NOT_INTERESTED';
  if (/yes|interested|tell me more|sounds good|let.?s chat|schedule|book|demo|call|meeting|pricing|how much|love to/i.test(lower))
    return 'INTERESTED';

  // Use LLM for ambiguous replies
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.ai.apiKey });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
