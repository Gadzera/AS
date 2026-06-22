/**
 * Report Builder + Dashboards (модуль 14, M18-1). Конфигурируемые отчёты над CRM-объектами/списками.
 * Маршрут /api/report-builder — ОТДЕЛЬНЫЙ от /api/analytics (наша AI-SDR outbound-аналитика).
 *
 *  GET    /meta                      — источники (objects+lists) с атрибутами для конструктора
 *  GET    /reports                   — список сохранённых отчётов
 *  POST   /reports                   — создать (manager; clientRequestId duplicate-safe)
 *  GET    /reports/:id               — отчёт + вычисленный результат (live)
 *  PATCH  /reports/:id               — правка (manager)
 *  DELETE /reports/:id               — архивировать (manager)
 *  POST   /preview                   — посчитать результат БЕЗ сохранения (member; read-only)
 *  GET    /reports/:id/drill         — drill-in: реальные записи бакета (member; read-only)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma, ReportSourceType, ReportType, ReportVisualization, AccessLevel } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';
import { assertAccess, buildResolver, meets, grantCreatorFull, resolveAccess } from '../services/permissions';

// RBAC: отчёт читает данные source-объекта/списка → нужен READ на источник (иначе отчёт = обход OBJECT NONE).
async function assertSourceReadable(req: Request, res: Response, sourceType: string, sourceObjectId: string | null, sourceListId: string | null): Promise<boolean> {
  if (sourceType === 'OBJECT' && sourceObjectId) return assertAccess(req, res, 'OBJECT', 'READ', sourceObjectId);
  if (sourceType === 'LIST' && sourceListId) return assertAccess(req, res, 'LIST', 'READ', sourceListId);
  return true;
}
async function sourceReadable(req: Request, sourceType: string, sourceObjectId: string | null, sourceListId: string | null): Promise<boolean> {
  const u = { userId: req.user!.userId, role: req.user!.role };
  if (sourceType === 'OBJECT' && sourceObjectId) return meets(await resolveAccess(req.user!.orgId!, u, 'OBJECT', sourceObjectId), 'READ');
  if (sourceType === 'LIST' && sourceListId) return meets(await resolveAccess(req.user!.orgId!, u, 'LIST', sourceListId), 'READ');
  return true;
}
import {
  ReportValidationError,
  computeReport,
  drillReport,
  backfillReportHistory,
  type MetricSpec,
  type ReportConfigInput,
} from '../services/reportBuilder';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

function canManage(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
function requireManager(req: Request, res: Response): boolean {
  if (!canManage(req.user!.role)) {
    res.status(403).json({ error: 'Only the owner or an admin can manage reports', code: 'REPORT_CREATE_DENIED' });
    return false;
  }
  return true;
}

const FILTER_OPS = ['eq', 'neq', 'contains', 'gt', 'lt', 'in', 'is_empty', 'is_not_empty'] as const;

const metricSchema = z.union([
  z.object({ kind: z.literal('count') }),
  z.object({ kind: z.enum(['sum', 'avg']), attributeId: z.string().min(1) }),
]);
const filterSchema = z.object({ attributeKey: z.string().min(1), op: z.enum(FILTER_OPS), value: z.unknown().optional() });
const configSchema = z.object({
  stageOrder: z.array(z.string()).optional(),
  dateRange: z.object({ from: z.string().optional(), to: z.string().optional() }).optional(),
}).nullish();

const reportBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['INSIGHT', 'FUNNEL', 'HISTORICAL', 'TIME_IN_STAGE', 'STAGE_CHANGE']),
  sourceType: z.enum(['OBJECT', 'LIST']),
  sourceObjectId: z.string().nullish(),
  sourceListId: z.string().nullish(),
  metric: metricSchema,
  groupByAttributeId: z.string().nullish(),
  segmentByAttributeId: z.string().nullish(),
  filters: z.array(filterSchema).default([]),
  visualization: z.enum(['BAR', 'LINE', 'TABLE', 'FUNNEL']).default('BAR'),
  config: configSchema,
});

type ReportBody = z.infer<typeof reportBodySchema>;

function bodyToConfig(b: ReportBody): ReportConfigInput {
  return {
    type: b.type as ReportType,
    sourceType: b.sourceType as ReportSourceType,
    sourceObjectId: b.sourceObjectId ?? null,
    sourceListId: b.sourceListId ?? null,
    metric: b.metric as MetricSpec,
    groupByAttributeId: b.groupByAttributeId ?? null,
    segmentByAttributeId: b.segmentByAttributeId ?? null,
    filters: b.filters,
    visualization: b.visualization as ReportVisualization,
    config: b.config ?? null,
  };
}

// Конфиг из сохранённой строки Report (Json-поля → типизированный ReportConfigInput).
function rowToConfig(row: {
  type: ReportType; sourceType: ReportSourceType; sourceObjectId: string | null; sourceListId: string | null;
  metric: Prisma.JsonValue; groupByAttributeId: string | null; segmentByAttributeId: string | null;
  filters: Prisma.JsonValue; visualization: ReportVisualization; config: Prisma.JsonValue;
}): ReportConfigInput {
  return {
    type: row.type,
    sourceType: row.sourceType,
    sourceObjectId: row.sourceObjectId,
    sourceListId: row.sourceListId,
    metric: (row.metric ?? { kind: 'count' }) as MetricSpec,
    groupByAttributeId: row.groupByAttributeId,
    segmentByAttributeId: row.segmentByAttributeId,
    filters: Array.isArray(row.filters) ? (row.filters as ReportConfigInput['filters']) : [],
    visualization: row.visualization,
    config: (row.config ?? null) as ReportConfigInput['config'],
  };
}

function serializeReport(row: {
  id: string; name: string; type: ReportType; sourceType: ReportSourceType; sourceObjectId: string | null; sourceListId: string | null;
  metric: Prisma.JsonValue; groupByAttributeId: string | null; segmentByAttributeId: string | null; filters: Prisma.JsonValue;
  visualization: ReportVisualization; config: Prisma.JsonValue; createdById: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id, name: row.name, type: row.type, sourceType: row.sourceType,
    sourceObjectId: row.sourceObjectId, sourceListId: row.sourceListId,
    metric: row.metric, groupByAttributeId: row.groupByAttributeId, segmentByAttributeId: row.segmentByAttributeId,
    filters: row.filters, visualization: row.visualization, config: row.config,
    createdById: row.createdById, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function handleErr(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ReportValidationError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code, field: err.field });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid report configuration', code: 'REPORT_BODY_INVALID', issues: err.issues });
    return;
  }
  next(err);
}

// Короткое описание конфига для audit-diff (НЕ кладём вычисленный результат).
function configSummary(cfg: ReportConfigInput): string {
  const src = cfg.sourceType === 'OBJECT' ? `object:${cfg.sourceObjectId}` : `list:${cfg.sourceListId}`;
  const m = cfg.metric.kind === 'count' ? 'count' : `${cfg.metric.kind}(${cfg.metric.attributeId})`;
  const grp = cfg.groupByAttributeId ? ` group:${cfg.groupByAttributeId}` : '';
  const seg = cfg.segmentByAttributeId ? ` segment:${cfg.segmentByAttributeId}` : '';
  return `${cfg.type} ${cfg.visualization} ${src} metric:${m}${grp}${seg} filters:${cfg.filters.length}`;
}

// ── GET /meta — источники для конструктора ──────────────────────────────────────
router.get('/meta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [objects, lists] = await Promise.all([
      prisma.object.findMany({
        where: { orgId, archivedAt: null, isHidden: false },
        orderBy: { pluralName: 'asc' },
        select: {
          id: true, key: true, singularName: true, pluralName: true,
          attributes: {
            where: { isArchived: false },
            orderBy: { order: 'asc' },
            select: {
              id: true, key: true, name: true, type: true, aiEnabled: true,
              options: { where: { isArchived: false }, orderBy: { order: 'asc' }, select: { value: true, label: true, order: true } },
            },
          },
        },
      }),
      prisma.list.findMany({
        where: { orgId, archivedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, primaryObjectId: true, primaryObject: { select: { key: true, pluralName: true } } },
      }),
    ]);
    // RBAC: конструктор показывает только READ-абельные объекты/списки как источники (S355 + не кормит preview-обход)
    const u = { userId: req.user!.userId, role: req.user!.role };
    const [objR, listR] = await Promise.all([buildResolver(orgId, u, 'OBJECT'), buildResolver(orgId, u, 'LIST')]);
    res.json({
      objects: objects.filter((o) => meets(objR(o.id), 'READ')),
      lists: lists.filter((l) => meets(listR(l.id), 'READ')).map((l) => ({ id: l.id, name: l.name, primaryObjectId: l.primaryObjectId, primaryObjectKey: l.primaryObject?.key ?? null, primaryObjectName: l.primaryObject?.pluralName ?? null })),
    });
  } catch (err) { next(err); }
});

// ── GET /reports — список ────────────────────────────────────────────────────────
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const reports = await prisma.report.findMany({ where: { orgId, archivedAt: null }, orderBy: { updatedAt: 'desc' } });
    // RBAC: dashboards/reports приватны — скрываем с уровнем NONE (S355)
    const resolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'DASHBOARD');
    res.json({ reports: reports.filter((r) => meets(resolver(r.id), 'READ')).map(serializeReport) });
  } catch (err) { next(err); }
});

// ── POST /reports — создать (manager, clientRequestId duplicate-safe) ───────────
router.post('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'DASHBOARD', 'READ_WRITE'))) return;
    const orgId = req.user!.orgId!;
    const clientRequestId = typeof req.body?.clientRequestId === 'string' && req.body.clientRequestId.trim() ? req.body.clientRequestId.trim().slice(0, 120) : null;

    // duplicate-safe: тот же clientRequestId → возвращаем существующий отчёт, не плодим дубль.
    if (clientRequestId) {
      const existing = await prisma.report.findFirst({ where: { orgId, clientRequestId } });
      if (existing) {
        const result = await computeReport(orgId, rowToConfig(existing)).catch(() => null);
        res.status(200).json({ report: serializeReport(existing), result, deduped: true });
        return;
      }
    }

    const body = reportBodySchema.parse(req.body);
    const cfg = bodyToConfig(body);

    // Валидация + расчёт ДО вставки: invalid → 400, ничего не сохраняем.
    const result = await computeReport(orgId, cfg, true);

    let created;
    try {
      created = await prisma.report.create({
        data: {
          orgId, name: body.name, type: cfg.type, sourceType: cfg.sourceType,
          sourceObjectId: cfg.sourceObjectId, sourceListId: cfg.sourceListId,
          metric: cfg.metric as unknown as Prisma.InputJsonValue,
          groupByAttributeId: cfg.groupByAttributeId, segmentByAttributeId: cfg.segmentByAttributeId,
          filters: cfg.filters as unknown as Prisma.InputJsonValue,
          visualization: cfg.visualization,
          config: (cfg.config ?? Prisma.DbNull) as Prisma.InputJsonValue,
          clientRequestId, createdById: req.user!.userId,
        },
      });
    } catch (e) {
      // гонка двух одинаковых clientRequestId → вернуть существующий
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && clientRequestId) {
        const existing = await prisma.report.findFirst({ where: { orgId, clientRequestId } });
        if (existing) {
          const r = await computeReport(orgId, rowToConfig(existing)).catch(() => null);
          res.status(200).json({ report: serializeReport(existing), result: r, deduped: true });
          return;
        }
      }
      throw e;
    }

    // правка #4: создатель получает INDIVIDUAL FULL на отчёт (workspace default DASHBOARD=NONE → приватен)
    await grantCreatorFull(orgId, req.user!.userId, 'DASHBOARD', created.id);
    await audit({ orgId, actorId: req.user!.userId, action: 'REPORT_CREATED', targetType: 'report', targetId: created.id, summary: configSummary(cfg) });
    res.status(201).json({ report: serializeReport(created), result });
  } catch (err) { handleErr(err, res, next); }
});

// ── GET /reports/:id — отчёт + результат ────────────────────────────────────────
router.get('/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'DASHBOARD', 'READ', req.params.id))) return;
    const row = await prisma.report.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!row) { res.status(404).json({ error: 'Report not found' }); return; }
    if (!(await assertSourceReadable(req, res, row.sourceType, row.sourceObjectId, row.sourceListId))) return;
    const result = await computeReport(orgId, rowToConfig(row), false, row.id).catch((e) => {
      if (e instanceof ReportValidationError) return null;
      throw e;
    });
    res.json({ report: serializeReport(row), result });
  } catch (err) { handleErr(err, res, next); }
});

// ── PATCH /reports/:id — правка (manager) ───────────────────────────────────────
router.patch('/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'DASHBOARD', 'READ_WRITE', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const row = await prisma.report.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!row) { res.status(404).json({ error: 'Report not found' }); return; }

    const body = reportBodySchema.parse(req.body);
    const cfg = bodyToConfig(body);
    const result = await computeReport(orgId, cfg, true); // re-validate

    const updated = await prisma.report.update({
      where: { id: row.id },
      data: {
        name: body.name, type: cfg.type, sourceType: cfg.sourceType,
        sourceObjectId: cfg.sourceObjectId, sourceListId: cfg.sourceListId,
        metric: cfg.metric as unknown as Prisma.InputJsonValue,
        groupByAttributeId: cfg.groupByAttributeId, segmentByAttributeId: cfg.segmentByAttributeId,
        filters: cfg.filters as unknown as Prisma.InputJsonValue,
        visualization: cfg.visualization,
        config: (cfg.config ?? Prisma.DbNull) as Prisma.InputJsonValue,
      },
    });
    await audit({ orgId, actorId: req.user!.userId, action: 'REPORT_UPDATED', targetType: 'report', targetId: row.id, summary: configSummary(cfg) });
    res.json({ report: serializeReport(updated), result });
  } catch (err) { handleErr(err, res, next); }
});

// ── DELETE /reports/:id — архивировать (manager) ────────────────────────────────
router.delete('/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'DASHBOARD', 'FULL', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const row = await prisma.report.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!row) { res.status(404).json({ error: 'Report not found' }); return; }
    await prisma.report.update({ where: { id: row.id }, data: { archivedAt: new Date() } });
    await audit({ orgId, actorId: req.user!.userId, action: 'REPORT_DELETED', targetType: 'report', targetId: row.id, summary: 'archived' });
    res.json({ ok: true });
  } catch (err) { handleErr(err, res, next); }
});

// ── POST /preview — расчёт без сохранения (member read-only) ─────────────────────
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = reportBodySchema.parse(req.body);
    const cfg = bodyToConfig(body);
    // RBAC: нельзя строить отчёт над источником, который не READ-абелен (обход OBJECT/LIST NONE через preview)
    if (!(await assertSourceReadable(req, res, cfg.sourceType, cfg.sourceObjectId ?? null, cfg.sourceListId ?? null))) return;
    const result = await computeReport(orgId, cfg, true);
    res.json({ result });
  } catch (err) { handleErr(err, res, next); }
});

// ── GET /reports/:id/drill?bucket=&segment= — drill-in (member read-only) ───────
router.get('/reports/:id/drill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : '';
    const segment = typeof req.query.segment === 'string' && req.query.segment ? req.query.segment : null;
    if (!bucket) { res.status(400).json({ error: 'bucket is required', code: 'DRILL_BUCKET_REQUIRED' }); return; }
    if (!(await assertAccess(req, res, 'DASHBOARD', 'READ', req.params.id))) return;
    const row = await prisma.report.findFirst({ where: { id: req.params.id, orgId, archivedAt: null } });
    if (!row) { res.status(404).json({ error: 'Report not found' }); return; }
    // drill отдаёт СЫРЫЕ записи bucket'а → нужен READ на source-объект/список
    if (!(await assertSourceReadable(req, res, row.sourceType, row.sourceObjectId, row.sourceListId))) return;
    // drill осмыслен только для INSIGHT/FUNNEL (иначе total не совпадёт с графиком) — серверный гард, не только UI
    if (row.type !== ReportType.INSIGHT && row.type !== ReportType.FUNNEL) { res.status(422).json({ error: 'Drill-in is only available for insight and funnel reports', code: 'DRILL_TYPE_UNSUPPORTED' }); return; }
    const drill = await drillReport(orgId, rowToConfig(row), bucket, segment);
    res.json(drill);
  } catch (err) { handleErr(err, res, next); }
});

// ── POST /reports/:id/backfill-history — построить снапшоты (текущий + реконструкция из StageTransition) ──
router.post('/reports/:id/backfill-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'DASHBOARD', 'READ_WRITE', req.params.id))) return;
    const orgId = req.user!.orgId!;
    const row = await prisma.report.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true } });
    if (!row) { res.status(404).json({ error: 'Report not found' }); return; }
    const result = await backfillReportHistory(orgId, row.id);
    res.json(result);
  } catch (err) { handleErr(err, res, next); }
});

/* ════════════════ Dashboards + widgets (M18-2 + DSH-1 finalization) ════════════════ */
const dashboardBodySchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).nullish() });
// DSH-2: виджет = ЛИБО reportId (linked, live) ЛИБО inlineConfig (immutable снимок, валидируется ТЕМ ЖЕ reportBodySchema). Ровно один.
const widgetBodySchema = z.object({ reportId: z.string().min(1).optional(), inlineConfig: reportBodySchema.optional(), x: z.number().int().min(0).default(0), y: z.number().int().min(0).default(0), w: z.number().int().min(1).max(12).default(6), h: z.number().int().min(1).max(12).default(4) }).refine((b) => (!!b.reportId) !== (!!b.inlineConfig), { message: 'Provide exactly one of reportId or inlineConfig', path: ['reportId'] });
const widgetPatchSchema = z.object({ x: z.number().int().min(0).optional(), y: z.number().int().min(0).optional(), w: z.number().int().min(1).max(12).optional(), h: z.number().int().min(1).max(12).optional(), order: z.number().int().optional() });

const readClientReqId = (req: Request): string | null => (typeof req.body?.clientRequestId === 'string' && req.body.clientRequestId.trim() ? req.body.clientRequestId.trim().slice(0, 120) : null);

// DSH-1 RBAC (правка GPT): чужой private dashboard (NONE) → 404 (скрытие существования);
// доступный, но недостаточного уровня → 403. Возвращает строку дашборда или null (ответ уже отправлен).
async function assertDashboard(req: Request, res: Response, dashId: string, required: AccessLevel): Promise<{ id: string } | null> {
  const orgId = req.user!.orgId!;
  const d = await prisma.dashboard.findFirst({ where: { id: dashId, orgId, archivedAt: null }, select: { id: true } });
  const have = await resolveAccess(orgId, { userId: req.user!.userId, role: req.user!.role }, 'DASHBOARD', dashId);
  if (!d || have === 'NONE') { res.status(404).json({ error: 'Dashboard not found' }); return null; }
  if (!meets(have, required)) { res.status(403).json({ error: `You don’t have ${required.replace('_', '+').toLowerCase()} access to this dashboard`, code: 'PERMISSION_DENIED', entityKind: 'DASHBOARD', needed: required, have }); return null; }
  return d;
}
const serializeDash = (d: { id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date; _count: { widgets: number } }) => ({ id: d.id, name: d.name, description: d.description, widgetCount: d._count.widgets, createdAt: d.createdAt, updatedAt: d.updatedAt });
const serializeWidget = (w: { id: string; reportId: string | null; x: number; y: number; w: number; h: number; order: number }) => ({ id: w.id, reportId: w.reportId ?? null, inline: w.reportId == null, x: w.x, y: w.y, w: w.w, h: w.h, order: w.order });

router.get('/dashboards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const all = await prisma.dashboard.findMany({ where: { orgId, archivedAt: null }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { widgets: true } } } });
    // RBAC: дашборды приватны — скрываем NONE (S355, правка #4)
    const resolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'DASHBOARD');
    const dashboards = all.filter((d) => meets(resolver(d.id), 'READ'));
    res.json({ dashboards: dashboards.map(serializeDash) });
  } catch (err) { next(err); }
});

router.post('/dashboards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertAccess(req, res, 'DASHBOARD', 'READ_WRITE'))) return;
    const orgId = req.user!.orgId!;
    const body = dashboardBodySchema.parse(req.body);
    const clientRequestId = readClientReqId(req);

    // DSH-1 idempotency: тот же clientRequestId → существующий дашборд, без второго ряда и без второго audit
    if (clientRequestId) {
      const existing = await prisma.dashboard.findFirst({ where: { orgId, clientRequestId }, include: { _count: { select: { widgets: true } } } });
      if (existing) { res.status(200).json({ dashboard: serializeDash(existing), deduped: true }); return; }
    }

    let created;
    try {
      created = await prisma.dashboard.create({ data: { orgId, name: body.name, description: body.description ?? null, createdById: req.user!.userId, clientRequestId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && clientRequestId) {
        const existing = await prisma.dashboard.findFirst({ where: { orgId, clientRequestId }, include: { _count: { select: { widgets: true } } } });
        if (existing) { res.status(200).json({ dashboard: serializeDash(existing), deduped: true }); return; }
      }
      throw e;
    }
    // правка #4: создатель → INDIVIDUAL FULL (workspace default DASHBOARD=NONE → приватен создателю)
    await grantCreatorFull(orgId, req.user!.userId, 'DASHBOARD', created.id);
    await audit({ orgId, actorId: req.user!.userId, action: 'DASHBOARD_CREATED', targetType: 'dashboard', targetId: created.id, summary: created.name });
    res.status(201).json({ dashboard: { id: created.id, name: created.name, description: created.description, widgetCount: 0, createdAt: created.createdAt, updatedAt: created.updatedAt } });
  } catch (err) { handleErr(err, res, next); }
});

// Полный дашборд: виджеты + вычисленный результат каждого отчёта (live).
router.get('/dashboards/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertDashboard(req, res, req.params.id, 'READ'))) return;
    const d = await prisma.dashboard.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, include: { widgets: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } } });
    if (!d) { res.status(404).json({ error: 'Dashboard not found' }); return; }
    const widgets = await Promise.all(d.widgets.map(async (w) => {
      // DSH-2: inline-виджет (immutable снимок) считается из СВОЕГО config; linked — из текущего Report (live).
      if (w.reportId == null) {
        const parsed = reportBodySchema.safeParse(w.inlineConfig);
        // снимок повреждён/несовместим со схемой ЛИБО HISTORICAL (без reportId данных нет, см. write-guard) → honest placeholder, без 500
        if (!parsed.success || parsed.data.type === 'HISTORICAL') {
          return { id: w.id, reportId: null, inline: true, title: parsed.success ? parsed.data.name : 'Snapshot', reportType: (parsed.success ? parsed.data.type : null) as ReportType | null, x: w.x, y: w.y, w: w.w, h: w.h, order: w.order, report: null, result: null, missing: true, restricted: false };
        }
        const cfg = bodyToConfig(parsed.data);
        // source RBAC применяется И к inline-config (не только к saved report)
        const restricted = !(await sourceReadable(req, cfg.sourceType, cfg.sourceObjectId ?? null, cfg.sourceListId ?? null));
        // archived/missing source → computeReport вернёт null (catch) → honest placeholder, без утечки
        const result = !restricted ? await computeReport(orgId, cfg, false).catch(() => null) : null;
        return { id: w.id, reportId: null, inline: true, title: parsed.data.name, reportType: cfg.type, x: w.x, y: w.y, w: w.w, h: w.h, order: w.order, report: null, result, missing: false, restricted };
      }
      const report = await prisma.report.findFirst({ where: { id: w.reportId, orgId, archivedAt: null } });
      // RBAC: если member не READ-абелен на source-объект отчёта — НЕ считаем (не утекаем данные скрытого объекта).
      const restricted = report ? !(await sourceReadable(req, report.sourceType, report.sourceObjectId, report.sourceListId)) : false;
      // Report archived/removed → виджет показывает placeholder, НЕ падает (widget remove ≠ delete report и наоборот).
      const result = report && !restricted ? await computeReport(orgId, rowToConfig(report), false, report.id).catch(() => null) : null;
      // restricted → НЕ отдаём конфиг отчёта (filters/source/group): симметрично inline, чтобы скрытый источник не утекал даже метаданными. title/reportType достаточно для placeholder.
      return { id: w.id, reportId: w.reportId, inline: false, title: report?.name ?? null, reportType: report?.type ?? null, x: w.x, y: w.y, w: w.w, h: w.h, order: w.order, report: report && !restricted ? serializeReport(report) : null, result, missing: !report, restricted };
    }));
    res.json({ dashboard: { id: d.id, name: d.name, description: d.description }, widgets });
  } catch (err) { handleErr(err, res, next); }
});

router.patch('/dashboards/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = await assertDashboard(req, res, req.params.id, 'READ_WRITE');
    if (!d) return;
    const orgId = req.user!.orgId!;
    const body = dashboardBodySchema.parse(req.body);
    const upd = await prisma.dashboard.update({ where: { id: d.id }, data: { name: body.name, description: body.description ?? null } });
    await audit({ orgId, actorId: req.user!.userId, action: 'DASHBOARD_UPDATED', targetType: 'dashboard', targetId: d.id, summary: `name=${upd.name}` });
    res.json({ dashboard: { id: upd.id, name: upd.name, description: upd.description } });
  } catch (err) { handleErr(err, res, next); }
});

router.delete('/dashboards/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = await assertDashboard(req, res, req.params.id, 'FULL');
    if (!d) return;
    const orgId = req.user!.orgId!;
    await prisma.dashboard.update({ where: { id: d.id }, data: { archivedAt: new Date() } });
    await audit({ orgId, actorId: req.user!.userId, action: 'DASHBOARD_DELETED', targetType: 'dashboard', targetId: d.id, summary: 'archived' });
    res.json({ ok: true });
  } catch (err) { handleErr(err, res, next); }
});

// Положить виджет на дашборд. ДВА вида (ровно один в body):
//  • reportId (linked, live): RBAC dashboard READ_WRITE + report READ + source READ.
//  • inlineConfig (immutable снимок, DSH-2): валидируется ТЕМ ЖЕ reportBodySchema + computeReport(validateOnly);
//    RBAC dashboard READ_WRITE + source READ (на отчёт нет ссылки — нет report-READ).
router.post('/dashboards/:id/widgets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const d = await assertDashboard(req, res, req.params.id, 'READ_WRITE');
    if (!d) return;
    const orgId = req.user!.orgId!;
    const body = widgetBodySchema.parse(req.body);
    const clientRequestId = readClientReqId(req);

    // inlineConfig снимок (immutable) — хранится как валидированный body reportBodySchema
    let widgetReportId: string | null = null;
    let widgetInline: Prisma.InputJsonValue | undefined;
    let auditSrc: string;

    if (body.inlineConfig) {
      const cfg = bodyToConfig(body.inlineConfig);
      // HIGH-2: HISTORICAL копит снапшоты по reportId (ReportSnapshot). У inline-виджета reportId нет —
      // снимок был бы ВСЕГДА пустым (нарушение parity). Запрещаем на входе, без молчаливого пустого графика.
      if (cfg.type === ReportType.HISTORICAL) { res.status(400).json({ error: 'Historical reports track snapshots over time and need a saved report — add it as a Live widget instead.', code: 'WIDGET_INLINE_HISTORICAL_UNSUPPORTED' }); return; }
      // RBAC: source inline-конфига должен быть READ-абелен (иначе обход NONE через inline-виджет)
      if (!(await assertSourceReadable(req, res, cfg.sourceType, cfg.sourceObjectId ?? null, cfg.sourceListId ?? null))) return;
      // Валидация ТЕМ ЖЕ контрактом, что saved report (бросит ReportValidationError → 400)
      await computeReport(orgId, cfg, true);
      widgetInline = body.inlineConfig as unknown as Prisma.InputJsonValue;
      auditSrc = `inline:${configSummary(cfg)}`;
    } else {
      // linked: report READ + source READ (RBAC ДО dedup — replay после потери доступа → 403)
      if (!(await assertAccess(req, res, 'DASHBOARD', 'READ', body.reportId!))) return;
      const report = await prisma.report.findFirst({ where: { id: body.reportId!, orgId, archivedAt: null }, select: { id: true, sourceType: true, sourceObjectId: true, sourceListId: true } });
      if (!report) { res.status(404).json({ error: 'Report not found', code: 'WIDGET_REPORT_NOT_FOUND' }); return; }
      if (!(await assertSourceReadable(req, res, report.sourceType, report.sourceObjectId, report.sourceListId))) return;
      widgetReportId = report.id;
      auditSrc = `report=${report.id}`;
    }

    // DSH-1 idempotency: тот же clientRequestId в пределах дашборда → существующий виджет, без второго ряда/audit
    if (clientRequestId) {
      const existing = await prisma.dashboardWidget.findFirst({ where: { dashboardId: d.id, clientRequestId } });
      if (existing) { res.status(200).json({ widget: serializeWidget(existing), deduped: true }); return; }
    }

    const count = await prisma.dashboardWidget.count({ where: { dashboardId: d.id } });
    let w;
    try {
      w = await prisma.dashboardWidget.create({ data: { orgId, dashboardId: d.id, reportId: widgetReportId, inlineConfig: widgetInline, x: body.x, y: body.y, w: body.w, h: body.h, order: count, clientRequestId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && clientRequestId) {
        const existing = await prisma.dashboardWidget.findFirst({ where: { dashboardId: d.id, clientRequestId } });
        if (existing) { res.status(200).json({ widget: serializeWidget(existing), deduped: true }); return; }
      }
      throw e;
    }
    await audit({ orgId, actorId: req.user!.userId, action: 'DASHBOARD_WIDGET_ADDED', targetType: 'dashboard_widget', targetId: w.id, summary: `dashboard=${d.id} ${auditSrc}` });
    res.status(201).json({ widget: serializeWidget(w) });
  } catch (err) { handleErr(err, res, next); }
});

// Reorder/resize виджета. RBAC: dashboard READ_WRITE (управление раскладкой). Audit — diff раскладки/порядка.
router.patch('/dashboards/:id/widgets/:widgetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertDashboard(req, res, req.params.id, 'READ_WRITE'))) return;
    const orgId = req.user!.orgId!;
    const w = await prisma.dashboardWidget.findFirst({ where: { id: req.params.widgetId, orgId, dashboardId: req.params.id }, select: { id: true, x: true, y: true, w: true, h: true, order: true } });
    if (!w) { res.status(404).json({ error: 'Widget not found' }); return; }
    const body = widgetPatchSchema.parse(req.body);
    const upd = await prisma.dashboardWidget.update({ where: { id: w.id }, data: body });
    const before = w as unknown as Record<string, number>;
    const after = upd as unknown as Record<string, number>;
    const diff = (['x', 'y', 'w', 'h', 'order'] as const).filter((k) => body[k] !== undefined && before[k] !== after[k]).map((k) => `${k}:${before[k]}→${after[k]}`);
    await audit({ orgId, actorId: req.user!.userId, action: 'DASHBOARD_WIDGET_UPDATED', targetType: 'dashboard_widget', targetId: w.id, summary: `dashboard=${req.params.id} ${diff.join(' ') || 'no-op'}` });
    res.json({ widget: serializeWidget(upd) });
  } catch (err) { handleErr(err, res, next); }
});

// Убрать виджет с дашборда — НЕ удаляет Report (только DashboardWidget). RBAC: dashboard READ_WRITE.
router.delete('/dashboards/:id/widgets/:widgetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await assertDashboard(req, res, req.params.id, 'READ_WRITE'))) return;
    const orgId = req.user!.orgId!;
    const w = await prisma.dashboardWidget.findFirst({ where: { id: req.params.widgetId, orgId, dashboardId: req.params.id }, select: { id: true, reportId: true } });
    if (!w) { res.status(404).json({ error: 'Widget not found' }); return; }
    await prisma.dashboardWidget.delete({ where: { id: w.id } });
    await audit({ orgId, actorId: req.user!.userId, action: 'DASHBOARD_WIDGET_REMOVED', targetType: 'dashboard_widget', targetId: w.id, summary: `dashboard=${req.params.id} report=${w.reportId}` });
    res.json({ ok: true });
  } catch (err) { handleErr(err, res, next); }
});

// ── DSH-3: drill-in из ВИДЖЕТА — реальные записи выбранного bucket/segment ───────────────
// Переиспользует drillReport (ОДИН drill-движок, не дублируем). RBAC в ДВА слоя:
//   (1) доступ к dashboard (READ; чужой private → 404, недостаток → 403);
//   (2) доступ к source object/list виджета (READ) — revoke-after-create здесь даёт 403 без утечки записей.
// linked → из текущего Report (archived/missing → 404 placeholder, drill disabled);
// inline → из снимка (повреждён → 409). Пустой bucket → drillReport вернёт records:[] (честный empty, не fake rows).
router.get('/dashboards/:id/widgets/:widgetId/drill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const bucket = typeof req.query.bucket === 'string' ? req.query.bucket.slice(0, 512) : '';
    const segment = typeof req.query.segment === 'string' && req.query.segment ? req.query.segment.slice(0, 512) : null;
    if (!bucket) { res.status(400).json({ error: 'bucket is required', code: 'DRILL_BUCKET_REQUIRED' }); return; }
    // слой 1: доступ к дашборду
    if (!(await assertDashboard(req, res, req.params.id, 'READ'))) return;
    const w = await prisma.dashboardWidget.findFirst({ where: { id: req.params.widgetId, orgId, dashboardId: req.params.id }, select: { id: true, reportId: true, inlineConfig: true } });
    if (!w) { res.status(404).json({ error: 'Widget not found' }); return; }

    let cfg: ReportConfigInput;
    if (w.reportId == null) {
      // inline снимок: тот же контракт, что на записи; повреждённый снимок → drill недоступен (НЕ 500)
      const parsed = reportBodySchema.safeParse(w.inlineConfig);
      if (!parsed.success) { res.status(409).json({ error: 'This snapshot is unavailable', code: 'WIDGET_SNAPSHOT_BROKEN' }); return; }
      cfg = bodyToConfig(parsed.data);
    } else {
      const report = await prisma.report.findFirst({ where: { id: w.reportId, orgId, archivedAt: null } });
      if (!report) { res.status(404).json({ error: 'Report unavailable or archived', code: 'WIDGET_REPORT_UNAVAILABLE' }); return; }
      cfg = rowToConfig(report);
    }
    // слой 2: доступ к источнику (object/list). Потеря READ после создания виджета → 403, записи не отдаём.
    if (!(await assertSourceReadable(req, res, cfg.sourceType, cfg.sourceObjectId ?? null, cfg.sourceListId ?? null))) return;
    // drill осмыслен только для INSIGHT/FUNNEL (bucketKey = значение группы → реальные записи). Для
    // HISTORICAL/TIME_IN_STAGE/STAGE_CHANGE бакеты строятся иначе → total НЕ совпал бы с графиком: запрещаем серверно (не только в UI).
    if (cfg.type !== ReportType.INSIGHT && cfg.type !== ReportType.FUNNEL) { res.status(422).json({ error: 'Drill-in is only available for insight and funnel widgets', code: 'DRILL_TYPE_UNSUPPORTED' }); return; }
    const drill = await drillReport(orgId, cfg, bucket, segment);
    res.json(drill);
  } catch (err) { handleErr(err, res, next); }
});

export default router;
