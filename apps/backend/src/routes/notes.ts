/**
 * Record notes (M27-2). Монтируется на /api/records → /:recordId/notes[/:noteId].
 * RBAC: чтение = OBJECT READ; создание = OBJECT READ_WRITE; правка/удаление = автор или OWNER/ADMIN.
 * Notes = простой текст (БЕЗ @mentions/notify — Q3). Soft-delete: deletedAt/deletedById, body скрывается плейсхолдером,
 * Activity сохраняется (без body). Archived record → 409 RECORD_ARCHIVED на любые мутации.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, isManager } from '../services/permissions';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

const bodySchema = z.object({ body: z.string().trim().min(1).max(8000) });

// Запись для операции: objectId + признак archived (не фильтруем archivedAt, чтобы отличать 404 от 409).
async function recordForOp(orgId: string, recordId: string): Promise<{ objectId: string; archived: boolean } | null> {
  const r = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true, archivedAt: true } });
  return r ? { objectId: r.objectId, archived: r.archivedAt !== null } : null;
}

const DELETED_PLACEHOLDER = 'This note was deleted.';
function serializeNote(n: { id: string; body: string; createdAt: Date; updatedAt: Date; editedAt: Date | null; deletedAt: Date | null; author: { id: string; name: string | null; email: string } | null }) {
  const deleted = n.deletedAt !== null;
  return {
    id: n.id,
    body: deleted ? null : n.body,
    placeholder: deleted ? DELETED_PLACEHOLDER : undefined,
    deleted,
    edited: n.editedAt !== null,
    author: n.author,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

// GET /:recordId/notes
router.get('/:recordId/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;
    const notes = await prisma.note.findMany({
      where: { recordId: req.params.recordId, orgId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, body: true, createdAt: true, updatedAt: true, editedAt: true, deletedAt: true, author: { select: { id: true, name: true, email: true } } },
    });
    res.json({ notes: notes.map(serializeNote) });
  } catch (err) { next(err); }
});

// POST /:recordId/notes
router.post('/:recordId/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    if (rec.archived) { res.status(409).json({ error: 'This record is archived — no new notes can be added.', code: 'RECORD_ARCHIVED' }); return; }
    const data = bodySchema.parse(req.body);

    const note = await prisma.note.create({
      data: { orgId, recordId: req.params.recordId, authorId: req.user!.userId, body: data.body },
      select: { id: true, body: true, createdAt: true, updatedAt: true, editedAt: true, deletedAt: true, author: { select: { id: true, name: true, email: true } } },
    });
    await prisma.activity.create({ data: { orgId, recordId: req.params.recordId, actorId: req.user!.userId, type: 'NOTE_CREATED', title: 'Note added', noteId: note.id } });
    await audit({ orgId, actorId: req.user!.userId, action: 'NOTE_CREATED', targetType: 'note', targetId: note.id, summary: `note added on record ${req.params.recordId}` });
    res.status(201).json(serializeNote(note));
  } catch (err) { next(err); }
});

// PATCH /:recordId/notes/:noteId — правка тела (автор или OWNER/ADMIN)
router.patch('/:recordId/notes/:noteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    if (rec.archived) { res.status(409).json({ error: 'This record is archived — notes cannot be edited.', code: 'RECORD_ARCHIVED' }); return; }
    const data = bodySchema.parse(req.body);

    const existing = await prisma.note.findFirst({ where: { id: req.params.noteId, recordId: req.params.recordId, orgId, archivedAt: null }, select: { id: true, authorId: true, deletedAt: true } });
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return; }
    if (existing.deletedAt) { res.status(409).json({ error: 'This note was deleted.', code: 'NOTE_DELETED' }); return; }
    const isOwner = existing.authorId === req.user!.userId;
    if (!isOwner && !isManager(req.user!.role)) { res.status(403).json({ error: 'Only the author or an admin can edit this note', code: 'PERMISSION_DENIED' }); return; }

    const note = await prisma.note.update({
      where: { id: existing.id },
      data: { body: data.body, editedAt: new Date() },
      select: { id: true, body: true, createdAt: true, updatedAt: true, editedAt: true, deletedAt: true, author: { select: { id: true, name: true, email: true } } },
    });
    await prisma.activity.create({ data: { orgId, recordId: req.params.recordId, actorId: req.user!.userId, type: 'NOTE_UPDATED', title: 'Note edited', noteId: note.id } });
    await audit({ orgId, actorId: req.user!.userId, action: 'NOTE_UPDATED', targetType: 'note', targetId: note.id, summary: `note edited on record ${req.params.recordId}` });
    res.json(serializeNote(note));
  } catch (err) { next(err); }
});

// DELETE /:recordId/notes/:noteId — SOFT-delete (автор или OWNER/ADMIN). Activity сохраняется, body скрыт.
router.delete('/:recordId/notes/:noteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    if (rec.archived) { res.status(409).json({ error: 'This record is archived.', code: 'RECORD_ARCHIVED' }); return; }

    const existing = await prisma.note.findFirst({ where: { id: req.params.noteId, recordId: req.params.recordId, orgId, archivedAt: null }, select: { id: true, authorId: true, deletedAt: true } });
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return; }
    // ownership ПЕРЕД идемпотентным 204 — чтобы не-владелец не получал «успех» на чужой удалённой заметке.
    const isOwner = existing.authorId === req.user!.userId;
    if (!isOwner && !isManager(req.user!.role)) { res.status(403).json({ error: 'Only the author or an admin can delete this note', code: 'PERMISSION_DENIED' }); return; }
    if (existing.deletedAt) { res.status(204).send(); return; } // уже удалена — идемпотентно

    await prisma.note.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: req.user!.userId } });
    // Activity сохраняется (без body в summary — правка GPT).
    await prisma.activity.create({ data: { orgId, recordId: req.params.recordId, actorId: req.user!.userId, type: 'NOTE_UPDATED', title: 'Note deleted', noteId: existing.id } });
    await audit({ orgId, actorId: req.user!.userId, action: 'NOTE_DELETED', targetType: 'note', targetId: existing.id, summary: `note deleted on record ${req.params.recordId}` });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
