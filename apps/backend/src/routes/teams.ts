/**
 * Teams / Expert groups (M21-2, S350/S351/S353/S356). /api/teams. Управление — только OWNER/ADMIN.
 * Команда = область Team для permission-грантов (subjectKey 'team:<id>'). isExternal=true → expert group
 * (его участники не наследуют workspace-дефолты — только явные гранты, иначе NONE; см. permissions.buildResolver).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';
import { isManager, teamSubject } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

function requireManager(req: Request, res: Response): boolean {
  if (!isManager(req.user!.role)) { res.status(403).json({ error: 'Only the owner or an admin can manage teams', code: 'PERMISSION_ADMIN_ONLY' }); return false; }
  return true;
}

// GET / — команды с участниками (+ доступные пользователи для добавления)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const [teams, users] = await Promise.all([
      prisma.team.findMany({ where: { orgId }, orderBy: [{ isExternal: 'asc' }, { name: 'asc' }], include: { members: { select: { userId: true } } } }),
      prisma.user.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, email: true, role: true } }),
    ]);
    res.json({
      teams: teams.map((t) => ({ id: t.id, name: t.name, description: t.description, color: t.color, isExternal: t.isExternal, subjectKey: teamSubject(t.id), memberIds: t.members.map((m) => m.userId) })),
      users,
    });
  } catch (err) { next(err); }
});

const createSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(400).nullish(), color: z.string().max(40).nullish(), isExternal: z.boolean().optional() });

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const body = createSchema.parse(req.body);
    try {
      const team = await prisma.team.create({ data: { orgId, name: body.name, description: body.description ?? null, color: body.color ?? null, isExternal: body.isExternal ?? false, createdById: req.user!.userId } });
      await audit({ orgId, actorId: req.user!.userId, action: 'TEAM_CREATED', targetType: 'team', targetId: team.id, summary: `${team.name}${team.isExternal ? ' (expert)' : ''}` });
      res.status(201).json({ team: { id: team.id, name: team.name, description: team.description, color: team.color, isExternal: team.isExternal, subjectKey: teamSubject(team.id), memberIds: [] } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') { res.status(409).json({ error: 'A team with this name already exists', code: 'TEAM_NAME_TAKEN' }); return; }
      throw e;
    }
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid team', code: 'TEAM_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

const patchSchema = createSchema.partial();
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const existing = await prisma.team.findFirst({ where: { id: req.params.id, orgId }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Team not found', code: 'TEAM_NOT_FOUND' }); return; }
    const body = patchSchema.parse(req.body);
    const team = await prisma.team.update({ where: { id: existing.id }, data: { ...(body.name !== undefined && { name: body.name }), ...(body.description !== undefined && { description: body.description }), ...(body.color !== undefined && { color: body.color }), ...(body.isExternal !== undefined && { isExternal: body.isExternal }) } });
    await audit({ orgId, actorId: req.user!.userId, action: 'TEAM_UPDATED', targetType: 'team', targetId: team.id, summary: team.name });
    res.json({ team: { id: team.id, name: team.name, description: team.description, color: team.color, isExternal: team.isExternal, subjectKey: teamSubject(team.id) } });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid team', code: 'TEAM_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

// DELETE /:id — удаляет команду + её permission-гранты (subjectKey 'team:<id>') + членство (cascade)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const existing = await prisma.team.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, name: true } });
    if (!existing) { res.status(404).json({ error: 'Team not found', code: 'TEAM_NOT_FOUND' }); return; }
    await prisma.$transaction([
      prisma.permissionGrant.deleteMany({ where: { orgId, scope: 'TEAM', subjectKey: teamSubject(existing.id) } }),
      prisma.team.delete({ where: { id: existing.id } }), // members cascade
    ]);
    await audit({ orgId, actorId: req.user!.userId, action: 'TEAM_DELETED', targetType: 'team', targetId: existing.id, summary: existing.name });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

const membersSchema = z.object({ userIds: z.array(z.string().min(1)).min(1).max(200) });
router.post('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const team = await prisma.team.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, name: true } });
    if (!team) { res.status(404).json({ error: 'Team not found', code: 'TEAM_NOT_FOUND' }); return; }
    const { userIds } = membersSchema.parse(req.body);
    // только пользователи этой org
    const valid = await prisma.user.findMany({ where: { id: { in: userIds }, orgId }, select: { id: true } });
    await prisma.teamMember.createMany({ data: valid.map((u) => ({ orgId, teamId: team.id, userId: u.id })), skipDuplicates: true });
    await audit({ orgId, actorId: req.user!.userId, action: 'TEAM_MEMBER_ADDED', targetType: 'team', targetId: team.id, summary: `+${valid.length} to ${team.name}` });
    res.json({ added: valid.length });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid members', code: 'MEMBERS_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

router.delete('/:id/members/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const team = await prisma.team.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, name: true } });
    if (!team) { res.status(404).json({ error: 'Team not found', code: 'TEAM_NOT_FOUND' }); return; }
    await prisma.teamMember.deleteMany({ where: { orgId, teamId: team.id, userId: req.params.userId } });
    await audit({ orgId, actorId: req.user!.userId, action: 'TEAM_MEMBER_REMOVED', targetType: 'team', targetId: team.id, summary: `removed member from ${team.name}` });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
