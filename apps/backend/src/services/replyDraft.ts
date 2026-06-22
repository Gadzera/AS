/**
 * M14-3: AI-черновик ответа + approval-gate. Черновик — отдельная сущность (ReplyDraft) со статусом и
 * BACKEND-DERIVED risk flags (low_confidence/fallback_attribution/unsubscribe_intent/negative_sentiment/
 * asks_for_pricing|legal|security/missing_thread_context). High-risk/low-confidence/fallback → canAutopilot=false.
 * Действия: generate/regenerate (один активный DRAFT на reply, без orphan), edit (снимок before/after),
 * approve&send (один controlled action), suppress/handoff. Всё пишет audit Activity.
 */
import { PrismaClient, ReplyClass, ReplyRiskLevel, ActivityType } from '@prisma/client';
import { generateAutoReply } from './claude';
import { llmAvailable } from './llm';
import { assertCredits, debitCredits } from './billing/ledger'; // M16-4: guard + единый ledger

const prisma = new PrismaClient();
const DRAFT_GEN_COST = 1; // M16-4: стоимость генерации AI-черновика ответа (auto-response)

export interface RiskResult { flags: string[]; level: ReplyRiskLevel; canAutopilot: boolean }

const PRICING_RE = /\bpric|\bcost|\bquote\b|budget|how much|discount|\$\s?\d/i;
const LEGAL_RE = /legal|contract|\bterms\b|gdpr|\bdpa\b|liabilit|lawyer|\bnda\b|complian|procurement/i;
const SECURITY_RE = /security|soc ?2|iso ?27|pen.?test|vulnerab|data protection|encryption|infosec/i;

/** Backend-расчёт риска черновика. Влияет на gate (canAutopilot) и UI. */
export function computeReplyRisk(p: { intent: ReplyClass | null; intentConfidence: number | null; attributionMode: string | null; inboundBody: string; hasThreadContext: boolean }): RiskResult {
  const flags: string[] = [];
  const body = p.inboundBody || '';
  if ((p.intentConfidence ?? 1) < 0.6) flags.push('low_confidence');
  if (!p.attributionMode || p.attributionMode === 'fallback_last_outbound' || p.attributionMode === 'none') flags.push('fallback_attribution');
  if (p.intent === 'UNSUBSCRIBE') flags.push('unsubscribe_intent');
  if (p.intent === 'NOT_INTERESTED') flags.push('negative_sentiment');
  if (PRICING_RE.test(body)) flags.push('asks_for_pricing');
  if (LEGAL_RE.test(body)) flags.push('asks_for_legal');
  if (SECURITY_RE.test(body)) flags.push('asks_for_security');
  if (!p.hasThreadContext) flags.push('missing_thread_context');

  const high = flags.includes('unsubscribe_intent') || flags.includes('asks_for_legal') || flags.includes('asks_for_security') || (flags.includes('fallback_attribution') && flags.includes('low_confidence'));
  const level: ReplyRiskLevel = high ? 'HIGH' : flags.length ? 'MEDIUM' : 'LOW';
  // Autopilot (M14-5) — ТОЛЬКО low-risk без fallback/low_confidence/unsubscribe. Остальное → human handoff.
  const canAutopilot = level === 'LOW' && !flags.includes('fallback_attribution') && !flags.includes('low_confidence') && !flags.includes('unsubscribe_intent');
  return { flags, level, canAutopilot };
}

/** Сгенерировать/перегенерировать черновик. Один активный DRAFT на reply — regenerate ОБНОВЛЯЕТ его (без orphan). */
export async function generateOrRegenerateDraft(orgId: string, inboundMessageId: string): Promise<{ ok: boolean; reason?: string; draftId?: string }> {
  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, direction: 'INBOUND', lead: { orgId } },
    select: { id: true, body: true, replyClass: true, intentConfidence: true, attributionMode: true, replyToMessageId: true, campaignId: true, leadId: true, lead: { select: { firstName: true } } },
  });
  if (!inbound) return { ok: false, reason: 'reply_not_found' };
  const outbound = inbound.replyToMessageId ? await prisma.message.findUnique({ where: { id: inbound.replyToMessageId }, select: { body: true } }) : null;

  // M16-4: первая генерация черновика — платная операция. GUARD ДО LLM-вызова (нехватка → 402, без LLM/draft).
  // Регенерация существующего DRAFT — бесплатно (уже оплачена при создании).
  const existing = await prisma.replyDraft.findFirst({ where: { inboundMessageId, status: 'DRAFT' }, select: { id: true } });
  if (!existing) await assertCredits(orgId, DRAFT_GEN_COST, 'AUTO_RESPONSE');

  // Контекст: исходное письмо (тред) + ответ лида + лид + кампания.
  const gen = await generateAutoReply({ leadFirstName: inbound.lead.firstName, originalMessage: outbound?.body ?? '(original outbound unavailable)', replyFromLead: inbound.body });
  const risk = computeReplyRisk({ intent: inbound.replyClass, intentConfidence: inbound.intentConfidence, attributionMode: inbound.attributionMode, inboundBody: inbound.body, hasThreadContext: !!inbound.replyToMessageId });
  const generatedBy = llmAvailable() ? 'deepseek' : 'demo';

  if (existing) {
    await prisma.replyDraft.update({ where: { id: existing.id }, data: { subject: gen.subject, body: gen.body, originalBody: null, editedById: null, riskFlags: risk.flags, riskLevel: risk.level, canAutopilot: risk.canAutopilot, generatedBy } });
    return { ok: true, draftId: existing.id };
  }
  const d = await prisma.replyDraft.create({ data: { orgId, inboundMessageId, leadId: inbound.leadId, campaignId: inbound.campaignId, subject: gen.subject, body: gen.body, status: 'DRAFT', riskFlags: risk.flags, riskLevel: risk.level, canAutopilot: risk.canAutopilot, generatedBy }, select: { id: true } });
  // Списание за первую генерацию — через единый ledger, идемпотентно по draft id (повтор не спишет дважды).
  await debitCredits({ orgId, amount: DRAFT_GEN_COST, source: 'AUTO_RESPONSE', reason: 'auto-response draft', idempotencyKey: `reply-draft-gen:${d.id}`, replyDraftId: d.id });
  return { ok: true, draftId: d.id };
}

/** Ручная правка: снимок ДО первой правки (originalBody) → audit before/after. */
export async function editDraft(orgId: string, draftId: string, body: string, editorId: string): Promise<{ ok: boolean; reason?: string }> {
  const d = await prisma.replyDraft.findFirst({ where: { id: draftId, orgId }, select: { id: true, body: true, originalBody: true, status: true } });
  if (!d) return { ok: false, reason: 'draft_not_found' };
  if (d.status === 'SENT' || d.status === 'SUPPRESSED') return { ok: false, reason: `draft_${d.status.toLowerCase()}` };
  await prisma.replyDraft.update({ where: { id: draftId }, data: { body, originalBody: d.originalBody ?? d.body, editedById: editorId } });
  return { ok: true };
}

// approve+send — теперь через M12-lifecycle: см. services/replySend.ts → sendApprovedReply (thread-safe, idempotent).

/** Снять черновик / передать человеку (без отправки). */
export async function suppressDraft(orgId: string, draftId: string, userId: string): Promise<{ ok: boolean; reason?: string }> {
  const d = await prisma.replyDraft.findFirst({ where: { id: draftId, orgId }, select: { id: true, status: true, leadId: true, inboundMessageId: true } });
  if (!d) return { ok: false, reason: 'draft_not_found' };
  if (d.status === 'SENT') return { ok: false, reason: 'already_sent' };
  await prisma.replyDraft.update({ where: { id: d.id }, data: { status: 'SUPPRESSED' } });
  await prisma.activity.create({
    data: { orgId, actorId: userId, type: ActivityType.NOTE_CREATED, title: 'Reply draft suppressed (handoff)', body: 'Draft suppressed — handed off to a human (no auto-send)', payload: { leadId: d.leadId, draftId: d.id, inboundMessageId: d.inboundMessageId, action: 'suppress' } },
  });
  return { ok: true };
}
