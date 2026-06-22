/**
 * Record panels (M27-3): Calls / Emails на странице записи. Монтируется на /api/records → /:recordId/calls|emails.
 * RBAC: чтение = OBJECT READ на запись (не раскрываем calls/emails записи, к объекту которой нет доступа).
 *  • Calls — реальные звонки M19, привязанные через CallAssociatedRecord (НЕ эвристика по lead/email). Unlink = OBJECT READ_WRITE.
 *  • Emails — только Email.recordId === recordId (реальные/демо/draft, если реально связаны). Внешний sync — deferred stub (фронт).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

async function recordForOp(orgId: string, recordId: string): Promise<{ objectId: string; archived: boolean } | null> {
  const r = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true, archivedAt: true } });
  return r ? { objectId: r.objectId, archived: r.archivedAt !== null } : null;
}

// GET /:recordId/calls — звонки, реально привязанные к записи через CallAssociatedRecord.
router.get('/:recordId/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;

    const links = await prisma.callAssociatedRecord.findMany({ where: { orgId, recordId: req.params.recordId }, select: { callId: true, associationType: true } });
    const linkType = new Map(links.map((l) => [l.callId, l.associationType]));
    const calls = links.length
      ? await prisma.call.findMany({
          where: { id: { in: links.map((l) => l.callId) }, orgId, archivedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true, direction: true, status: true, outcome: true, durationSec: true, summary: true, aiIntent: true, nextStep: true, createdAt: true },
        })
      : [];
    res.json({ calls: calls.map((c) => ({ ...c, associationType: linkType.get(c.id) ?? 'manual' })) });
  } catch (err) { next(err); }
});

// DELETE /:recordId/calls/:callId — отвязать звонок от записи (сам звонок не удаляется). OBJECT READ_WRITE.
router.delete('/:recordId/calls/:callId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rec.objectId))) return;
    // unlink — это cleanup (удаление связи, не создание контента), поэтому НАМЕРЕННО разрешён и на archived записи.
    await prisma.callAssociatedRecord.deleteMany({ where: { orgId, callId: req.params.callId, recordId: req.params.recordId } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /:recordId/emails — письма, реально связанные с записью (Email.recordId). Без внешнего inbox-sync.
router.get('/:recordId/emails', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const rec = await recordForOp(orgId, req.params.recordId);
    if (!rec) { res.status(404).json({ error: 'Record not found', code: 'RECORD_NOT_FOUND' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', rec.objectId))) return;

    const emails = await prisma.email.findMany({
      where: { recordId: req.params.recordId, orgId, archivedAt: null }, // адверс HIGH: архивные письма не показываем (симметрия с calls)
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, direction: true, status: true, subject: true, fromEmail: true, toEmails: true, bodyText: true, aiGenerated: true, demo: true, sentAt: true, createdAt: true },
    });
    res.json({ emails: emails.map((e) => ({ ...e, snippet: (e.bodyText ?? '').slice(0, 180), bodyText: undefined })) });
  } catch (err) { next(err); }
});

export default router;
