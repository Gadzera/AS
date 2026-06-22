/**
 * Workflows (M-автоматизация). Правила «триггер → условие → действия» поверх sequence-движка.
 *  - GET    /api/workflows        — сид системных правил при первом заходе + список с run-статами,
 *                                   лента последних прогонов, каталог триггеров/действий.
 *  - POST   /api/workflows        — создать правило (OWNER/ADMIN).
 *  - PATCH  /api/workflows/:id     — вкл/выкл и редактирование (OWNER/ADMIN).
 *  - DELETE /api/workflows/:id     — удалить (только пользовательские, не системные; OWNER/ADMIN).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { ACTIONS, TRIGGERS, ensureSystemWorkflows, testWorkflow, retryWorkflowRun, rerunWorkflow, runWorkflows, publishWorkflow, duplicateWorkflow } from '../services/workflows';
import { validateActionList } from '../services/workflowActions';
import { listSecrets, setSecret, deleteSecret, secretsAvailable, SecretsUnavailableError } from '../services/workflowSecrets';
import { audit } from '../services/audit';
import { assertAccess, buildResolver, meets } from '../services/permissions';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
function requireManager(req: Request, res: Response): boolean {
  if (!canManage(req.user!.role)) {
    res.status(403).json({ error: 'Only the owner or an admin can manage workflows' });
    return false;
  }
  return true;
}

const TRIGGER_KEYS = Object.keys(TRIGGERS);
const CLASSES = ['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE'] as const;

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    await ensureSystemWorkflows(orgId);

    const [workflows, runs] = await Promise.all([
      prisma.workflow.findMany({ where: { orgId }, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] }),
      prisma.workflowRun.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    // Подтянуть имена лидов к прогонам
    const leadIds = [...new Set(runs.map((r) => r.leadId).filter(Boolean) as string[])];
    const leads = leadIds.length ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, firstName: true, lastName: true, company: true } }) : [];
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const wfMap = new Map(workflows.map((w) => [w.id, w.name]));
    const runsOut = runs.map((r) => ({
      id: r.id, trigger: r.trigger, summary: r.summary, createdAt: r.createdAt,
      // M17-1: run-ledger поля — Runs-tab показывает реальные статусы/тайминг (не декоративная лента).
      status: r.status, durationMs: r.durationMs, attemptCount: r.attemptCount, dedupeCount: r.dedupeCount, workflowId: r.workflowId,
      recordId: r.recordId, version: r.workflowVersion, // M17-5: версия прогона
      workflowName: wfMap.get(r.workflowId) ?? '—',
      lead: r.leadId && leadMap.has(r.leadId) ? `${leadMap.get(r.leadId)!.firstName} ${leadMap.get(r.leadId)!.lastName}` : null,
    }));

    // M17-5: published-флаги + «unpublished changes» (draftUpdatedAt > publishedAt текущей версии).
    const pubKeys = workflows.filter((w) => w.publishedVersion != null).map((w) => ({ workflowId: w.id, version: w.publishedVersion as number }));
    const pubVers = pubKeys.length ? await prisma.workflowVersion.findMany({ where: { OR: pubKeys }, select: { workflowId: true, publishedAt: true } }) : [];
    const pubAtByWf = new Map(pubVers.map((v) => [v.workflowId, v.publishedAt]));
    const workflowsOut = workflows.map((w) => {
      const pubAt = pubAtByWf.get(w.id);
      const hasUnpublishedChanges = w.publishedVersion == null || (!!w.draftUpdatedAt && !!pubAt && w.draftUpdatedAt > pubAt);
      return { ...w, published: w.publishedVersion != null, hasUnpublishedChanges };
    });

    const stats = {
      total: workflows.length,
      active: workflows.filter((w) => w.isActive && w.publishedVersion != null).length,
      totalRuns: workflows.reduce((s, w) => s + w.runCount, 0),
    };

    // RBAC: скрываем workflows с уровнем NONE + их прогоны (S355)
    const resolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'WORKFLOW');
    const visibleWf = workflowsOut.filter((w) => meets(resolver(w.id), 'READ'));
    const visibleIds = new Set(visibleWf.map((w) => w.id));

    res.json({
      workflows: visibleWf, runs: runsOut.filter((r) => visibleIds.has(r.workflowId)), stats,
      canManage: canManage(req.user!.role),
      catalog: { triggers: TRIGGERS, actions: ACTIONS },
    });
  } catch (err) {
    next(err);
  }
});

// ─── M17-4 secret store (для HTTP-блоков; value наружу НЕ отдаётся) ───────────
// GET — только метаданные (все роли). POST/DELETE — manager. /secrets/:key — 2 сегмента, не конфликтует с /:id.
router.get('/secrets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ available: secretsAvailable(), canManage: canManage(req.user!.role), secrets: await listSecrets(req.user!.orgId!) });
  } catch (err) { next(err); }
});
const secretSchema = z.object({ key: z.string().min(1).max(64), value: z.string().min(1).max(8192) });
router.post('/secrets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const data = secretSchema.parse(req.body);
    const meta = await setSecret(req.user!.orgId!, data.key, data.value, req.user!.userId);
    res.status(201).json({ secret: meta });
  } catch (err) {
    if (err instanceof SecretsUnavailableError) { res.status(503).json({ error: 'Secret store not configured (WORKFLOW_SECRET_ENCRYPTION_KEY missing)', code: 'SECRETS_UNAVAILABLE' }); return; }
    if (err instanceof Error && /Invalid secret key/.test(err.message)) { res.status(400).json({ error: err.message }); return; }
    next(err);
  }
});
router.delete('/secrets/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const key = req.params.key;
    // M17-5: предупредить, если секрет используется в actions (удаление разрешено, но publish такого правила упадёт).
    const token = `{{secret.${key}}}`;
    const wfs = await prisma.workflow.findMany({ where: { orgId }, select: { name: true, actions: true } });
    const referenced = wfs.filter((w) => w.actions.some((a) => a.includes(token))).map((w) => w.name);
    const ok = await deleteSecret(orgId, key);
    res.json({ ok, warning: referenced.length ? `Still referenced by ${referenced.length} workflow(s): ${referenced.slice(0, 3).join(', ')}` : undefined });
  } catch (err) { next(err); }
});

// M17-2: пользователь может строить правило на любом каноническом триггере (UI помечает contract-only).
const TRIGGER_ENUM = Object.keys(TRIGGERS) as [string, ...string[]];
const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  trigger: z.enum(TRIGGER_ENUM),
  conditionClass: z.enum(CLASSES).nullable().optional(),
  // M17-3: каждый элемент — голый ключ ИЛИ JSON-спека {type,config}; до 24 шагов на правило.
  actions: z.array(z.string()).min(1).max(24),
  isActive: z.boolean().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ_WRITE'))) return;
    const orgId = req.user!.orgId!;
    const data = upsertSchema.parse(req.body);
    // M17-3: валидируем config КАЖДОГО действия + span-границы IF/SWITCH (а не только имя ключа).
    const av = validateActionList(data.actions);
    if (!av.ok) { res.status(400).json({ error: `Action ${av.index + 1}: ${av.error}` }); return; }

    const workflow = await prisma.workflow.create({
      data: {
        orgId, name: data.name, description: data.description ?? null, trigger: data.trigger as never,
        conditionClass: (data.trigger === 'REPLY_RECEIVED' ? data.conditionClass ?? null : null) as never,
        actions: data.actions, isActive: data.isActive ?? true, isSystem: false,
        draftUpdatedAt: new Date(), // M17-5: новый workflow — unpublished draft (publishedVersion=null)
      },
    });
    res.status(201).json({ workflow });
  } catch (err) {
    next(err);
  }
});

const patchSchema = upsertSchema.partial();

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ_WRITE', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const existing = await prisma.workflow.findFirst({ where: { id: req.params.id, orgId } });
    if (!existing) { res.status(404).json({ error: 'Workflow not found' }); return; }
    const data = patchSchema.parse(req.body);

    if (data.actions) {
      const av = validateActionList(data.actions);
      if (!av.ok) { res.status(400).json({ error: `Action ${av.index + 1}: ${av.error}` }); return; }
    }

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.actions !== undefined) update.actions = data.actions;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    // Системные правила: можно вкл/выкл и менять действия, но не триггер/условие (целостность шаблона).
    if (!existing.isSystem) {
      if (data.trigger !== undefined) update.trigger = data.trigger;
      if (data.conditionClass !== undefined) update.conditionClass = data.conditionClass;
    }
    // M17-5: правка содержимого draft помечает «unpublished changes» (не влияет на published-исполнение до Publish).
    if (data.name !== undefined || data.description !== undefined || data.actions !== undefined || data.trigger !== undefined || data.conditionClass !== undefined) update.draftUpdatedAt = new Date();

    const workflow = await prisma.workflow.update({ where: { id: existing.id }, data: update });
    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      await audit({ orgId, actorId: req.user!.userId, actorName: req.user!.email, action: data.isActive ? 'WORKFLOW_ENABLED' : 'WORKFLOW_DISABLED', targetType: 'workflow', targetId: existing.id, summary: `${data.isActive ? 'Enabled' : 'Disabled'} workflow "${workflow.name}"` });
    }
    res.json({ workflow });
  } catch (err) {
    next(err);
  }
});

// POST /api/workflows/:id/test — сухой прогон правила на реальном лиде (без мутаций),
// пишет наблюдаемый [test]-run в ленту. Помогает увидеть, что и на ком сработает.
router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ_WRITE', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const result = await testWorkflow(orgId, req.params.id);
    if (!result.ok) { res.status(404).json({ error: 'Workflow not found' }); return; }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// M17-5: POST /api/workflows/:id/publish — АТОМАРНАЯ публикация draft → новая WorkflowVersion.
// Валидация (config/refs/secrets/spans) не прошла → 422 с field-level errors, published-версия НЕ меняется.
router.post('/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ_WRITE', req.params.id))) return;
    const r = await publishWorkflow(req.user!.orgId!, req.params.id, req.user!.userId);
    if (r.ok) { res.json({ ok: true, version: r.version }); return; }
    if (r.code === 'NOT_FOUND') { res.status(404).json({ error: 'Workflow not found' }); return; }
    if (r.code === 'PUBLISH_CONFLICT') { res.status(409).json({ error: 'Another publish is in progress — try again', code: 'PUBLISH_CONFLICT' }); return; }
    res.status(422).json({ error: 'Validation failed — fix the errors before publishing', code: 'PUBLISH_VALIDATION', errors: r.errors });
  } catch (err) { next(err); }
});

// M17-5: POST /api/workflows/:id/duplicate — копия как UNPUBLISHED draft (без runs/versions).
router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ_WRITE'))) return;
    const r = await duplicateWorkflow(req.user!.orgId!, req.params.id);
    if (!r.ok) { res.status(404).json({ error: 'Workflow not found' }); return; }
    res.status(201).json({ workflow: r.workflow });
  } catch (err) { next(err); }
});

// ─── M17-1 run-ledger endpoints ──────────────────────────────────────────────

const RUN_STATUSES = ['PENDING', 'RUNNING', 'WAITING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED'];

// GET /api/workflows/runs/:runId — детальный прогон + per-step ledger (для step-log drawer).
router.get('/runs/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const run = await prisma.workflowRun.findFirst({ where: { id: req.params.runId, orgId } });
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }
    const [steps, wf, lead] = await Promise.all([
      prisma.workflowRunStep.findMany({ where: { runId: run.id }, orderBy: { order: 'asc' } }),
      prisma.workflow.findUnique({ where: { id: run.workflowId }, select: { name: true } }),
      run.leadId ? prisma.lead.findFirst({ where: { id: run.leadId, orgId }, select: { firstName: true, lastName: true, company: true } }) : Promise.resolve(null),
    ]);
    res.json({
      run: {
        id: run.id, workflowId: run.workflowId, workflowName: wf?.name ?? '—', trigger: run.trigger, status: run.status,
        summary: run.summary, error: run.error, startedAt: run.startedAt, completedAt: run.completedAt, durationMs: run.durationMs,
        attemptCount: run.attemptCount, dedupeCount: run.dedupeCount, idempotencyKey: run.idempotencyKey, campaignId: run.campaignId,
        attributionMode: run.attributionMode, createdAt: run.createdAt, version: run.workflowVersion, // M17-5
        lead: lead ? `${lead.firstName} ${lead.lastName}${lead.company ? ` · ${lead.company}` : ''}` : null,
      },
      steps: steps.map((s) => ({ id: s.id, order: s.order, action: s.action, status: s.status, resultSummary: s.resultSummary, error: s.error, input: s.input, output: s.output, durationMs: s.durationMs, attemptCount: s.attemptCount })),
    });
  } catch (err) { next(err); }
});

// POST /api/workflows/runs/:runId/retry — повтор FAILED/PARTIAL (пропускает SUCCEEDED-шаги, не повторяет side effects).
router.post('/runs/:runId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const r = await retryWorkflowRun(orgId, req.params.runId);
    if (r.ok) { res.json({ ok: true, status: r.status }); return; }
    const map: Record<string, number> = { NOT_FOUND: 404, WORKFLOW_GONE: 404, NOTHING_TO_RETRY: 400, RETRY_LIMIT_REACHED: 429 };
    res.status(map[r.code ?? ''] ?? 400).json({ error: r.code === 'RETRY_LIMIT_REACHED' ? 'Retry limit reached' : r.code === 'NOTHING_TO_RETRY' ? 'Run already succeeded — nothing to retry' : 'Run not found', code: r.code });
  } catch (err) { next(err); }
});

// POST /api/workflows/runs/:runId/rerun — совершенно новый прогон того же правила (новый idempotencyKey).
router.post('/runs/:runId/rerun', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!requireManager(req, res)) return;
    const orgId = req.user!.orgId!;
    const r = await rerunWorkflow(orgId, req.params.runId);
    if (r.ok) { res.json({ ok: true, runId: r.runId, status: r.status }); return; }
    res.status(404).json({ error: 'Run not found', code: r.code });
  } catch (err) { next(err); }
});

// GET /api/workflows/:id/runs — пагинированная история прогонов правила (фильтр по статусу).
router.get('/:id/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ', req.params.id))) return;
    const wf = await prisma.workflow.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, name: true } });
    if (!wf) { res.status(404).json({ error: 'Workflow not found' }); return; }
    const status = typeof req.query.status === 'string' && RUN_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const where = { orgId, workflowId: wf.id, ...(status ? { status: status as never } : {}) };
    const [rows, total] = await Promise.all([
      prisma.workflowRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: limit }),
      prisma.workflowRun.count({ where }),
    ]);
    const leadIds = [...new Set(rows.map((r) => r.leadId).filter(Boolean) as string[])];
    const leads = leadIds.length ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    res.json({
      workflow: wf, total, limit, offset,
      runs: rows.map((r) => ({
        id: r.id, trigger: r.trigger, status: r.status, summary: r.summary, durationMs: r.durationMs, attemptCount: r.attemptCount,
        dedupeCount: r.dedupeCount, createdAt: r.createdAt, version: r.workflowVersion, // M17-5
        lead: r.leadId && leadMap.has(r.leadId) ? `${leadMap.get(r.leadId)!.firstName} ${leadMap.get(r.leadId)!.lastName}` : null,
      })),
    });
  } catch (err) { next(err); }
});

// M17-2: POST /api/workflows/:id/run — ручной запуск ОДНОГО правила (MANUAL_RUN / RECORD_COMMAND / LIST_ENTRY_COMMAND).
// clientRequestId ОБЯЗАТЕЛЕН (защита от двойного клика): без него → 400. Дубль того же clientRequestId → existing run.
const manualRunSchema = z.object({
  clientRequestId: z.string().min(1).max(100),
  recordId: z.string().optional(),
  objectId: z.string().optional(),
  leadId: z.string().optional(),
});
router.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'READ_WRITE', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const parsed = manualRunSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'clientRequestId is required for a manual run', code: 'CLIENT_REQUEST_ID_REQUIRED' }); return; }
    const { clientRequestId, recordId, objectId, leadId } = parsed.data;
    const wf = await prisma.workflow.findFirst({ where: { id: req.params.id, orgId }, select: { id: true, trigger: true, isActive: true, publishedVersion: true } });
    if (!wf) { res.status(404).json({ error: 'Workflow not found' }); return; }
    if (wf.publishedVersion == null) { res.status(409).json({ error: 'Workflow is not published — publish it before running', code: 'WORKFLOW_NOT_PUBLISHED' }); return; } // M17-5: исполняем только published
    if (!wf.isActive) { res.status(409).json({ error: 'Workflow is disabled — enable it to run', code: 'WORKFLOW_DISABLED' }); return; } // не делаем вид, что disabled-правило «запустилось»
    const targetId = recordId ?? leadId ?? 'none';
    const key = `manual:${wf.id}:${req.user!.userId}:${targetId}:${clientRequestId}`;
    // onlyWorkflowId → запускаем РОВНО это правило (не все по триггеру). Триггер берём с правила.
    const r = await runWorkflows({ orgId, trigger: wf.trigger as never, onlyWorkflowId: wf.id, leadId, recordId, objectId, idempotencyKey: key });
    const created = r.runs[0];
    res.json({ ok: true, runId: created?.runId, status: created?.status, deduped: created?.deduped ?? false });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'WORKFLOW', 'FULL', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const existing = await prisma.workflow.findFirst({ where: { id: req.params.id, orgId } });
    if (!existing) { res.status(404).json({ error: 'Workflow not found' }); return; }
    if (existing.isSystem) { res.status(400).json({ error: 'System workflows cannot be deleted — disable it instead' }); return; }
    await prisma.workflow.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
