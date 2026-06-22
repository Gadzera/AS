/**
 * M13-2: трекинг открытий писем как идемпотентные MessageEvent OPENED.
 * Только для СУЩЕСТВУЮЩЕГО Message; бот/прокси (UA-денилист) не считаем как человеческое открытие;
 * первое human-открытие → одно OPENED-событие (dedupeKey='open') + denormalized Message.openedAt (compat).
 * Приватность: сырой IP не храним — короткий соль-хеш (ipHash).
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { runWorkflows } from './workflows';

const prisma = new PrismaClient();

// UA-денилист прокси/сканеров/прелоадеров — это НЕ человек, открытие не засчитываем.
const BOT_UA_RE = /GoogleImageProxy|Google Web Preview|GoogleDocs|via ggpht|YahooMailProxy|BarracudaCentral|Mimecast|Proofpoint|Symantec|Microsoft.*(Preview|Protection)|Outlook.*Protection|SkypeUriPreview|curl|wget|libwww|python-requests|Go-http-client|java\/|okhttp|node-fetch|axios|bot\b|spider|crawler|scanner|prefetch|preview|HeadlessChrome|PhantomJS|facebookexternalhit|Slackbot|TelegramBot|WhatsApp|Twitterbot|LinkedInBot|Discordbot/i;

/** Похож ли User-Agent на бота/прокси-сканер (пустой UA тоже трактуем как небезопасный). */
export function isBotUserAgent(ua: string | undefined | null): boolean {
  if (!ua || ua.trim() === '') return true;
  return BOT_UA_RE.test(ua);
}

const IP_SALT = process.env.TRACK_IP_SALT || 'aisdr-track-salt';
/** Приватный хеш IP (не храним сырой адрес). */
export function hashIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(IP_SALT + ip).digest('hex').slice(0, 16);
}

/**
 * Идемпотентно зафиксировать OPENED по существующему сообщению.
 * 'unknown' — Message не найден (событие не пишем); 'duplicate' — уже открыто; 'recorded' — записано.
 */
export async function recordOpenEvent(messageId: string, ua: string | null, ip: string | null): Promise<'recorded' | 'duplicate' | 'unknown'> {
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true, leadId: true, campaignLeadId: true, campaignId: true, lead: { select: { orgId: true } } } });
  if (!msg) return 'unknown'; // событие только для существующего Message
  try {
    const ev = await prisma.messageEvent.create({
      data: {
        messageId, type: 'OPENED', dedupeKey: 'open', occurredAt: new Date(),
        meta: { userAgent: (ua ?? '').slice(0, 300), ipHash: hashIp(ip) },
        leadId: msg.leadId, campaignLeadId: msg.campaignLeadId, campaignId: msg.campaignId,
      },
      select: { id: true },
    });
    // compat: первое human-открытие денормализуем в Message.openedAt (source-of-truth — MessageEvent).
    await prisma.message.updateMany({ where: { id: messageId, openedAt: null }, data: { openedAt: new Date() } });
    // M13-4: триггер OPENED — scoped к кампании сообщения, идемпотентно по event id. Только на ПЕРВОЕ открытие.
    await runWorkflows({ orgId: msg.lead.orgId, trigger: 'OPENED', leadId: msg.leadId, campaignId: msg.campaignId, eventId: ev.id, idempotencyKey: `open:${ev.id}` }).catch(() => undefined);
    return 'recorded';
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return 'duplicate'; // уже открыто — идемпотентно, no-op
    throw e;
  }
}

const stripBrackets = (s: string) => s.trim().replace(/^<+/, '').replace(/>+$/, '').trim();

/**
 * M13-4: приём bounce от провайдера. Находим КОНКРЕТНОЕ отскочившее outbound (по providerMessageId),
 * пишем BOUNCED MessageEvent и запускаем триггер BOUNCED scoped к кампании ЭТОГО сообщения (а не ко всем
 * кампаниям лида). Идемпотентно (повтор того же события не плодит дубль/второй WorkflowRun).
 */
export async function recordBounceEvent(params: { providerMessageId: string; bounceType?: string | null; reason?: string | null; providerEventId?: string | null }): Promise<'recorded' | 'duplicate' | 'unknown'> {
  const pid = stripBrackets(params.providerMessageId);
  if (!pid) return 'unknown';
  const msg = await prisma.message.findFirst({
    where: { direction: 'OUTBOUND', providerMessageId: pid },
    select: { id: true, leadId: true, campaignLeadId: true, campaignId: true, lead: { select: { orgId: true } } },
  });
  if (!msg) return 'unknown';
  const dedupe = params.providerEventId ?? 'bounce';
  try {
    const ev = await prisma.messageEvent.create({
      data: {
        messageId: msg.id, type: 'BOUNCED', dedupeKey: dedupe, providerEventId: params.providerEventId ?? null, occurredAt: new Date(),
        meta: { bounceType: params.bounceType ?? null, reason: (params.reason ?? '').slice(0, 500) },
        leadId: msg.leadId, campaignLeadId: msg.campaignLeadId, campaignId: msg.campaignId,
      },
      select: { id: true },
    });
    await runWorkflows({ orgId: msg.lead.orgId, trigger: 'BOUNCED', leadId: msg.leadId, campaignId: msg.campaignId, eventId: ev.id, idempotencyKey: `bounce:${ev.id}` }).catch(() => undefined);
    return 'recorded';
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return 'duplicate';
    throw e;
  }
}
