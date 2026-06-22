/**
 * Record tasks (M27-2). Монтируется на /api/records → /:recordId/tasks[/:taskId].
 * RBAC: чтение = OBJECT READ; создание = OBJECT READ_WRITE; update/complete/delete = creator, assignee или OWNER/ADMIN.
 * Assignee = активный пользователь той же org. dueAt строго ISO. complete идемпотентен. Archived record → 409 RECORD_ARCHIVED.
 * TASK_ASSIGNED notification при назначении/переназначении (НЕ если assignee===actor); дедуп по taskId+assignee+assignmentVersion.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, TaskStatus, TaskPriority } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, isManager } from '../services/permissions';
import { audit } from '../services/audit';
import { notify } from '../services/notifications';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

const createSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(8000).nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});
const updateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(8000).nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});

const taskSelect = {
  id: true, title: true, description: true, status: true, priority: true, dueAt: true,
  completedAt: true, createdAt: true, updatedAt: true, recordId: true,
  assignee: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

async function recordForOp(orgId: string, recordId: string): Promise<{ objectId: string; archived: boolean } | null> {
  const r = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true, archivedAt: true } });
  return r ? { objectId: r.objectId, archived: r.archivedAt !== null } : null;
}
// assignee обязан быть активным пользователем ЭТОЙ org
async function validAssignee(orgId: string, assigneeId: string): Promise<boolean> {
  const u = await prisma.user.findFirst({ where: { id: assigneeId, orgId, isActive: true }, select: { id: true } });
  return !!u;
}

// GET /:recordId/tasks
router.get('/:recordId/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;
    const tasks = await prisma.task.findMany({
      where: { recordId: req.params.recordId, orgId, archivedAt: null },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      select: taskSelect,
    });
    res.json({ tasks });
  } catch (err) { next(err); }
});

// POST /:recordId/tasks
router.post('/:recordId/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const actorId = req.user!.userId;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    if (rec.archived) { res.status(409).json({ error: 'This record is archived — no new tasks can be added.', code: 'RECORD_ARCHIVED' }); return; }
    const data = createSchema.parse(req.body);
    if (data.assigneeId && !(await validAssignee(orgId, data.assigneeId))) { res.status(422).json({ error: 'Assignee must be an active member of this workspace', code: 'INVALID_ASSIGNEE' }); return; }

    const assigned = data.assigneeId ?? null;
    const task = await prisma.task.create({
      data: {
        orgId, recordId: req.params.recordId, title: data.title, description: data.description ?? null,
        priority: data.priority ?? TaskPriority.NORMAL, dueAt: data.dueAt ? new Date(data.dueAt) : null,
        assigneeId: assigned, assignmentVersion: assigned ? 1 : 0, createdById: actorId,
      },
      select: taskSelect,
    });
    await prisma.activity.create({ data: { orgId, recordId: req.params.recordId, actorId, type: 'TASK_CREATED', title: `Task created: ${data.title}`, taskId: task.id } });
    await audit({ orgId, actorId, action: 'TASK_CREATED', targetType: 'task', targetId: task.id, summary: `task created on record ${req.params.recordId}${assigned ? ` · assigned ${assigned}` : ''}` });
    // TASK_ASSIGNED — только если назначили НЕ себе (Q4); дедуп по версии назначения.
    if (assigned && assigned !== actorId) {
      await notify({ orgId, source: 'SYSTEM', type: 'TASK_ASSIGNED', title: `You were assigned a task: ${data.title}`, body: data.title.slice(0, 140), entityType: 'task', entityId: task.id, dedupeKey: `task-assigned:${task.id}:${assigned}:1`, recipientUserIds: [assigned] });
    }
    res.status(201).json(task);
  } catch (err) { next(err); }
});

// PATCH /:recordId/tasks/:taskId
router.patch('/:recordId/tasks/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const actorId = req.user!.userId;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    if (rec.archived) { res.status(409).json({ error: 'This record is archived — tasks cannot be changed.', code: 'RECORD_ARCHIVED' }); return; }
    const data = updateSchema.parse(req.body);

    const existing = await prisma.task.findFirst({ where: { id: req.params.taskId, recordId: req.params.recordId, orgId, archivedAt: null }, select: { id: true, createdById: true, assigneeId: true, status: true, assignmentVersion: true, title: true } });
    if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }
    // ownership: creator, assignee или OWNER/ADMIN
    const canMutate = existing.createdById === actorId || existing.assigneeId === actorId || isManager(req.user!.role);
    if (!canMutate) { res.status(403).json({ error: 'Only the creator, assignee or an admin can change this task', code: 'PERMISSION_DENIED' }); return; }

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueAt !== undefined) patch.dueAt = data.dueAt ? new Date(data.dueAt) : null;

    // смена assignee → валидация + версия + (позже) notify
    let newAssignee: string | null | undefined;
    let newVersion = existing.assignmentVersion;
    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      if (data.assigneeId && !(await validAssignee(orgId, data.assigneeId))) { res.status(422).json({ error: 'Assignee must be an active member of this workspace', code: 'INVALID_ASSIGNEE' }); return; }
      newAssignee = data.assigneeId;
      newVersion = existing.assignmentVersion + 1;
      patch.assigneeId = data.assigneeId;
      patch.assignmentVersion = newVersion;
    }

    // статус/complete — идемпотентно: TASK_COMPLETED только при ПЕРЕХОДЕ в COMPLETED.
    // Матрица переходов: COMPLETED/CANCELED — терминальные, выйти можно только в OPEN/IN_PROGRESS (reopen).
    let justCompleted = false;
    if (data.status !== undefined && data.status !== existing.status) {
      const fromTerminal = existing.status === TaskStatus.COMPLETED || existing.status === TaskStatus.CANCELED;
      const toActive = data.status === TaskStatus.OPEN || data.status === TaskStatus.IN_PROGRESS;
      if (fromTerminal && !toActive) {
        res.status(422).json({ error: 'This task is already finished — reopen it before changing to another state.', code: 'INVALID_STATUS_TRANSITION' });
        return;
      }
      patch.status = data.status;
      if (data.status === TaskStatus.COMPLETED) { patch.completedAt = new Date(); justCompleted = true; }
      else if (existing.status === TaskStatus.COMPLETED) { patch.completedAt = null; } // снятие завершения
    }

    if (Object.keys(patch).length === 0) {
      const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: existing.id }, select: taskSelect });
      res.json(unchanged); return; // no-op
    }

    const task = await prisma.task.update({ where: { id: existing.id }, data: patch, select: taskSelect });

    if (justCompleted) {
      await prisma.activity.create({ data: { orgId, recordId: req.params.recordId, actorId, type: 'TASK_COMPLETED', title: `Task completed: ${task.title}`, taskId: task.id } });
    }
    await audit({ orgId, actorId, action: 'TASK_UPDATED', targetType: 'task', targetId: task.id, summary: `task updated on record ${req.params.recordId} · changed [${Object.keys(patch).join(', ')}]` });
    // notify нового assignee (не себе) — дедуп по новой версии
    if (newAssignee && newAssignee !== actorId) {
      await notify({ orgId, source: 'SYSTEM', type: 'TASK_ASSIGNED', title: `You were assigned a task: ${task.title}`, body: task.title.slice(0, 140), entityType: 'task', entityId: task.id, dedupeKey: `task-assigned:${task.id}:${newAssignee}:${newVersion}`, recipientUserIds: [newAssignee] });
    }
    res.json(task);
  } catch (err) { next(err); }
});

// DELETE /:recordId/tasks/:taskId — soft-archive (creator/assignee/OWNER/ADMIN)
router.delete('/:recordId/tasks/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const actorId = req.user!.userId;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    if (rec.archived) { res.status(409).json({ error: 'This record is archived.', code: 'RECORD_ARCHIVED' }); return; }

    const existing = await prisma.task.findFirst({ where: { id: req.params.taskId, recordId: req.params.recordId, orgId, archivedAt: null }, select: { id: true, createdById: true, assigneeId: true } });
    if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }
    const canMutate = existing.createdById === actorId || existing.assigneeId === actorId || isManager(req.user!.role);
    if (!canMutate) { res.status(403).json({ error: 'Only the creator, assignee or an admin can delete this task', code: 'PERMISSION_DENIED' }); return; }

    await prisma.task.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    await audit({ orgId, actorId, action: 'TASK_DELETED', targetType: 'task', targetId: existing.id, summary: `task deleted on record ${req.params.recordId}` });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
