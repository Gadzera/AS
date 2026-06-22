/**
 * M15-4: цикл исхода встречи. Типизированный MeetingOutcome (не free-string). Исход двигает статус встречи и
 * (по явным правилам) статус лида: QUALIFIED→CONVERTED, NOT_QUALIFIED→LOST, NO_SHOW НЕ ведёт в LOST автоматически.
 * Аудит фиксирует before/after (исход, статус встречи, статус лида). Атрибуция — через meeting links (campaignId/
 * campaignLeadId на самой встрече), НЕ через повторный lastOutbound. Связанный HandoffPackage обновляется (отражает
 * исход). Идемпотентно: повтор того же исхода без изменений — no-op (без второго аудита).
 */
import { PrismaClient, MeetingOutcome, MeetingStatus, ActivityType } from '@prisma/client';
import { getOrBuildHandoff } from './handoff';

const prisma = new PrismaClient();

// Исход → статус встречи. SHOWED/QUALIFIED/NOT_QUALIFIED = встреча состоялась (COMPLETED); NO_SHOW/CANCELED — свои.
export function statusForOutcome(o: MeetingOutcome): MeetingStatus {
  if (o === 'NO_SHOW') return MeetingStatus.NO_SHOW;
  if (o === 'CANCELED') return MeetingStatus.CANCELED;
  return MeetingStatus.COMPLETED; // SHOWED / QUALIFIED / NOT_QUALIFIED
}

// Явное правило связи исхода со статусом лида. NO_SHOW/SHOWED/CANCELED — без авто-перевода.
function leadStatusForOutcome(o: MeetingOutcome): 'CONVERTED' | 'LOST' | null {
  if (o === 'QUALIFIED') return 'CONVERTED';
  if (o === 'NOT_QUALIFIED') return 'LOST';
  return null;
}

export interface OutcomeResult { ok: boolean; reason?: string; changed?: boolean; meetingStatus?: MeetingStatus; leadStatus?: string | null }

export async function setMeetingOutcome(orgId: string, meetingId: string, outcome: MeetingOutcome, userId: string): Promise<OutcomeResult> {
  const m = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId, archivedAt: null },
    select: { id: true, leadId: true, campaignId: true, campaignLeadId: true, replyMessageId: true, outcomeType: true, status: true },
  });
  if (!m) return { ok: false, reason: 'meeting_not_found' };

  const newStatus = statusForOutcome(outcome);
  // Идемпотентность: тот же исход и статус уже выставлены → ничего не меняем, без аудита.
  if (m.outcomeType === outcome && m.status === newStatus) return { ok: true, changed: false, meetingStatus: m.status };

  const lead = m.leadId ? await prisma.lead.findFirst({ where: { id: m.leadId, orgId }, select: { status: true } }) : null;
  const leadFrom = lead?.status ?? null;
  const leadTo = leadStatusForOutcome(outcome);

  await prisma.meeting.update({ where: { id: m.id }, data: { outcomeType: outcome, status: newStatus } });
  // Лид двигается ТОЛЬКО по явному правилу (через сам Meeting+его leadId, без lastOutbound-эвристики).
  if (leadTo && m.leadId) await prisma.lead.updateMany({ where: { id: m.leadId, orgId }, data: { status: leadTo } });

  // Аудит before/after. Атрибуция кампании — из meeting links (campaignId/campaignLeadId на встрече).
  await prisma.activity.create({
    data: {
      orgId, actorId: userId, type: ActivityType.MEETING_OUTCOME, title: `Meeting outcome · ${m.outcomeType ?? '—'} → ${outcome}`,
      body: `Meeting outcome set to ${outcome}`,
      payload: { meetingId: m.id, leadId: m.leadId, campaignId: m.campaignId, campaignLeadId: m.campaignLeadId, from: m.outcomeType, to: outcome, statusFrom: m.status, statusTo: newStatus, leadStatusFrom: leadFrom, leadStatusTo: leadTo ?? leadFrom },
    },
  });

  // Связанный HandoffPackage отражает исход (next step/summary обновятся; пишет 'updated' при материальном изменении).
  if (m.replyMessageId) await getOrBuildHandoff(orgId, m.replyMessageId, userId).catch(() => undefined);

  return { ok: true, changed: true, meetingStatus: newStatus, leadStatus: leadTo };
}
