/**
 * M15-2: создание встречи из заинтересованного ответа (или вручную) с АТРИБУЦИЕЙ и DB-level идемпотентностью.
 * Reply-путь: атрибуция из inbound (sourceMessageId/campaignId/campaignLeadId/replyDraftId/attributionMode),
 * idempotencyKey=`meeting-reply:<replyMessageId>` (UNIQUE) → один Meeting на reply (двойной клик/гонка → дубля нет).
 * Сайд-эффекты (lead→HOT, inbound.handledAt, audit MEETING_SCHEDULED, workflow MEETING_BOOKED) — ТОЛЬКО при
 * создании НОВОЙ встречи; на повтор возвращаем существующую с duplicate:true (без второго audit/workflow).
 * Workflow получает campaignId из АТРИБУЦИИ (не из повторного поиска lastOutbound).
 */
import { PrismaClient, ActivityType } from '@prisma/client';
import { runWorkflows } from './workflows';
import { syncMeeting } from './calendar';

const prisma = new PrismaClient();

export interface ScheduleResult { ok: boolean; reason?: string; meetingId?: string; duplicate?: boolean; workflowsTriggered?: number }

export async function scheduleMeetingFromReply(p: {
  orgId: string; replyMessageId?: string | null; leadId?: string | null;
  scheduledAt?: Date | null; durationMin?: number; title?: string; company?: string; notes?: string; createdById: string;
}): Promise<ScheduleResult> {
  const orgId = p.orgId;

  // ── атрибуция ──
  let leadId: string | null = p.leadId ?? null;
  let company: string | null = p.company ?? null;
  let campaignId: string | null = null;
  let campaignLeadId: string | null = null;
  let sourceMessageId: string | null = null;
  let replyMessageId: string | null = null;
  let replyDraftId: string | null = null;
  let attributionMode = 'manual';
  let source = 'manual';
  let leadName = '';

  if (p.replyMessageId) {
    const inbound = await prisma.message.findFirst({
      where: { id: p.replyMessageId, direction: 'INBOUND', lead: { orgId } },
      select: { id: true, leadId: true, campaignId: true, campaignLeadId: true, replyToMessageId: true, attributionMode: true, lead: { select: { firstName: true, lastName: true, company: true } } },
    });
    if (!inbound) return { ok: false, reason: 'reply_not_found' };
    // replyDraftId — ТОЛЬКО черновик ЭТОГО inbound (не «последний черновик лида»).
    const draft = await prisma.replyDraft.findFirst({ where: { inboundMessageId: inbound.id }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    leadId = inbound.leadId;
    company = company ?? inbound.lead.company ?? null;
    campaignId = inbound.campaignId;
    campaignLeadId = inbound.campaignLeadId;
    sourceMessageId = inbound.replyToMessageId;
    replyMessageId = inbound.id;
    replyDraftId = draft?.id ?? null;
    attributionMode = inbound.attributionMode ?? 'fallback_last_outbound';
    source = 'reply';
    leadName = `${inbound.lead.firstName} ${inbound.lead.lastName}`.trim();
  } else if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { firstName: true, lastName: true, company: true } });
    if (!lead) return { ok: false, reason: 'lead_not_found' };
    company = company ?? lead.company ?? null;
    leadName = `${lead.firstName} ${lead.lastName}`.trim();
  }
  // (manual без лида — standalone встреча, leadId=null — разрешено)

  const title = p.title?.trim() || (leadName ? `Intro call — ${leadName}` : 'Meeting');
  const idempotencyKey = replyMessageId ? `meeting-reply:${replyMessageId}` : null;

  // ── идемпотентность (reply): уже есть встреча на этот reply → вернуть её (без сайд-эффектов) ──
  if (idempotencyKey) {
    const existing = await prisma.meeting.findUnique({ where: { idempotencyKey }, select: { id: true } });
    if (existing) return { ok: true, meetingId: existing.id, duplicate: true };
  }

  // ── создание (на гонке create→P2002→read: дубля нет, сайд-эффекты только у победителя) ──
  let meetingId: string;
  try {
    const m = await prisma.meeting.create({
      data: {
        orgId, leadId, title, company, scheduledAt: p.scheduledAt ?? null, durationMin: p.durationMin ?? 30,
        status: 'SCHEDULED', source, notes: p.notes ?? null, createdById: p.createdById,
        campaignId, campaignLeadId, sourceMessageId, replyMessageId, replyDraftId, attributionMode, idempotencyKey,
      },
      select: { id: true },
    });
    meetingId = m.id;
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002' && idempotencyKey) {
      const ex = await prisma.meeting.findUnique({ where: { idempotencyKey }, select: { id: true } });
      if (ex) return { ok: true, meetingId: ex.id, duplicate: true }; // проигравший гонку — без сайд-эффектов
    }
    throw e;
  }

  // ── сайд-эффекты ТОЛЬКО для новой встречи ──
  await syncMeeting(orgId, meetingId).catch(() => undefined); // demo-календарь
  if (leadId) await prisma.lead.updateMany({ where: { id: leadId, orgId }, data: { status: 'HOT' } });
  // ответ оттриажирован встречей — уходит из очереди решений (только ПОСЛЕ создания встречи).
  if (replyMessageId) await prisma.message.update({ where: { id: replyMessageId }, data: { handledAt: new Date() } }).catch(() => undefined);
  await prisma.activity.create({
    data: {
      orgId, actorId: p.createdById, type: ActivityType.MEETING_SCHEDULED, title: 'Meeting scheduled',
      body: `${title}${leadName ? ` with ${leadName}` : ''}${source === 'reply' ? ' (from reply)' : ''}`,
      payload: { meetingId, leadId, replyMessageId, sourceMessageId, campaignId, campaignLeadId, replyDraftId, attributionMode, source },
    },
  });
  // Workflow MEETING_BOOKED — campaignId из АТРИБУЦИИ (reply); для manual-with-lead — fallback на lastOutbound.
  let wfCampaignId = campaignId;
  if (!wfCampaignId && leadId) {
    const lastOutbound = await prisma.message.findFirst({ where: { leadId, direction: 'OUTBOUND', campaignId: { not: null } }, orderBy: { sentAt: 'desc' }, select: { campaignId: true } });
    wfCampaignId = lastOutbound?.campaignId ?? null;
  }
  let workflowsTriggered = 0;
  // M17-2: стабильный ключ meeting:<meetingId> — одна встреча запускает правило ровно раз (любой путь).
  if (leadId) { const wf = await runWorkflows({ orgId, trigger: 'MEETING_BOOKED', leadId, campaignId: wfCampaignId, idempotencyKey: `meeting:${meetingId}` }); workflowsTriggered = wf.matched; }

  return { ok: true, meetingId, duplicate: false, workflowsTriggered };
}
