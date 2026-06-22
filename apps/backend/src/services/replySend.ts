/**
 * M14-4: thread-safe send одобренного AI-ответа. Идёт ЧЕРЕЗ жизненный цикл M12 (НЕ пишет SENT напрямую):
 *   QUEUED → claim(CAS) SENDING → провайдер → SENT / handleSendFailure(FAILED+retry/permanent).
 * Идемпотентность: Message.idempotencyKey = `reply-draft:<draftId>` (UNIQUE) → двойной клик/ретрай дают
 * ОДИН OUTBOUND; claim-CAS → ОДИН provider-send. Ответ уходит в ПРАВИЛЬНЫЙ тред (replyToMessageId=inbound +
 * In-Reply-To/References) с ЯЩИКА исходного исходящего (если рабочий, иначе fallback/NO_MAILBOX).
 * inbound.handledAt ставится ТОЛЬКО после успешного SENT; сбой НЕ помечает draft/inbound как отправленные.
 * Аудит: approved+sent / failure с draftId+inboundMessageId+thread-контекстом.
 */
import { PrismaClient, ActivityType } from '@prisma/client';
import { config } from '../config';
import { sendEmail } from './email';
import { handleSendFailure, friendlySendError } from './sendError';
import { resolveReplyMailbox } from './mailbox';

const prisma = new PrismaClient();

const REPLY_KEY = (draftId: string) => `reply-draft:${draftId}`;
// Message-ID для заголовков треда (In-Reply-To/References) — в угловых скобках.
const asMsgId = (id: string | null | undefined): string | null => (id ? (id.startsWith('<') ? id : `<${id}>`) : null);

export interface ReplySendResult { ok: boolean; reason?: string; messageId?: string; status?: 'SENT' | 'FAILED'; mailboxId?: string }

// approverId=null → отправил агент/система (M14-5 autopilot): Activity.actorId/ReplyDraft.approvedById = null,
// audit approvedBy='agent'. Транспорт/идемпотентность те же, что у ручного approve (нота GPT M14-4).
export async function sendApprovedReply(orgId: string, draftId: string, approverId: string | null): Promise<ReplySendResult> {
  const draft = await prisma.replyDraft.findFirst({
    where: { id: draftId, orgId },
    select: { id: true, status: true, subject: true, body: true, leadId: true, campaignId: true, inboundMessageId: true, sentMessageId: true },
  });
  if (!draft) return { ok: false, reason: 'draft_not_found' };
  if (draft.status === 'SUPPRESSED') return { ok: false, reason: 'suppressed' };
  if (draft.status === 'SENT') return { ok: true, reason: 'already_sent', messageId: draft.sentMessageId ?? undefined, status: 'SENT' };

  const lead = await prisma.lead.findFirst({ where: { id: draft.leadId, orgId }, select: { email: true } });
  if (!lead?.email) return { ok: false, reason: 'no_email' };

  // Тред: входящее + исходное исходящее (для In-Reply-To/References и выбора ящика).
  const inbound = await prisma.message.findUnique({ where: { id: draft.inboundMessageId }, select: { id: true, providerMessageId: true, replyToMessageId: true, campaignLeadId: true } });
  if (!inbound) return { ok: false, reason: 'inbound_not_found' };
  const origOutbound = inbound.replyToMessageId
    ? await prisma.message.findUnique({ where: { id: inbound.replyToMessageId }, select: { mailboxId: true, providerMessageId: true } })
    : null;

  // Ящик: исходный (если рабочий+под ёмкостью), иначе fallback; нет рабочих → NO_MAILBOX (не отправляем).
  const mbRes = await resolveReplyMailbox(orgId, origOutbound?.mailboxId ?? null);
  if (!mbRes.mailbox) {
    await prisma.activity.create({
      data: { orgId, actorId: approverId, type: ActivityType.NOTE_CREATED, title: 'Reply not sent — no working mailbox', body: `Reply held: ${mbRes.reason === 'ALL_AT_CAPACITY' ? 'all mailboxes at daily capacity' : 'no connected mailbox'}`, payload: { draftId: draft.id, inboundMessageId: draft.inboundMessageId, leadId: draft.leadId, action: 'approve_send_held', reason: mbRes.reason } },
    });
    return { ok: false, reason: mbRes.reason === 'ALL_AT_CAPACITY' ? 'all_at_capacity' : 'no_mailbox' };
  }
  const mailbox = mbRes.mailbox;

  // thread-заголовки: In-Reply-To = входящее; References = исходное исходящее + входящее.
  const inReplyTo = asMsgId(inbound.providerMessageId) ?? undefined;
  const references = [asMsgId(origOutbound?.providerMessageId), asMsgId(inbound.providerMessageId)].filter((x): x is string => !!x);

  // find-or-create OUTBOUND по UNIQUE idempotencyKey — ОДИН Message на draft (двойной клик/гонка не плодят).
  // mailboxId ставим уже при create (детерминированная identity). На гонке create→P2002→re-read; цикл (до 3)
  // переживает редкий интервал между P2002 и re-read.
  const key = REPLY_KEY(draft.id);
  const sel = { id: true, status: true, attemptCount: true, leadId: true } as const;
  let msg: { id: string; status: string; attemptCount: number; leadId: string } | null = null;
  for (let i = 0; i < 3 && !msg; i++) {
    msg = await prisma.message.findUnique({ where: { idempotencyKey: key }, select: sel });
    if (msg) break;
    try {
      msg = await prisma.message.create({
        data: {
          leadId: draft.leadId, campaignId: draft.campaignId, mailboxId: mailbox.id, idempotencyKey: key,
          direction: 'OUTBOUND', channel: 'EMAIL', subject: draft.subject, body: draft.body, aiGenerated: true,
          status: 'QUEUED', replyToMessageId: draft.inboundMessageId,
        },
        select: sel,
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') continue; // другой запрос создал — перечитаем
      throw e;
    }
  }
  if (!msg) return { ok: false, reason: 'message_unresolved' };
  if (msg.leadId !== draft.leadId) return { ok: false, reason: 'idempotency_conflict' }; // защита: ключ должен принадлежать этому лиду
  if (msg.status === 'SENT') { await markDraftSent(draft.id, approverId, msg.id); return { ok: true, reason: 'already_sent', messageId: msg.id, status: 'SENT', mailboxId: mailbox.id }; }

  // claim-CAS (паттерн M12): UPDATE ... WHERE status IN (QUEUED,FAILED) под row-lock READ COMMITTED — победитель
  // ОДИН (проигравший перечитывает WHERE по уже-SENDING строке → count=0). mailboxId refresh: ретрай использует
  // АКТУАЛЬНО рабочий ящик (исходный, если жив → тред в одном ящике; иначе — fallback, чтобы отправка прошла).
  const claim = await prisma.message.updateMany({ where: { id: msg.id, status: { in: ['QUEUED', 'FAILED'] }, permanentFailure: false }, data: { status: 'SENDING', sendingAt: new Date(), mailboxId: mailbox.id } });
  if (claim.count === 0) {
    const fresh = await prisma.message.findUnique({ where: { id: msg.id }, select: { status: true, permanentFailure: true } });
    if (fresh?.status === 'SENT') { await markDraftSent(draft.id, approverId, msg.id); return { ok: true, reason: 'already_sent', messageId: msg.id, status: 'SENT', mailboxId: mailbox.id }; }
    if (fresh?.permanentFailure) return { ok: false, reason: 'send_failed_permanent', messageId: msg.id, status: 'FAILED' };
    return { ok: false, reason: 'in_progress', messageId: msg.id }; // параллельная отправка уже идёт
  }

  // Внешняя отправка строго между SENDING и SENT — через провайдера (demo логирует).
  try {
    const from = mailbox.fromName ? `${mailbox.fromName} <${mailbox.address}>` : mailbox.address;
    const pixel = `<img src="${config.backend.url}/api/track/open/${msg.id}" width="1" height="1" style="display:none" alt="" />`;
    const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${draft.body.replace(/\n/g, '<br>')}</div>${pixel}`;
    const providerMessageId = (await sendEmail({ to: lead.email, subject: draft.subject ?? 'Re:', body: htmlBody, from, html: true, inReplyTo, references })).messageId;

    // Message→SENT первым (фиксируем факт отправки у провайдера; если бы упало позже — recoverStaleSending не нужен).
    await prisma.message.update({ where: { id: msg.id }, data: { status: 'SENT', providerMessageId, sentAt: new Date(), error: null } });
    const now = new Date();
    // Финализация атомарно: draft→SENT + inbound.handledAt (ТОЛЬКО после SENT) + audit одним транзакционным блоком.
    // Если упадёт — Message уже SENT, повторный approve через markDraftSent довершит draft/inbound идемпотентно.
    await prisma.$transaction([
      prisma.replyDraft.update({ where: { id: draft.id }, data: { status: 'SENT', approvedById: approverId, approvedAt: now, sentMessageId: msg.id, sentAt: now } }),
      prisma.message.update({ where: { id: draft.inboundMessageId }, data: { handledAt: now } }),
      prisma.activity.create({
        data: { orgId, actorId: approverId, type: ActivityType.EMAIL_SENT, title: approverId ? 'Reply approved & sent' : 'Reply auto-sent (agent)', body: `Reply sent in-thread from ${mailbox.address}`, payload: { action: 'approve_send', approvedBy: approverId ? 'human' : 'agent', draftId: draft.id, inboundMessageId: draft.inboundMessageId, outboundMessageId: msg.id, leadId: draft.leadId, mailboxId: mailbox.id, usedPreferredMailbox: mbRes.usedPreferred, providerMessageId, inReplyTo: inReplyTo ?? null, references } },
      }),
    ]);
    return { ok: true, messageId: msg.id, status: 'SENT', mailboxId: mailbox.id };
  } catch (e) {
    // M12-4: безопасный сбой в ТОЙ ЖЕ строке (FAILED + attempt + backoff/permanent). Draft/inbound НЕ трогаем
    // (остаются DRAFT/непрочитанным) — повторный approve переотправит (FAILED claim-able, если не permanent).
    const res = await handleSendFailure({ messageId: msg.id, campaignLeadId: inbound.campaignLeadId ?? null, orgId, campaignId: draft.campaignId, leadId: draft.leadId, error: e, priorAttempt: msg.attemptCount });
    await prisma.activity.create({
      data: { orgId, actorId: approverId, type: ActivityType.NOTE_CREATED, title: `Reply send ${res.permanent ? 'failed (terminal)' : 'failed — will retry'}`, body: `${friendlySendError(e)} — draft kept, reply NOT marked sent`, payload: { action: 'approve_send_failed', draftId: draft.id, inboundMessageId: draft.inboundMessageId, outboundMessageId: msg.id, leadId: draft.leadId, permanent: res.permanent, attempt: res.attempt, reason: friendlySendError(e) } },
    });
    return { ok: false, reason: res.permanent ? 'send_failed_permanent' : 'send_failed', messageId: msg.id, status: 'FAILED' };
  }
}

// Идемпотентное доведение draft→SENT, если OUTBOUND уже SENT (гонка/повтор).
async function markDraftSent(draftId: string, approverId: string | null, messageId: string): Promise<void> {
  const d = await prisma.replyDraft.findUnique({ where: { id: draftId }, select: { status: true, inboundMessageId: true } });
  if (!d || d.status === 'SENT') return;
  const now = new Date();
  await prisma.replyDraft.update({ where: { id: draftId }, data: { status: 'SENT', approvedById: approverId, approvedAt: now, sentMessageId: messageId, sentAt: now } });
  await prisma.message.update({ where: { id: d.inboundMessageId }, data: { handledAt: now } }).catch(() => undefined);
}
