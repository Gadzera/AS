/**
 * Record comments (M22-1). Монтируется на /api/records → пути /:recordId/comments[/:commentId].
 * RBAC: чтение = OBJECT READ, создание/правка/удаление = OBJECT READ_WRITE (+ автор/admin для edit/delete в сервисе).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, isManager } from '../services/permissions';
import { createComment, editComment, deleteComment, listComments, CommentError } from '../services/comments';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

function handle(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommentError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
  if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid comment', code: 'COMMENT_INVALID', issues: err.issues }); return; }
  next(err);
}

// objectId записи (org-scoped) для RBAC-гейта; 404 если нет
async function recordObjectId(orgId: string, recordId: string): Promise<string | null> {
  const r = await prisma.record.findFirst({ where: { id: recordId, orgId, archivedAt: null }, select: { objectId: true } });
  return r?.objectId ?? null;
}

const bodySchema = z.object({ body: z.string().trim().min(1).max(4000), parentId: z.string().min(1).optional() });

// GET /:recordId/comments
router.get('/:recordId/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectId = await recordObjectId(orgId, req.params.recordId);
    if (!objectId) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', objectId))) return;
    res.json(await listComments(orgId, req.params.recordId));
  } catch (err) { handle(err, res, next); }
});

// POST /:recordId/comments
router.post('/:recordId/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectId = await recordObjectId(orgId, req.params.recordId);
    if (!objectId) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', objectId))) return;
    const { body, parentId } = bodySchema.parse(req.body);
    const r = await createComment(orgId, req.params.recordId, { userId: req.user!.userId }, body, parentId);
    res.status(201).json(r);
  } catch (err) { handle(err, res, next); }
});

// PATCH /:recordId/comments/:commentId
router.patch('/:recordId/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectId = await recordObjectId(orgId, req.params.recordId);
    if (!objectId) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', objectId))) return;
    const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
    const r = await editComment(orgId, req.params.recordId, req.params.commentId, { userId: req.user!.userId, isManager: isManager(req.user!.role) }, body);
    res.json(r);
  } catch (err) { handle(err, res, next); }
});

// DELETE /:recordId/comments/:commentId — soft-delete (автор или admin)
router.delete('/:recordId/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectId = await recordObjectId(orgId, req.params.recordId);
    if (!objectId) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', objectId))) return;
    const r = await deleteComment(orgId, req.params.recordId, req.params.commentId, { userId: req.user!.userId, isManager: isManager(req.user!.role) });
    res.json(r);
  } catch (err) { handle(err, res, next); }
});

export default router;
