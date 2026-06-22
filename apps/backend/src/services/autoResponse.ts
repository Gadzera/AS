/**
 * M14-5: auto-response rules (autopilot). На каждый входящий ответ агент решает — авто-ответить или
 * передать человеку. Автопилот разрешён ТОЛЬКО для безопасных: canAutopilot=true + riskLevel=LOW + ТОЧНАЯ
 * атрибуция + confidence ≥ порога. Всё остальное (high-risk/low-conf/fallback/unsubscribe/negative) → human
 * handoff БЕЗ отправки (+ notification). Отправка — тем же sendApprovedReply/M12-lifecycle (нота GPT M14-4),
 * только approver = система (null). Идемпотентно: повтор не шлёт второй ответ.
 */
import { PrismaClient, NotificationSource } from '@prisma/client';
import { generateOrRegenerateDraft } from './replyDraft';
import { sendApprovedReply } from './replySend';

const prisma = new PrismaClient();

// «Точная» атрибуция — по заголовкам треда (не fallback/none).
const EXACT_MODES = new Set(['header_in_reply_to', 'header_references', 'thread_id']);

export interface AutopilotDecision { eligible: boolean; reason: string }

/** Чистое решение автопилота (поверх backend-risk: ещё exact attribution + порог уверенности). */
export function evaluateAutopilot(p: {
  minConfidence: number; canAutopilot: boolean; riskLevel: string; attributionMode: string | null; intentConfidence: number | null;
}): AutopilotDecision {
  if (!p.canAutopilot) return { eligible: false, reason: 'not_autopilot_eligible' }; // high-risk/unsub/negative/fallback/low-conf уже отсечены risk-движком
  if (p.riskLevel !== 'LOW') return { eligible: false, reason: 'risk_not_low' };
  if (!p.attributionMode || !EXACT_MODES.has(p.attributionMode)) return { eligible: false, reason: 'attribution_not_exact' };
  if ((p.intentConfidence ?? 0) < p.minConfidence) return { eligible: false, reason: 'below_confidence_threshold' };
  return { eligible: true, reason: 'eligible' };
}

export type AutoResponseAction = 'auto_sent' | 'handoff' | 'skipped' | 'failed';

export async function maybeAutoRespond(orgId: string, inboundMessageId: string): Promise<{ action: AutoResponseAction; reason: string; draftId?: string; messageId?: string }> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { autoResponseEnabled: true, autoResponseMinConfidence: true } });
  if (!org?.autoResponseEnabled) return { action: 'skipped', reason: 'autopilot_disabled' }; // выключен → ручной поток M14-3

  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, direction: 'INBOUND', lead: { orgId } },
    select: { id: true, intentConfidence: true, attributionMode: true, leadId: true, handledAt: true },
  });
  if (!inbound) return { action: 'skipped', reason: 'inbound_not_found' };
  if (inbound.handledAt) return { action: 'skipped', reason: 'already_handled' }; // повтор/уже обработан

  // Черновик: контекст + backend-risk + canAutopilot. Идемпотентно (один активный DRAFT на reply).
  const gen = await generateOrRegenerateDraft(orgId, inboundMessageId);
  if (!gen.ok || !gen.draftId) return { action: 'skipped', reason: gen.reason ?? 'draft_failed' };
  const draft = await prisma.replyDraft.findUnique({ where: { id: gen.draftId }, select: { id: true, status: true, canAutopilot: true, riskLevel: true, riskFlags: true } });
  if (!draft) return { action: 'skipped', reason: 'draft_missing' };
  if (draft.status === 'SENT') return { action: 'skipped', reason: 'already_sent' }; // повтор — уже авто-отправлен

  const decision = evaluateAutopilot({ minConfidence: org.autoResponseMinConfidence, canAutopilot: draft.canAutopilot, riskLevel: draft.riskLevel, attributionMode: inbound.attributionMode, intentConfidence: inbound.intentConfidence });

  const leadName = await leadLabel(inbound.leadId);

  if (decision.eligible) {
    // origin=AUTOPILOT, отправка тем же sendApprovedReply, approver=null (система/агент).
    await prisma.replyDraft.update({ where: { id: draft.id }, data: { origin: 'AUTOPILOT' } });
    const sent = await sendApprovedReply(orgId, draft.id, null);
    if (sent.ok) return { action: 'auto_sent', reason: 'eligible', draftId: draft.id, messageId: sent.messageId };
    // failed auto-send: origin остаётся AUTOPILOT (Reports.failedAutoSend), но человека УВЕДОМЛЯЕМ (draft не потерян).
    await notifyHuman(orgId, inbound.id, inbound.leadId, `Auto-send failed — ${leadName}`, `Autopilot could not send this reply (${sent.reason}). Review and send manually in Replies.`, `reply_autofail:${inbound.id}`);
    return { action: 'failed', reason: sent.reason ?? 'send_failed', draftId: draft.id };
  }

  // Не eligible → human handoff: draft=HANDOFF (ждёт approval), нотификация (dedupe), БЕЗ отправки.
  await prisma.replyDraft.update({ where: { id: draft.id }, data: { origin: 'HANDOFF' } });
  await notifyHuman(orgId, inbound.id, inbound.leadId, `Reply needs human approval — ${leadName}`, `Auto-response held (${decision.reason}${draft.riskFlags.length ? `: ${draft.riskFlags.join(', ')}` : ''}). Review and approve in Replies.`, `reply_handoff:${inbound.id}`);
  return { action: 'handoff', reason: decision.reason, draftId: draft.id };
}

async function leadLabel(leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true } });
  return `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() || 'lead';
}

// Уведомление человеку (handoff / failed auto-send) — идемпотентно по dedupeKey.
async function notifyHuman(orgId: string, inboundId: string, leadId: string, title: string, body: string, dedupeKey: string): Promise<void> {
  const existing = await prisma.notification.findFirst({ where: { orgId, dedupeKey }, select: { id: true } });
  if (existing) return;
  await prisma.notification.create({
    data: { orgId, source: NotificationSource.REPLY, title, body, leadId, entityType: 'reply', entityId: inboundId, dedupeKey },
  });
}
