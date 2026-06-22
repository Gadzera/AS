/**
 * Insight-шаблоны Call Intelligence (M19-1). CRUD шаблонов с секциями + scope/permissions.
 * Маршрут /api/call-insight-templates. Прогон шаблона над звонком — в routes/calls.ts.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, InsightTemplateScope, InsightOutputFormat } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';
import {
  CallInsightError,
  ensureSystemTemplates,
  visibleTemplatesWhere,
  canEditTemplate,
  validateSections,
  MAX_SECTIONS,
  type SectionInput,
} from '../services/callInsights';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

function isManager(role: string): boolean { return role === 'OWNER' || role === 'ADMIN'; }

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(4000),
  outputFormat: z.nativeEnum(InsightOutputFormat).default(InsightOutputFormat.TEXT),
  order: z.number().int().min(0).optional(),
});
const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullish(),
  scope: z.nativeEnum(InsightTemplateScope).default(InsightTemplateScope.PERSONAL),
  sections: z.array(sectionSchema).max(MAX_SECTIONS + 5), // финально проверит validateSections
});

function serializeTemplate(t: {
  id: string; name: string; description: string | null; scope: InsightTemplateScope; ownerId: string | null; isSystem: boolean; version: number; createdById: string | null; createdAt: Date; updatedAt: Date;
  sections: { id: string; title: string; prompt: string; outputFormat: InsightOutputFormat; order: number }[];
}, userId: string, role: string) {
  return {
    id: t.id, name: t.name, description: t.description, scope: t.scope, ownerId: t.ownerId, isSystem: t.isSystem, version: t.version,
    editable: canEditTemplate(t, userId, role),
    sections: [...t.sections].sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, title: s.title, prompt: s.prompt, outputFormat: s.outputFormat, order: s.order })),
    createdAt: t.createdAt, updatedAt: t.updatedAt,
  };
}

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CallInsightError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
  if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid template', code: 'TEMPLATE_BODY_INVALID', issues: err.issues }); return; }
  next(err);
}

// GET / — видимые шаблоны (+ сид системных)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    await ensureSystemTemplates(orgId);
    const templates = await prisma.insightTemplate.findMany({
      where: visibleTemplatesWhere(orgId, req.user!.userId, req.user!.role),
      include: { sections: { orderBy: { order: 'asc' } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    res.json({ templates: templates.map((t) => serializeTemplate(t, req.user!.userId, req.user!.role)) });
  } catch (err) { next(err); }
});

// POST / — создать (WORKSPACE → manager; PERSONAL → любой, ownerId=self)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = templateSchema.parse(req.body);
    if (body.scope === InsightTemplateScope.WORKSPACE && !isManager(req.user!.role)) {
      res.status(403).json({ error: 'Only the owner or an admin can create workspace templates', code: 'TEMPLATE_EDIT_DENIED' });
      return;
    }
    validateSections(body.sections as SectionInput[]);
    const created = await prisma.insightTemplate.create({
      data: {
        orgId, name: body.name, description: body.description ?? null, scope: body.scope,
        ownerId: body.scope === InsightTemplateScope.PERSONAL ? req.user!.userId : null,
        isSystem: false, version: 1, createdById: req.user!.userId,
        sections: { create: body.sections.map((s, i) => ({ orgId, title: s.title, prompt: s.prompt, outputFormat: s.outputFormat, order: s.order ?? i })) },
      },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
    await audit({ orgId, actorId: req.user!.userId, action: 'CALL_TEMPLATE_CREATED', targetType: 'insight_template', targetId: created.id, summary: `${created.scope} "${created.name}" · ${created.sections.length} sections` });
    res.status(201).json({ template: serializeTemplate(created, req.user!.userId, req.user!.role) });
  } catch (err) { handleErr(err, res, next); }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const t = await prisma.insightTemplate.findFirst({ where: { id: req.params.id, ...visibleTemplatesWhere(orgId, req.user!.userId, req.user!.role) }, include: { sections: { orderBy: { order: 'asc' } } } });
    if (!t) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json({ template: serializeTemplate(t, req.user!.userId, req.user!.role) });
  } catch (err) { next(err); }
});

// PATCH /:id — правка (system → 403 immutable; personal → owner; workspace → manager). version++.
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.insightTemplate.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, isSystem: true, scope: true, ownerId: true } });
    if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }
    if (existing.isSystem) { res.status(403).json({ error: 'System templates cannot be edited', code: 'SYSTEM_TEMPLATE_IMMUTABLE' }); return; }
    if (!canEditTemplate(existing, req.user!.userId, req.user!.role)) { res.status(403).json({ error: 'You cannot edit this template', code: 'TEMPLATE_EDIT_DENIED' }); return; }

    const body = templateSchema.parse(req.body);
    if (body.scope === InsightTemplateScope.WORKSPACE && !isManager(req.user!.role)) { res.status(403).json({ error: 'Only a manager can make a template workspace-wide', code: 'TEMPLATE_EDIT_DENIED' }); return; }
    // Адверс-ревью M3: запрет «угона» — WORKSPACE-шаблон нельзя превратить в личный (он стал бы приватным у редактора).
    if (existing.scope === InsightTemplateScope.WORKSPACE && body.scope === InsightTemplateScope.PERSONAL) {
      res.status(400).json({ error: 'A workspace template cannot be converted to personal — duplicate it instead', code: 'SCOPE_DOWNGRADE_FORBIDDEN' });
      return;
    }
    validateSections(body.sections as SectionInput[]);

    // Полная замена секций + version++ (входит в run-idempotency → новый платный run после правки)
    const updated = await prisma.$transaction(async (tx) => {
      await tx.insightTemplateSection.deleteMany({ where: { templateId: existing.id } });
      return tx.insightTemplate.update({
        where: { id: existing.id },
        data: {
          name: body.name, description: body.description ?? null, scope: body.scope,
          ownerId: body.scope === InsightTemplateScope.PERSONAL ? (existing.ownerId ?? req.user!.userId) : null,
          version: { increment: 1 },
          sections: { create: body.sections.map((s, i) => ({ orgId, title: s.title, prompt: s.prompt, outputFormat: s.outputFormat, order: s.order ?? i })) },
        },
        include: { sections: { orderBy: { order: 'asc' } } },
      });
    });
    await audit({ orgId, actorId: req.user!.userId, action: 'CALL_TEMPLATE_UPDATED', targetType: 'insight_template', targetId: updated.id, summary: `v${updated.version} "${updated.name}" · ${updated.sections.length} sections` });
    res.json({ template: serializeTemplate(updated, req.user!.userId, req.user!.role) });
  } catch (err) { handleErr(err, res, next); }
});

// DELETE /:id — archive (system → 403)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.insightTemplate.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, isSystem: true, scope: true, ownerId: true, name: true } });
    if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }
    if (existing.isSystem) { res.status(403).json({ error: 'System templates cannot be deleted', code: 'SYSTEM_TEMPLATE_IMMUTABLE' }); return; }
    if (!canEditTemplate(existing, req.user!.userId, req.user!.role)) { res.status(403).json({ error: 'You cannot delete this template', code: 'TEMPLATE_EDIT_DENIED' }); return; }
    await prisma.insightTemplate.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await audit({ orgId, actorId: req.user!.userId, action: 'CALL_TEMPLATE_DELETED', targetType: 'insight_template', targetId: existing.id, summary: `archived "${existing.name}"` });
    res.json({ ok: true });
  } catch (err) { handleErr(err, res, next); }
});

export default router;
