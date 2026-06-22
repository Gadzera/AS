/**
 * Движок Workflow — правила автоматизации поверх sequence/CRM-движка.
 * ТРИГГЕР → УСЛОВИЕ → ДЕЙСТВИЯ (типизированный каталог: lead / record / list / logic / delay / assign).
 *
 * M17-1: каждый прогон — машинно-читаемый аудит (WorkflowRun.status + per-step WorkflowRunStep).
 *   • Универсальная идемпотентность РАНА: NON-NULL idempotencyKey + @@unique([workflowId, idempotencyKey]).
 *   • Ошибки шагов НЕ глотаются: упавший шаг → FAILED + error(raw) → run PARTIAL/FAILED.
 *   • Retry-safe re-exec: успешный побочный эффект НЕ повторяется (WorkflowActionIdempotency).
 *   • Stuck-RUNNING recovery свипером.
 * M17-2: 13 канонических триггеров + recursion-guard (sourceWorkflowRunId).
 * M17-3: типизированный каталог действий + реальные Data Hub операции + логика (FILTER/IF/SWITCH) +
 *   DELAY/DELAY_UNTIL через scheduler (WAITING + resumeAt, НЕ setTimeout) + ROUND_ROBIN. Подробности —
 *   в services/workflowActions.ts (zod-валидация config, executors, condition-eval).
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { notify } from './notifications';
import {
  ACTION_CATALOG, ACTION_KEYS, parseActionSpec, validateActionConfig, validateActionList, isMutatingAction, checkSpan,
  evalConditions, loadSubjectFacts, computeResumeAt,
  execCreateRecord, execUpdateRecord, execArchiveRecord, execAddToList, execRemoveFromList, execUpdateListEntry, execRoundRobin, execFindRecords,
  // M17-4: AI / HTTP / transform / интеграции + template-резолвер
  resolveTemplates, runTransform, runAiBlock, runHttpRequest, runSequenceBlock, runSendNotification,
  type ActionResult, type ActionCtx, type Condition, type ResolveCtx,
} from './workflowActions';
import { loadSecretMap } from './workflowSecrets';
import { automationAccess, meets } from './permissions';

const prisma = new PrismaClient();

type Tx = Prisma.TransactionClient;

export type WorkflowTrigger =
  | 'REPLY_RECEIVED' | 'MEETING_BOOKED' | 'SEQUENCE_COMPLETED' | 'LEAD_UNSUBSCRIBED' | 'OPENED' | 'BOUNCED'
  // M17-2 канонические CRM-триггеры
  | 'RECORD_COMMAND' | 'RECORD_CREATED' | 'RECORD_UPDATED' | 'ATTRIBUTE_UPDATED'
  | 'LIST_ENTRY_COMMAND' | 'RECORD_ADDED_TO_LIST' | 'LIST_ENTRY_UPDATED' | 'TASK_CREATED'
  | 'MANUAL_RUN' | 'RECURRING_SCHEDULE' | 'WEBHOOK_RECEIVED' | 'TYPEFORM_SUBMISSION' | 'OUTREACH_EVENT';

export const MAX_RUN_ATTEMPTS = 3; // retry-лимит для прогона
export const STUCK_RUN_TIMEOUT_MS = 5 * 60_000; // RUNNING дольше этого после claimedAt → реклейм

// M17-3: каталог действий (label/description/kind/params) живёт в workflowActions; здесь — back-compat реэкспорт.
export const ACTIONS = ACTION_CATALOG;
export { ACTION_KEYS };

// M17-2: delivery=true — реально провязанный fire-site; delivery=false — contract+synthetic harness (нет prod-инфры).
export const TRIGGERS: Record<WorkflowTrigger, { label: string; description: string; supportsClass: boolean; delivery: boolean }> = {
  REPLY_RECEIVED: { label: 'Reply received', description: 'A prospect replied and the agent classified it.', supportsClass: true, delivery: true },
  MEETING_BOOKED: { label: 'Meeting booked', description: 'A meeting was scheduled with the lead.', supportsClass: false, delivery: true },
  SEQUENCE_COMPLETED: { label: 'Sequence completed', description: 'The lead finished all sequence steps with no reply.', supportsClass: false, delivery: true },
  LEAD_UNSUBSCRIBED: { label: 'Lead unsubscribed', description: 'The lead opted out.', supportsClass: false, delivery: true },
  OPENED: { label: 'Email opened', description: 'The prospect opened a tracked email (attributed to its campaign).', supportsClass: false, delivery: true },
  BOUNCED: { label: 'Email bounced', description: 'A sent email bounced (attributed to that send’s campaign).', supportsClass: false, delivery: true },
  RECORD_CREATED: { label: 'Record created', description: 'A record was created in an object.', supportsClass: false, delivery: true },
  RECORD_UPDATED: { label: 'Record updated', description: 'A record changed (at least one attribute).', supportsClass: false, delivery: true },
  ATTRIBUTE_UPDATED: { label: 'Attribute updated', description: 'A specific attribute value actually changed (not a no-op write).', supportsClass: false, delivery: true },
  RECORD_COMMAND: { label: 'Record command', description: 'Run this workflow on demand from a record.', supportsClass: false, delivery: true },
  MANUAL_RUN: { label: 'Manual run', description: 'Run this workflow manually.', supportsClass: false, delivery: true },
  RECORD_ADDED_TO_LIST: { label: 'Record added to list', description: 'A record was added to a list.', supportsClass: false, delivery: true },
  LIST_ENTRY_COMMAND: { label: 'List entry command', description: 'Run on demand from a list entry.', supportsClass: false, delivery: true },
  LIST_ENTRY_UPDATED: { label: 'List entry updated', description: 'A list entry (stage) changed. Contract only — no stage-write service yet.', supportsClass: false, delivery: false },
  TASK_CREATED: { label: 'Task created', description: 'A task was created. Contract only — tasks are not yet persisted.', supportsClass: false, delivery: false },
  RECURRING_SCHEDULE: { label: 'Recurring schedule', description: 'On a schedule. Contract only — scheduler not yet wired.', supportsClass: false, delivery: false },
  WEBHOOK_RECEIVED: { label: 'Webhook received', description: 'An incoming webhook. Contract only — no public endpoint yet.', supportsClass: false, delivery: false },
  TYPEFORM_SUBMISSION: { label: 'Typeform submission', description: 'A Typeform response. Contract only — integration not yet wired.', supportsClass: false, delivery: false },
  OUTREACH_EVENT: { label: 'Outreach event', description: 'An Outreach integration event. Contract only — integration not yet wired.', supportsClass: false, delivery: false },
};

export interface RunCtx {
  orgId: string;
  trigger: WorkflowTrigger;
  leadId?: string;
  recordId?: string | null; // M17-2: subject-запись (record/list-триггеры)
  objectId?: string | null; // M17-2: объект записи
  campaignId?: string | null; // M11-1: кампания события (scope стопов)
  replyClass?: string | null;
  eventId?: string | null; // M13-4: id MessageEvent-источника (вторичный guard)
  attributionMode?: string | null; // M13-4: способ атрибуции
  idempotencyKey?: string | null; // M17-1: детерминированный ключ дедупа (если не задан — выводим)
  sourceWorkflowRunId?: string | null; // M17-2: guard самозапуска (событие, созданное внутри прогона)
  batchId?: string | null; // M17-2: id пачки bulk manual-run
  onlyWorkflowId?: string | null; // M17-1: ограничить прогон ОДНИМ правилом (rerun/manual-run)
}

// ─── Lead-действия (legacy, M17-1): реальные мутации лида/enrollment ───────────
// M11-1: стопы scope'ятся к кампании события; SUPPRESS_CONTACT — глобально. Исполняются в транзакции движка.
async function applyLeadAction(client: Tx, action: string, ctx: RunCtx): Promise<ActionResult> {
  const { orgId, leadId, campaignId, trigger } = ctx;
  if (!leadId) return { summary: `${action} (no lead in context)`, output: { skipped: 'no_lead' } };
  const clScope = campaignId ? { leadId, campaignId } : null;

  switch (action) {
    case 'SET_LEAD_HOT': {
      const r = await client.lead.updateMany({ where: { id: leadId, orgId }, data: { status: 'HOT' } });
      return { summary: 'lead → HOT', output: { leadId, status: 'HOT', affected: r.count } };
    }
    case 'MOVE_TO_REPLIED': {
      const r = await client.lead.updateMany({ where: { id: leadId, orgId }, data: { status: 'REPLIED' } });
      let clCount = 0;
      if (clScope) clCount = (await client.campaignLead.updateMany({ where: clScope, data: { status: 'REPLIED' } })).count;
      return { summary: clScope ? 'lead → REPLIED, this enrollment → REPLIED' : 'lead → REPLIED', output: { leadId, leadAffected: r.count, enrollmentAffected: clCount } };
    }
    case 'PAUSE_SEQUENCE': {
      if (!clScope) return { summary: 'sequence pause skipped (no campaign context — avoided cross-campaign stop)', output: { skipped: 'no_campaign' } };
      if (trigger === 'REPLY_RECEIVED') {
        const r = await client.campaignLead.updateMany({ where: clScope, data: { status: 'REPLIED' } });
        return { summary: 'enrollment → REPLIED (this campaign, auto-steps halted)', output: { enrollmentAffected: r.count, mode: 'replied' } };
      }
      const r = await client.campaignLead.updateMany({ where: clScope, data: { status: 'PAUSED', pausedAt: new Date() } });
      return { summary: 'sequence paused (this campaign)', output: { enrollmentAffected: r.count, mode: 'paused' } };
    }
    case 'MARK_CONVERTED': {
      const r = await client.lead.updateMany({ where: { id: leadId, orgId }, data: { status: 'CONVERTED' } });
      let clCount = 0;
      if (clScope) clCount = (await client.campaignLead.updateMany({ where: clScope, data: { status: 'STOPPED', stopReason: 'CONVERTED', nextSendAt: null } })).count;
      return { summary: clScope ? 'lead → CONVERTED, this campaign stopped' : 'lead → CONVERTED (no campaign context for sequence stop)', output: { leadId, leadAffected: r.count, enrollmentAffected: clCount } };
    }
    case 'SUPPRESS_CONTACT': {
      const r = await client.lead.updateMany({ where: { id: leadId, orgId }, data: { status: 'UNSUBSCRIBED' } });
      const cl = await client.campaignLead.updateMany({ where: { leadId }, data: { status: 'STOPPED', stopReason: 'UNSUBSCRIBED', nextSendAt: null } });
      return { summary: 'lead suppressed globally, all sequences stopped', output: { leadId, leadAffected: r.count, enrollmentAffected: cl.count } };
    }
    default:
      throw new Error(`Unknown lead action: ${action}`);
  }
}

// Диспетчер mutating-действий внутри транзакции движка (lead/record/list/assign).
// M21-2 (S352): мутирующее record/list-действие требует automation-грант воркфлоу на цель (default NONE).
// Нет гранта → step FAILED PERMISSION_DENIED (не молча, не выполняем эффект). Lead-действия не гейтим.
const RECORD_MUT = new Set(['CREATE_RECORD', 'UPDATE_RECORD', 'ARCHIVE_RECORD', 'ROUND_ROBIN']);
const LIST_MUT = new Set(['ADD_TO_LIST', 'REMOVE_FROM_LIST', 'UPDATE_LIST_ENTRY']);
export async function assertAutomationAccess(orgId: string, workflowId: string | null | undefined, type: string, actionCtx: ActionCtx, cfg: Record<string, unknown>): Promise<void> {
  if (!workflowId) return; // нет id воркфлоу (dry-run/test) — пропускаем
  let kind: 'OBJECT' | 'LIST';
  let entityId: string | null = null;
  if (RECORD_MUT.has(type)) {
    kind = 'OBJECT';
    if (type === 'CREATE_RECORD' && cfg.objectKey) { const o = await prisma.object.findFirst({ where: { orgId, key: String(cfg.objectKey), archivedAt: null }, select: { id: true } }); entityId = o?.id ?? null; }
    else {
      // адверс-ревью #2: берём objectId РЕАЛЬНО мутируемой записи (config.recordId перекрывает субъект),
      // иначе per-entity automation-грант обходится подменой recordId на запись другого объекта.
      const targetRecordId = (typeof cfg.recordId === 'string' ? cfg.recordId : null) ?? actionCtx.recordId ?? null;
      if (targetRecordId) { const r = await prisma.record.findFirst({ where: { id: targetRecordId, orgId }, select: { objectId: true } }); entityId = r?.objectId ?? actionCtx.objectId ?? null; }
      else entityId = actionCtx.objectId ?? null;
    }
  } else if (LIST_MUT.has(type)) { kind = 'LIST'; entityId = cfg.listId ? String(cfg.listId) : null; }
  else return; // не record/list — не гейтим
  const have = await automationAccess(orgId, workflowId, kind, entityId);
  if (!meets(have, 'READ_WRITE')) throw new Error(`PERMISSION_DENIED: workflow has no ${kind} automation grant (have ${have}). Grant it in Settings → Permissions → Automations.`);
}

async function runMutatingExecutor(tx: Tx, type: string, ctx: RunCtx, actionCtx: ActionCtx, cfg: Record<string, unknown>): Promise<ActionResult> {
  switch (type) {
    case 'SET_LEAD_HOT': case 'MOVE_TO_REPLIED': case 'PAUSE_SEQUENCE': case 'MARK_CONVERTED': case 'SUPPRESS_CONTACT':
      return applyLeadAction(tx, type, ctx);
    case 'CREATE_RECORD': return execCreateRecord(tx, ctx.orgId, cfg);
    case 'UPDATE_RECORD': return execUpdateRecord(tx, ctx.orgId, actionCtx, cfg);
    case 'ARCHIVE_RECORD': return execArchiveRecord(tx, ctx.orgId, actionCtx, cfg);
    case 'ADD_TO_LIST': return execAddToList(tx, ctx.orgId, actionCtx, cfg);
    case 'REMOVE_FROM_LIST': return execRemoveFromList(tx, ctx.orgId, actionCtx, cfg);
    case 'UPDATE_LIST_ENTRY': return execUpdateListEntry(tx, ctx.orgId, actionCtx, cfg);
    case 'ROUND_ROBIN': return execRoundRobin(tx, ctx.orgId, actionCtx, cfg);
    default: throw new Error(`Unknown mutating action: ${type}`);
  }
}

// Применить mutating-шаг ТРАНЗАКЦИОННО-идемпотентно (GPT M17-3): claim WorkflowActionIdempotency + мутация
// в ОДНОЙ транзакции. Падение мутации до commit → tx rollback → claim не остаётся «applied» → retry повторит.
// Дубль ключа (retry/concurrency) → idempotent-skip (эффект не повторяется).
async function applyMutatingIdempotent(type: string, order: number, runId: string, ctx: RunCtx, actionCtx: ActionCtx, cfg: Record<string, unknown>): Promise<ActionResult> {
  // M21-2 (S352): automation-грант проверяем ДО claim/tx (использует prisma, не tx) — denied не «застолбит» idempotency-ключ.
  await assertAutomationAccess(ctx.orgId, actionCtx.workflowId, type, actionCtx, cfg);
  const key = `act:${runId}:${order}`;
  const existing = await prisma.workflowActionIdempotency.findUnique({ where: { orgId_key: { orgId: ctx.orgId, key } }, select: { id: true } });
  if (existing) return { summary: 'already applied (idempotent skip)', output: { idempotentSkip: true } };
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.workflowActionIdempotency.create({ data: { orgId: ctx.orgId, key, runId } });
      return await runMutatingExecutor(tx, type, ctx, actionCtx, cfg);
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      // Инвариант: claim и мутация — в ОДНОЙ tx, поэтому закоммиченный claim ⟺ эффект применён (атомарно).
      // Если claim существует ПОСЛЕ нашего P2002 — его закоммитил конкурентный прогон того же (runId,order),
      // т.е. та же логическая операция уже выполнена ⇒ idempotent-skip корректен. P2002 самой мутации без
      // claim'а → tx откатилась, claim отсутствует → пробрасываем (шаг FAILED, retry повторит).
      const claimed = await prisma.workflowActionIdempotency.findUnique({ where: { orgId_key: { orgId: ctx.orgId, key } }, select: { id: true } });
      if (claimed) return { summary: 'already applied (idempotent skip)', output: { idempotentSkip: true } };
    }
    throw e;
  }
}

// Сухой прогон (dry-run) для кнопки Test: что БЫ сделало действие, без мутаций.
function simulateAction(raw: string): string {
  const { type } = parseActionSpec(raw);
  return ACTION_CATALOG[type]?.label ?? `${type} (unknown)`;
}

// ─── M17-1 идемпотентность РАНА ───────────────────────────────────────────────

// Детерминированный ключ дедупа РАНА (one trigger occurrence ⇒ ≤1 run per workflow).
function deriveRunKey(ctx: RunCtx): string {
  if (ctx.idempotencyKey) return ctx.idempotencyKey;
  if (ctx.eventId) return `evt:${ctx.eventId}`;
  return `${ctx.trigger.toLowerCase()}:${ctx.leadId ?? 'nolead'}:${ctx.campaignId ?? 'nocamp'}:${ctx.batchId ?? 'single'}`;
}

// ─── M17-3 control-flow helpers ───────────────────────────────────────────────

function rangeInclusive(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// ─── M17-1/M17-3 исполнение прогона ──────────────────────────────────────────

interface RunResult { workflowId: string; runId: string; status: string; deduped: boolean }

/**
 * Исполнить/возобновить шаги прогона ПО ПОРЯДКУ. Поддерживает:
 *  • уже SUCCEEDED/SKIPPED шаг — пропускает (retry/resume-safe; IF/SWITCH восстанавливают skip-решения из output);
 *  • FILTER — короткозамыкает прогон (остальные шаги SKIPPED), run остаётся SUCCEEDED;
 *  • IF/SWITCH — гейтят следующие span шагов (не выбранные → SKIPPED, причина в output);
 *  • DELAY/DELAY_UNTIL — ставит run в WAITING + resumeAt и ПРИОСТАНАВЛИВАЕТ (scheduler возобновит);
 *  • mutating-действия — транзакционно-идемпотентны (эффект не повторяется на retry).
 * Финал: SUCCEEDED / PARTIAL / FAILED / WAITING (пауза).
 */
async function executeRun(
  run: { id: string; orgId: string; leadId: string | null; trigger: string },
  wf: { id: string; name: string; actions: string[] },
  ctx: RunCtx,
  opts?: { resume?: boolean },
): Promise<string> {
  const startedAt = new Date();
  await prisma.workflowRun.update({
    where: { id: run.id },
    // resume (после DELAY) — НЕ инкрементим attemptCount (это не retry, а нормальное продолжение).
    data: { status: 'RUNNING', startedAt, claimedAt: startedAt, ...(opts?.resume ? {} : { attemptCount: { increment: 1 } }) },
  });

  const specs = wf.actions.map(parseActionSpec);
  const n = specs.length;

  const existingSteps = await prisma.workflowRunStep.findMany({ where: { runId: run.id }, select: { order: true, status: true, resultSummary: true, output: true } });
  const doneByOrder = new Map(existingSteps.map((s) => [s.order, s]));

  // Рантайм-субъект: FIND_RECORDS с assignFirstToSubject может переназначить запись для следующих шагов.
  const rctx: ActionCtx = { orgId: run.orgId, recordId: ctx.recordId ?? null, objectId: ctx.objectId ?? null, leadId: ctx.leadId ?? null, workflowId: wf.id };

  // M17-4: workflow-context (выходы шагов steps.N + переменные var.x от TRANSFORM) + секреты для резолвера.
  const wfVars: { steps: Record<number, unknown>; vars: Record<string, unknown> } = { steps: {}, vars: {} };
  const secretMap = await loadSecretMap(run.orgId);
  const resolveCtx = (): ResolveCtx => ({ steps: wfVars.steps, vars: wfVars.vars, secrets: secretMap });

  const skipSet = new Set<number>(); // orders, пропускаемые из-за не выбранной ветки IF/SWITCH
  const parts: string[] = [];
  let anyFailed = false;
  let anyOk = false;
  let filtered = false;

  for (let order = 0; order < n; order++) {
    const { type, config } = specs[order];
    const prev = doneByOrder.get(order);
    const stepStart = new Date();

    // Resume/retry: уже терминальный шаг — переиспользуем. Контрол/субъект-эффекты восстанавливаем из output.
    if (prev && (prev.status === 'SUCCEEDED' || prev.status === 'SKIPPED')) {
      if (prev.status === 'SUCCEEDED' && (type === 'IF' || type === 'SWITCH')) {
        const skipped = (prev.output as { skippedSteps?: number[] } | null)?.skippedSteps;
        if (Array.isArray(skipped)) for (const o2 of skipped) skipSet.add(o2);
      }
      // M17-3 resume-fix: FIND_RECORDS(assignFirstToSubject) переназначал субъект — на resume восстановить его,
      // иначе последующие mutating-шаги после DELAY ушли бы на исходную (неверную) запись.
      if (prev.status === 'SUCCEEDED' && type === 'FIND_RECORDS') {
        const out = prev.output as { firstRecordId?: string | null; assignedFirstToSubject?: boolean } | null;
        if (out?.assignedFirstToSubject && out.firstRecordId) rctx.recordId = out.firstRecordId;
      }
      // M17-4: на resume восстановить workflow-context из сохранённых выходов (для chaining {{steps.N}}/{{var.x}}).
      if (prev.status === 'SUCCEEDED') {
        wfVars.steps[order] = prev.output ?? null;
        if (type === 'TRANSFORM') { const ex = (prev.output as { extracted?: Record<string, unknown> } | null)?.extracted; if (ex) Object.assign(wfVars.vars, ex); }
      }
      parts.push(prev.resultSummary ?? `${type} (already done)`);
      if (prev.status === 'SUCCEEDED') anyOk = true;
      continue;
    }

    // Шаг в не выбранной ветке.
    if (skipSet.has(order)) {
      await upsertStep(run, order, type, { status: 'SKIPPED', resultSummary: 'branch not taken', output: { skippedReason: 'branch not taken' }, input: { type, config }, startedAt: stepStart });
      parts.push(`${type} (skipped)`);
      continue;
    }

    // M17-4: резолв шаблонов {{steps.N}}/{{var.x}}/{{secret.NAME}} ДО валидации (fail-safe). sanitized → в логи
    // (секреты замаскированы ****), resolved → в исполнение. Не найден токен → step FAILED (не silent).
    const res = resolveTemplates(config, resolveCtx());
    const input = { type, config: res.sanitized, subjectRecordId: rctx.recordId ?? undefined };
    if (res.missing.length) {
      await upsertStep(run, order, type, { status: 'FAILED', error: `template variable not found: ${res.missing.join(', ')}`, resultSummary: 'template variable not found', input, startedAt: stepStart });
      parts.push(`${type} (unresolved)`);
      anyFailed = true;
      continue;
    }
    // Валидация типа+config: невалид → шаг FAILED, прогон продолжается.
    const v = validateActionConfig(type, res.resolved as Record<string, unknown>);
    if (!v.ok) {
      await upsertStep(run, order, type, { status: 'FAILED', error: v.error, resultSummary: 'invalid action (skipped)', input, startedAt: stepStart });
      parts.push(`${type} (invalid)`);
      anyFailed = true;
      continue;
    }
    const cfg = v.config;

    // ── FILTER: hard-gate (не совпало → короткое замыкание прогона) ──
    if (type === 'FILTER') {
      const facts = (await loadSubjectFacts(rctx)) ?? {};
      const ev = evalConditions(facts, cfg.conditions as Condition[], (cfg.match as 'all' | 'any') ?? 'all');
      if (ev.matched) {
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'filter passed', output: { matched: true, reason: ev.reason, skippedSteps: [] }, input, startedAt: stepStart });
        parts.push('filter passed');
        anyOk = true;
      } else {
        const skipped = order + 1 <= n - 1 ? rangeInclusive(order + 1, n - 1) : [];
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'did not match — stopped', output: { matched: false, reason: ev.reason, skippedSteps: skipped }, input, startedAt: stepStart });
        parts.push('filtered out');
        anyOk = true;
        filtered = true;
        for (const o2 of skipped) {
          await upsertStep(run, o2, specs[o2].type, { status: 'SKIPPED', resultSummary: 'after filter (run stopped)', output: { skippedReason: 'after filter' }, input: { type: specs[o2].type }, startedAt: new Date() });
        }
        break;
      }
      continue;
    }

    // ── IF: гейт следующих span шагов (по умолчанию 1) ──
    if (type === 'IF') {
      const span = (cfg.span as number | undefined) ?? 1;
      const bound = checkSpan(order, span, n, specs);
      if (!bound.ok) { await upsertStep(run, order, type, { status: 'FAILED', error: bound.error, resultSummary: 'invalid branch', input, startedAt: stepStart }); parts.push('if (invalid)'); anyFailed = true; continue; }
      const facts = (await loadSubjectFacts(rctx)) ?? {};
      const ev = evalConditions(facts, cfg.conditions as Condition[], (cfg.match as 'all' | 'any') ?? 'all');
      const governed = rangeInclusive(order + 1, order + span);
      const skipped: number[] = [];
      if (!ev.matched) for (const o2 of governed) { skipSet.add(o2); skipped.push(o2); }
      await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: ev.matched ? `matched → run next ${span}` : `not matched → skip next ${span}`, output: { matched: ev.matched, reason: ev.reason, skippedSteps: skipped }, input, startedAt: stepStart });
      parts.push(`if ${ev.matched ? '✓' : '✗'}`);
      anyOk = true;
      continue;
    }

    // ── SWITCH: маршрутизация по значению поля к одному case-span ──
    if (type === 'SWITCH') {
      const cases = cfg.cases as { value: string; label?: string; span: number }[];
      const defaultSpan = (cfg.defaultSpan as number | undefined) ?? 0;
      const totalSpan = cases.reduce((s, c) => s + c.span, 0) + defaultSpan;
      const bound = checkSpan(order, totalSpan, n, specs);
      if (!bound.ok) { await upsertStep(run, order, type, { status: 'FAILED', error: bound.error, resultSummary: 'invalid switch', input, startedAt: stepStart }); parts.push('switch (invalid)'); anyFailed = true; continue; }
      const facts = (await loadSubjectFacts(rctx)) ?? {};
      const fieldVal = facts[cfg.field as string];
      const blocks: { label: string; start: number; span: number }[] = [];
      let cursor = order + 1;
      for (const c of cases) { blocks.push({ label: c.label ?? c.value, start: cursor, span: c.span }); cursor += c.span; }
      if (defaultSpan > 0) { blocks.push({ label: 'default', start: cursor, span: defaultSpan }); cursor += defaultSpan; }
      const matchIdx = cases.findIndex((c) => String(fieldVal ?? '') === String(c.value));
      const chosenIdx = matchIdx >= 0 ? matchIdx : (defaultSpan > 0 ? blocks.length - 1 : -1);
      const skipped: number[] = [];
      blocks.forEach((b, i) => { if (i !== chosenIdx) for (let o2 = b.start; o2 < b.start + b.span; o2++) { skipSet.add(o2); skipped.push(o2); } });
      const chosenLabel = chosenIdx >= 0 ? blocks[chosenIdx].label : 'none';
      await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: `switch ${cfg.field}=${JSON.stringify(fieldVal ?? null)} → ${chosenLabel}`, output: { matched: matchIdx >= 0, value: fieldVal ?? null, chosen: chosenLabel, skippedSteps: skipped }, input, startedAt: stepStart });
      parts.push(`switch → ${chosenLabel}`);
      anyOk = true;
      continue;
    }

    // ── DELAY / DELAY_UNTIL: пауза до resumeAt (scheduler возобновит) ──
    if (type === 'DELAY' || type === 'DELAY_UNTIL') {
      const prevOut = prev?.output as { resumeAt?: string } | null;
      if (prev?.status === 'WAITING' && prevOut?.resumeAt) {
        // Возобновление: НЕ пересчитываем resumeAt (GPT-правка) — используем сохранённый.
        const resumeAt = new Date(prevOut.resumeAt);
        if (resumeAt.getTime() <= Date.now()) {
          await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: `waited until ${resumeAt.toISOString()}`, output: { resumeAt: prevOut.resumeAt, resumed: true }, input, startedAt: stepStart });
          parts.push('delay elapsed');
          anyOk = true;
          continue;
        }
        await prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'WAITING', resumeAt, completedAt: null } });
        return 'WAITING';
      }
      const resumeAt = computeResumeAt(type, cfg, new Date());
      await upsertStep(run, order, type, { status: 'WAITING', resultSummary: `waiting until ${resumeAt.toISOString()}`, output: { resumeAt: resumeAt.toISOString() }, input, startedAt: stepStart });
      await prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'WAITING', resumeAt, claimedAt: null } });
      return 'WAITING';
    }

    // ── NOTIFY_HUMAN: handoff-нотификация (идемпотентна по dedupeKey), без WorkflowActionIdempotency ──
    if (type === 'NOTIFY_HUMAN') {
      try {
        if (ctx.leadId || rctx.recordId) {
          const lead = ctx.leadId ? await prisma.lead.findFirst({ where: { id: ctx.leadId, orgId: ctx.orgId }, select: { firstName: true, lastName: true, company: true } }) : null;
          const who = lead ? `${lead.firstName} ${lead.lastName}${lead.company ? ` · ${lead.company}` : ''}` : rctx.recordId ? 'a record' : 'a prospect';
          await notify({
            orgId: ctx.orgId, source: 'WORKFLOW', title: `${wf.name}: action needed`,
            body: `${who} — ${TRIGGERS[ctx.trigger].label.toLowerCase()}${ctx.replyClass ? ` (${ctx.replyClass.toLowerCase()})` : ''}.`,
            leadId: ctx.leadId ?? undefined, entityType: ctx.leadId ? 'lead' : 'record', entityId: ctx.leadId ?? rctx.recordId ?? undefined,
            dedupeKey: ctx.eventId ? `wf:${wf.id}:event:${ctx.eventId}` : `wf:${wf.id}:${ctx.leadId ?? rctx.recordId}:${ctx.trigger}`,
          });
        }
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'human notified (handoff)', output: { handoff: true }, input, startedAt: stepStart });
        parts.push('human notified (handoff)');
        anyOk = true;
      } catch (e) {
        await upsertStep(run, order, type, { status: 'FAILED', error: e instanceof Error ? e.message : String(e), resultSummary: 'notify failed', input, startedAt: stepStart });
        parts.push('notify failed');
        anyFailed = true;
      }
      continue;
    }

    // ── M17-4 TRANSFORM: извлечь поля из workflow-context в ctx.vars (для chaining) ──
    if (type === 'TRANSFORM') {
      const t = runTransform(cfg, resolveCtx());
      if (t.missing.length) {
        await upsertStep(run, order, type, { status: 'FAILED', error: `missing required path(s): ${t.missing.join(', ')}`, resultSummary: 'transform: missing path', output: t.result.output as Prisma.InputJsonValue, input, startedAt: stepStart });
        parts.push('transform (missing)'); anyFailed = true;
      } else {
        Object.assign(wfVars.vars, t.extracted);
        wfVars.steps[order] = t.result.output;
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: t.result.summary, output: t.result.output as Prisma.InputJsonValue, input, startedAt: stepStart });
        parts.push(t.result.summary); anyOk = true;
      }
      continue;
    }

    // ── M17-4 AI-блоки (M16 credit-guard ДО LLM; idempotent debit; опц. запись в атрибут) ──
    if (type === 'AI_CLASSIFY' || type === 'AI_SUMMARIZE' || type === 'AI_PROMPT' || type === 'AI_RESEARCH') {
      const key = `act:${run.id}:${order}`;
      const existing = await prisma.workflowActionIdempotency.findUnique({ where: { orgId_key: { orgId: run.orgId, key } }, select: { id: true } });
      if (existing) {
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'already applied (idempotent skip)', output: { idempotent: true }, input, startedAt: stepStart });
        wfVars.steps[order] = prev?.output ?? { idempotent: true }; parts.push(`${type} (idempotent)`); anyOk = true; continue; // chaining: реальный прошлый output
      }
      try {
        const r = await runAiBlock(run.orgId, rctx, type, cfg, run.id, order);
        wfVars.steps[order] = r.output;
        if (r.writeFailed) {
          // LLM ок, запись в атрибут упала → честный FAILED (claim НЕ создаём; retry повторит запись, debit идемпотентен — без двойного списания)
          await upsertStep(run, order, type, { status: 'FAILED', error: 'AI result produced but target attribute write failed', resultSummary: 'attribute write failed', output: r.output as Prisma.InputJsonValue, input, startedAt: stepStart });
          parts.push(`${type} (write failed)`); anyFailed = true;
        } else {
          await prisma.workflowActionIdempotency.create({ data: { orgId: run.orgId, key, runId: run.id } }).catch((e) => { if ((e as { code?: string }).code !== 'P2002') throw e; });
          await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: r.summary, output: r.output as Prisma.InputJsonValue, idempotencyKey: key, input, startedAt: stepStart });
          parts.push(r.summary); anyOk = true;
        }
      } catch (e) {
        await upsertStep(run, order, type, { status: 'FAILED', error: e instanceof Error ? e.message : String(e), resultSummary: `${type} failed`, input, startedAt: stepStart });
        parts.push(`${type} failed`); anyFailed = true;
      }
      continue;
    }

    // ── M17-4 HTTP_REQUEST (SSRF-guard, timeout, retry; unsafe-методы — claim-before-act против двойной отправки) ──
    if (type === 'HTTP_REQUEST') {
      const method = String(cfg.method ?? 'GET').toUpperCase();
      const unsafe = method !== 'GET' && method !== 'HEAD';
      const key = `act:${run.id}:${order}`;
      if (unsafe) {
        const existing = await prisma.workflowActionIdempotency.findUnique({ where: { orgId_key: { orgId: run.orgId, key } }, select: { id: true } });
        if (existing) { await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'already sent (idempotent skip)', output: { idempotent: true }, input, startedAt: stepStart }); wfVars.steps[order] = prev?.output ?? { idempotent: true }; parts.push('http (idempotent)'); anyOk = true; continue; }
        await prisma.workflowActionIdempotency.create({ data: { orgId: run.orgId, key, runId: run.id } }).catch((e) => { if ((e as { code?: string }).code !== 'P2002') throw e; });
      }
      try {
        const r = await runHttpRequest(cfg);
        wfVars.steps[order] = r.output;
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: r.summary, output: r.output as Prisma.InputJsonValue, idempotencyKey: unsafe ? key : undefined, input, startedAt: stepStart });
        parts.push(r.summary); anyOk = true;
      } catch (e) {
        await upsertStep(run, order, type, { status: 'FAILED', error: e instanceof Error ? e.message : String(e), resultSummary: 'http request failed', input, startedAt: stepStart });
        parts.push('http failed'); anyFailed = true;
      }
      continue;
    }

    // ── M17-4 SEQUENCE (enroll/unenroll через shared M11-сервис; idempotent) ──
    if (type === 'ENROLL_SEQUENCE' || type === 'UNENROLL_SEQUENCE') {
      const key = `act:${run.id}:${order}`;
      const existing = await prisma.workflowActionIdempotency.findUnique({ where: { orgId_key: { orgId: run.orgId, key } }, select: { id: true } });
      if (existing) { await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'already applied (idempotent skip)', output: { idempotent: true }, input, startedAt: stepStart }); parts.push(`${type} (idempotent)`); anyOk = true; continue; }
      try {
        const r = await runSequenceBlock(run.orgId, rctx, type, cfg);
        await prisma.workflowActionIdempotency.create({ data: { orgId: run.orgId, key, runId: run.id } }).catch((e) => { if ((e as { code?: string }).code !== 'P2002') throw e; });
        wfVars.steps[order] = r.output;
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: r.summary, output: r.output as Prisma.InputJsonValue, idempotencyKey: key, input, startedAt: stepStart });
        parts.push(r.summary); anyOk = true;
      } catch (e) {
        await upsertStep(run, order, type, { status: 'FAILED', error: e instanceof Error ? e.message : String(e), resultSummary: `${type} failed`, input, startedAt: stepStart });
        parts.push(`${type} failed`); anyFailed = true;
      }
      continue;
    }

    // ── M17-4 SEND_NOTIFICATION (claim-before-act + dedupeKey — даже конкурентный resume не дублирует) ──
    if (type === 'SEND_NOTIFICATION') {
      const key = `act:${run.id}:${order}`;
      const existing = await prisma.workflowActionIdempotency.findUnique({ where: { orgId_key: { orgId: run.orgId, key } }, select: { id: true } });
      if (existing) { await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: 'already sent (idempotent skip)', output: { idempotent: true }, input, startedAt: stepStart }); wfVars.steps[order] = prev?.output ?? { idempotent: true }; parts.push('notification (idempotent)'); anyOk = true; continue; }
      try {
        const r = await runSendNotification(run.orgId, rctx, cfg, `wf-notify:${run.id}:${order}`);
        await prisma.workflowActionIdempotency.create({ data: { orgId: run.orgId, key, runId: run.id } }).catch((e) => { if ((e as { code?: string }).code !== 'P2002') throw e; });
        wfVars.steps[order] = r.output;
        await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: r.summary, output: r.output as Prisma.InputJsonValue, idempotencyKey: key, input, startedAt: stepStart });
        parts.push(r.summary); anyOk = true;
      } catch (e) {
        await upsertStep(run, order, type, { status: 'FAILED', error: e instanceof Error ? e.message : String(e), resultSummary: 'notification failed', input, startedAt: stepStart });
        parts.push('notification failed'); anyFailed = true;
      }
      continue;
    }

    // ── Остальные действия (record/list/assign/lead) ──
    try {
      let r: ActionResult;
      if (type === 'FIND_RECORDS') {
        const f = await execFindRecords(run.orgId, cfg);
        r = f.result;
        if (f.firstRecordId) rctx.recordId = f.firstRecordId; // assignFirstToSubject → субъект для следующих шагов
      } else if (isMutatingAction(type)) {
        r = await applyMutatingIdempotent(type, order, run.id, ctx, rctx, cfg);
      } else {
        throw new Error(`Unhandled action: ${type}`);
      }
      wfVars.steps[order] = r.output; // M17-4: выход шага доступен следующим ({{steps.N...}})
      await upsertStep(run, order, type, { status: 'SUCCEEDED', resultSummary: r.summary, output: r.output as Prisma.InputJsonValue, idempotencyKey: isMutatingAction(type) ? `act:${run.id}:${order}` : undefined, input, startedAt: stepStart });
      parts.push(r.summary);
      anyOk = true;
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      await upsertStep(run, order, type, { status: 'FAILED', error: raw, resultSummary: `${type} failed`, input, startedAt: stepStart });
      parts.push(`${type} failed`);
      anyFailed = true;
    }
  }

  const completedAt = new Date();
  // filtered (короткое замыкание FILTER) — НОРМАЛЬНЫЙ исход → SUCCEEDED.
  const status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED' = filtered ? 'SUCCEEDED' : !anyFailed ? 'SUCCEEDED' : anyOk ? 'PARTIAL' : 'FAILED';
  const attr = ctx.attributionMode ? ` · attribution:${ctx.attributionMode}` : '';
  const summary = (parts.join(' · ') || 'no actions') + attr;
  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { status, summary, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), resumeAt: null },
  });
  return status;
}

// Создать/обновить шаг (идемпотентно по @@unique([runId, order])).
async function upsertStep(
  run: { id: string; orgId: string },
  order: number,
  action: string,
  data: { status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'WAITING'; resultSummary?: string; error?: string; output?: unknown; input?: unknown; idempotencyKey?: string; startedAt: Date },
): Promise<void> {
  const isWaiting = data.status === 'WAITING';
  const completedAt = isWaiting ? null : new Date();
  const common = {
    status: data.status, resultSummary: data.resultSummary ?? null, error: data.error ?? null,
    output: (data.output ?? Prisma.DbNull) as Prisma.InputJsonValue, input: (data.input ?? Prisma.DbNull) as Prisma.InputJsonValue, idempotencyKey: data.idempotencyKey ?? null,
    startedAt: data.startedAt, completedAt, durationMs: completedAt ? completedAt.getTime() - data.startedAt.getTime() : null,
  };
  await prisma.workflowRunStep.upsert({
    where: { runId_order: { runId: run.id, order } },
    create: { orgId: run.orgId, runId: run.id, order, action, ...common, attemptCount: 1 },
    update: { ...common, attemptCount: { increment: 1 } },
  });
}

/**
 * Прогон всех активных правил под триггер/условие.
 * Дубль источника → existing run {deduped:true} (без второй строки).
 */
export async function runWorkflows(ctx: RunCtx): Promise<{ matched: number; runs: RunResult[]; suppressed?: boolean }> {
  // M17-2 SELF-RECURSION GUARD: событие, СОЗДАННОЕ внутри прогона, НЕ запускает новые триггеры.
  if (ctx.sourceWorkflowRunId) return { matched: 0, runs: [], suppressed: true };

  // M17-5: матчим только ОПУБЛИКОВАННЫЕ активные правила; исполняем IMMUTABLE snapshot версии (не draft).
  const workflows = await prisma.workflow.findMany({
    where: { orgId: ctx.orgId, isActive: true, publishedVersion: { not: null }, ...(ctx.onlyWorkflowId ? { id: ctx.onlyWorkflowId } : {}) },
    select: { id: true, name: true, publishedVersion: true },
  });
  if (workflows.length === 0) return { matched: 0, runs: [] };
  const versions = await prisma.workflowVersion.findMany({ where: { OR: workflows.map((w) => ({ workflowId: w.id, version: w.publishedVersion as number })) } });
  const verByWf = new Map(versions.map((v) => [`${v.workflowId}:${v.version}`, v]));

  const key = deriveRunKey(ctx);
  const runs: RunResult[] = [];
  let matched = 0;

  for (const wf of workflows) {
    const ver = verByWf.get(`${wf.id}:${wf.publishedVersion}`);
    if (!ver) continue;
    const effTrigger = ver.trigger as WorkflowTrigger;
    // Матчинг событийных триггеров — по PUBLISHED snapshot (не по draft). onlyWorkflowId = явный manual/rerun.
    if (!ctx.onlyWorkflowId) {
      if (effTrigger !== ctx.trigger) continue;
      if (ctx.trigger === 'REPLY_RECEIVED' && ver.conditionClass && ver.conditionClass !== ctx.replyClass) continue;
    }
    const runTrigger = ctx.onlyWorkflowId ? effTrigger : ctx.trigger;

    let run: { id: string; orgId: string; leadId: string | null; trigger: string };
    try {
      run = await prisma.workflowRun.create({
        data: {
          orgId: ctx.orgId, workflowId: wf.id, workflowVersion: wf.publishedVersion, leadId: ctx.leadId ?? null, recordId: ctx.recordId ?? null, objectId: ctx.objectId ?? null, trigger: runTrigger as never,
          summary: 'pending', status: 'PENDING', idempotencyKey: key, eventId: ctx.eventId ?? null,
          campaignId: ctx.campaignId ?? null, attributionMode: ctx.attributionMode ?? null, batchId: ctx.batchId ?? null,
        },
        select: { id: true, orgId: true, leadId: true, trigger: true },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        const existing = await prisma.workflowRun.findFirst({ where: { workflowId: wf.id, idempotencyKey: key }, select: { id: true, status: true } });
        if (existing) {
          await prisma.workflowRun.update({ where: { id: existing.id }, data: { dedupeCount: { increment: 1 } } });
          runs.push({ workflowId: wf.id, runId: existing.id, status: existing.status, deduped: true });
          continue;
        }
      }
      throw e;
    }

    const runCtx = ctx.onlyWorkflowId ? { ...ctx, trigger: effTrigger } : ctx;
    const status = await executeRun(run, { id: wf.id, name: wf.name, actions: ver.actions }, runCtx);
    await prisma.workflow.update({ where: { id: wf.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    runs.push({ workflowId: wf.id, runId: run.id, status, deduped: false });
    matched++;
  }
  return { matched, runs };
}

// M17-5: какие действия исполнять для прогона — IMMUTABLE snapshot его версии (legacy-run без версии → draft).
async function loadRunWorkflow(run: { workflowId: string; orgId: string; workflowVersion: number | null }): Promise<{ id: string; name: string; actions: string[] } | null> {
  const wf = await prisma.workflow.findFirst({ where: { id: run.workflowId, orgId: run.orgId }, select: { id: true, name: true, actions: true } });
  if (!wf) return null;
  if (run.workflowVersion != null) {
    const ver = await prisma.workflowVersion.findUnique({ where: { workflowId_version: { workflowId: run.workflowId, version: run.workflowVersion } }, select: { actions: true } });
    if (ver) return { id: wf.id, name: wf.name, actions: ver.actions };
  }
  return { id: wf.id, name: wf.name, actions: wf.actions };
}

/** M17-2: оживлённый LEAD_UNSUBSCRIBED. */
export async function fireLeadUnsubscribed(orgId: string, leadId: string, opts?: { campaignId?: string | null; sourceWorkflowRunId?: string | null }): Promise<void> {
  await runWorkflows({ orgId, trigger: 'LEAD_UNSUBSCRIBED', leadId, campaignId: opts?.campaignId ?? null, idempotencyKey: `unsub:${leadId}`, sourceWorkflowRunId: opts?.sourceWorkflowRunId ?? null }).catch(() => undefined);
}

/** M17-2: synthetic-harness для contract-триггеров (WEBHOOK/SCHEDULE/TYPEFORM/OUTREACH/LIST_ENTRY_UPDATED/TASK_CREATED). */
export async function fireSyntheticTrigger(ctx: RunCtx): Promise<{ matched: number; runs: RunResult[]; suppressed?: boolean }> {
  return runWorkflows(ctx);
}

/**
 * Retry прогона (FAILED/PARTIAL): пропускает SUCCEEDED шаги, гонит первый FAILED/PENDING, не повторяет side effects.
 */
export async function retryWorkflowRun(orgId: string, runId: string): Promise<{ ok: boolean; status?: string; code?: string }> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, orgId } });
  if (!run) return { ok: false, code: 'NOT_FOUND' };
  if (run.status === 'SUCCEEDED') return { ok: false, code: 'NOTHING_TO_RETRY' };
  if (run.attemptCount >= MAX_RUN_ATTEMPTS) {
    await prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: 'retry limit reached' } });
    return { ok: false, code: 'RETRY_LIMIT_REACHED' };
  }
  // M17-5: retry исполняет ту же версию (immutable), что и исходный прогон.
  const wfRun = await loadRunWorkflow(run);
  if (!wfRun) return { ok: false, code: 'WORKFLOW_GONE' };
  const ctx = rebuildCtx(run);
  const status = await executeRun({ id: run.id, orgId: run.orgId, leadId: run.leadId, trigger: run.trigger }, wfRun, ctx);
  return { ok: true, status };
}

/** Rerun: совершенно новый прогон ТОЙ ЖЕ версии (immutable snapshot источника), новый idempotencyKey. */
export async function rerunWorkflow(orgId: string, runId: string): Promise<{ ok: boolean; runId?: string; status?: string; code?: string }> {
  const src = await prisma.workflowRun.findFirst({ where: { id: runId, orgId } });
  if (!src) return { ok: false, code: 'NOT_FOUND' };
  const wfRun = await loadRunWorkflow(src);
  if (!wfRun) return { ok: false, code: 'WORKFLOW_GONE' };
  const run = await prisma.workflowRun.create({
    data: {
      orgId, workflowId: src.workflowId, workflowVersion: src.workflowVersion, leadId: src.leadId, recordId: src.recordId, objectId: src.objectId, trigger: src.trigger,
      summary: 'pending', status: 'PENDING', idempotencyKey: `rerun:${src.id}:${new Date().getTime()}`, campaignId: src.campaignId, attributionMode: src.attributionMode,
    },
    select: { id: true, orgId: true, leadId: true, trigger: true },
  });
  const status = await executeRun(run, wfRun, rebuildCtx(src));
  await prisma.workflow.update({ where: { id: src.workflowId }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
  return { ok: true, runId: run.id, status };
}

function rebuildCtx(run: { orgId: string; trigger: string; leadId: string | null; recordId: string | null; objectId: string | null; campaignId: string | null; eventId: string | null; attributionMode: string | null; idempotencyKey: string }): RunCtx {
  return {
    orgId: run.orgId, trigger: run.trigger as WorkflowTrigger, leadId: run.leadId ?? undefined, recordId: run.recordId, objectId: run.objectId,
    campaignId: run.campaignId, eventId: run.eventId, attributionMode: run.attributionMode, idempotencyKey: run.idempotencyKey,
  };
}

/**
 * Stuck-RUNNING recovery (свипер): прогоны в RUNNING дольше таймаута после claimedAt — реклеймятся.
 */
export async function recoverStuckWorkflowRuns(timeoutMs: number = STUCK_RUN_TIMEOUT_MS): Promise<{ recovered: number }> {
  const cutoff = new Date(Date.now() - timeoutMs);
  const stuck = await prisma.workflowRun.findMany({ where: { status: 'RUNNING', claimedAt: { lt: cutoff } }, select: { id: true, orgId: true } });
  let recovered = 0;
  for (const s of stuck) {
    const r = await retryWorkflowRun(s.orgId, s.id).catch(() => ({ ok: false }));
    if ((r as { ok: boolean }).ok) recovered++;
  }
  return { recovered };
}

/**
 * M17-3: возобновить WAITING-прогоны DELAY/DELAY_UNTIL, у которых наступил resumeAt.
 * Claim-safe (GPT-правка): CAS updateMany WHERE status=WAITING — один воркер выигрывает прогон.
 */
export async function resumeDueWorkflowRuns(now: Date = new Date()): Promise<{ resumed: number }> {
  const due = await prisma.workflowRun.findMany({ where: { status: 'WAITING', resumeAt: { lte: now, not: null } }, select: { id: true, orgId: true }, take: 200 });
  let resumed = 0;
  for (const d of due) {
    // CAS: перевести WAITING→RUNNING только если всё ещё WAITING (исключает двойной resume двумя воркерами).
    const claim = await prisma.workflowRun.updateMany({ where: { id: d.id, status: 'WAITING' }, data: { status: 'RUNNING', claimedAt: new Date() } });
    if (claim.count !== 1) continue;
    const run = await prisma.workflowRun.findUnique({ where: { id: d.id } });
    if (!run) continue;
    const wf = await loadRunWorkflow(run); // M17-5: исполнять версию прогона (immutable)
    if (!wf) continue;
    try {
      await executeRun({ id: run.id, orgId: run.orgId, leadId: run.leadId, trigger: run.trigger }, wf, rebuildCtx(run), { resume: true });
    } catch {
      // Транзиентный сбой во время resume — вернуть прогон в WAITING (повторит следующий тик как RESUME,
      // НЕ через stuck-sweeper/retry, чтобы не сжигать attemptCount-бюджет). Идемпотентные шаги не повторятся.
      await prisma.workflowRun.updateMany({ where: { id: run.id, status: 'RUNNING' }, data: { status: 'WAITING', resumeAt: new Date(Date.now() + 30_000) } }).catch(() => undefined);
    }
    resumed++;
  }
  return { resumed };
}

/**
 * Тест правила (dry-run): симулирует действия БЕЗ мутаций, пишет наблюдаемый WorkflowRun [test] (SKIPPED).
 */
export async function testWorkflow(orgId: string, workflowId: string): Promise<
  { ok: false } | { ok: true; run: { id: string; summary: string; createdAt: Date }; lead: string | null; parts: string[]; active: boolean }
> {
  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, orgId } });
  if (!wf) return { ok: false };

  let lead: { id: string; firstName: string; lastName: string; company: string | null } | null = null;
  if (wf.trigger === 'REPLY_RECEIVED') {
    const msg = await prisma.message.findFirst({
      where: { direction: 'INBOUND', lead: { orgId }, ...(wf.conditionClass ? { replyClass: wf.conditionClass } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { lead: { select: { id: true, firstName: true, lastName: true, company: true } } },
    });
    lead = msg?.lead ?? null;
  }
  if (!lead) {
    lead = await prisma.lead.findFirst({ where: { orgId }, orderBy: { updatedAt: 'desc' }, select: { id: true, firstName: true, lastName: true, company: true } });
  }

  const parts = wf.actions.map(simulateAction);
  const leadName = lead ? `${lead.firstName} ${lead.lastName}${lead.company ? ` · ${lead.company}` : ''}` : null;
  const summary = `[test] ${leadName ? `${leadName} — ` : ''}would: ${parts.join(' · ')}`;
  const run = await prisma.workflowRun.create({
    data: { orgId, workflowId: wf.id, leadId: lead?.id ?? null, trigger: wf.trigger, summary, status: 'SKIPPED', idempotencyKey: `test:${wf.id}:${new Date().getTime()}:${Math.random().toString(36).slice(2, 10)}` },
  });
  return { ok: true, run: { id: run.id, summary, createdAt: run.createdAt }, lead: leadName, parts, active: wf.isActive };
}

// Системные правила-шаблоны. Создаются один раз для org, если у неё ещё нет ни одного workflow.
const SYSTEM_WORKFLOWS = [
  { name: 'Hot reply → handoff', description: 'Interested replies are escalated to a human and the sequence pauses.', trigger: 'REPLY_RECEIVED' as const, conditionClass: 'INTERESTED' as const, actions: ['SET_LEAD_HOT', 'PAUSE_SEQUENCE', 'NOTIFY_HUMAN'] },
  { name: 'Unsubscribe → suppress', description: 'Opt-outs are suppressed and removed from all outreach.', trigger: 'REPLY_RECEIVED' as const, conditionClass: 'UNSUBSCRIBE' as const, actions: ['SUPPRESS_CONTACT'] },
  { name: 'Not interested → stop nurture', description: 'Negative replies pause the sequence and mark the lead replied.', trigger: 'REPLY_RECEIVED' as const, conditionClass: 'NOT_INTERESTED' as const, actions: ['PAUSE_SEQUENCE', 'MOVE_TO_REPLIED'] },
  { name: 'Meeting booked → convert', description: 'When a meeting is booked, mark the lead converted and stop outreach.', trigger: 'MEETING_BOOKED' as const, conditionClass: null, actions: ['MARK_CONVERTED'] },
];

export async function ensureSystemWorkflows(orgId: string): Promise<void> {
  const count = await prisma.workflow.count({ where: { orgId } });
  if (count > 0) return;
  await prisma.workflow.createMany({
    data: SYSTEM_WORKFLOWS.map((w) => ({ orgId, name: w.name, description: w.description, trigger: w.trigger as never, conditionClass: (w.conditionClass ?? null) as never, actions: w.actions, isSystem: true, isActive: true })),
  });
  // M17-5: системные правила сразу публикуем v1 (иначе publishedVersion=null → не runnable).
  const created = await prisma.workflow.findMany({ where: { orgId, isSystem: true, publishedVersion: null }, select: { id: true, trigger: true, conditionClass: true, actions: true } });
  for (const w of created) {
    await prisma.workflowVersion.create({ data: { orgId, workflowId: w.id, version: 1, trigger: w.trigger, conditionClass: w.conditionClass, actions: w.actions } });
  }
  await prisma.workflow.updateMany({ where: { orgId, isSystem: true, publishedVersion: null }, data: { publishedVersion: 1, draftUpdatedAt: new Date() } });
}

// ─── M17-5 publish / validate / duplicate ─────────────────────────────────────

export interface PublishError { index: number; field: string; message: string }

/** Валидация draft перед публикацией: структура (validateActionList) + ref-checks (object/list/campaign) + secrets. */
export async function validatePublish(orgId: string, wf: { actions: string[] }): Promise<PublishError[]> {
  const errors: PublishError[] = [];
  const av = validateActionList(wf.actions);
  if (!av.ok) return [{ index: av.index, field: 'action', message: av.error }]; // структурно невалидно — дальше не идём
  const secretNames = new Set<string>();
  // лит-значение = строка БЕЗ шаблона {{...}} (templated refs резолвятся в рантайме — не валидируем как статичный ref).
  const lit = (v: unknown): v is string => typeof v === 'string' && !v.includes('{{');
  for (let i = 0; i < wf.actions.length; i++) {
    const { type, config } = parseActionSpec(wf.actions[i]);
    // секреты: и {{secret.X}}, и {{secrets.X}} (резолвер принимает оба namespace).
    for (const m of JSON.stringify(config).matchAll(/\{\{\s*secrets?\.([A-Za-z0-9_.]+)\s*\}\}/g)) secretNames.add(m[1]);
    if ((type === 'CREATE_RECORD' || type === 'FIND_RECORDS') && lit(config.objectKey)) {
      if (!(await prisma.object.findFirst({ where: { orgId, key: config.objectKey, archivedAt: null }, select: { id: true } }))) errors.push({ index: i, field: 'objectKey', message: `Object not found: ${config.objectKey}` });
    }
    if ((type === 'ADD_TO_LIST' || type === 'REMOVE_FROM_LIST' || type === 'UPDATE_LIST_ENTRY') && lit(config.listId)) {
      if (!(await prisma.list.findFirst({ where: { id: config.listId, orgId }, select: { id: true } }))) errors.push({ index: i, field: 'listId', message: `List not found: ${config.listId}` });
    }
    if ((type === 'ENROLL_SEQUENCE' || type === 'UNENROLL_SEQUENCE') && lit(config.campaignId)) {
      if (!(await prisma.campaign.findFirst({ where: { id: config.campaignId, orgId }, select: { id: true } }))) errors.push({ index: i, field: 'campaignId', message: `Campaign not found: ${config.campaignId}` });
    }
  }
  if (secretNames.size) {
    const have = new Set((await prisma.workflowSecret.findMany({ where: { orgId, key: { in: [...secretNames] } }, select: { key: true } })).map((s) => s.key));
    for (const name of secretNames) if (!have.has(name)) errors.push({ index: -1, field: 'secret', message: `Missing secret: ${name}` });
  }
  return errors;
}

/** Публикация: validation → create WorkflowVersion → update publishedVersion — АТОМАРНО. Ошибки → published не меняется. */
export async function publishWorkflow(orgId: string, workflowId: string, userId: string | null): Promise<{ ok: true; version: number } | { ok: false; errors?: PublishError[]; code?: string }> {
  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, orgId }, select: { id: true, trigger: true, conditionClass: true, actions: true, publishedVersion: true } });
  if (!wf) return { ok: false, code: 'NOT_FOUND' };
  const errors = await validatePublish(orgId, { actions: wf.actions });
  if (errors.length) return { ok: false, errors };
  try {
    // nextVersion вычисляем ВНУТРИ tx (MAX+1), чтобы конкурентные publish не получили одинаковый номер.
    const version = await prisma.$transaction(async (tx) => {
      const max = await tx.workflowVersion.aggregate({ where: { workflowId }, _max: { version: true } });
      const nextVersion = (max._max.version ?? 0) + 1;
      await tx.workflowVersion.create({ data: { orgId, workflowId, version: nextVersion, trigger: wf.trigger, conditionClass: wf.conditionClass, actions: wf.actions, publishedById: userId } });
      await tx.workflow.update({ where: { id: workflowId }, data: { publishedVersion: nextVersion } });
      return nextVersion;
    });
    return { ok: true, version };
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return { ok: false, code: 'PUBLISH_CONFLICT' }; // гонка двух publish — повторить
    throw e;
  }
}

/** Duplicate: новый Workflow DRAFT (unpublished, isSystem=false), без копий runs/versions. */
export async function duplicateWorkflow(orgId: string, workflowId: string): Promise<{ ok: boolean; workflow?: unknown }> {
  const src = await prisma.workflow.findFirst({ where: { id: workflowId, orgId } });
  if (!src) return { ok: false };
  const copy = await prisma.workflow.create({
    data: { orgId, name: `${src.name} (copy)`, description: src.description, trigger: src.trigger, conditionClass: src.conditionClass, actions: src.actions, isActive: true, isSystem: false, publishedVersion: null, draftUpdatedAt: new Date() },
  });
  return { ok: true, workflow: copy };
}
