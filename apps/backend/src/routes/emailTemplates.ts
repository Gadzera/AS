/**
 * Email templates (M28-2). Монтируется на /api/email-templates.
 * RBAC (решение GPT Q2):
 *  • list/get — любой аутентифицированный член org (шаблоны нужны для compose, который проверяет права на запись);
 *  • create/update/archive — ТОЛЬКО OWNER/ADMIN (granular template-perms — позже).
 * subject/body содержат {{merge}}-переменные; их допустимость определяется контрактом mergeVariables на этапе compose.
 * Archived-симметрия: archivedAt:null в листинге; повторный archive идемпотентен.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { isManager } from '../services/permissions';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1).max(20000),
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().min(1).max(20000).optional(),
});

function serializeTemplate(t: { id: string; name: string; subject: string; body: string; createdById: string | null; createdAt: Date; updatedAt: Date; archivedAt: Date | null; createdBy?: { id: string; name: string | null; email: string } | null }) {
  return {
    id: t.id, name: t.name, subject: t.subject, body: t.body,
    createdBy: t.createdBy ?? null, createdById: t.createdById,
    archived: t.archivedAt !== null,
    createdAt: t.createdAt, updatedAt: t.updatedAt,
  };
}

// GET / — список живых шаблонов org (для выбора в compose).
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const includeArchived = String(req.query.includeArchived ?? '') === 'true' && isManager(req.user!.role);
    const templates = await prisma.emailTemplate.findMany({
      where: { orgId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, subject: true, body: true, createdById: true, createdAt: true, updatedAt: true, archivedAt: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
    res.json({ templates: templates.map(serializeTemplate), canManage: isManager(req.user!.role) });
  } catch (err) { next(err); }
});

// GET /:id — один шаблон.
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const t = await prisma.emailTemplate.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      select: { id: true, name: true, subject: true, body: true, createdById: true, createdAt: true, updatedAt: true, archivedAt: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!t) { res.status(404).json({ error: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }); return; }
    res.json({ template: serializeTemplate(t) });
  } catch (err) { next(err); }
});

// POST / — создать шаблон (только OWNER/ADMIN).
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!isManager(req.user!.role)) { res.status(403).json({ error: 'Only workspace admins can manage email templates', code: 'TEMPLATE_FORBIDDEN' }); return; }
    const data = createSchema.parse(req.body);
    const t = await prisma.emailTemplate.create({
      data: { orgId, name: data.name, subject: data.subject, body: data.body, createdById: req.user!.userId },
      select: { id: true, name: true, subject: true, body: true, createdById: true, createdAt: true, updatedAt: true, archivedAt: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
    await audit({ orgId, actorId: req.user!.userId, action: 'EMAIL_TEMPLATE_CREATED', targetType: 'email_template', targetId: t.id, summary: `email template "${t.name}" created` });
    res.status(201).json({ template: serializeTemplate(t) });
  } catch (err) { next(err); }
});

// PATCH /:id — обновить шаблон (только OWNER/ADMIN).
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!isManager(req.user!.role)) { res.status(403).json({ error: 'Only workspace admins can manage email templates', code: 'TEMPLATE_FORBIDDEN' }); return; }
    const data = updateSchema.parse(req.body);
    if (Object.keys(data).length === 0) { res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' }); return; }
    const existing = await prisma.emailTemplate.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }); return; }
    const t = await prisma.emailTemplate.update({
      where: { id: existing.id }, data,
      select: { id: true, name: true, subject: true, body: true, createdById: true, createdAt: true, updatedAt: true, archivedAt: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
    await audit({ orgId, actorId: req.user!.userId, action: 'EMAIL_TEMPLATE_UPDATED', targetType: 'email_template', targetId: t.id, summary: `email template "${t.name}" updated [${Object.keys(data).join(', ')}]` });
    res.json({ template: serializeTemplate(t) });
  } catch (err) { next(err); }
});

// POST /:id/archive — архивировать шаблон (только OWNER/ADMIN). Идемпотентно.
router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!isManager(req.user!.role)) { res.status(403).json({ error: 'Only workspace admins can manage email templates', code: 'TEMPLATE_FORBIDDEN' }); return; }
    const existing = await prisma.emailTemplate.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, archivedAt: true } });
    if (!existing) { res.status(404).json({ error: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }); return; }
    if (!existing.archivedAt) {
      await prisma.emailTemplate.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
      await audit({ orgId, actorId: req.user!.userId, action: 'EMAIL_TEMPLATE_ARCHIVED', targetType: 'email_template', targetId: existing.id, summary: `email template archived` });
    }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
