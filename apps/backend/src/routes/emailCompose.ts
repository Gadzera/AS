/**
 * Email compose (M28-1 + M28-2). Монтируется на /api/records →
 *   GET  /:recordId/email-recipients  — резолвимые получатели (self + связанные People). OBJECT READ.
 *   GET  /:recordId/email-variables    — контракт доступных merge-переменных. OBJECT READ.
 *   POST /:recordId/emails/preview      — preview итогового письма (resolve + unresolved/empty). OBJECT READ.
 *   POST /:recordId/emails              — создать draft или demo-send. OBJECT READ_WRITE; archived → 409.
 *
 * Дисциплина (правки GPT):
 *  #1 recipient-resolver (generic, без hardcode) — services/crm/recipientResolver.
 *  #2 preview обязателен перед send (UI), backend всё равно резолвит на send.
 *  #3 merge только по контракту mergeVariables (нет произвольных deep-path); unresolved → блок send (422).
 *  #4 idempotency-key → один Email+Activity на ключ (двойной клик/ретрай).
 *  #5 Activity строго раз: EMAIL_DRAFTED при создании draft, EMAIL_SENT при compose→send.
 *  #6 body safety: наружу только snippet; bodyHtml/provider/token не отдаём.
 *  #7 archived-симметрия: archived record → compose/send/draft = 409 RECORD_ARCHIVED.
 *  Q1 send = demo-safe: status SENT + demo:true + sentAt, БЕЗ внешней доставки (disclaimer обязателен в UI).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Direction, EmailStatus, Channel, ActivityType, Prisma, PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess } from '../services/permissions';
import { audit } from '../services/audit';
import { resolveRecipients, resolveSingleRecipient } from '../services/crm/recipientResolver';
import { listRecordVariables, buildMergeContext, resolveMerge } from '../services/crm/mergeVariables';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// Copy-правка GPT (M28-1+2 приёмка): pre-send/preview ≠ post-send.
export const PRESEND_DISCLAIMER = 'Demo-safe · no external delivery'; // preview / draft (ещё не отправлено)
export const SENT_DISCLAIMER = 'Demo sent · no external delivery';     // после demo-send

async function recordForOp(orgId: string, recordId: string): Promise<{ objectId: string; archived: boolean } | null> {
  const r = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true, archivedAt: true } });
  return r ? { objectId: r.objectId, archived: r.archivedAt !== null } : null;
}

const recipientSchema = z.object({
  email: z.string().trim().max(320).optional().nullable(),
  name: z.string().trim().max(200).optional().nullable(),
  recordId: z.string().trim().max(60).optional().nullable(),
});
const previewSchema = z.object({
  subject: z.string().max(500).optional().default(''),
  body: z.string().max(20000).optional().default(''),
  templateId: z.string().trim().max(60).optional().nullable(),
  recipient: recipientSchema,
});
const composeSchema = previewSchema.extend({
  action: z.enum(['draft', 'send']),
  idempotencyKey: z.string().trim().min(1).max(200).optional().nullable(),
});

// Письмо наружу: только безопасные поля (body safety #6) — snippet, без bodyText/bodyHtml/provider/token.
function serializeEmail(e: { id: string; direction: Direction; status: EmailStatus; subject: string | null; fromEmail: string | null; toEmails: Prisma.JsonValue; bodyText: string | null; aiGenerated: boolean; demo: boolean; templateId: string | null; sentAt: Date | null; createdAt: Date }) {
  return {
    id: e.id, direction: e.direction, status: e.status, subject: e.subject, fromEmail: e.fromEmail,
    toEmails: e.toEmails, aiGenerated: e.aiGenerated, demo: e.demo, templateId: e.templateId,
    sentAt: e.sentAt, createdAt: e.createdAt, snippet: (e.bodyText ?? '').slice(0, 180),
  };
}

const EMAIL_SELECT = { id: true, direction: true, status: true, subject: true, fromEmail: true, toEmails: true, bodyText: true, aiGenerated: true, demo: true, templateId: true, sentAt: true, createdAt: true } as const;

// GET /:recordId/email-recipients
router.get('/:recordId/email-recipients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;
    const recipients = await resolveRecipients(orgId, req.params.recordId);
    res.json({ recipients });
  } catch (err) { next(err); }
});

// GET /:recordId/email-variables
router.get('/:recordId/email-variables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;
    const variables = await listRecordVariables(orgId, req.params.recordId);
    res.json({ variables });
  } catch (err) { next(err); }
});

// Резолвит template (если задан) + merge subject/body. Возвращает resolved + объединённые unresolved/empty.
async function resolveCompose(orgId: string, recordId: string, input: { subject: string; body: string; templateId?: string | null }, recipient: { email: string; name: string | null }) {
  const ctx = await buildMergeContext(orgId, recordId, recipient);
  const subj = resolveMerge(input.subject ?? '', ctx);
  const body = resolveMerge(input.body ?? '', ctx);
  const unresolved = Array.from(new Set([...subj.unresolved, ...body.unresolved]));
  const empty = Array.from(new Set([...subj.empty, ...body.empty]));
  return { subject: subj.output, body: body.output, unresolved, empty };
}

// POST /:recordId/emails/preview — read-only превью (OBJECT READ).
router.post('/:recordId/emails/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;
    const data = previewSchema.parse(req.body);

    if (data.templateId) {
      const tpl = await prisma.emailTemplate.findFirst({ where: { id: data.templateId, orgId, archivedAt: null }, select: { id: true } });
      if (!tpl) { res.status(400).json({ error: 'Template not found or archived', code: 'TEMPLATE_NOT_FOUND' }); return; }
    }

    const resolved = await resolveSingleRecipient(orgId, req.params.recordId, data.recipient);
    const recipient = resolved ?? { email: '', name: null };
    const merged = await resolveCompose(orgId, req.params.recordId, data, recipient);
    const recipientResolved = resolved !== null;
    const canSend = recipientResolved && merged.unresolved.length === 0 && !rec.archived;

    res.json({
      to: resolved?.email ?? null,
      recipientName: resolved?.name ?? null,
      recipientResolved,
      subject: merged.subject,
      body: merged.body,
      unresolved: merged.unresolved,
      empty: merged.empty,
      demo: true,
      disclaimer: PRESEND_DISCLAIMER, // preview = ещё не отправлено
      recordArchived: rec.archived,
      canSend,
    });
  } catch (err) { next(err); }
});

// POST /:recordId/emails — создать draft или demo-send (OBJECT READ_WRITE).
router.post('/:recordId/emails', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    // #7 archived-симметрия: на архивную запись compose/draft/send запрещены.
    if (rec.archived) { res.status(409).json({ error: 'Record is archived', code: 'RECORD_ARCHIVED' }); return; }
    const data = composeSchema.parse(req.body);
    // #4 ключ неймспейсим записью на сервере (адверс HIGH-1): глобально-уникальный (orgId, idempotencyKey)
    // не может коллизионно вернуть письмо ДРУГОЙ записи — recordId зашит в сам ключ.
    const storedKey = data.idempotencyKey ? `${req.params.recordId}:${data.idempotencyKey}` : null;

    // #4 идемпотентность: уже есть письмо с этим ключом → возвращаем его, без второго Email/Activity.
    if (storedKey) {
      const existing = await prisma.email.findFirst({ where: { orgId, recordId: req.params.recordId, idempotencyKey: storedKey }, select: EMAIL_SELECT });
      if (existing) { res.status(200).json({ email: serializeEmail(existing), demo: true, disclaimer: existing.status === EmailStatus.SENT ? SENT_DISCLAIMER : PRESEND_DISCLAIMER, idempotent: true }); return; }
    }

    // template-проверка (provenance + допустимость) — должен существовать и быть живым.
    if (data.templateId) {
      const tpl = await prisma.emailTemplate.findFirst({ where: { id: data.templateId, orgId, archivedAt: null }, select: { id: true } });
      if (!tpl) { res.status(400).json({ error: 'Template not found or archived', code: 'TEMPLATE_NOT_FOUND' }); return; }
    }

    // #1 recipient-resolver: получатель обязателен и должен резолвиться.
    const resolved = await resolveSingleRecipient(orgId, req.params.recordId, data.recipient);
    if (!resolved) { res.status(422).json({ error: 'Recipient could not be resolved to an email', code: 'RECIPIENT_UNRESOLVED' }); return; }

    const merged = await resolveCompose(orgId, req.params.recordId, data, { email: resolved.email, name: resolved.name });

    // #3 unresolved guard: SEND с неизвестными переменными запрещён (draft допускается — это черновик).
    if (data.action === 'send' && merged.unresolved.length > 0) {
      res.status(422).json({ error: 'Unresolved merge variables', code: 'UNRESOLVED_VARIABLES', unresolved: merged.unresolved });
      return;
    }
    if (!merged.subject.trim() && !merged.body.trim()) {
      res.status(400).json({ error: 'Email subject and body are both empty', code: 'EMPTY_EMAIL' });
      return;
    }

    const actor = await prisma.user.findFirst({ where: { id: req.user!.userId }, select: { email: true, name: true } });
    const isSend = data.action === 'send';
    const now = new Date();

    // #4/#5: Email + Activity в одной транзакции; Activity ровно один раз (тип по action).
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const email = await tx.email.create({
          data: {
            orgId, recordId: req.params.recordId, senderUserId: req.user!.userId,
            direction: Direction.OUTBOUND, channel: Channel.EMAIL,
            status: isSend ? EmailStatus.SENT : EmailStatus.DRAFT,
            fromEmail: actor?.email ?? null, fromName: actor?.name ?? null,
            toEmails: [resolved.email] as Prisma.InputJsonValue,
            subject: merged.subject || null, bodyText: merged.body || null,
            demo: true, // Q1: M28 demo-safe — внешней доставки нет
            templateId: data.templateId ?? null,
            idempotencyKey: storedKey,
            sentAt: isSend ? now : null,
          },
          select: EMAIL_SELECT,
        });
        await tx.activity.create({
          data: {
            orgId, recordId: req.params.recordId, actorId: req.user!.userId, emailId: email.id,
            type: isSend ? ActivityType.EMAIL_SENT : ActivityType.EMAIL_DRAFTED,
            title: isSend ? 'Email sent (demo)' : 'Email drafted',
            payload: { to: resolved.email, demo: true, templateId: data.templateId ?? null } as Prisma.InputJsonValue,
          },
        });
        return email;
      });
    } catch (e) {
      // гонка двойного submit с одинаковым idempotencyKey → берём уже созданное письмо
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && storedKey) {
        const existing = await prisma.email.findFirst({ where: { orgId, recordId: req.params.recordId, idempotencyKey: storedKey }, select: EMAIL_SELECT });
        if (existing) { res.status(200).json({ email: serializeEmail(existing), demo: true, disclaimer: existing.status === EmailStatus.SENT ? SENT_DISCLAIMER : PRESEND_DISCLAIMER, idempotent: true }); return; }
      }
      throw e;
    }

    await audit({ orgId, actorId: req.user!.userId, action: isSend ? 'EMAIL_SENT' : 'EMAIL_DRAFTED', targetType: 'email', targetId: created.id, summary: `${isSend ? 'demo-sent' : 'drafted'} email to ${resolved.email} on record ${req.params.recordId}` });

    res.status(201).json({ email: serializeEmail(created), demo: true, disclaimer: isSend ? SENT_DISCLAIMER : PRESEND_DISCLAIMER, empty: merged.empty });
  } catch (err) { next(err); }
});

export default router;
