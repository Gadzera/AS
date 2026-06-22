/**
 * M15-3: пакет передачи человеку/AE. Собирается из РЕАЛЬНЫХ источников (lead/company/inbound reply/linked
 * outbound/campaign/intent+confidence/risk flags/draft/meeting) и ПЕРСИСТИТСЯ как сущность HandoffPackage
 * (не UI-текст). Идемпотентность по replyMessageId (@unique). Содержит summary, thread snapshot, recommended
 * next step, source campaign, attribution quality, risk flags. Назначение — реальный AE (User) или Unassigned.
 * Аудит: created/updated/viewed/assigned/handed_off (Activity HANDOFF_PACKAGE, action в payload). Без дублей нотификаций.
 */
import { PrismaClient, ActivityType, ReplyClass, MeetingOutcome } from '@prisma/client';

const prisma = new PrismaClient();

const EXACT_MODES = new Set(['header_in_reply_to', 'header_references', 'thread_id']);
function attributionQuality(mode: string | null): 'exact' | 'fallback' | 'manual' | 'unknown' {
  if (!mode) return 'unknown';
  if (EXACT_MODES.has(mode)) return 'exact';
  if (mode === 'fallback_last_outbound') return 'fallback';
  if (mode === 'manual') return 'manual';
  return 'unknown';
}

// Рекомендованный следующий шаг — из реального intent/risk/meeting+outcome (grounded, без LLM).
function recommendNextStep(p: { intent: ReplyClass | null; riskFlags: string[]; hasMeeting: boolean; meetingWhen?: Date | null; meetingOutcome?: MeetingOutcome | null }): string {
  // M15-4: если встреча уже состоялась/закрыта — следующий шаг отражает исход.
  if (p.meetingOutcome) {
    if (p.meetingOutcome === 'QUALIFIED') return 'Qualified — move to proposal and align on the close plan.';
    if (p.meetingOutcome === 'NOT_QUALIFIED') return 'Not qualified — disqualify and capture the reason.';
    if (p.meetingOutcome === 'NO_SHOW') return 'No-show — re-engage and propose a new time.';
    if (p.meetingOutcome === 'SHOWED') return 'Meeting happened — log the outcome and confirm next steps.';
    if (p.meetingOutcome === 'CANCELED') return 'Meeting canceled — re-propose a time.';
  }
  if (p.hasMeeting) return `Prep for the booked call${p.meetingWhen ? ` on ${p.meetingWhen.toISOString().slice(0, 16).replace('T', ' ')}` : ''} — review account context and tailor the agenda.`;
  if (p.intent === 'UNSUBSCRIBE') return 'Suppress the contact (compliance) — do not reply.';
  const sensitive = p.riskFlags.filter((f) => f === 'asks_for_pricing' || f === 'asks_for_legal' || f === 'asks_for_security');
  if (sensitive.length) return `Loop in the right owner for ${sensitive.map((f) => f.replace('asks_for_', '')).join(' / ')} before replying, then propose a call.`;
  if (p.intent === 'NOT_INTERESTED') return 'Handle the objection or disqualify — capture the reason.';
  if (p.intent === 'INTERESTED') return 'Book a meeting (or approve the AI reply) and propose two time slots.';
  if (p.intent === 'FOLLOW_UP') return 'Confirm timing and schedule a nurture follow-up.';
  return 'Review the reply and decide the next step.';
}

function buildSummary(p: { leadName: string; title: string | null; company: string | null; intent: ReplyClass | null; conf: number | null; campaignName: string | null; quality: string; outboundSubject: string | null; riskFlags: string[]; hasMeeting: boolean; meetingOutcome?: MeetingOutcome | null }): string {
  const who = `${p.leadName}${p.title ? `, ${p.title}` : ''}${p.company ? ` at ${p.company}` : ''}`;
  const intent = p.intent ? p.intent.replace('_', ' ').toLowerCase() : 'unclassified';
  const conf = p.conf != null ? ` (${Math.round(p.conf * 100)}% conf)` : '';
  const camp = p.campaignName ? ` from “${p.campaignName}” (${p.quality} attribution)` : '';
  const re = p.outboundSubject ? `, replying to “${p.outboundSubject}”` : '';
  const risk = p.riskFlags.length ? ` Flags: ${p.riskFlags.join(', ')}.` : '';
  // M15-4: исход встречи важнее статуса «booked».
  const mtg = p.meetingOutcome ? ` Meeting outcome: ${p.meetingOutcome.replace('_', ' ').toLowerCase()}.` : p.hasMeeting ? ' A meeting is already booked.' : '';
  return `${who} replied ${intent}${conf}${camp}${re}.${risk}${mtg}`.trim();
}

export interface HandoffResult { ok: boolean; reason?: string; handoffId?: string; created?: boolean; updated?: boolean }

/** Собрать-или-получить пакет передачи по входящему ответу (идемпотентно). */
export async function getOrBuildHandoff(orgId: string, replyMessageId: string, userId: string): Promise<HandoffResult> {
  const inbound = await prisma.message.findFirst({
    where: { id: replyMessageId, direction: 'INBOUND', lead: { orgId } },
    select: { id: true, leadId: true, campaignId: true, campaignLeadId: true, replyToMessageId: true, attributionMode: true, replyClass: true, intentConfidence: true, body: true, repliedAt: true, createdAt: true, lead: { select: { firstName: true, lastName: true, title: true, company: true } } },
  });
  if (!inbound) return { ok: false, reason: 'reply_not_found' };

  const [outbound, draft, meeting, campaign, threadMsgs] = await Promise.all([
    inbound.replyToMessageId ? prisma.message.findUnique({ where: { id: inbound.replyToMessageId }, select: { id: true, subject: true, body: true, sentAt: true } }) : Promise.resolve(null),
    prisma.replyDraft.findFirst({ where: { inboundMessageId: inbound.id }, orderBy: { createdAt: 'desc' }, select: { id: true, riskFlags: true, riskLevel: true } }),
    prisma.meeting.findFirst({ where: { replyMessageId: inbound.id, archivedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, scheduledAt: true, status: true, outcomeType: true } }),
    inbound.campaignId ? prisma.campaign.findUnique({ where: { id: inbound.campaignId }, select: { name: true } }) : Promise.resolve(null),
    prisma.message.findMany({ where: { leadId: inbound.leadId }, orderBy: { createdAt: 'asc' }, take: 8, select: { direction: true, subject: true, body: true, sentAt: true, repliedAt: true, createdAt: true } }),
  ]);

  const leadName = `${inbound.lead.firstName} ${inbound.lead.lastName}`.trim();
  const riskFlags = draft?.riskFlags ?? [];
  const quality = attributionQuality(inbound.attributionMode);
  const summary = buildSummary({ leadName, title: inbound.lead.title, company: inbound.lead.company, intent: inbound.replyClass, conf: inbound.intentConfidence, campaignName: campaign?.name ?? null, quality, outboundSubject: outbound?.subject ?? null, riskFlags, hasMeeting: !!meeting, meetingOutcome: meeting?.outcomeType ?? null });
  const recommendedNextStep = recommendNextStep({ intent: inbound.replyClass, riskFlags, hasMeeting: !!meeting, meetingWhen: meeting?.scheduledAt ?? null, meetingOutcome: meeting?.outcomeType ?? null });
  const threadSnapshot = threadMsgs.map((m) => ({ direction: m.direction, subject: m.subject, body: (m.body || '').replace(/<[^>]+>/g, ' ').slice(0, 400), at: (m.sentAt ?? m.repliedAt ?? m.createdAt).toISOString() }));

  const data = {
    orgId, replyMessageId: inbound.id, leadId: inbound.leadId, campaignId: inbound.campaignId, sourceMessageId: inbound.replyToMessageId,
    replyDraftId: draft?.id ?? null, meetingId: meeting?.id ?? null, intent: inbound.replyClass, intentConfidence: inbound.intentConfidence,
    attributionMode: inbound.attributionMode, riskFlags, riskLevel: draft?.riskLevel ?? null, summary, recommendedNextStep, threadSnapshot,
  };

  const existing = await prisma.handoffPackage.findUnique({ where: { replyMessageId: inbound.id }, select: { id: true, recommendedNextStep: true, meetingId: true, riskLevel: true, summary: true } });
  if (!existing) {
    const created = await prisma.handoffPackage.create({ data: { ...data, createdById: userId }, select: { id: true } });
    await audit(orgId, userId, created.id, 'created', inbound.id, inbound.leadId, inbound.campaignId, inbound.attributionMode);
    return { ok: true, handoffId: created.id, created: true };
  }
  // материальное изменение (встреча/риск/шаг/summary) → обновить + audit updated; иначе идемпотентно вернуть.
  const changed = existing.meetingId !== data.meetingId || existing.riskLevel !== data.riskLevel || existing.recommendedNextStep !== data.recommendedNextStep || existing.summary !== data.summary;
  if (changed) {
    await prisma.handoffPackage.update({ where: { id: existing.id }, data });
    await audit(orgId, userId, existing.id, 'updated', inbound.id, inbound.leadId, inbound.campaignId, inbound.attributionMode);
    return { ok: true, handoffId: existing.id, created: false, updated: true };
  }
  return { ok: true, handoffId: existing.id, created: false, updated: false };
}

/** Назначить пакет реальному AE (User в org) или снять назначение (assigneeId=null). */
export async function assignHandoff(orgId: string, handoffId: string, assigneeId: string | null, userId: string): Promise<HandoffResult> {
  const hp = await prisma.handoffPackage.findFirst({ where: { id: handoffId, orgId }, select: { id: true, replyMessageId: true, leadId: true } });
  if (!hp) return { ok: false, reason: 'handoff_not_found' };
  if (assigneeId) {
    const u = await prisma.user.findFirst({ where: { id: assigneeId, orgId }, select: { id: true } });
    if (!u) return { ok: false, reason: 'assignee_not_in_org' };
  }
  await prisma.handoffPackage.update({ where: { id: hp.id }, data: { assigneeId, status: assigneeId ? 'ASSIGNED' : 'OPEN' } });
  await audit(orgId, userId, hp.id, assigneeId ? 'assigned' : 'unassigned', hp.replyMessageId, hp.leadId, null, null, { assigneeId });
  return { ok: true, handoffId: hp.id };
}

/** Отметить просмотр (один раз — без спама в аудите). */
export async function markHandoffViewed(orgId: string, handoffId: string, userId: string): Promise<void> {
  const hp = await prisma.handoffPackage.findFirst({ where: { id: handoffId, orgId }, select: { id: true, viewedAt: true, replyMessageId: true, leadId: true } });
  if (!hp || hp.viewedAt) return;
  await prisma.handoffPackage.update({ where: { id: hp.id }, data: { viewedAt: new Date() } });
  await audit(orgId, userId, hp.id, 'viewed', hp.replyMessageId, hp.leadId, null, null);
}

/** Явная передача (handed off) — статус + нотификация (deduped, без дублей на тот же reply). */
export async function handOffToHuman(orgId: string, handoffId: string, userId: string): Promise<HandoffResult> {
  const hp = await prisma.handoffPackage.findFirst({ where: { id: handoffId, orgId }, select: { id: true, replyMessageId: true, leadId: true, assigneeId: true, handedOffAt: true } });
  if (!hp) return { ok: false, reason: 'handoff_not_found' };
  if (!hp.handedOffAt) {
    await prisma.handoffPackage.update({ where: { id: hp.id }, data: { status: 'HANDED_OFF', handedOffAt: new Date() } });
    await audit(orgId, userId, hp.id, 'handed_off', hp.replyMessageId, hp.leadId, null, null, { assigneeId: hp.assigneeId });
  }
  // нотификация — идемпотентно по dedupeKey (без дублей на тот же reply handoff).
  const lead = await prisma.lead.findUnique({ where: { id: hp.leadId }, select: { firstName: true, lastName: true } });
  const dedupeKey = `handoff_package:${hp.replyMessageId}`;
  const exists = await prisma.notification.findFirst({ where: { orgId, dedupeKey }, select: { id: true } });
  if (!exists) {
    await prisma.notification.create({ data: { orgId, source: 'REPLY' as any, title: `Reply handed off — ${`${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() || 'lead'}`, body: 'A reply was handed off to a human. Open the handoff package in Replies.', leadId: hp.leadId, entityType: 'reply', entityId: hp.replyMessageId, dedupeKey } });
  }
  return { ok: true, handoffId: hp.id };
}

async function audit(orgId: string, userId: string, handoffId: string, action: string, replyMessageId: string, leadId: string, campaignId: string | null, attributionMode: string | null, extra?: Record<string, unknown>): Promise<void> {
  await prisma.activity.create({
    data: { orgId, actorId: userId, type: ActivityType.HANDOFF_PACKAGE, title: `Handoff package ${action}`, body: `Handoff package ${action}`, payload: { action, handoffId, replyMessageId, leadId, campaignId, attributionMode, ...(extra ?? {}) } },
  });
}
