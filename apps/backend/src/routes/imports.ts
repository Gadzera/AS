/**
 * Import / Migration — job-flow (M20-1, S330–S338). /api/imports.
 *  POST /            — создать import job (validate raw rows + auto-map + idempotency)
 *  GET  /            — история импортов (фильтры)
 *  GET  /:id         — job + server-side preview (через единый планировщик)
 *  PATCH /:id/mapping— сохранить mapping/dedupeKey → пересчёт статуса
 *  POST /:id/preview — preview по плану (read-only; mapping из тела или сохранённый)
 *  POST /:id/confirm — запустить импорт (CAS-claim READY→RUNNING, общий executor)
 *  POST /:id/cancel  — отменить
 * Старый POST /api/records/import оставлен как legacy quick import (не трогаю).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma, ImportStatus, ImportTargetType } from '@prisma/client';
import { createHash } from 'crypto';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';
import {
  ImportError, validateRawRows, autoMap, planImportRows, executeImport, cleanupPartialImport,
  type ImportMapping,
} from '../services/importJob';
import { rollbackPreview, rollbackConfirm } from '../services/importRollback';
import { assertAccess } from '../services/permissions';

// RBAC: импорт пишет/читает записи цели → нужен доступ к OBJECT (или LIST для list-импорта).
async function assertImportTarget(req: Request, res: Response, job: { targetType: ImportTargetType; objectId: string | null; listId: string | null }, needed: 'READ' | 'READ_WRITE'): Promise<boolean> {
  if (job.targetType === 'LIST' && job.listId) return assertAccess(req, res, 'LIST', needed, job.listId);
  if (job.objectId) return assertAccess(req, res, 'OBJECT', needed, job.objectId);
  return true;
}

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ImportError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; }
  if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid import payload', code: 'IMPORT_BODY_INVALID', issues: err.issues }); return; }
  next(err);
}

const createSchema = z.object({
  targetType: z.enum(['OBJECT', 'LIST']).default('OBJECT'),
  objectKey: z.string().min(1).optional(),
  objectId: z.string().min(1).optional(),
  listId: z.string().min(1).optional(),
  fileName: z.string().min(1).max(255),
  delimiter: z.string().max(4).default(','),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.union([z.array(z.unknown()), z.record(z.unknown())])),
  clientRequestId: z.string().max(120).optional(),
});

function jobSummary(j: { id: string; fileName: string; targetType: ImportTargetType; objectId: string | null; listId: string | null; status: ImportStatus; rowCount: number; createdCount: number; updatedCount: number; skippedCount: number; errorCount: number; processedRows: number; dedupeKey: string | null; createdById: string | null; createdAt: Date; completedAt: Date | null; rolledBackAt: Date | null; rollbackStats: unknown }) {
  return { id: j.id, fileName: j.fileName, targetType: j.targetType, objectId: j.objectId, listId: j.listId, status: j.status, rowCount: j.rowCount, createdCount: j.createdCount, updatedCount: j.updatedCount, skippedCount: j.skippedCount, errorCount: j.errorCount, processedRows: j.processedRows, dedupeKey: j.dedupeKey, createdById: j.createdById, createdAt: j.createdAt, completedAt: j.completedAt, rolledBackAt: j.rolledBackAt, rollbackStats: j.rollbackStats };
}

// POST / — создать job
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = createSchema.parse(req.body);
    const clientRequestId = body.clientRequestId ?? null;

    // idempotency: тот же clientRequestId → вернуть существующий job (двойной upload не плодит)
    if (clientRequestId) {
      const existing = await prisma.importJob.findFirst({ where: { orgId, clientRequestId } });
      if (existing) { res.status(200).json({ job: jobSummary(existing), headers: existing.headers, sampleRows: existing.sampleRows, mapping: existing.mapping, deduped: true }); return; }
    }

    // целевой объект (org-scope). Для LIST — резолвим список → его primaryObject + сохраняем listId.
    let listId: string | null = null;
    let obj: { id: string; key: string };
    if (body.targetType === 'LIST') {
      if (!body.listId) { res.status(400).json({ error: 'listId required for LIST import', code: 'LIST_REQUIRED' }); return; }
      const list = await prisma.list.findFirst({ where: { orgId, id: body.listId }, select: { id: true, type: true, primaryObjectId: true, primaryObject: { select: { key: true } } } });
      if (!list) { res.status(404).json({ error: 'List not found', code: 'LIST_NOT_FOUND' }); return; }
      // LST-1: DYNAMIC-список — членство вычисляется из правила, import не может добавлять в него записи
      // (иначе нарушится инвариант «0 ListEntry у DYNAMIC»). Импортируйте в объект, правило подхватит подходящие.
      if (list.type === 'DYNAMIC') { res.status(409).json({ error: 'Cannot import into a dynamic list — its membership is computed from a rule. Import into the object instead.', code: 'LIST_DYNAMIC_READONLY_MEMBERSHIP' }); return; }
      listId = list.id;
      obj = { id: list.primaryObjectId, key: list.primaryObject.key };
    } else {
      const found = await prisma.object.findFirst({ where: { orgId, archivedAt: null, ...(body.objectId ? { id: body.objectId } : { key: body.objectKey }) }, select: { id: true, key: true } });
      if (!found) { res.status(404).json({ error: 'Object not found', code: 'OBJECT_NOT_FOUND' }); return; }
      obj = found;
    }
    // RBAC: импорт записывает записи → нужен READ_WRITE на цель (OBJECT или LIST)
    if (!(await assertImportTarget(req, res, { targetType: body.targetType as ImportTargetType, objectId: obj.id, listId }, 'READ_WRITE'))) return;

    // переvalidate сырые строки (caps/headers/malformed)
    const { headers, rows } = validateRawRows(body.headers, body.rows);
    const attributes = await prisma.attribute.findMany({ where: { objectId: obj.id, isArchived: false }, select: { key: true, type: true } });
    const mapping = autoMap(headers, attributes);
    const hasMapping = Object.keys(mapping).length > 0;
    const fileHash = createHash('sha1').update(JSON.stringify({ headers, rows })).digest('hex');

    const created = await (async () => {
      try {
        return await prisma.importJob.create({
          data: {
            orgId, targetType: body.targetType as ImportTargetType, objectId: obj.id, listId, fileName: body.fileName, delimiter: body.delimiter,
            rowCount: rows.length, headers: headers as unknown as Prisma.InputJsonValue, sampleRows: rows.slice(0, 20) as unknown as Prisma.InputJsonValue,
            rawRows: rows as unknown as Prisma.InputJsonValue, mapping: mapping as unknown as Prisma.InputJsonValue,
            status: hasMapping ? ImportStatus.READY : ImportStatus.MAPPING_REQUIRED, fileHash, clientRequestId, createdById: req.user!.userId,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && clientRequestId) {
          const ex = await prisma.importJob.findFirst({ where: { orgId, clientRequestId } });
          if (ex) return ex;
        }
        throw e;
      }
    })();

    await audit({ orgId, actorId: req.user!.userId, action: 'IMPORT_STARTED', targetType: 'import', targetId: created.id, summary: `${created.fileName} → ${obj.key} · ${rows.length} rows` });
    res.status(201).json({ job: jobSummary(created), headers, sampleRows: rows.slice(0, 20), mapping });
  } catch (err) { handleErr(err, res, next); }
});

// GET / — история
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectId = typeof req.query.objectId === 'string' ? req.query.objectId : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const jobs = await prisma.importJob.findMany({
      where: { orgId, ...(objectId ? { objectId } : {}), ...(status ? { status: status as ImportStatus } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json({ imports: jobs.map(jobSummary) });
  } catch (err) { next(err); }
});

// GET /:id — job + preview
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, orgId } });
    if (!job) { res.status(404).json({ error: 'Import not found', code: 'IMPORT_NOT_FOUND' }); return; }
    if (!(await assertImportTarget(req, res, job, 'READ'))) return;
    let preview = null;
    if (job.objectId) {
      const { plan } = await planImportRows({ orgId, objectId: job.objectId, headers: job.headers as string[], rows: job.rawRows as Record<string, string>[], mapping: job.mapping as ImportMapping, dedupeKey: job.dedupeKey }).catch(() => ({ plan: null as never }));
      preview = plan ? { estimate: plan.estimate, detectedTypes: plan.detectedTypes, warnings: plan.warnings, rows: plan.rows.slice(0, 50) } : null;
    }
    res.json({ job: jobSummary(job), headers: job.headers, sampleRows: job.sampleRows, mapping: job.mapping, rowResults: job.rowResults, preview });
  } catch (err) { handleErr(err, res, next); }
});

// PATCH /:id/mapping — сохранить mapping/dedupeKey → пересчёт статуса
const mappingSchema = z.object({ mapping: z.record(z.object({ attributeKey: z.string().min(1), asRelationship: z.boolean().optional(), requiredStrategy: z.enum(['error', 'skip']).optional() })), dedupeKey: z.string().nullish() });
router.patch('/:id/mapping', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, status: true, objectId: true, listId: true, targetType: true } });
    if (!job) { res.status(404).json({ error: 'Import not found', code: 'IMPORT_NOT_FOUND' }); return; }
    if (!(await assertImportTarget(req, res, job, 'READ_WRITE'))) return;
    if (job.status === ImportStatus.RUNNING || job.status === ImportStatus.COMPLETED) { res.status(409).json({ error: 'Import already running or completed', code: 'IMPORT_LOCKED' }); return; }
    const body = mappingSchema.parse(req.body);
    const attrs = job.objectId ? await prisma.attribute.findMany({ where: { objectId: job.objectId, isArchived: false }, select: { key: true } }) : [];
    const validKeys = new Set(attrs.map((a) => a.key));
    const hasValid = Object.values(body.mapping).some((m) => validKeys.has(m.attributeKey));
    const updated = await prisma.importJob.update({ where: { id: job.id }, data: { mapping: body.mapping as unknown as Prisma.InputJsonValue, dedupeKey: body.dedupeKey ?? null, status: hasValid ? ImportStatus.READY : ImportStatus.MAPPING_REQUIRED } });
    res.json({ job: jobSummary(updated), mapping: updated.mapping });
  } catch (err) { handleErr(err, res, next); }
});

// POST /:id/preview — preview по плану из СОХРАНЁННОГО mapping (адверс-ревью M3: preview==confirm,
// никаких body-mapping, которые confirm не применит; UI сохраняет mapping ПЕРЕД preview).
router.post('/:id/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, orgId } });
    if (!job) { res.status(404).json({ error: 'Import not found', code: 'IMPORT_NOT_FOUND' }); return; }
    if (!(await assertImportTarget(req, res, job, 'READ_WRITE'))) return;
    if (!job.objectId) { res.status(400).json({ error: 'No target object', code: 'NO_TARGET' }); return; }
    const { plan } = await planImportRows({ orgId, objectId: job.objectId, headers: job.headers as string[], rows: job.rawRows as Record<string, string>[], mapping: job.mapping as ImportMapping, dedupeKey: job.dedupeKey });
    res.json({ estimate: plan.estimate, detectedTypes: plan.detectedTypes, warnings: plan.warnings, rows: plan.rows.slice(0, 50), totalRows: plan.rows.length });
  } catch (err) { handleErr(err, res, next); }
});

// POST /:id/confirm — CAS-claim READY→RUNNING, затем общий executor (sync)
router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, status: true, objectId: true, listId: true, targetType: true } });
    if (!job) { res.status(404).json({ error: 'Import not found', code: 'IMPORT_NOT_FOUND' }); return; }
    if (!(await assertImportTarget(req, res, job, 'READ_WRITE'))) return;
    // CAS: READY ИЛИ FAILED → RUNNING (FAILED ретраебелен, адверс-ревью C2). Повтор/гонка/COMPLETED → 409.
    const claim = await prisma.importJob.updateMany({ where: { id: job.id, orgId, status: { in: [ImportStatus.READY, ImportStatus.FAILED] } }, data: { status: ImportStatus.RUNNING } });
    if (claim.count === 0) { res.status(409).json({ error: 'Import is not ready or already ran', code: 'IMPORT_ALREADY_RUN' }); return; }
    // если это ретрай FAILED — сначала чистим частичный импорт (no duplicate creates на повторе)
    if (job.status === ImportStatus.FAILED) await cleanupPartialImport(orgId, job.id);
    try {
      const result = await executeImport(orgId, job.id, req.user!.userId);
      res.json({ result });
    } catch (e) {
      // инфра-сбой посреди импорта → откатываем частичное + FAILED (чистое состояние для ретрая)
      await cleanupPartialImport(orgId, job.id).catch(() => undefined);
      await prisma.importJob.update({ where: { id: job.id }, data: { status: ImportStatus.FAILED } }).catch(() => undefined);
      throw e;
    }
  } catch (err) { handleErr(err, res, next); }
});

// POST /:id/cancel — отменить (UPLOADED/MAPPING_REQUIRED/READY)
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const claim = await prisma.importJob.updateMany({ where: { id: req.params.id, orgId, status: { in: [ImportStatus.UPLOADED, ImportStatus.MAPPING_REQUIRED, ImportStatus.READY] } }, data: { status: ImportStatus.CANCELED } });
    if (claim.count === 0) { res.status(409).json({ error: 'Import cannot be canceled in its current state', code: 'IMPORT_NOT_CANCELABLE' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /:id/rollback/preview — что будет затронуто/пропущено(ручная правка)/удалено ДО выполнения (S337)
router.post('/:id/rollback/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const force = req.body?.force === true;
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, orgId }, select: { status: true, objectId: true, listId: true, targetType: true } });
    if (!job) { res.status(404).json({ error: 'Import not found', code: 'IMPORT_NOT_FOUND' }); return; }
    if (!(await assertImportTarget(req, res, job, 'READ_WRITE'))) return;
    if (job.status !== ImportStatus.COMPLETED && job.status !== ImportStatus.COMPLETED_WITH_ERRORS) {
      res.status(409).json({ error: 'Only completed imports can be rolled back', code: 'ROLLBACK_NOT_ALLOWED' }); return;
    }
    const preview = await rollbackPreview(orgId, req.params.id, force);
    res.json({ preview });
  } catch (err) { handleErr(err, res, next); }
});

// POST /:id/rollback — выполнить откат (идемпотентно: повтор → 409 ROLLBACK_ALREADY_DONE)
router.post('/:id/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const force = req.body?.force === true;
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, orgId }, select: { status: true, objectId: true, listId: true, targetType: true } });
    if (!job) { res.status(404).json({ error: 'Import not found', code: 'IMPORT_NOT_FOUND' }); return; }
    if (!(await assertImportTarget(req, res, job, 'READ_WRITE'))) return;
    if (job.status !== ImportStatus.COMPLETED && job.status !== ImportStatus.COMPLETED_WITH_ERRORS) {
      res.status(409).json({ error: 'Only completed imports can be rolled back', code: 'ROLLBACK_NOT_ALLOWED' }); return;
    }
    const stats = await rollbackConfirm(orgId, req.params.id, req.user!.userId, force);
    res.json({ stats });
  } catch (err) { handleErr(err, res, next); }
});

export default router;
