/**
 * Роуты ревью низкоуверенных AI-значений (M9.3, сценарии review-очереди).
 *
 *   GET   /api/ai/review-queue?objectKey=   — очередь: AI-значения с companion-confidence < порога
 *   POST  /api/ai/review/approve            — принять AI-значение (остаётся, уходит из очереди)
 *   POST  /api/ai/review/reject             — отклонить (значение очищается + помечается REJECTED)
 *   PATCH /api/ai/review/edit               — заменить на ручное значение (EDITED)
 *
 * Источник очереди — РЕАЛЬНЫЕ данные: атрибут X считается «reviewable AI field», если у объекта
 * есть companion NUMBER-атрибут `${X.key}_confidence`. Решения хранятся в ValueReview + Activity-аудит.
 * RBAC: смотреть очередь может любой; approve/reject/edit — не для MEMBER (полный backend-гейт здесь же).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, ActivityType, AttributeType, AiReviewStatus, Prisma } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { writeValues } from '../services/crm/values';
import { assertAccess } from '../services/permissions';

const prisma = new PrismaClient();

const CONF_SUFFIX = '_confidence';
const REVIEW_THRESHOLD = 60;

// Версия решения ревью: aiRunId (если значение из AI-run) + содержимое + confidence-снимок.
// Новый AI re-run меняет значение/прогон → другой fingerprint → запись снова попадает в очередь.
function makeFingerprint(aiRunId: string | null, valueAfter: string | null, confidence: number | null): string {
  return `${aiRunId ?? '∅'}|${valueAfter ?? '∅'}|${confidence ?? '∅'}`;
}

export const aiReviewRouter = Router();
aiReviewRouter.use(authenticate, requireOrg);

// M25-1: ревью меняет Value записи → OBJECT READ_WRITE (по M21; OWNER/ADMIN bypass).

type AttrLite = { id: string; key: string; name: string; type: AttributeType };

// Пары (base AI-поле ↔ companion *_confidence). Companion `<prefix>_confidence` сопоставляется
// с базовым полем, ключ которого == prefix или начинается с `prefix_` (напр. icp_confidence ↔ icp_fit).
function findPairs(attributes: AttrLite[]): Array<{ base: AttrLite; conf: AttrLite }> {
  const pairs: Array<{ base: AttrLite; conf: AttrLite }> = [];
  for (const conf of attributes) {
    if (!(conf.key.endsWith(CONF_SUFFIX) && conf.type === AttributeType.NUMBER)) continue;
    const prefix = conf.key.slice(0, -CONF_SUFFIX.length);
    const base =
      attributes.find((a) => a.key === prefix) ??
      attributes.find((a) => a.id !== conf.id && a.key.startsWith(prefix + '_') && !a.key.endsWith(CONF_SUFFIX));
    if (base) pairs.push({ base, conf });
  }
  return pairs;
}

// Объект + пары (base AI-поле ↔ companion *_confidence)
async function loadObjectAndPairs(orgId: string, objectKey: string) {
  const object = await prisma.object.findFirst({
    where: { orgId, key: objectKey, archivedAt: null },
    select: {
      id: true,
      key: true,
      primaryAttribute: { select: { id: true } },
      attributes: { where: { isArchived: false }, select: { id: true, key: true, name: true, type: true } },
    },
  });
  if (!object) return null;
  return { object, pairs: findPairs(object.attributes) };
}

// Запись + base-атрибут по ключу + текущее значение confidence (для записи в ValueReview)
async function loadTarget(orgId: string, recordId: string, attributeKey: string) {
  const record = await prisma.record.findFirst({
    where: { id: recordId, orgId, archivedAt: null },
    select: { id: true, orgId: true, objectId: true },
  });
  if (!record) return { error: 'record' as const };

  const attributes = await prisma.attribute.findMany({
    where: { orgId, objectId: record.objectId, isArchived: false },
    select: { id: true, key: true, name: true, type: true },
  });
  const attribute = attributes.find((a) => a.key === attributeKey);
  if (!attribute) return { error: 'attribute' as const };

  const pair = findPairs(attributes).find((p) => p.base.id === attribute.id);
  let confidence: number | null = null;
  if (pair) {
    const cv = await prisma.value.findFirst({
      where: { orgId, recordId, attributeId: pair.conf.id },
      select: { numberValue: true },
    });
    confidence = cv?.numberValue != null ? Math.round(Number(cv.numberValue)) : null;
  }

  const bv = await prisma.value.findFirst({
    where: { orgId, recordId, attributeId: attribute.id },
    select: { textValue: true, longTextValue: true, numberValue: true },
  });
  const aiValue =
    bv?.textValue ?? bv?.longTextValue ?? (bv?.numberValue != null ? String(Number(bv.numberValue)) : null);

  const lastRun = await prisma.aiRun.findFirst({
    where: { orgId, recordId, attributeId: attribute.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return { record, attribute, confidence, aiValue, lastRunId: lastRun?.id ?? null };
}

// ─── GET /api/ai/review-queue ────────────────────────────────────────────

const queueQuery = z.object({ objectKey: z.string().min(1) });

export type ReviewQueueItem = {
  recordId: string; recordName: string; attributeKey: string; attributeName: string;
  aiValue: string | null; confidence: number | null; lastRunId: string | null;
};

/**
 * ЕДИНЫЙ билдер очереди ревью — источник правды и для GET /review-queue, и для GET /metrics (needsReview).
 * Учитывает версионирование решений (aiRunId + valueFingerprint), чтобы needsReview в /metrics ВСЕГДА
 * совпадал с длиной очереди. Возврат null — объект не найден.
 */
export async function buildReviewQueue(
  orgId: string,
  objectKey: string,
): Promise<{ items: ReviewQueueItem[]; threshold: number } | null> {
  const loaded = await loadObjectAndPairs(orgId, objectKey);
  if (!loaded) return null;
  const { object, pairs } = loaded;
  if (pairs.length === 0) return { items: [], threshold: REVIEW_THRESHOLD };

  const primaryId = object.primaryAttribute?.id ?? null;
  const attrIds = new Set<string>();
  pairs.forEach((p) => { attrIds.add(p.base.id); attrIds.add(p.conf.id); });
  if (primaryId) attrIds.add(primaryId);

  const baseIds = pairs.map((p) => p.base.id);
  const records = await prisma.record.findMany({
    where: { orgId, objectId: object.id, archivedAt: null },
    select: {
      id: true,
      values: {
        where: { attributeId: { in: [...attrIds] } },
        select: { attributeId: true, textValue: true, longTextValue: true, numberValue: true },
      },
    },
  });
  const recordIds = records.map((r) => r.id);

  // последний AiRun на (record, base) — для версии fingerprint (если значение из AI-run)
  const runRows = await prisma.aiRun.findMany({
    where: { orgId, attributeId: { in: baseIds }, recordId: { in: recordIds } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, recordId: true, attributeId: true },
  });
  const lastRunByKey = new Map<string, string>();
  for (const r of runRows) {
    const k = `${r.recordId}:${r.attributeId}`;
    if (!lastRunByKey.has(k)) lastRunByKey.set(k, r.id);
  }

  // решённые ВЕРСИИ: исключаем только если решена ИМЕННО текущая версия значения (по fingerprint)
  const decided = await prisma.valueReview.findMany({
    where: { orgId, attributeId: { in: baseIds } },
    select: { recordId: true, attributeId: true, valueFingerprint: true },
  });
  const decidedSet = new Set(decided.map((d) => `${d.recordId}:${d.attributeId}:${d.valueFingerprint ?? ''}`));

  const items: ReviewQueueItem[] = [];

  for (const rec of records) {
    const byAttr = new Map(rec.values.map((v) => [v.attributeId, v]));
    const nameVal = primaryId ? byAttr.get(primaryId) : undefined;
    const recordName = nameVal?.textValue ?? nameVal?.longTextValue ?? rec.id.slice(-6);

    for (const p of pairs) {
      const cv = byAttr.get(p.conf.id);
      const conf = cv?.numberValue != null ? Math.round(Number(cv.numberValue)) : null;
      if (conf == null || conf >= REVIEW_THRESHOLD) continue;

      const bv = byAttr.get(p.base.id);
      const aiValue =
        bv?.textValue ??
        bv?.longTextValue ??
        (bv?.numberValue != null ? String(Number(bv.numberValue)) : null);

      const lastRunId = lastRunByKey.get(`${rec.id}:${p.base.id}`) ?? null;
      const fp = makeFingerprint(lastRunId, aiValue, conf);
      if (decidedSet.has(`${rec.id}:${p.base.id}:${fp}`)) continue; // эта версия уже решена

      items.push({
        recordId: rec.id,
        recordName,
        attributeKey: p.base.key,
        attributeName: p.base.name,
        aiValue,
        confidence: conf,
        lastRunId,
      });
    }
  }

  items.sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0));
  return { items, threshold: REVIEW_THRESHOLD };
}

/**
 * M9.8 — состояние ревью для ОДНОЙ ячейки (record, базовый AI-атрибут):
 * текущее значение, companion-confidence, последний run, fingerprint текущей версии,
 * и underReview (через ТОТ ЖЕ buildReviewQueue, что M9.3). Нужно provenance'у, чтобы привязать
 * решение к ТЕКУЩЕЙ версии значения и показать «сейчас на ревью / решено».
 * Возврат null — объект не найден; hasCompanion=false — у поля нет companion-confidence (не reviewable).
 */
export async function getCellReviewState(
  orgId: string,
  objectKey: string,
  recordId: string,
  attributeKey: string,
): Promise<{ confidence: number | null; aiValue: string | null; lastRunId: string | null; fingerprint: string | null; underReview: boolean; hasCompanion: boolean; threshold: number } | null> {
  const loaded = await loadObjectAndPairs(orgId, objectKey);
  if (!loaded) return null;
  const pair = loaded.pairs.find((p) => p.base.key === attributeKey);
  if (!pair) return { confidence: null, aiValue: null, lastRunId: null, fingerprint: null, underReview: false, hasCompanion: false, threshold: REVIEW_THRESHOLD };

  const confVal = await prisma.value.findFirst({ where: { orgId, recordId, attributeId: pair.conf.id }, select: { numberValue: true } });
  const confidence = confVal?.numberValue != null ? Math.round(Number(confVal.numberValue)) : null;
  const baseVal = await prisma.value.findFirst({ where: { orgId, recordId, attributeId: pair.base.id }, select: { textValue: true, longTextValue: true, numberValue: true } });
  const aiValue = baseVal?.textValue ?? baseVal?.longTextValue ?? (baseVal?.numberValue != null ? String(Number(baseVal.numberValue)) : null);
  const lastRun = await prisma.aiRun.findFirst({ where: { orgId, recordId, attributeId: pair.base.id }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const lastRunId = lastRun?.id ?? null;
  const fingerprint = makeFingerprint(lastRunId, aiValue, confidence);

  const queue = await buildReviewQueue(orgId, objectKey);
  const underReview = !!queue && queue.items.some((i) => i.recordId === recordId && i.attributeKey === attributeKey);
  return { confidence, aiValue, lastRunId, fingerprint, underReview, hasCompanion: true, threshold: REVIEW_THRESHOLD };
}

aiReviewRouter.get('/review-queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { objectKey } = queueQuery.parse(req.query);
    // RBAC: review-queue показывает значения записей объекта → нужен OBJECT READ
    const obj = await prisma.object.findFirst({ where: { orgId, key: objectKey, archivedAt: null }, select: { id: true } });
    if (!obj) { res.status(404).json({ error: 'Object not found' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', obj.id))) return;

    const result = await buildReviewQueue(orgId, objectKey);
    if (!result) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    res.json({ items: result.items, total: result.items.length, threshold: result.threshold });
  } catch (err) {
    next(err);
  }
});

// ─── Решения ─────────────────────────────────────────────────────────────

const decisionSchema = z.object({ recordId: z.string().min(1), attributeKey: z.string().min(1) });
const editSchema = decisionSchema.extend({ value: z.string().trim().min(1).max(2000) });

async function writeReview(
  tx: Prisma.TransactionClient,
  orgId: string,
  recordId: string,
  attributeId: string,
  status: AiReviewStatus,
  confidence: number | null,
  decidedById: string,
  aiRunId: string | null,
  valueFingerprint: string,
  // M9.8 — снимки значения на момент решения (для provenance/audit после очистки/правки)
  valueBefore: string | null,
  valueAfter: string | null,
  note?: string,
) {
  await tx.valueReview.upsert({
    where: { recordId_attributeId_valueFingerprint: { recordId, attributeId, valueFingerprint } },
    create: { orgId, recordId, attributeId, status, confidence, decidedById, aiRunId, valueFingerprint, valueBefore, valueAfter, note: note ?? null },
    update: { status, confidence, decidedById, aiRunId, valueBefore, valueAfter, note: note ?? null },
  });
}

// POST /api/ai/review/approve
aiReviewRouter.post('/review/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { recordId, attributeKey } = decisionSchema.parse(req.body);

    const t = await loadTarget(orgId, recordId, attributeKey);
    if ('error' in t) { res.status(404).json({ error: `${t.error} not found` }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', t.record.objectId))) return;

    const fp = makeFingerprint(t.lastRunId, t.aiValue, t.confidence); // approve: значение не меняется
    await prisma.$transaction(async (tx) => {
      await writeReview(tx, orgId, recordId, t.attribute.id, AiReviewStatus.APPROVED, t.confidence, req.user!.userId, t.lastRunId, fp, t.aiValue, t.aiValue);
      await tx.activity.create({
        data: {
          orgId, recordId, actorId: req.user!.userId,
          type: ActivityType.AI_VALUE_APPROVED,
          title: `AI value approved: ${t.attribute.name}`,
          payload: { attributeKey, attributeId: t.attribute.id, confidence: t.confidence, aiRunId: t.lastRunId } as Prisma.InputJsonValue,
        },
      });
    });

    res.json({ ok: true, status: 'APPROVED' });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/review/reject — отклонить: очистить AI-значение + пометить REJECTED
aiReviewRouter.post('/review/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { recordId, attributeKey } = decisionSchema.parse(req.body);

    const t = await loadTarget(orgId, recordId, attributeKey);
    if ('error' in t) { res.status(404).json({ error: `${t.error} not found` }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', t.record.objectId))) return;

    const fp = makeFingerprint(t.lastRunId, null, t.confidence); // reject: значение очищается → версия с null
    await prisma.$transaction(async (tx) => {
      await writeValues(tx, { id: t.record.id, orgId, objectId: t.record.objectId }, { [attributeKey]: null });
      await writeReview(tx, orgId, recordId, t.attribute.id, AiReviewStatus.REJECTED, t.confidence, req.user!.userId, t.lastRunId, fp, t.aiValue, null);
      await tx.activity.create({
        data: {
          orgId, recordId, actorId: req.user!.userId,
          type: ActivityType.AI_VALUE_REJECTED,
          title: `AI value rejected & cleared: ${t.attribute.name}`,
          payload: { attributeKey, attributeId: t.attribute.id, confidence: t.confidence, aiRunId: t.lastRunId } as Prisma.InputJsonValue,
        },
      });
    });

    res.json({ ok: true, status: 'REJECTED' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/ai/review/edit — ручное значение вместо AI
aiReviewRouter.patch('/review/edit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { recordId, attributeKey, value } = editSchema.parse(req.body);

    const t = await loadTarget(orgId, recordId, attributeKey);
    if ('error' in t) { res.status(404).json({ error: `${t.error} not found` }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', t.record.objectId))) return;

    const fp = makeFingerprint(t.lastRunId, value, t.confidence); // edit: версия с ручным значением
    await prisma.$transaction(async (tx) => {
      await writeValues(tx, { id: t.record.id, orgId, objectId: t.record.objectId }, { [attributeKey]: value });
      await writeReview(tx, orgId, recordId, t.attribute.id, AiReviewStatus.EDITED, t.confidence, req.user!.userId, t.lastRunId, fp, t.aiValue, value, value);
      await tx.activity.create({
        data: {
          orgId, recordId, actorId: req.user!.userId,
          type: ActivityType.AI_VALUE_EDITED,
          title: `AI value edited: ${t.attribute.name}`,
          payload: { attributeKey, attributeId: t.attribute.id, value, aiRunId: t.lastRunId } as Prisma.InputJsonValue,
        },
      });
    });

    res.json({ ok: true, status: 'EDITED' });
  } catch (err) {
    next(err);
  }
});

export default aiReviewRouter;
