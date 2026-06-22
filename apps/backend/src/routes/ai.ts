/**
 * Роуты модуля AI-атрибутов (M2) — сценарии S160–S173.
 *
 * Маршруты (все под /api/ai):
 *   POST /api/attributes/:attributeId/ai/run               — запуск по одной записи (S166–S168)
 *   POST /api/attributes/:attributeId/ai/run-view          — массовый запуск по view (S169)
 *   GET  /api/ai/runs/:aiRunId                             — статус run (S164, Research async)
 *   GET  /api/ai/bulk-runs/:bulkRunId                      — статус bulk run (S169)
 *   GET  /api/billing/credits                              — баланс кредитов (S171)
 *   GET  /api/billing/credits/transactions                 — история транзакций (S172)
 *
 * Роуты /api/attributes/:attributeId/ai/* монтируются из index.ts как
 * отдельный sub-router (см. секцию «Регистрация» в ОТЧЁТЕ).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../middleware/auth';
import {
  runAiForRecord,
  runAiBulkForView,
  getAiRunStatus,
  getBulkRunStatus,
  type AiRunSource,
} from '../services/ai/index';
import {
  getOrCreateBalance,
  getUsageBreakdown,
  listTransactions,
  InsufficientCreditsError,
  AI_CREDIT_COSTS,
} from '../services/ai/credits';
import { resolveScopeRecordIds, recordFilterSchema } from './records';
import { buildReviewQueue, getCellReviewState } from './aiReview';
import { assertAccess, buildResolver, meets } from '../services/permissions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// M25-1: objectId AI-атрибута (для RBAC по M21 access-level на его объект).
async function attrObjectId(orgId: string, attributeId: string): Promise<string | null> {
  const a = await prisma.attribute.findFirst({ where: { id: attributeId, orgId }, select: { objectId: true } });
  return a?.objectId ?? null;
}

// адверс CRITICAL-1: оставляет только recordIds, принадлежащие объекту атрибута (cross-object отсекаем).
async function filterRecordsToObject(orgId: string, objectId: string, recordIds: string[]): Promise<string[]> {
  if (!recordIds.length) return [];
  const valid = await prisma.record.findMany({ where: { id: { in: recordIds }, orgId, objectId }, select: { id: true } });
  const ok = new Set(valid.map((r) => r.id));
  return recordIds.filter((id) => ok.has(id));
}

// адверс HIGH-1: чтение AI-run/bulk-run раскрывает output/input → нужен OBJECT READ к объекту атрибута; нет→404.
async function aiObjectReadOr404(req: Request, res: Response, objectId: string | null | undefined): Promise<boolean> {
  if (!objectId) { res.status(404).json({ error: 'Not found' }); return false; }
  const resolver = await buildResolver(req.user!.orgId!, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');
  if (!meets(resolver(objectId), 'READ')) { res.status(404).json({ error: 'Not found' }); return false; }
  return true;
}

// ─── Роутер для /api/attributes/:attributeId/ai ───────────────────────────

export const attributeAiRouter = Router({ mergeParams: true });
attributeAiRouter.use(authenticate, requireOrg);

// ─── Роутер для /api/ai ──────────────────────────────────────────────────

const aiRouter = Router();
aiRouter.use(authenticate, requireOrg);

// ─── Роутер для /api/billing/credits ─────────────────────────────────────

export const creditsRouter = Router();
creditsRouter.use(authenticate, requireOrg);

// ─── Вспомогательные ─────────────────────────────────────────────────────

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof InsufficientCreditsError) {
    // M16-4: единый machine-readable формат — {code, required, available, source}.
    res.status(402).json({ error: err.message, code: err.code, required: err.required, available: err.available, source: err.source });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('CLASSIFY_REQUIRES_OPTIONS')) {
    res.status(422).json({ error: message, code: 'CLASSIFY_REQUIRES_OPTIONS' });
    return;
  }

  if (message.includes('Атрибут не найден') || message.includes('Запись не найдена')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('Не AI-атрибут') || message.includes('не является AI-атрибутом')) {
    res.status(422).json({ error: message, code: 'NOT_AI_ATTRIBUTE' });
    return;
  }

  next(err);
}

// M25-1: запуск AI = мутация Value → OBJECT READ_WRITE (по M21; OWNER/ADMIN bypass).
// Возвращает objectId при успехе, null если отказано (ответ уже отправлен assertAccess).
async function requireAiRunAccess(req: Request, res: Response, attributeId: string): Promise<string | null> {
  const orgId = req.user!.orgId!;
  const objectId = await attrObjectId(orgId, attributeId);
  if (!objectId) { res.status(404).json({ error: 'Атрибут не найден' }); return null; }
  if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', objectId))) return null;
  return objectId;
}

// ─── Схемы валидации ─────────────────────────────────────────────────────

const runSingleSchema = z.object({
  recordId: z.string().min(1),
  source: z.enum(['CELL', 'RECORD_PAGE', 'BOARD_CARD', 'BULK']).optional(),
  // M29-1: явное согласие перезаписать РУЧНОЕ значение (после подтверждения в UI на 409).
  overwrite: z.boolean().optional(),
});

const runViewSchema = z.object({
  viewId: z.string().min(1).optional(),
  // selected-scope: явный список выбранных записей
  recordIds: z.array(z.string().min(1)).min(1).max(2000).optional(),
  // view-scope: backend сам резолвит «текущий вид» (objectKey + filters + search)
  objectKey: z.string().min(1).optional(),
  filters: z.array(recordFilterSchema).optional(),
  search: z.string().max(200).optional(),
  mode: z.enum(['all_matching', 'loaded_rows', 'selected_rows']).optional(),
  skipExisting: z.boolean().optional(),
  // M25-1 (правка #6): обязателен на create bulk-run (идемпотентность). Preflight его не требует.
  clientRequestId: z.string().min(1).max(200).optional(),
});

// Жёсткий потолок одного bulk-прогона (синхронная обработка построчно).
const MAX_BULK = 500;

/**
 * Резолвит scope массового прогона в список recordIds (M9.2):
 *  - selected: явные recordIds[]
 *  - view: backend вычисляет записи текущего вида (objectKey + filters + search)
 *  - legacy: viewId → все записи объекта (старое поведение, fallback)
 * Возвращает также cappedFrom — реальный размер scope, если он превысил MAX_BULK.
 */
async function resolveBulkScope(
  orgId: string,
  data: z.infer<typeof runViewSchema>,
): Promise<{ recordIds: string[]; scope: 'selected' | 'view'; cappedFrom: number | null }> {
  if (data.recordIds && data.recordIds.length > 0) {
    const capped = data.recordIds.length > MAX_BULK ? data.recordIds.length : null;
    return { recordIds: data.recordIds.slice(0, MAX_BULK), scope: 'selected', cappedFrom: capped };
  }

  if (data.objectKey) {
    const { recordIds } = await resolveScopeRecordIds(orgId, {
      objectKey: data.objectKey,
      filters: data.filters,
      search: data.search,
    });
    const capped = recordIds.length > MAX_BULK ? recordIds.length : null;
    return { recordIds: recordIds.slice(0, MAX_BULK), scope: 'view', cappedFrom: capped };
  }

  if (data.viewId) {
    const view = await prisma.view.findFirst({
      where: { id: data.viewId, orgId, archivedAt: null },
      select: { objectId: true },
    });
    if (!view?.objectId) return { recordIds: [], scope: 'view', cappedFrom: null };
    const records = await prisma.record.findMany({
      where: { orgId, objectId: view.objectId, archivedAt: null },
      select: { id: true },
      take: MAX_BULK,
    });
    return { recordIds: records.map((r) => r.id), scope: 'view', cappedFrom: null };
  }

  return { recordIds: [], scope: 'view', cappedFrom: null };
}

// ─── POST /api/attributes/:attributeId/ai/run ────────────────────────────

attributeAiRouter.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { attributeId } = req.params;
    const objectId = await requireAiRunAccess(req, res, attributeId);
    if (!objectId) return;
    const data = runSingleSchema.parse(req.body);

    // адверс CRITICAL-1: запись ОБЯЗАНА принадлежать объекту атрибута (иначе cross-object run/утечка контекста).
    const rec = await prisma.record.findFirst({ where: { id: data.recordId, orgId, archivedAt: null }, select: { objectId: true } });
    if (!rec || rec.objectId !== objectId) { res.status(404).json({ error: 'Record not found in this object' }); return; }

    const result = await runAiForRecord({
      orgId,
      recordId: data.recordId,
      attributeId,
      source: (data.source as AiRunSource) ?? 'CELL',
      triggeredById: req.user!.userId,
      overwrite: data.overwrite,
    });

    // M29-1: текущее значение ручное — не перезаписываем молча. Фронт показывает подтверждение и повторяет с overwrite=true.
    if (result.status === 'CONFLICT') {
      res.status(409).json({
        error: 'This value was manually edited',
        code: 'MANUAL_VALUE_CONFLICT',
        message: 'This value was manually edited. Overwrite with AI?',
      });
      return;
    }

    if (result.status === 'FAILED') {
      res.status(503).json({
        error: 'AI run завершился с ошибкой',
        code: 'AI_RUN_FAILED',
        aiRunId: result.aiRunId,
      });
      return;
    }

    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

// ─── POST /api/attributes/:attributeId/ai/run-view ───────────────────────

attributeAiRouter.post('/run-view', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { attributeId } = req.params;
    const objectId = await requireAiRunAccess(req, res, attributeId);
    if (!objectId) return;
    const data = runViewSchema.parse(req.body);

    // M25-1 (правка #6): clientRequestId обязателен для создания bulk-run.
    if (!data.clientRequestId) {
      res.status(400).json({ error: 'clientRequestId is required for a bulk run', code: 'CLIENT_REQUEST_ID_REQUIRED' });
      return;
    }

    let scope: { recordIds: string[]; scope: 'selected' | 'view'; cappedFrom: number | null };
    try {
      scope = await resolveBulkScope(orgId, data);
    } catch (e) {
      res.status(422).json({
        error: e instanceof Error ? e.message : 'Не удалось вычислить scope',
        code: 'SCOPE_RESOLUTION_FAILED',
      });
      return;
    }
    // адверс CRITICAL-1: обрабатываем ТОЛЬКО записи объекта атрибута (cross-object scope отсекаем).
    scope.recordIds = await filterRecordsToObject(orgId, objectId, scope.recordIds);

    if (scope.recordIds.length === 0) {
      res.status(422).json({ error: 'Нет записей для обработки' });
      return;
    }

    const result = await runAiBulkForView({
      orgId,
      attributeId,
      recordIds: scope.recordIds,
      viewId: data.viewId,
      triggeredById: req.user!.userId,
      skipExisting: data.skipExisting ?? false,
      clientRequestId: data.clientRequestId,
    });

    res.json({ ...result, scopeKind: scope.scope, cappedFrom: scope.cappedFrom });
  } catch (err) {
    handleError(err, res, next);
  }
});

// ─── POST /api/attributes/:attributeId/ai/run-view/preflight ─────────────
// Превью billable-строк ДО запуска (M9.2): total in scope / already filled / will run /
// estimated credits. Не создаёт AiBulkRun и не списывает кредиты.

attributeAiRouter.post('/run-view/preflight', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { attributeId } = req.params;
    const objectId = await requireAiRunAccess(req, res, attributeId);
    if (!objectId) return;
    const data = runViewSchema.parse(req.body);

    const attribute = await prisma.attribute.findFirst({
      where: { id: attributeId, orgId },
      select: { id: true, name: true, aiEnabled: true, aiType: true },
    });
    if (!attribute) {
      res.status(404).json({ error: 'Атрибут не найден' });
      return;
    }
    if (!attribute.aiEnabled || !attribute.aiType) {
      res.status(422).json({ error: 'Не AI-атрибут', code: 'NOT_AI_ATTRIBUTE' });
      return;
    }

    let scope: { recordIds: string[]; scope: 'selected' | 'view'; cappedFrom: number | null };
    try {
      scope = await resolveBulkScope(orgId, data);
    } catch (e) {
      res.status(422).json({
        error: e instanceof Error ? e.message : 'Не удалось вычислить scope',
        code: 'SCOPE_RESOLUTION_FAILED',
      });
      return;
    }
    // адверс CRITICAL-1: preflight тоже только по записям объекта атрибута
    scope.recordIds = await filterRecordsToObject(orgId, objectId, scope.recordIds);

    const totalInScope = scope.recordIds.length;
    // M29-1: один запрос значений со source — для honest-preflight (already filled + manual-protected).
    const existingValues = totalInScope > 0
      ? await prisma.value.findMany({
          where: { attributeId, recordId: { in: scope.recordIds } },
          select: { recordId: true, source: true },
        })
      : [];
    const filledIds = new Set(existingValues.map((v) => v.recordId));
    const manualIds = new Set(existingValues.filter((v) => v.source === 'MANUAL').map((v) => v.recordId));

    // skipExisting: любые заполненные исключены заранее (manual входят в них). Иначе: manual-строки пропустит guard (не charge).
    const alreadyFilled = data.skipExisting ? filledIds.size : 0;
    const manualProtected = data.skipExisting ? 0 : manualIds.size;

    const willRun = Math.max(0, totalInScope - alreadyFilled - manualProtected);
    const costPerRow = AI_CREDIT_COSTS[attribute.aiType] ?? 1;
    const estimatedCredits = willRun * costPerRow;
    const balance = await getOrCreateBalance(orgId);

    res.json({
      attribute: { id: attribute.id, name: attribute.name, aiType: attribute.aiType },
      scopeKind: scope.scope,
      cappedFrom: scope.cappedFrom,
      maxBulk: MAX_BULK,
      totalInScope,
      alreadyFilled,
      manualProtected, // M29-1: строки с ручным значением — будут пропущены (не списываются)
      willRun,
      costPerRow,
      estimatedCredits,
      balance: balance.balance,
      sufficient: balance.balance >= estimatedCredits,
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

// ─── GET /api/attributes/:attributeId/ai/provenance?recordId= ────────────
// Последний AiRun по записи+атрибуту: реальная provenance для popover (M9).

const provenanceSchema = z.object({ recordId: z.string().min(1) });

attributeAiRouter.get('/provenance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { attributeId } = req.params;
    const { recordId } = provenanceSchema.parse(req.query);

    const attribute = await prisma.attribute.findFirst({
      where: { id: attributeId, orgId },
      select: { id: true, key: true, name: true, type: true, objectId: true, aiEnabled: true, aiType: true, aiPrompt: true, aiGuidance: true, object: { select: { key: true } } },
    });
    if (!attribute) {
      res.status(404).json({ error: 'Attribute not found' });
      return;
    }
    // M25-1 (security блокер): provenance раскрывает output/prompt/cost/sources записи → нужен OBJECT READ.
    // Нет READ (NONE/чужой объект) → 404 (скрытие существования), не утечка.
    const provResolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');
    if (!meets(provResolver(attribute.objectId), 'READ')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const RUNS_LIMIT = 10;
    const runRows = await prisma.aiRun.findMany({
      where: { orgId, attributeId, recordId },
      orderBy: { createdAt: 'desc' },
      take: RUNS_LIMIT,
      include: { requestedBy: { select: { name: true, email: true } } },
    });
    const runCount = await prisma.aiRun.count({ where: { orgId, attributeId, recordId } });
    const latest = runRows[0] ?? null;

    // текущее значение ячейки напрямую (для любого атрибута, не только reviewable)
    const curValRow = await prisma.value.findFirst({
      where: { orgId, recordId, attributeId },
      select: { textValue: true, longTextValue: true, numberValue: true },
    });
    const currentValue = curValRow?.textValue ?? curValRow?.longTextValue ?? (curValRow?.numberValue != null ? String(Number(curValRow.numberValue)) : null);

    // все решения ревью по ячейке (для timeline) + имена decidedBy (батч)
    const reviewRows = await prisma.valueReview.findMany({
      where: { orgId, attributeId, recordId },
      orderBy: { createdAt: 'desc' },
    });
    const decidedIds = [...new Set(reviewRows.map((r) => r.decidedById).filter(Boolean))] as string[];
    const users = decidedIds.length
      ? await prisma.user.findMany({ where: { id: { in: decidedIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userName = new Map(users.map((u) => [u.id, u.name ?? u.email]));

    // состояние ревью текущей версии + underReview (ТОТ ЖЕ builder, что M9.3 /review-queue)
    const cell = await getCellReviewState(orgId, attribute.object.key, recordId, attribute.key);
    // решение, привязанное к ТЕКУЩЕЙ версии значения (по valueFingerprint), а не просто последнее
    const currentReviewRow = cell?.fingerprint ? reviewRows.find((r) => r.valueFingerprint === cell.fingerprint) ?? null : null;

    // totalAiCost — по ФАКТИЧЕСКИМ debit-транзакциям всех run'ов ячейки (не AiRun.creditsCost; FAILED не списывает)
    const allRunIds = (await prisma.aiRun.findMany({ where: { orgId, attributeId, recordId }, select: { id: true } })).map((r) => r.id);
    const costAgg = allRunIds.length
      ? await prisma.creditTransaction.aggregate({ where: { orgId, type: 'DEBIT', aiRunId: { in: allRunIds } }, _sum: { amount: true } })
      : null;
    const totalAiCost = costAgg ? Math.abs(Number(costAgg._sum.amount ?? 0)) : 0;

    // ── единый timeline (newest-first): runs + review decisions ──
    type TLEvent = { type: string; at: string; actor: string | null; cost: number; detail: string | null; status: string; source?: string | null };
    const timeline: TLEvent[] = [];
    for (const r of runRows) {
      const failed = r.status === 'FAILED';
      const skipped = r.status === 'SKIPPED_INSUFFICIENT_CREDITS';
      // M25-2: origin запуска (CELL/BULK/AUTO…) — для различения manual / bulk / auto-rerun в аудите.
      const runSource = (r.input as { source?: string } | null)?.source ?? null;
      timeline.push({
        type: failed ? 'AI_FAILED' : skipped ? 'AI_SKIPPED' : 'AI_FILLED',
        at: (r.completedAt ?? r.createdAt).toISOString(),
        actor: runSource === 'AUTO' ? 'Auto-rerun' : (r.requestedBy?.name ?? r.requestedBy?.email ?? 'AI agent'),
        cost: failed || skipped ? 0 : r.creditsCost, // FAILED/SKIPPED — cost 0, value unchanged
        detail: failed
          ? (r.error ?? 'AI run failed — value unchanged')
          : skipped
            ? 'skipped — insufficient credits (not charged)'
            : (r.outputText ? r.outputText.slice(0, 200) : null),
        status: r.status,
        source: runSource,
      });
    }
    for (const rv of reviewRows) {
      timeline.push({
        type: rv.status === 'APPROVED' ? 'REVIEW_APPROVED' : rv.status === 'REJECTED' ? 'REVIEW_REJECTED' : 'REVIEW_EDITED',
        at: rv.createdAt.toISOString(),
        actor: rv.decidedById ? (userName.get(rv.decidedById) ?? null) : null,
        cost: 0,
        detail: rv.status === 'REJECTED'
          ? `rejected & cleared (was: ${rv.valueBefore ?? '—'})`
          : rv.status === 'EDITED'
            ? `edited: ${rv.valueBefore ?? '—'} → ${rv.valueAfter ?? '—'}`
            : `approved (value: ${rv.valueAfter ?? rv.valueBefore ?? '—'})`,
        status: rv.status,
      });
    }
    timeline.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)); // newest-first как аудит-лента

    res.json({
      attribute: { key: attribute.key, name: attribute.name, aiType: attribute.aiType, prompt: attribute.aiPrompt ?? null, guidance: attribute.aiGuidance ?? null },
      runCount,
      runsLimit: RUNS_LIMIT,
      hasMore: runCount > runRows.length,
      currentValue,
      confidence: cell?.confidence ?? null,
      reviewable: cell?.hasCompanion ?? false,
      underReview: cell?.underReview ?? false,
      threshold: cell?.threshold ?? null,
      totalAiCost,
      review: currentReviewRow
        ? {
            status: currentReviewRow.status,
            decidedBy: currentReviewRow.decidedById ? (userName.get(currentReviewRow.decidedById) ?? null) : null,
            decidedAt: currentReviewRow.createdAt.toISOString(),
            confidence: currentReviewRow.confidence,
            note: currentReviewRow.note,
            valueBefore: currentReviewRow.valueBefore,
            valueAfter: currentReviewRow.valueAfter,
          }
        : null,
      run: latest
        ? {
            id: latest.id,
            aiType: latest.aiType,
            status: latest.status,
            creditsCost: latest.creditsCost,
            outputText: latest.outputText ?? null,
            input: latest.input ?? null,
            error: latest.error ?? null,
            requestedBy: latest.requestedBy?.name ?? latest.requestedBy?.email ?? null,
            startedAt: latest.startedAt,
            completedAt: latest.completedAt,
            createdAt: latest.createdAt,
          }
        : null,
      timeline,
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

// ─── GET /api/ai/runs/:aiRunId ───────────────────────────────────────────

aiRouter.get('/runs/:aiRunId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const aiRunId = req.params.aiRunId;

    const meta = await prisma.aiRun.findFirst({ where: { id: aiRunId, orgId }, select: { attribute: { select: { objectId: true } } } });
    if (!meta) { res.status(404).json({ error: 'AI run не найден' }); return; }
    if (!(await aiObjectReadOr404(req, res, meta.attribute.objectId))) return;

    const run = await getAiRunStatus(aiRunId, orgId);

    if (!run) {
      res.status(404).json({ error: 'AI run не найден' });
      return;
    }

    res.json(run);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ai/bulk-runs/:bulkRunId ────────────────────────────────────

aiRouter.get('/bulk-runs/:bulkRunId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const bulkRunId = req.params.bulkRunId;

    const meta = await prisma.aiBulkRun.findFirst({ where: { id: bulkRunId, orgId }, select: { attribute: { select: { objectId: true } } } });
    if (!meta) { res.status(404).json({ error: 'Bulk AI run не найден' }); return; }
    if (!(await aiObjectReadOr404(req, res, meta.attribute.objectId))) return;

    const run = await getBulkRunStatus(bulkRunId, orgId);

    if (!run) {
      res.status(404).json({ error: 'Bulk AI run не найден' });
      return;
    }

    res.json(run);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ai/bulk-runs/:bulkRunId/runs ───────────────────────────────
// Пер-рекордные результаты массового прогона: какие записи упали (частичные ошибки, M9.2).

aiRouter.get('/bulk-runs/:bulkRunId/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const bulkRunId = req.params.bulkRunId;

    const bulk = await prisma.aiBulkRun.findFirst({
      where: { id: bulkRunId, orgId },
      select: { id: true, attribute: { select: { objectId: true } } },
    });
    if (!bulk) {
      res.status(404).json({ error: 'Bulk AI run не найден' });
      return;
    }
    if (!(await aiObjectReadOr404(req, res, bulk.attribute.objectId))) return;

    const runs = await prisma.aiRun.findMany({
      where: { orgId, bulkRunId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        recordId: true,
        status: true,
        creditsCost: true,
        error: true,
        outputText: true,
        completedAt: true,
      },
    });

    res.json({ bulkRunId, count: runs.length, runs });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ai/metrics ──────────────────────────────────────────────────
// Метрики Data Hub из РЕАЛЬНЫХ значений (M9.7): AI-filled (заполненные ячейки aiEnabled-атрибутов),
// evidence coverage (доля записей с заполненным RESEARCH/SUMMARIZE-полем), needs review (ТОТ ЖЕ builder,
// что /review-queue, с версионированием), credits (spentOnAi по фактическим списаниям + остаток), last run.
const metricsQuery = z.object({ objectKey: z.string().min(1) });

// «Заполнено» = существует значение и хотя бы одно типизированное поле непустое.
function valueIsFilled(v: { textValue: string | null; longTextValue: string | null; numberValue: unknown; booleanValue: boolean | null; dateValue: Date | null; jsonValue: unknown } | undefined): boolean {
  if (!v) return false;
  return (
    (v.textValue != null && v.textValue !== '') ||
    (v.longTextValue != null && v.longTextValue !== '') ||
    v.numberValue != null ||
    v.booleanValue != null ||
    v.dateValue != null ||
    (v.jsonValue != null)
  );
}

aiRouter.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { objectKey } = metricsQuery.parse(req.query);

    const object = await prisma.object.findFirst({
      where: { orgId, key: objectKey, archivedAt: null },
      select: {
        id: true,
        attributes: {
          where: { isArchived: false, aiEnabled: true },
          select: { id: true, key: true, name: true, aiType: true },
        },
      },
    });
    if (!object) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const aiAttrs = object.attributes; // только aiEnabled
    const aiAttrIds = aiAttrs.map((a) => a.id);
    // evidence-bearing = RESEARCH / SUMMARIZE (CLASSIFY-оценка типа AI Tier не считается доказательной базой)
    const evidenceAttrIds = aiAttrs.filter((a) => a.aiType === 'RESEARCH' || a.aiType === 'SUMMARIZE').map((a) => a.id);

    // только неархивные записи + их значения по AI-атрибутам
    const records = await prisma.record.findMany({
      where: { orgId, objectId: object.id, archivedAt: null },
      select: {
        id: true,
        values: {
          where: { attributeId: { in: aiAttrIds } },
          select: { attributeId: true, textValue: true, longTextValue: true, numberValue: true, booleanValue: true, dateValue: true, jsonValue: true },
        },
      },
    });
    const totalRecords = records.length;
    const aiCellsTotal = totalRecords * aiAttrs.length;

    let aiFilled = 0;
    let recordsWithEvidence = 0;
    for (const rec of records) {
      const byAttr = new Map(rec.values.map((v) => [v.attributeId, v]));
      for (const id of aiAttrIds) {
        if (valueIsFilled(byAttr.get(id))) aiFilled += 1;
      }
      if (evidenceAttrIds.some((id) => valueIsFilled(byAttr.get(id)))) recordsWithEvidence += 1;
    }
    const evidenceCoverage = totalRecords ? Math.round((recordsWithEvidence / totalRecords) * 100) : 0;

    // needs review — ровно тот же builder, что GET /review-queue (включая versioning по fingerprint)
    const queue = await buildReviewQueue(orgId, objectKey);
    const needsReview = queue ? queue.items.length : 0;

    // spent on AI = сумма ФАКТИЧЕСКИХ DEBIT-списаний, привязанных к AiRun (failed runs не списывают → не в spend)
    const spentAgg = await prisma.creditTransaction.aggregate({
      where: { orgId, type: 'DEBIT', aiRunId: { not: null } },
      _sum: { amount: true },
    });
    const spentOnAi = Math.abs(Number(spentAgg._sum.amount ?? 0));
    const balance = await getOrCreateBalance(orgId);

    const lastRun = aiAttrIds.length
      ? await prisma.aiRun.findFirst({
          where: { orgId, attributeId: { in: aiAttrIds } },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, status: true },
        })
      : null;

    res.json({
      objectKey,
      totalRecords,
      aiAttributes: aiAttrs.map((a) => ({ key: a.key, name: a.name, aiType: a.aiType })),
      aiFilled,
      aiCellsTotal,
      aiFilledPct: aiCellsTotal ? Math.round((aiFilled / aiCellsTotal) * 100) : 0,
      evidenceCoverage,
      recordsWithEvidence,
      needsReview,
      credits: {
        spentOnAi,
        remaining: balance.balance,
        used: balance.usedThisPeriod,
        includedMonthly: balance.includedMonthly,
      },
      lastRunAt: lastRun?.createdAt ?? null,
      lastRunStatus: lastRun?.status ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/billing/credits ─────────────────────────────────────────────

creditsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const [balance, breakdown] = await Promise.all([
      getOrCreateBalance(orgId),
      getUsageBreakdown(orgId),
    ]);

    res.json({
      balance: balance.balance,
      includedMonthly: balance.includedMonthly,
      usedThisPeriod: balance.usedThisPeriod,
      periodEnd: balance.periodEnd?.toISOString() ?? null,
      breakdown,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/billing/credits/transactions ───────────────────────────────

creditsRouter.get(
  '/transactions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.orgId!;
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const createdById =
        typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;

      const result = await listTransactions({
        orgId,
        page,
        limit,
        type,
        createdById,
        from,
        to,
      });

      res.json({
        transactions: result.transactions,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export { aiRouter };
export default aiRouter;
