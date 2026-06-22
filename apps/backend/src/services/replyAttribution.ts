/**
 * M13-3: атрибуция входящего ответа к КОНКРЕТНОМУ outbound Message.
 * Приоритет: In-Reply-To → References → thread-id (по нормализованному providerMessageId), затем
 * degraded fallback на lastOutbound (ЯВНО помеченный attributionMode='fallback_last_outbound').
 * ingestInboundReply: полный конвейер — резолв лида, идемпотентность, атрибуция, INBOUND Message с
 * привязкой (replyToMessageId/campaignLeadId/campaignId/attributionMode), REPLIED MessageEvent на
 * outbound, классификация, статус лида и запуск REPLY_RECEIVED от атрибутированной кампании (без дублей).
 */
import { PrismaClient, ReplyClass } from '@prisma/client';
import { classifyReplyIntent } from './claude';
import { runWorkflows, fireLeadUnsubscribed } from './workflows';
import { maybeAutoRespond } from './autoResponse';

const prisma = new PrismaClient();

export type AttributionMode = 'header_in_reply_to' | 'header_references' | 'thread_id' | 'fallback_last_outbound' | 'none';
export interface ReplyAttribution {
  outboundMessageId: string | null;
  campaignLeadId: string | null;
  campaignId: string | null;
  mode: AttributionMode;
}

const LEAD_STATUS_BY_CLASS: Record<string, 'HOT' | 'LOST' | 'REPLIED' | 'UNSUBSCRIBED'> = {
  INTERESTED: 'HOT', NOT_INTERESTED: 'LOST', FOLLOW_UP: 'REPLIED', UNSUBSCRIBE: 'UNSUBSCRIBED',
};

/** Нормализовать Message-ID из заголовка: снять угловые скобки/пробелы. */
export function normalizeMessageId(id?: string | null): string | null {
  if (!id) return null;
  const t = id.trim().replace(/^<+/, '').replace(/>+$/, '').trim();
  return t || null;
}

/** Атрибутировать ответ по заголовкам треда (точно), иначе degraded lastOutbound (помечено). */
export async function attributeReply(params: {
  orgId: string; leadId: string; inReplyTo?: string | null; references?: string | null; threadId?: string | null;
}): Promise<ReplyAttribution> {
  const { orgId, leadId } = params;
  const inReplyTo = normalizeMessageId(params.inReplyTo);
  const refs = (params.references ?? '').split(/[\s,]+/).map(normalizeMessageId).filter(Boolean) as string[];
  const threadId = normalizeMessageId(params.threadId);

  const findOutboundByProviderId = (pid: string) => prisma.message.findFirst({
    where: { direction: 'OUTBOUND', providerMessageId: pid, lead: { orgId } },
    orderBy: { sentAt: 'desc' },
    select: { id: true, campaignLeadId: true, campaignId: true },
  });

  // 1. In-Reply-To — самый точный признак.
  if (inReplyTo) {
    const m = await findOutboundByProviderId(inReplyTo);
    if (m) return { outboundMessageId: m.id, campaignLeadId: m.campaignLeadId, campaignId: m.campaignId, mode: 'header_in_reply_to' };
  }
  // 2. References — любой из id треда.
  for (const ref of refs) {
    const m = await findOutboundByProviderId(ref);
    if (m) return { outboundMessageId: m.id, campaignLeadId: m.campaignLeadId, campaignId: m.campaignId, mode: 'header_references' };
  }
  // 3. thread-id провайдера (если ESP даёт его как providerMessageId).
  if (threadId) {
    const m = await findOutboundByProviderId(threadId);
    if (m) return { outboundMessageId: m.id, campaignLeadId: m.campaignLeadId, campaignId: m.campaignId, mode: 'thread_id' };
  }
  // 4. DEGRADED fallback: последнее исходящее касание лида (явно помечаем как эвристику). НЕ требуем
  // campaignId — ответ засчитываем в любом случае (кампания проставится, если у касания она есть).
  const last = await prisma.message.findFirst({
    where: { leadId, direction: 'OUTBOUND' },
    orderBy: { sentAt: 'desc' },
    select: { id: true, campaignLeadId: true, campaignId: true },
  });
  if (last) return { outboundMessageId: last.id, campaignLeadId: last.campaignLeadId, campaignId: last.campaignId, mode: 'fallback_last_outbound' };
  return { outboundMessageId: null, campaignLeadId: null, campaignId: null, mode: 'none' };
}

export interface IngestResult {
  ok: boolean;
  reason?: string;
  duplicate?: boolean;
  inboundMessageId?: string;
  attribution?: ReplyAttribution;
  replyClass?: ReplyClass;
  workflowsTriggered?: number;
  autoResponse?: { action: string; reason: string; draftId?: string; messageId?: string };
}

/** Принять входящий ответ: атрибуция по заголовкам + INBOUND + REPLIED event + классификация + workflow. */
export async function ingestInboundReply(params: {
  orgId: string; leadId?: string; fromEmail?: string; body: string;
  inReplyTo?: string | null; references?: string | null; threadId?: string | null; providerMessageId?: string | null;
}): Promise<IngestResult> {
  const { orgId, body } = params;

  // Резолв лида: по leadId (в рамках org) или по fromEmail.
  const lead = params.leadId
    ? await prisma.lead.findFirst({ where: { id: params.leadId, orgId }, select: { id: true } })
    : params.fromEmail
      ? await prisma.lead.findFirst({ where: { orgId, email: { equals: params.fromEmail, mode: 'insensitive' } }, select: { id: true } })
      : null;
  if (!lead) return { ok: false, reason: 'lead_not_found' };

  // Идемпотентность ingestion: тот же inbound Message-ID не принимаем дважды.
  const ownPid = normalizeMessageId(params.providerMessageId);
  if (ownPid) {
    const dup = await prisma.message.findFirst({ where: { direction: 'INBOUND', providerMessageId: ownPid, lead: { orgId } }, select: { id: true } });
    if (dup) return { ok: true, duplicate: true, inboundMessageId: dup.id };
  }

  const attribution = await attributeReply({ orgId, leadId: lead.id, inReplyTo: params.inReplyTo, references: params.references, threadId: params.threadId });
  // M14-1: intent классифицируется РОВНО один раз (при ingestion), с уверенностью; source=AUTO.
  const { intent: cls, confidence } = await classifyReplyIntent(body);
  const now = new Date();

  const inbound = await prisma.message.create({
    data: {
      leadId: lead.id, direction: 'INBOUND', channel: 'EMAIL', body, replyClass: cls, repliedAt: now,
      intentConfidence: confidence, intentClassifiedAt: now, intentSource: 'AUTO',
      providerMessageId: ownPid, // собственный Message-ID входящего (идемпотентность)
      replyToMessageId: attribution.outboundMessageId,
      campaignLeadId: attribution.campaignLeadId, campaignId: attribution.campaignId,
      attributionMode: attribution.mode,
    },
    select: { id: true },
  });

  // REPLIED MessageEvent на ВЫЧИСЛЕННОМ outbound (атрибуция события). Идемпотентность по inbound-id.
  const repliedDedupe = ownPid ?? inbound.id;
  let repliedEventId: string | null = null;
  if (attribution.outboundMessageId) {
    try {
      const ev = await prisma.messageEvent.create({
        data: {
          messageId: attribution.outboundMessageId, type: 'REPLIED', dedupeKey: repliedDedupe, occurredAt: now,
          // M14-1: исторический snapshot АВТО-классификации — human override его НЕ переписывает.
          meta: { inboundMessageId: inbound.id, attributionMode: attribution.mode, replyClass: cls, intentConfidence: confidence, intentSource: 'AUTO' },
          leadId: lead.id, campaignLeadId: attribution.campaignLeadId, campaignId: attribution.campaignId,
        },
        select: { id: true },
      });
      repliedEventId = ev.id;
    } catch (e) {
      if ((e as { code?: string })?.code !== 'P2002') throw e;
      const ex = await prisma.messageEvent.findFirst({ where: { messageId: attribution.outboundMessageId, type: 'REPLIED', dedupeKey: repliedDedupe }, select: { id: true } });
      repliedEventId = ex?.id ?? null;
    }
  }

  await prisma.lead.updateMany({ where: { id: lead.id, orgId }, data: { status: LEAD_STATUS_BY_CLASS[cls] } });

  // M13-4/M17-2: REPLY_RECEIVED от MessageEvent REPLIED; стабильный ключ reply:<eventId> (fallback inbound.id).
  const replyEventId = repliedEventId ?? inbound.id;
  const wf = await runWorkflows({ orgId, trigger: 'REPLY_RECEIVED', leadId: lead.id, campaignId: attribution.campaignId, replyClass: cls, eventId: replyEventId, idempotencyKey: `reply:${replyEventId}`, attributionMode: attribution.mode });
  // M17-2: оживлённый LEAD_UNSUBSCRIBED — genuine opt-out (inbound UNSUBSCRIBE), ключ unsub:<leadId> (at-most-once).
  if (cls === 'UNSUBSCRIBE') await fireLeadUnsubscribed(orgId, lead.id, { campaignId: attribution.campaignId });

  // M14-5: автопилот — агент сам отвечает на low-risk (через sendApprovedReply) или передаёт человеку (handoff).
  // НЕ ломает ingestion при сбое; идемпотентно (повтор ingest сюда не доходит — дедуп по providerMessageId выше).
  let autoResponse: { action: string; reason: string; draftId?: string; messageId?: string } = { action: 'skipped', reason: 'not_run' };
  try { autoResponse = await maybeAutoRespond(orgId, inbound.id); }
  catch (e) { console.warn('[autoResponse] failed for inbound', inbound.id, e); autoResponse = { action: 'failed', reason: 'exception' }; }

  return { ok: true, inboundMessageId: inbound.id, attribution, replyClass: cls, workflowsTriggered: wf.matched, autoResponse };
}

/**
 * M13-5: бэкфилл легаси INBOUND-ответов в модель MessageEvent. Для каждого входящего без привязки
 * атрибутируем (без заголовков → degraded fallback на lastOutbound), проставляем привязку на inbound и
 * создаём REPLIED MessageEvent (идемпотентно по inbound-id). Не запускает workflow (исторические данные).
 */
export async function backfillReplyEvents(orgId?: string): Promise<{ processed: number; linked: number }> {
  const inbounds = await prisma.message.findMany({
    where: { direction: 'INBOUND', replyToMessageId: null, ...(orgId ? { lead: { orgId } } : {}) },
    select: { id: true, leadId: true, createdAt: true, lead: { select: { orgId: true } } },
  });
  let linked = 0;
  for (const inb of inbounds) {
    const attr = await attributeReply({ orgId: inb.lead.orgId, leadId: inb.leadId });
    if (!attr.outboundMessageId) continue;
    await prisma.message.update({ where: { id: inb.id }, data: { replyToMessageId: attr.outboundMessageId, campaignLeadId: attr.campaignLeadId, campaignId: attr.campaignId, attributionMode: attr.mode } });
    try {
      await prisma.messageEvent.create({
        data: {
          messageId: attr.outboundMessageId, type: 'REPLIED', dedupeKey: inb.id, occurredAt: inb.createdAt,
          meta: { inboundMessageId: inb.id, attributionMode: attr.mode, backfill: true },
          leadId: inb.leadId, campaignLeadId: attr.campaignLeadId, campaignId: attr.campaignId,
        },
      });
      linked++;
    } catch (e) { if ((e as { code?: string })?.code !== 'P2002') throw e; }
  }
  return { processed: inbounds.length, linked };
}
