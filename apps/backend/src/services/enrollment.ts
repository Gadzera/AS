/**
 * M11-3/M11-4: пауза/возобновление enrollment'а (CampaignLead).
 * Единый источник логики для per-lead (M11-3) и campaign-level (M11-4) pause/resume.
 *
 * Принцип (директива GPT к M11-1): стоп/пауза сигнализируется СТАТУСОМ, nextSendAt — только расписание.
 * При resume сохраняем «остаток ожидания» до следующего шага: сдвигаем nextSendAt на длительность паузы.
 * Clamp к окну отправки и исключение паузы из возраста warmup — M11-4/M11-6.
 */
import { PrismaClient, ActivityType } from '@prisma/client';
import { clampToSendWindow } from '../lib/sendWindow';

const prisma = new PrismaClient();

// Поставить на паузу можно только enrollment, который реально идёт (PENDING/ACTIVE).
// Терминальные (COMPLETED/STOPPED) и REPLIED (ждёт человека) не паузим.
const PAUSEABLE = ['PENDING', 'ACTIVE'];

export interface EnrollmentActionResult {
  ok: boolean;
  reason?: string;
  status?: string;
  nextSendAt?: Date | null;
}

/** Пауза одного enrollment'а: → PAUSED + pausedAt. nextSendAt не трогаем (на resume сдвинем). Идемпотентно. */
export async function pauseEnrollment(campaignLeadId: string): Promise<EnrollmentActionResult> {
  const cl = await prisma.campaignLead.findUnique({ where: { id: campaignLeadId }, select: { status: true, nextSendAt: true } });
  if (!cl) return { ok: false, reason: 'not_found' };
  if (cl.status === 'PAUSED') return { ok: true, status: 'PAUSED', nextSendAt: cl.nextSendAt }; // уже на паузе
  if (!PAUSEABLE.includes(cl.status)) return { ok: false, reason: `cannot pause from ${cl.status}` };
  const updated = await prisma.campaignLead.update({
    where: { id: campaignLeadId },
    data: { status: 'PAUSED', pausedAt: new Date() },
    select: { status: true, nextSendAt: true },
  });
  return { ok: true, status: updated.status, nextSendAt: updated.nextSendAt };
}

/**
 * Возобновление: PAUSED → ACTIVE, сдвиг расписания на длительность паузы (сохраняем остаток до шага),
 * pausedAt очищаем. Если срок уже наступил/расписания не было — слать сейчас.
 */
export async function resumeEnrollment(campaignLeadId: string): Promise<EnrollmentActionResult> {
  const cl = await prisma.campaignLead.findUnique({
    where: { id: campaignLeadId },
    select: { status: true, pausedAt: true, nextSendAt: true, campaign: { select: { org: { select: { sendWindowStart: true, sendWindowEnd: true, sendDays: true, timezone: true } } } } },
  });
  if (!cl) return { ok: false, reason: 'not_found' };
  if (cl.status !== 'PAUSED') return { ok: false, reason: `not_paused:${cl.status}` };

  const now = new Date();
  const pauseTime = cl.pausedAt ?? now;
  const pausedMs = Math.max(0, now.getTime() - pauseTime.getTime());
  // Если на момент паузы следующий шаг был ещё в будущем — сохраняем остаток, сдвигая на длительность паузы.
  // Иначе (срок уже был/нет расписания) — возобновляем немедленно.
  let next = cl.nextSendAt && cl.nextSendAt.getTime() > pauseTime.getTime()
    ? new Date(cl.nextSendAt.getTime() + pausedMs)
    : now;

  // Clamp к окну отправки орг-таймзоны: возобновлённый шаг не уйдёт ночью/в выходной.
  const org = cl.campaign.org;
  next = clampToSendWindow(next, {
    start: org.sendWindowStart, end: org.sendWindowEnd,
    days: org.sendDays.split(',').map((d) => Number(d.trim())).filter((n) => n >= 1 && n <= 7),
    timeZone: org.timezone,
  });

  const updated = await prisma.campaignLead.update({
    where: { id: campaignLeadId },
    data: { status: 'ACTIVE', pausedAt: null, nextSendAt: next },
    select: { status: true, nextSendAt: true },
  });
  return { ok: true, status: updated.status, nextSendAt: updated.nextSendAt };
}

/**
 * Единая аудит-запись паузы/возобновления enrollment'а. Используется и per-lead (M11-3),
 * и campaign-level (M11-4) → одинаковый формат события в таймлайне Lead 360.
 */
const AUDIT_META: Record<'pause' | 'resume' | 'enroll' | 'unenroll', { type: ActivityType; verb: string }> = {
  pause: { type: ActivityType.SEQUENCE_PAUSED, verb: 'paused' },
  resume: { type: ActivityType.SEQUENCE_RESUMED, verb: 'resumed' },
  enroll: { type: ActivityType.SEQUENCE_ENROLLED, verb: 'enrolled' },
  unenroll: { type: ActivityType.SEQUENCE_EXITED, verb: 'exited' },
};

export async function writeEnrollmentAudit(params: {
  action: 'pause' | 'resume' | 'enroll' | 'unenroll';
  orgId: string; actorId: string | null; leadId: string; campaignId: string;
  campaignLeadId: string; campaignName: string;
  lead: { firstName: string; lastName: string };
  nextSendAt: Date | null;
}): Promise<void> {
  const { action, orgId, actorId, leadId, campaignId, campaignLeadId, campaignName, lead, nextSendAt } = params;
  const { type, verb } = AUDIT_META[action];
  await prisma.activity.create({
    data: {
      orgId, actorId, type,
      title: `Sequence ${verb} · ${campaignName}`,
      body: `${lead.firstName} ${lead.lastName} ${verb} in “${campaignName}”${nextSendAt ? ` — next send ${nextSendAt.toISOString()}` : ''}`,
      payload: { leadId, campaignId, campaignLeadId, action, nextSendAt: nextSendAt?.toISOString() ?? null },
    },
  });
}

/**
 * M11-7: зачисление лида в кампанию (единый источник для single и bulk enroll). Идемпотентно
 * (already_enrolled → пропуск). Пишет аудит SEQUENCE_ENROLLED. PENDING + nextSendAt (если кампания ACTIVE).
 */
export async function enrollLeadInCampaign(params: {
  orgId: string; leadId: string; actorId: string | null;
  campaign: { id: string; name: string; status: string };
}): Promise<{ ok: boolean; reason?: string }> {
  const { orgId, leadId, actorId, campaign } = params;
  const existing = await prisma.campaignLead.findFirst({ where: { campaignId: campaign.id, leadId }, select: { id: true } });
  if (existing) return { ok: false, reason: 'already_enrolled' };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { firstName: true, lastName: true } });
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  const nextSendAt = campaign.status === 'ACTIVE' ? new Date() : null;
  const cl = await prisma.campaignLead.create({ data: { campaignId: campaign.id, leadId, currentStep: 0, status: 'PENDING', nextSendAt } });
  await writeEnrollmentAudit({ action: 'enroll', orgId, actorId, leadId, campaignId: campaign.id, campaignLeadId: cl.id, campaignName: campaign.name, lead, nextSendAt });
  return { ok: true };
}

/**
 * M17-4: вывод лида из кампании (shared-сервис для workflow UNENROLL_SEQUENCE — НЕ писать CampaignLead напрямую).
 * Идемпотентно (not_enrolled/already_exited → пропуск). campaignLead → STOPPED(SEQUENCE_EXITED), аудит SEQUENCE_EXITED.
 */
export async function unenrollLeadFromCampaign(params: {
  orgId: string; leadId: string; actorId: string | null;
  campaign: { id: string; name: string };
}): Promise<{ ok: boolean; reason?: string }> {
  const { orgId, leadId, actorId, campaign } = params;
  const cl = await prisma.campaignLead.findFirst({ where: { campaignId: campaign.id, leadId }, select: { id: true, status: true } });
  if (!cl) return { ok: false, reason: 'not_enrolled' };
  if (cl.status === 'STOPPED') return { ok: false, reason: 'already_exited' };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { firstName: true, lastName: true } });
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'STOPPED', stopReason: 'SEQUENCE_EXITED', nextSendAt: null } });
  await writeEnrollmentAudit({ action: 'unenroll', orgId, actorId, leadId, campaignId: campaign.id, campaignLeadId: cl.id, campaignName: campaign.name, lead, nextSendAt: null });
  return { ok: true };
}

/**
 * M11-4: пауза ВСЕЙ кампании. Переиспользует per-lead pauseEnrollment (нота GPT — один сервис,
 * без расхождений). Каждый затронутый enrollment паузится и аудитится. Кампания → PAUSED + pausedAt
 * (для исключения простоя из возраста warmup на resume). Возвращает число затронутых.
 */
export async function pauseCampaign(campaignId: string, actorId: string | null): Promise<{ ok: boolean; affected: number }> {
  const camp = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { orgId: true, name: true, status: true } });
  if (!camp) return { ok: false, affected: 0 };
  const targets = await prisma.campaignLead.findMany({
    where: { campaignId, status: { in: ['PENDING', 'ACTIVE'] } },
    select: { id: true, leadId: true, lead: { select: { firstName: true, lastName: true } } },
  });
  let affected = 0;
  for (const t of targets) {
    const r = await pauseEnrollment(t.id);
    if (r.ok) {
      affected++;
      await writeEnrollmentAudit({ action: 'pause', orgId: camp.orgId, actorId, leadId: t.leadId, campaignId, campaignLeadId: t.id, campaignName: camp.name, lead: t.lead, nextSendAt: null });
    }
  }
  // Кампания на паузу: pausedAt=now (если ещё не стояла). status=PAUSED.
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED', pausedAt: new Date() } });
  return { ok: true, affected };
}

/**
 * M11-4: возобновление ВСЕЙ кампании. Переиспущает per-lead resumeEnrollment (сдвиг+clamp на каждый
 * enrollment) + аудит. Кампания → ACTIVE, простой (now - pausedAt) копится в pausedDaysAccum и
 * исключается из возраста warmup. Возвращает число затронутых.
 */
export async function resumeCampaign(campaignId: string, actorId: string | null): Promise<{ ok: boolean; affected: number }> {
  const camp = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { orgId: true, name: true, pausedAt: true } });
  if (!camp) return { ok: false, affected: 0 };
  const targets = await prisma.campaignLead.findMany({
    where: { campaignId, status: 'PAUSED' },
    select: { id: true, leadId: true, lead: { select: { firstName: true, lastName: true } } },
  });
  let affected = 0;
  for (const t of targets) {
    const r = await resumeEnrollment(t.id);
    if (r.ok) {
      affected++;
      await writeEnrollmentAudit({ action: 'resume', orgId: camp.orgId, actorId, leadId: t.leadId, campaignId, campaignLeadId: t.id, campaignName: camp.name, lead: t.lead, nextSendAt: r.nextSendAt ?? null });
    }
  }
  // Исключаем простой из возраста warmup: pausedDaysAccum += (now - pausedAt) в днях.
  const pausedDays = camp.pausedAt ? Math.max(0, (Date.now() - camp.pausedAt.getTime()) / 86_400_000) : 0;
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE', pausedAt: null, pausedDaysAccum: { increment: pausedDays } } });
  return { ok: true, affected };
}
