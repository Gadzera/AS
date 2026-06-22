/**
 * Permissions / RBAC management (M21-1, S345/S346/S348/S349). /api/permissions.
 * Управление грантами — ТОЛЬКО OWNER/ADMIN (management-tier). MEMBER → 403.
 *  GET  /            — матрица: workspace-дефолты по видам + все гранты + каталог сущностей для override
 *  PUT  /grant       — выставить уровень доступа (scope/subject/entityKind/entityKey → level)
 *  DELETE /grant     — снять override (вернуть к наследуемому)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, AccessLevel, EntityKind, PermissionScope } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { isManager, listGrants, setGrant, clearGrant, ensurePermissionDefaults, ALL_ENTITY_KINDS, WS_SUBJECT, teamSubject, listAutomationGrants, setAutomationGrant, clearAutomationGrant } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

function requireManager(req: Request, res: Response): boolean {
  if (!isManager(req.user!.role)) { res.status(403).json({ error: 'Only the owner or an admin can manage permissions', code: 'PERMISSION_ADMIN_ONLY' }); return false; }
  return true;
}

const grantSchema = z.object({
  scope: z.enum(['WORKSPACE', 'TEAM', 'INDIVIDUAL']),
  subjectKey: z.string().min(1).max(120),
  entityKind: z.enum(['OBJECT', 'LIST', 'DASHBOARD', 'WORKFLOW', 'SEQUENCE']),
  entityKey: z.string().min(1).max(120), // '*' (kind default) | '<entityId>'
  level: z.enum(['NONE', 'READ', 'READ_WRITE', 'FULL']),
});

// GET / — матрица прав + каталог сущностей
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    await ensurePermissionDefaults(orgId);
    const grants = await listGrants(orgId);
    const workspaceDefaults: Record<string, AccessLevel> = {};
    for (const g of grants) if (g.scope === 'WORKSPACE' && g.subjectKey === WS_SUBJECT && g.entityKey === '*') workspaceDefaults[g.entityKind] = g.level;

    const [objects, lists, dashboards, reports, workflows, campaigns] = await Promise.all([
      prisma.object.findMany({ where: { orgId, archivedAt: null }, select: { id: true, pluralName: true } }),
      prisma.list.findMany({ where: { orgId }, select: { id: true, name: true } }),
      prisma.dashboard.findMany({ where: { orgId }, select: { id: true, name: true } }),
      prisma.report.findMany({ where: { orgId }, select: { id: true, name: true } }),
      prisma.workflow.findMany({ where: { orgId }, select: { id: true, name: true } }),
      prisma.campaign.findMany({ where: { orgId }, select: { id: true, name: true } }),
    ]);
    const entities: Record<string, { id: string; name: string }[]> = {
      OBJECT: objects.map((o) => ({ id: o.id, name: o.pluralName })),
      LIST: lists.map((l) => ({ id: l.id, name: l.name })),
      DASHBOARD: [...dashboards.map((d) => ({ id: d.id, name: d.name })), ...reports.map((r) => ({ id: r.id, name: `${r.name} (report)` }))],
      WORKFLOW: workflows.map((w) => ({ id: w.id, name: w.name })),
      SEQUENCE: campaigns.map((c) => ({ id: c.id, name: c.name })),
    };
    // M21-2: команды (для Team-override) + пользователи (для Individual-override) + automation-гранты
    const [teams, users, automationGrants] = await Promise.all([
      prisma.team.findMany({ where: { orgId }, orderBy: [{ isExternal: 'asc' }, { name: 'asc' }], include: { members: { select: { userId: true } } } }),
      prisma.user.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, email: true, role: true } }),
      listAutomationGrants(orgId),
    ]);
    res.json({
      kinds: ALL_ENTITY_KINDS, workspaceDefaults, grants, entities,
      teams: teams.map((t) => ({ id: t.id, name: t.name, isExternal: t.isExternal, subjectKey: teamSubject(t.id), memberIds: t.members.map((m) => m.userId) })),
      users, automationGrants,
    });
  } catch (err) { next(err); }
});

// PUT /grant — выставить уровень
router.put('/grant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const body = grantSchema.parse(req.body);
    await setGrant(orgId, req.user!.userId, body as { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string; level: AccessLevel });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid grant', code: 'GRANT_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

// DELETE /grant — снять override (workspace kind-default снимать нельзя — он базовый)
const clearSchema = grantSchema.omit({ level: true });
router.delete('/grant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const body = clearSchema.parse(req.body);
    if (body.scope === 'WORKSPACE' && body.subjectKey === WS_SUBJECT && body.entityKey === '*') {
      res.status(400).json({ error: 'Workspace kind-default cannot be cleared — set its level instead', code: 'CANNOT_CLEAR_DEFAULT' }); return;
    }
    await clearGrant(orgId, req.user!.userId, body as { scope: PermissionScope; subjectKey: string; entityKind: EntityKind; entityKey: string });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid grant', code: 'GRANT_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

// ── Automation grants (S352): доступ воркфлоу к сущности (READ|READ_WRITE) ──
const autoSchema = z.object({ workflowId: z.string().min(1), entityKind: z.enum(['OBJECT', 'LIST', 'DASHBOARD', 'WORKFLOW', 'SEQUENCE']), entityKey: z.string().min(1).max(120), level: z.enum(['READ', 'READ_WRITE']) });
router.put('/automation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const body = autoSchema.parse(req.body);
    // воркфлоу должен принадлежать org
    const wf = await prisma.workflow.findFirst({ where: { id: body.workflowId, orgId }, select: { id: true } });
    if (!wf) { res.status(404).json({ error: 'Workflow not found', code: 'WORKFLOW_NOT_FOUND' }); return; }
    await setAutomationGrant(orgId, req.user!.userId, body as { workflowId: string; entityKind: EntityKind; entityKey: string; level: AccessLevel });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid automation grant', code: 'AUTO_GRANT_INVALID', issues: err.issues }); return; }
    next(err);
  }
});
router.delete('/automation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const body = autoSchema.omit({ level: true }).parse(req.body);
    await clearAutomationGrant(orgId, req.user!.userId, body as { workflowId: string; entityKind: EntityKind; entityKey: string });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid automation grant', code: 'AUTO_GRANT_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

export default router;
