/**
 * Global Emails (M28-3). Монтируется на /api/emails.
 *   GET /        — список писем org с пагинацией/фильтрами + hidden-count по RBAC.
 *   GET /:id     — безопасный detail (bodyText ТОЛЬКО при OBJECT READ на record письма).
 *
 * Решения/scope GPT:
 *  • ТОЛЬКО Email-модель, record-linked (recordId NOT null); legacy Message/лидовые письма (recordId=null) НЕ включаем.
 *  • Письма без OBJECT READ на их record → не раскрываем (ни snippet/from/to/subject), отдаём «Hidden by permissions: N».
 *  • В списке ТОЛЬКО snippet/metadata; bodyText/bodyHtml/provider/providerMessageId/idempotencyKey/token — НЕ отдаём.
 *  • Detail отдаёт bodyText только при OBJECT READ; archivedAt:null везде; пагинация обязательна.
 *  • Фильтры: status, direction, linked record.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmailStatus, Direction, ActivityType, Prisma, PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, buildResolver, meets } from '../services/permissions';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).optional().default(PAGE_SIZE_DEFAULT),
  status: z.nativeEnum(EmailStatus).optional(),
  direction: z.nativeEnum(Direction).optional(),
  recordId: z.string().trim().min(1).max(60).optional(),
});

// Безопасная проекция письма для списка: snippet вместо bodyText; никаких provider/token/html.
function serializeListEmail(e: {
  id: string; direction: Direction; status: EmailStatus; subject: string | null; fromEmail: string | null; fromName: string | null;
  toEmails: Prisma.JsonValue; bodyText: string | null; aiGenerated: boolean; demo: boolean; sentAt: Date | null; createdAt: Date;
  record: { id: string; displayName: string | null; object: { key: string; singularName: string } | null } | null;
}) {
  return {
    id: e.id, direction: e.direction, status: e.status, subject: e.subject, fromEmail: e.fromEmail, fromName: e.fromName,
    toEmails: e.toEmails, aiGenerated: e.aiGenerated, demo: e.demo, sentAt: e.sentAt, createdAt: e.createdAt,
    snippet: (e.bodyText ?? '').slice(0, 180),
    linkedRecord: e.record ? { id: e.record.id, displayName: e.record.displayName, objectKey: e.record.object?.key ?? null, objectName: e.record.object?.singularName ?? null } : null,
  };
}

// Разбивает объекты org на доступные (READ+) и закрытые для текущего пользователя.
// Адверс HIGH: архивные объекты ИСКЛЮЧАЕМ — их id не попадёт ни в allowed, ни в denied, поэтому письма
// записей архивного объекта не видны в списке И не считаются hidden (поверхность их не показывает вовсе).
async function splitObjectsByRead(req: Request, orgId: string): Promise<{ allowed: string[]; denied: string[] }> {
  const objects = await prisma.object.findMany({ where: { orgId, archivedAt: null }, select: { id: true } });
  const resolve = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');
  const allowed: string[] = []; const denied: string[] = [];
  for (const o of objects) (meets(resolve(o.id), 'READ') ? allowed : denied).push(o.id);
  return { allowed, denied };
}

// GET / — список с пагинацией + hidden-count.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const q = listQuerySchema.parse(req.query);
    const { allowed, denied } = await splitObjectsByRead(req, orgId);

    // record-linked письма (Q3: без legacy/null-record), не архивные, по фильтрам
    const baseWhere: Prisma.EmailWhereInput = {
      orgId, archivedAt: null, recordId: { not: null },
      ...(q.status ? { status: q.status } : {}),
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.recordId ? { recordId: q.recordId } : {}),
    };
    const visibleWhere: Prisma.EmailWhereInput = { ...baseWhere, record: { objectId: { in: allowed } } };
    const hiddenWhere: Prisma.EmailWhereInput = { ...baseWhere, record: { objectId: { in: denied } } };

    const skip = (q.page - 1) * q.pageSize;
    const [total, hiddenCount, rows] = await Promise.all([
      prisma.email.count({ where: visibleWhere }),
      prisma.email.count({ where: hiddenWhere }),
      prisma.email.findMany({
        where: visibleWhere,
        orderBy: { createdAt: 'desc' },
        skip, take: q.pageSize,
        select: {
          id: true, direction: true, status: true, subject: true, fromEmail: true, fromName: true, toEmails: true,
          bodyText: true, aiGenerated: true, demo: true, sentAt: true, createdAt: true,
          record: { select: { id: true, displayName: true, object: { select: { key: true, singularName: true } } } },
        },
      }),
    ]);

    res.json({
      emails: rows.map(serializeListEmail),
      total, hiddenCount,
      page: q.page, pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
    });
  } catch (err) { next(err); }
});

// ── M28-5: Outbox / drafts / demo-resend ─────────────────────────────────────────────────────────

const DETAIL_SELECT = {
  id: true, recordId: true, direction: true, status: true, subject: true, fromEmail: true, fromName: true,
  toEmails: true, ccEmails: true, bodyText: true, aiGenerated: true, demo: true, templateId: true,
  sentAt: true, openedAt: true, repliedAt: true, createdAt: true,
  record: { select: { id: true, objectId: true, displayName: true, archivedAt: true, object: { select: { key: true, singularName: true, archivedAt: true } } } },
} as const;

type EmailDetailRow = Prisma.EmailGetPayload<{ select: typeof DETAIL_SELECT }>;

// Detail-проекция наружу: bodyText включён (gate выше), но без bodyHtml/provider/token/idempotencyKey/threadId.
function serializeDetail(e: EmailDetailRow) {
  return {
    id: e.id, direction: e.direction, status: e.status, subject: e.subject,
    fromEmail: e.fromEmail, fromName: e.fromName, toEmails: e.toEmails, ccEmails: e.ccEmails,
    bodyText: e.bodyText, aiGenerated: e.aiGenerated, demo: e.demo, templateId: e.templateId,
    sentAt: e.sentAt, openedAt: e.openedAt, repliedAt: e.repliedAt, createdAt: e.createdAt,
    linkedRecord: e.record ? { id: e.record.id, displayName: e.record.displayName, objectKey: e.record.object?.key ?? null, objectName: e.record.object?.singularName ?? null } : null,
  };
}

// Грузит письмо для операции. null + причина (404 — не часть поверхности: null-record/удалён/архивный объект).
async function loadEmail(orgId: string, id: string): Promise<EmailDetailRow | null> {
  const email = await prisma.email.findFirst({ where: { id, orgId, archivedAt: null }, select: DETAIL_SELECT });
  if (!email || !email.recordId || !email.record || email.record.object?.archivedAt) return null;
  return email;
}

// DRAFT раскрывается/правится только при READ_WRITE (черновик редактируемый); прочие статусы — READ (M28-3).
function neededLevel(status: EmailStatus): 'READ' | 'READ_WRITE' {
  return status === EmailStatus.DRAFT ? 'READ_WRITE' : 'READ';
}

// GET /:id — безопасный detail (bodyText только при OBJECT READ; DRAFT — только при READ_WRITE).
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const email = await loadEmail(orgId, req.params.id);
    if (!email) { res.status(404).json({ error: 'Email not found', code: 'EMAIL_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', neededLevel(email.status), email.record!.objectId))) return;
    res.json({ email: serializeDetail(email) });
  } catch (err) { next(err); }
});

const editDraftSchema = z.object({
  subject: z.string().max(500).optional(),
  body: z.string().max(20000).optional(),
});

// PATCH /:id — редактировать DRAFT (subject/body). READ_WRITE; archived record → 409; не DRAFT → 409.
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const email = await loadEmail(orgId, req.params.id);
    if (!email) { res.status(404).json({ error: 'Email not found', code: 'EMAIL_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', email.record!.objectId))) return;
    if (email.record!.archivedAt) { res.status(409).json({ error: 'Record is archived', code: 'RECORD_ARCHIVED' }); return; }
    if (email.status !== EmailStatus.DRAFT) { res.status(409).json({ error: 'Only drafts can be edited', code: 'NOT_DRAFT' }); return; }

    const data = editDraftSchema.parse(req.body);
    if (data.subject === undefined && data.body === undefined) { res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }); return; }
    const nextSubject = data.subject !== undefined ? data.subject : email.subject ?? '';
    const nextBody = data.body !== undefined ? data.body : email.bodyText ?? '';
    if (!String(nextSubject).trim() && !String(nextBody).trim()) { res.status(400).json({ error: 'Email subject and body are both empty', code: 'EMPTY_EMAIL' }); return; }

    const updated = await prisma.email.update({
      where: { id: email.id },
      data: { subject: nextSubject || null, bodyText: nextBody || null },
      select: DETAIL_SELECT,
    });
    await audit({ orgId, actorId: req.user!.userId, action: 'EMAIL_DRAFT_EDITED', targetType: 'email', targetId: email.id, summary: `draft edited on record ${email.recordId}` });
    res.json({ email: serializeDetail(updated) });
  } catch (err) { next(err); }
});

// POST /:id/send — отправить DRAFT (DRAFT→SENT, demo). READ_WRITE; archived → 409. Activity EMAIL_SENT строго раз (transition-guard).
router.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const email = await loadEmail(orgId, req.params.id);
    if (!email) { res.status(404).json({ error: 'Email not found', code: 'EMAIL_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', email.record!.objectId))) return;
    if (email.record!.archivedAt) { res.status(409).json({ error: 'Record is archived', code: 'RECORD_ARCHIVED' }); return; }
    // уже отправлено (двойной клик/гонка) → идемпотентно возвращаем текущее, без второго Activity
    if (email.status === EmailStatus.SENT) { res.status(200).json({ email: serializeDetail(email), demo: email.demo, idempotent: true }); return; }
    if (email.status !== EmailStatus.DRAFT) { res.status(409).json({ error: 'Only drafts can be sent', code: 'NOT_DRAFT' }); return; }
    if (!String(email.subject ?? '').trim() && !String(email.bodyText ?? '').trim()) { res.status(400).json({ error: 'Email subject and body are both empty', code: 'EMPTY_EMAIL' }); return; }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      // transition-guard: переводим SENT только из DRAFT — гонка двойного send не создаст второй EMAIL_SENT
      const moved = await tx.email.updateMany({ where: { id: email.id, status: EmailStatus.DRAFT }, data: { status: EmailStatus.SENT, sentAt: now, demo: true } });
      if (moved.count === 0) return { sent: false as const };
      await tx.activity.create({ data: { orgId, recordId: email.recordId, actorId: req.user!.userId, emailId: email.id, type: ActivityType.EMAIL_SENT, title: 'Email sent (demo)', payload: { demo: true, fromDraft: true } as Prisma.InputJsonValue } });
      const fresh = await tx.email.findUniqueOrThrow({ where: { id: email.id }, select: DETAIL_SELECT });
      return { sent: true as const, fresh };
    });
    if (!result.sent) { const cur = await loadEmail(orgId, req.params.id); res.status(200).json({ email: cur ? serializeDetail(cur) : null, demo: true, idempotent: true }); return; }
    await audit({ orgId, actorId: req.user!.userId, action: 'EMAIL_SENT', targetType: 'email', targetId: email.id, summary: `draft demo-sent on record ${email.recordId}` });
    res.json({ email: serializeDetail(result.fresh), demo: true });
  } catch (err) { next(err); }
});

const resendSchema = z.object({ idempotencyKey: z.string().trim().min(1).max(200).optional() });

// POST /:id/resend — demo-resend для SENT/FAILED demo-писем. КАЖДЫЙ пользовательский attempt = отдельный EMAIL_SENT Activity.
// Адверс HIGH: чтобы network-retry/двойной submit ОДНОГО клика не плодил второй EMAIL_SENT, attempt дедупится по
// idempotencyKey (хранится в Activity.payload.attemptKey). Разные клики шлют разные ключи → честные отдельные attempts.
router.post('/:id/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const email = await loadEmail(orgId, req.params.id);
    if (!email) { res.status(404).json({ error: 'Email not found', code: 'EMAIL_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', email.record!.objectId))) return;
    if (email.record!.archivedAt) { res.status(409).json({ error: 'Record is archived', code: 'RECORD_ARCHIVED' }); return; }
    // честный backend-path только для demo-писем (реальной доставки нет) и статусов SENT/FAILED
    if (!email.demo) { res.status(409).json({ error: 'Only demo emails can be resent', code: 'NOT_DEMO_RESENDABLE' }); return; }
    if (email.status !== EmailStatus.SENT && email.status !== EmailStatus.FAILED) { res.status(409).json({ error: 'Only sent or failed emails can be resent', code: 'NOT_RESENDABLE' }); return; }
    const { idempotencyKey } = resendSchema.parse(req.body ?? {});

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      // дедуп attempt: тот же idempotencyKey уже породил EMAIL_SENT для этого письма → no-op (один attempt = один Activity)
      if (idempotencyKey) {
        const dup = await tx.activity.findFirst({ where: { orgId, emailId: email.id, type: ActivityType.EMAIL_SENT, payload: { path: ['attemptKey'], equals: idempotencyKey } }, select: { id: true } });
        if (dup) return { duplicated: true as const };
      }
      await tx.email.update({ where: { id: email.id }, data: { status: EmailStatus.SENT, sentAt: now } });
      // отдельный send-attempt → отдельный Activity (РЕАЛЬНАЯ новая попытка; attemptKey отделяет attempt от сетевого ретрая)
      await tx.activity.create({ data: { orgId, recordId: email.recordId, actorId: req.user!.userId, emailId: email.id, type: ActivityType.EMAIL_SENT, title: 'Email re-sent (demo)', payload: { demo: true, resend: true, attemptKey: idempotencyKey ?? null } as Prisma.InputJsonValue } });
      const fresh = await tx.email.findUniqueOrThrow({ where: { id: email.id }, select: DETAIL_SELECT });
      return { duplicated: false as const, fresh };
    });
    if (result.duplicated) { const cur = await loadEmail(orgId, req.params.id); res.status(200).json({ email: cur ? serializeDetail(cur) : null, demo: true, resent: false, idempotent: true }); return; }
    await audit({ orgId, actorId: req.user!.userId, action: 'EMAIL_RESENT', targetType: 'email', targetId: email.id, summary: `demo-resent on record ${email.recordId}` });
    res.json({ email: serializeDetail(result.fresh), demo: true, resent: true });
  } catch (err) { next(err); }
});

export default router;
