/**
 * M12-4: классификация ошибок отправки и безопасная обработка сбоев.
 * transient → FAILED + lead-level backoff (та же Message переотправится по расписанию).
 * permanent (или исчерпан retry) → терминально: лид удержан (без петли), причина в send-feed (SendSkip
 * SEND_FAILED) дружелюбной строкой; RAW ошибка провайдера хранится ТОЛЬКО в Message.error (backend-аудит).
 * recoverStaleSending: зависший SENDING (краш процесса) → FAILED (retryable) без дубля.
 */
import { PrismaClient } from '@prisma/client';
import { recordSendSkip } from './sendSkip';

const prisma = new PrismaClient();

export const MAX_SEND_ATTEMPTS = 5; // после стольких transient-сбоев — терминально (give up)
const BACKOFF_BASE_MS = 5 * 60 * 1000; // 5 минут
const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000; // 6 часов
export const STALE_SENDING_MS = 5 * 60 * 1000; // SENDING старше этого — считаем зависшим

// Признаки ПЕРМАНЕНТНОГО (неустранимого ретраем) сбоя: отказ получателя/адреса/аутентификации.
const PERMANENT_RE = /\b5(?:50|51|53|54)\b|5\.1\.\d|5\.7\.\d|invalid recipient|recipient (?:rejected|address rejected)|address rejected|mailbox (?:unavailable|not found)|user unknown|no such user|does not exist|invalid address|authentication failed|auth(?:entication)? (?:failed|error)|\b535\b/i;
// Признаки ВРЕМЕННОГО сбоя.
const TRANSIENT_RE = /\b4(?:21|41|50|51|52)\b|4\.\d\.\d|timeout|timed out|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ENOTFOUND|socket|temporar|rate.?limit|\b429\b|\b50[023]\b|try again/i;

export function classifySendError(error: unknown): 'transient' | 'permanent' {
  const msg = error instanceof Error ? `${error.message} ${(error as { code?: string }).code ?? ''}` : String(error);
  if (PERMANENT_RE.test(msg)) return 'permanent';
  if (TRANSIENT_RE.test(msg)) return 'transient';
  return 'transient'; // по умолчанию — ретраим (безопаснее не «терять» лида на неизвестной ошибке)
}

// Короткая ДРУЖЕЛЮБНАЯ причина для send-feed (без сырых кодов/стека).
export function friendlySendError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/auth/i.test(msg) || /\b535\b/.test(msg)) return 'Mailbox authentication failed';
  if (/recipient|address|user unknown|no such user|does not exist|mailbox (?:unavailable|not found)/i.test(msg)) return 'Recipient address rejected the message';
  if (classifySendError(error) === 'permanent') return 'Message could not be delivered';
  return 'Temporary delivery issue';
}

/**
 * Обработать сбой отправки одной Message. Возвращает {permanent, attempt}.
 * campaignLeadId=null → reply-send без enrollment (M14-4): расписание лида не трогаем (нет enrollment'а);
 * терминальный блок ретрая держится на Message.permanentFailure (claim-CAS его исключает), а не на nextSendAt.
 */
export async function handleSendFailure(p: {
  messageId: string; campaignLeadId: string | null; orgId: string; campaignId: string | null; leadId: string;
  error: unknown; priorAttempt: number;
}): Promise<{ permanent: boolean; attempt: number }> {
  const attempt = (p.priorAttempt ?? 0) + 1;
  const raw = (p.error instanceof Error ? p.error.message : String(p.error)).slice(0, 1000);
  const cls = classifySendError(p.error);
  const permanent = cls === 'permanent' || attempt >= MAX_SEND_ATTEMPTS;

  // RAW ошибка — только в Message.error (backend-аудит). permanentFailure блокирует переотправку (claim-CAS).
  await prisma.message.update({
    where: { id: p.messageId },
    data: { status: 'FAILED', error: raw, attemptCount: attempt, permanentFailure: permanent, sendingAt: null },
  });

  if (permanent) {
    // Терминально: держим лида (без петли каждые 60с). Feed получает ДРУЖЕЛЮБНУЮ причину.
    if (p.campaignLeadId) await prisma.campaignLead.updateMany({ where: { id: p.campaignLeadId }, data: { nextSendAt: null } });
    await recordSendSkip({
      orgId: p.orgId, campaignId: p.campaignId ?? undefined, leadId: p.leadId, reason: 'SEND_FAILED',
      detail: friendlySendError(p.error) + (cls !== 'permanent' ? ` (gave up after ${attempt} attempts)` : ''),
    });
  } else if (p.campaignLeadId) {
    // transient (sequence): lead-level экспоненциальный backoff — переотправим ТУ ЖЕ Message по расписанию.
    const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS);
    await prisma.campaignLead.updateMany({ where: { id: p.campaignLeadId }, data: { nextSendAt: new Date(Date.now() + backoff) } });
  }
  // reply-send transient (campaignLeadId=null): ретрай инициирует человек повторным approve (Message FAILED claim-able).
  return { permanent, attempt };
}

/** Восстановление зависшего SENDING (краш процесса между claim и SENT/FAILED) → FAILED (retryable). */
export async function recoverStaleSending(staleMs: number = STALE_SENDING_MS): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const res = await prisma.message.updateMany({
    where: { status: 'SENDING', sendingAt: { lt: cutoff } },
    data: { status: 'FAILED', error: 'send timeout — recovered (process likely crashed mid-send)', sendingAt: null },
  });
  if (res.count > 0) console.log(`[Worker] recovered ${res.count} stale SENDING message(s) → FAILED (retryable)`);
  return res.count;
}
