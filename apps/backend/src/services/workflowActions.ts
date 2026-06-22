/**
 * M17-3 Core action blocks — типизированный каталог действий Workflow + реальные исполнители.
 *
 * Принципы (утверждено GPT 2026-06-19, путь A плоский движок):
 * • Workflow.actions остаётся String[]; каждый элемент — голый ключ (legacy lead-действие)
 *   ИЛИ JSON-спека {type, config} (transitional format). parseActionSpec разбирает обе формы.
 * • КАЖДАЯ спека валидируется per-action zod-схемой; невалид → шаг FAILED (readable summary + raw error).
 * • Mutating-действия (record/list/round-robin) исполняются ВНУТРИ транзакции движка: claim
 *   WorkflowActionIdempotency + мутация + output в одной tx (падение до commit → claim не остаётся).
 *   Поэтому здесь executors принимают tx (Prisma.TransactionClient), а движок оборачивает их.
 * • Записи, созданные/изменённые внутри прогона, downstream-триггеры НЕ зажигают (recursion-guard;
 *   cross-workflow chaining — M17-5). Поэтому тут НЕТ импорта движка → нет циклического импорта.
 * • Read-only (FIND/FILTER/IF/SWITCH) — без идемпотентного ключа; работают на фактах субъекта.
 */

import { AttributeType, Prisma, PrismaClient, ValueSource } from '@prisma/client';
import { lookup as dnsLookup } from 'dns/promises';
import { z } from 'zod';
import { writeValues } from './crm/values';
import { assertCredits, debitCredits } from './billing/ledger';
import { llmAvailable, llmComplete } from './llm';
import { notify } from './notifications';
import { enrollLeadInCampaign, unenrollLeadFromCampaign } from './enrollment';
import { automationAccess, meets } from './permissions';

const prisma = new PrismaClient();

// Транзакционный клиент Prisma (то, что приходит в callback prisma.$transaction).
type Tx = Prisma.TransactionClient;

// Контекст субъекта прогона (запись CRM или лид).
export interface ActionCtx {
  orgId: string;
  recordId?: string | null;
  objectId?: string | null;
  leadId?: string | null;
  workflowId?: string | null; // M21-2: для проверки automation-грантов (S352)
}

// Результат применения одного действия: человеко-безопасное summary + машинный output для аудита.
export interface ActionResult {
  summary: string;
  output: Record<string, unknown>;
}

export type ActionKind = 'lead' | 'record' | 'list' | 'logic' | 'delay' | 'assign' | 'ai' | 'http' | 'transform' | 'integration';

// Дескриптор параметра для UI-билдера (фронт рендерит редактор по типу).
export interface ParamDescriptor {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'objectKey' | 'listId' | 'kv' | 'csv' | 'conditions' | 'cases' | 'match' | 'method' | 'transform';
  required?: boolean;
  placeholder?: string;
}

export interface ActionMeta {
  label: string;
  description: string;
  kind: ActionKind;
  mutating: boolean; // true → исполнять в транзакции с idempotency-claim
  control?: boolean; // true → управляет потоком (FILTER/IF/SWITCH/DELAY), исполняется самим движком
  params: ParamDescriptor[];
}

// ─── Каталог действий ─────────────────────────────────────────────────────────

export const ACTION_CATALOG: Record<string, ActionMeta> = {
  // Legacy lead-действия (M17-1) — без параметров.
  NOTIFY_HUMAN: { label: 'Notify a human', description: 'Hand off to the cockpit Work Queue for a person to act.', kind: 'lead', mutating: false, params: [] },
  PAUSE_SEQUENCE: { label: 'Pause sequence', description: 'Stop further automated steps for this lead.', kind: 'lead', mutating: true, params: [] },
  SET_LEAD_HOT: { label: 'Mark lead hot', description: 'Set the lead status to HOT for fast follow-up.', kind: 'lead', mutating: true, params: [] },
  MARK_CONVERTED: { label: 'Mark converted', description: 'Set the lead to CONVERTED and stop outreach.', kind: 'lead', mutating: true, params: [] },
  SUPPRESS_CONTACT: { label: 'Suppress contact', description: 'Unsubscribe the lead and halt all outreach.', kind: 'lead', mutating: true, params: [] },
  MOVE_TO_REPLIED: { label: 'Move to replied', description: 'Set the lead status to REPLIED (nurture later).', kind: 'lead', mutating: true, params: [] },

  // M17-3 record-действия (реальные Data Hub операции org-scoped).
  CREATE_RECORD: { label: 'Create record', description: 'Create a new record in an object with the given values.', kind: 'record', mutating: true,
    params: [{ key: 'objectKey', label: 'Object', type: 'objectKey', required: true }, { key: 'values', label: 'Values (attribute → value)', type: 'kv', required: true }] },
  UPDATE_RECORD: { label: 'Update record', description: 'Update the subject record (or a record by id) with new values.', kind: 'record', mutating: true,
    params: [{ key: 'values', label: 'Values (attribute → value)', type: 'kv', required: true }, { key: 'recordId', label: 'Record id (optional — defaults to subject)', type: 'text' }] },
  FIND_RECORDS: { label: 'Find records', description: 'Find records in an object matching conditions (read-only).', kind: 'record', mutating: false,
    params: [{ key: 'objectKey', label: 'Object', type: 'objectKey', required: true }, { key: 'conditions', label: 'Conditions', type: 'conditions' }, { key: 'limit', label: 'Limit (≤100)', type: 'number' }, { key: 'assignFirstToSubject', label: 'Use first match as subject for next steps', type: 'boolean' }] },
  ARCHIVE_RECORD: { label: 'Archive record', description: 'Soft-archive the subject record (sets archivedAt).', kind: 'record', mutating: true,
    params: [{ key: 'recordId', label: 'Record id (optional — defaults to subject)', type: 'text' }] },

  // M17-3 list-действия.
  ADD_TO_LIST: { label: 'Add to list', description: 'Add the subject record to a list.', kind: 'list', mutating: true,
    params: [{ key: 'listId', label: 'List', type: 'listId', required: true }, { key: 'recordId', label: 'Record id (optional)', type: 'text' }] },
  REMOVE_FROM_LIST: { label: 'Remove from list', description: 'Remove the subject record from a list.', kind: 'list', mutating: true,
    params: [{ key: 'listId', label: 'List', type: 'listId', required: true }, { key: 'recordId', label: 'Record id (optional)', type: 'text' }] },
  UPDATE_LIST_ENTRY: { label: 'Update list entry', description: 'Set the pipeline stage of the subject record on a list.', kind: 'list', mutating: true,
    params: [{ key: 'listId', label: 'List', type: 'listId', required: true }, { key: 'stage', label: 'Stage', type: 'text', required: true }, { key: 'recordId', label: 'Record id (optional)', type: 'text' }] },

  // M17-3 логика (линейная; исполняется движком, управляет последующими шагами).
  FILTER: { label: 'Filter (continue if)', description: 'Stop the run unless the subject matches the conditions.', kind: 'logic', mutating: false, control: true,
    params: [{ key: 'conditions', label: 'Conditions', type: 'conditions', required: true }, { key: 'match', label: 'Match', type: 'match' }] },
  IF: { label: 'If / branch', description: 'Run the next N steps only if the subject matches the conditions.', kind: 'logic', mutating: false, control: true,
    params: [{ key: 'conditions', label: 'Conditions', type: 'conditions', required: true }, { key: 'match', label: 'Match', type: 'match' }, { key: 'span', label: 'Applies to next N steps', type: 'number' }] },
  SWITCH: { label: 'Switch', description: 'Route to one branch of following steps by a field value.', kind: 'logic', mutating: false, control: true,
    params: [{ key: 'field', label: 'Field', type: 'text', required: true }, { key: 'cases', label: 'Cases', type: 'cases', required: true }, { key: 'defaultSpan', label: 'Default branch N steps', type: 'number' }] },

  // M17-3 задержки (через scheduler, исполняются движком).
  DELAY: { label: 'Delay', description: 'Pause the run for a relative duration, then resume.', kind: 'delay', mutating: false, control: true,
    params: [{ key: 'minutes', label: 'Minutes', type: 'number' }, { key: 'hours', label: 'Hours', type: 'number' }, { key: 'days', label: 'Days', type: 'number' }] },
  DELAY_UNTIL: { label: 'Delay until', description: 'Pause the run until an absolute timestamp, then resume.', kind: 'delay', mutating: false, control: true,
    params: [{ key: 'at', label: 'Resume at (ISO timestamp)', type: 'text', required: true }] },

  // M17-3 назначение.
  ROUND_ROBIN: { label: 'Round-robin assign', description: 'Fairly assign the subject record to a user via a USER attribute.', kind: 'assign', mutating: true,
    params: [{ key: 'attributeKey', label: 'USER attribute key (optional — auto-detect)', type: 'text' }, { key: 'poolUserIds', label: 'Pool user ids (optional — comma-separated, default active org users)', type: 'csv' }, { key: 'recordId', label: 'Record id (optional)', type: 'text' }] },

  // M17-4 AI-блоки (через M16 credit-guard, source WORKFLOW_AI). Результат всегда в step output/context;
  // в атрибут субъекта — только если задан targetAttributeKey.
  AI_CLASSIFY: { label: 'AI classify', description: 'Classify the input into one of the categories (1 credit).', kind: 'ai', mutating: true,
    params: [{ key: 'input', label: 'Input (text or {{template}})', type: 'text', required: true }, { key: 'categories', label: 'Categories (comma-separated)', type: 'csv', required: true }, { key: 'targetAttributeKey', label: 'Write result to attribute (optional)', type: 'text' }] },
  AI_SUMMARIZE: { label: 'AI summarize', description: 'Summarize the input (1 credit).', kind: 'ai', mutating: true,
    params: [{ key: 'input', label: 'Input (text or {{template}})', type: 'text', required: true }, { key: 'targetAttributeKey', label: 'Write result to attribute (optional)', type: 'text' }] },
  AI_PROMPT: { label: 'AI prompt', description: 'Run a custom prompt over the input (1 credit).', kind: 'ai', mutating: true,
    params: [{ key: 'prompt', label: 'Prompt', type: 'text', required: true }, { key: 'input', label: 'Input (optional)', type: 'text' }, { key: 'targetAttributeKey', label: 'Write result to attribute (optional)', type: 'text' }] },
  AI_RESEARCH: { label: 'AI research', description: 'Research the input and report findings (10 credits).', kind: 'ai', mutating: true,
    params: [{ key: 'input', label: 'Subject / question', type: 'text', required: true }, { key: 'targetAttributeKey', label: 'Write result to attribute (optional)', type: 'text' }] },

  // M17-4 HTTP + парсинг.
  HTTP_REQUEST: { label: 'HTTP request', description: 'Call an external API. Use {{secret.NAME}} in headers/url for secrets (masked in logs).', kind: 'http', mutating: true,
    params: [{ key: 'method', label: 'Method', type: 'method', required: true }, { key: 'url', label: 'URL', type: 'text', required: true }, { key: 'headers', label: 'Headers', type: 'kv' }, { key: 'body', label: 'Body', type: 'text' }, { key: 'timeoutMs', label: 'Timeout ms (≤30000)', type: 'number' }, { key: 'parseJson', label: 'Parse JSON response', type: 'boolean' }, { key: 'retryEnabled', label: 'Allow retry on non-GET (transient)', type: 'boolean' }] },
  TRANSFORM: { label: 'Transform / extract', description: 'Extract fields from previous step/AI/HTTP outputs into workflow variables.', kind: 'transform', mutating: false, control: true,
    params: [{ key: 'extract', label: 'Extract (var ← path)', type: 'transform', required: true }] },

  // M17-4 интеграции.
  ENROLL_SEQUENCE: { label: 'Enroll in sequence', description: 'Enroll the subject lead into a campaign sequence (via M11).', kind: 'integration', mutating: true,
    params: [{ key: 'campaignId', label: 'Campaign id', type: 'text', required: true }] },
  UNENROLL_SEQUENCE: { label: 'Unenroll from sequence', description: 'Remove the subject lead from a campaign sequence (via M11).', kind: 'integration', mutating: true,
    params: [{ key: 'campaignId', label: 'Campaign id', type: 'text', required: true }] },
  SEND_NOTIFICATION: { label: 'Send notification', description: 'Post an internal notification to the cockpit (idempotent on retry).', kind: 'integration', mutating: true,
    params: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'body', label: 'Body', type: 'text' }] },
};

export const ACTION_KEYS = Object.keys(ACTION_CATALOG);
export function isKnownAction(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACTION_CATALOG, type);
}
export function isControlAction(type: string): boolean {
  return !!ACTION_CATALOG[type]?.control;
}
export function isMutatingAction(type: string): boolean {
  return !!ACTION_CATALOG[type]?.mutating;
}

// ─── Разбор спеки действия ──────────────────────────────────────────────────────

export interface ActionSpec {
  type: string;
  config: Record<string, unknown>;
}

/** Голый ключ ("SET_LEAD_HOT") ИЛИ JSON {type,config}. Не-JSON-строка трактуется как голый ключ. */
export function parseActionSpec(raw: string): ActionSpec {
  const s = (raw ?? '').trim();
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s) as { type?: unknown; config?: unknown };
      if (obj && typeof obj.type === 'string') {
        return { type: obj.type, config: (obj.config && typeof obj.config === 'object' ? obj.config : {}) as Record<string, unknown> };
      }
    } catch {
      /* падает в ветку голого ключа ниже — валидатор пометит unknown */
    }
  }
  return { type: s, config: {} };
}

// ─── Per-action zod-валидация config ──────────────────────────────────────────

const CONDITION_OPS = ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty', 'in'] as const;
const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(CONDITION_OPS),
  value: z.unknown().optional(),
});
const matchSchema = z.enum(['all', 'any']).default('all');

const CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  // lead-действия без config
  NOTIFY_HUMAN: z.object({}).passthrough(),
  PAUSE_SEQUENCE: z.object({}).passthrough(),
  SET_LEAD_HOT: z.object({}).passthrough(),
  MARK_CONVERTED: z.object({}).passthrough(),
  SUPPRESS_CONTACT: z.object({}).passthrough(),
  MOVE_TO_REPLIED: z.object({}).passthrough(),

  CREATE_RECORD: z.object({ objectKey: z.string().min(1), values: z.record(z.unknown()).default({}) }),
  UPDATE_RECORD: z.object({ recordId: z.string().min(1).optional(), values: z.record(z.unknown()) }),
  FIND_RECORDS: z.object({
    objectKey: z.string().min(1),
    conditions: z.array(conditionSchema).optional(),
    match: matchSchema.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    assignFirstToSubject: z.boolean().optional(),
  }),
  ARCHIVE_RECORD: z.object({ recordId: z.string().min(1).optional() }),

  ADD_TO_LIST: z.object({ listId: z.string().min(1), recordId: z.string().min(1).optional() }),
  REMOVE_FROM_LIST: z.object({ listId: z.string().min(1), recordId: z.string().min(1).optional() }),
  UPDATE_LIST_ENTRY: z.object({ listId: z.string().min(1), stage: z.string().min(1), recordId: z.string().min(1).optional() }),

  FILTER: z.object({ conditions: z.array(conditionSchema).min(1), match: matchSchema.optional() }),
  IF: z.object({ conditions: z.array(conditionSchema).min(1), match: matchSchema.optional(), span: z.number().int().positive().optional() }),
  SWITCH: z.object({
    field: z.string().min(1),
    cases: z.array(z.object({ value: z.string(), label: z.string().optional(), span: z.number().int().positive() })).min(1),
    defaultSpan: z.number().int().positive().optional(),
  }),

  DELAY: z.object({ minutes: z.number().int().nonnegative().optional(), hours: z.number().int().nonnegative().optional(), days: z.number().int().nonnegative().optional() })
    .refine((c) => (c.minutes ?? 0) + (c.hours ?? 0) + (c.days ?? 0) > 0, { message: 'delay must be > 0 (set minutes, hours or days)' }),
  DELAY_UNTIL: z.object({ at: z.string().min(1) }).refine((c) => !Number.isNaN(Date.parse(c.at)), { message: 'at must be a valid ISO timestamp' }),

  ROUND_ROBIN: z.object({ attributeKey: z.string().min(1).optional(), poolUserIds: z.array(z.string().min(1)).optional(), recordId: z.string().min(1).optional() }),

  // M17-4
  AI_CLASSIFY: z.object({ input: z.string().min(1), categories: z.array(z.string().min(1)).min(1), targetAttributeKey: z.string().min(1).optional() }),
  AI_SUMMARIZE: z.object({ input: z.string().min(1), targetAttributeKey: z.string().min(1).optional() }),
  AI_PROMPT: z.object({ prompt: z.string().min(1), input: z.string().optional(), targetAttributeKey: z.string().min(1).optional() }),
  AI_RESEARCH: z.object({ input: z.string().min(1), prompt: z.string().optional(), targetAttributeKey: z.string().min(1).optional() }),
  HTTP_REQUEST: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
    url: z.string().min(1),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
    timeoutMs: z.number().int().min(1).max(30000).optional(),
    parseJson: z.boolean().optional(),
    retryEnabled: z.boolean().optional(),
  }),
  TRANSFORM: z.object({ extract: z.array(z.object({ as: z.string().min(1), path: z.string().min(1), required: z.boolean().optional() })).min(1) }),
  ENROLL_SEQUENCE: z.object({ campaignId: z.string().min(1) }),
  UNENROLL_SEQUENCE: z.object({ campaignId: z.string().min(1) }),
  SEND_NOTIFICATION: z.object({ title: z.string().min(1), body: z.string().optional() }),
};

export interface ValidationOk { ok: true; config: Record<string, unknown> }
export interface ValidationErr { ok: false; error: string }

/** Валидация config действия. Невалид → {ok:false, error} (raw zod-сообщение) для step FAILED. */
export function validateActionConfig(type: string, config: Record<string, unknown>): ValidationOk | ValidationErr {
  if (!isKnownAction(type)) return { ok: false, error: `Unknown action type: ${type}` };
  const schema = CONFIG_SCHEMAS[type];
  if (!schema) return { ok: true, config };
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `Invalid config for ${type}: ${msg}` };
  }
  return { ok: true, config: parsed.data as Record<string, unknown> };
}

// Проверка span IF/SWITCH: positive int, в границах actions[], без вложенной логики (FILTER/IF/SWITCH) до M17-5.
export function checkSpan(order: number, span: number, n: number, specs: { type: string }[]): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(span) || span <= 0) return { ok: false, error: `span must be a positive integer (got ${span})` };
  if (order + span > n - 1) return { ok: false, error: `span ${span} exceeds the remaining ${n - 1 - order} step(s)` };
  for (let o = order + 1; o <= order + span; o++) {
    if (specs[o].type === 'FILTER' || specs[o].type === 'IF' || specs[o].type === 'SWITCH') {
      return { ok: false, error: `nested logic (${specs[o].type}) inside a branch is not supported until M17-5` };
    }
  }
  return { ok: true };
}

/** Полная валидация списка действий правила (для save-time): config каждого + span-границы IF/SWITCH. */
export function validateActionList(actions: string[]): { ok: true } | { ok: false; index: number; error: string } {
  const specs = actions.map(parseActionSpec);
  const n = specs.length;
  for (let i = 0; i < n; i++) {
    const v = validateActionConfig(specs[i].type, specs[i].config);
    if (!v.ok) return { ok: false, index: i, error: v.error };
  }
  for (let i = 0; i < n; i++) {
    const { type, config } = specs[i];
    if (type === 'IF') {
      const span = (config.span as number | undefined) ?? 1;
      const b = checkSpan(i, span, n, specs);
      if (!b.ok) return { ok: false, index: i, error: b.error };
    }
    if (type === 'SWITCH') {
      const cases = (config.cases as { span: number }[]) ?? [];
      const total = cases.reduce((s, c) => s + (c.span ?? 0), 0) + ((config.defaultSpan as number | undefined) ?? 0);
      const b = checkSpan(i, total, n, specs);
      if (!b.ok) return { ok: false, index: i, error: b.error };
    }
  }
  return { ok: true };
}

// ─── Оценка условий (facts субъекта) ──────────────────────────────────────────

export type Condition = z.infer<typeof conditionSchema>;
export type Facts = Record<string, unknown>;

function valueRowToJs(type: AttributeType, v: { textValue: string | null; longTextValue: string | null; numberValue: Prisma.Decimal | null; booleanValue: boolean | null; dateValue: Date | null; jsonValue: Prisma.JsonValue | null; userValueId: string | null; currencyAmount: Prisma.Decimal | null }): unknown {
  switch (type) {
    case AttributeType.NUMBER: return v.numberValue == null ? null : Number(v.numberValue);
    case AttributeType.CURRENCY: return v.currencyAmount == null ? null : Number(v.currencyAmount);
    case AttributeType.BOOLEAN: return v.booleanValue;
    case AttributeType.DATE:
    case AttributeType.DATETIME: return v.dateValue ? v.dateValue.toISOString() : null;
    case AttributeType.LONG_TEXT: return v.longTextValue;
    case AttributeType.MULTI_SELECT:
    case AttributeType.JSON:
    case AttributeType.RELATIONSHIP: return v.jsonValue ?? null;
    case AttributeType.USER: return v.userValueId;
    default: return v.textValue; // TEXT/EMAIL/PHONE/URL/SELECT
  }
}

function isEmpty(a: unknown): boolean {
  return a == null || a === '' || (Array.isArray(a) && a.length === 0);
}

function evalOne(actual: unknown, op: Condition['op'], expected: unknown): boolean {
  switch (op) {
    case 'is_empty': return isEmpty(actual);
    case 'is_not_empty': return !isEmpty(actual);
    case 'eq': {
      const an = Number(actual); const bn = Number(expected);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && actual !== '' && expected !== '') return an === bn;
      return String(actual ?? '') === String(expected ?? '');
    }
    case 'neq': return !evalOne(actual, 'eq', expected);
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'in': return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ''));
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const an = Number(actual); const bn = Number(expected);
      const useNum = !Number.isNaN(an) && !Number.isNaN(bn);
      const a = useNum ? an : Date.parse(String(actual)); const b = useNum ? bn : Date.parse(String(expected));
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
    }
    default: return false;
  }
}

export interface EvalResult { matched: boolean; reason: string }

export function evalConditions(facts: Facts, conditions: Condition[], match: 'all' | 'any' = 'all'): EvalResult {
  if (conditions.length === 0) return { matched: true, reason: 'no conditions' };
  const results = conditions.map((c) => ({ c, pass: evalOne(facts[c.field], c.op, c.value) }));
  const matched = match === 'any' ? results.some((r) => r.pass) : results.every((r) => r.pass);
  const failed = results.filter((r) => !r.pass).map((r) => `${r.c.field} ${r.c.op}${r.c.value !== undefined ? ` ${JSON.stringify(r.c.value)}` : ''}`);
  const reason = matched ? `${match}: matched` : `${match}: failed [${failed.join(', ')}]`;
  return { matched, reason };
}

// Загрузить факты записи (attrKey → нормализованное значение) для условий.
async function recordFacts(orgId: string, recordId: string): Promise<{ objectId: string; facts: Facts } | null> {
  const rec = await prisma.record.findFirst({ where: { id: recordId, orgId }, select: { objectId: true } });
  if (!rec) return null;
  const attrs = await prisma.attribute.findMany({ where: { orgId, objectId: rec.objectId, archivedAt: null }, select: { id: true, key: true, type: true } });
  const byId = new Map(attrs.map((a) => [a.id, a]));
  const values = await prisma.value.findMany({ where: { orgId, recordId } });
  const facts: Facts = {};
  for (const v of values) {
    const a = byId.get(v.attributeId);
    if (a) facts[a.key] = valueRowToJs(a.type, v);
  }
  return { objectId: rec.objectId, facts };
}

function leadFacts(lead: { status: string; company: string | null; industry: string | null; country: string | null; city: string | null; title: string | null; score: number; email: string | null; firstName: string; lastName: string }): Facts {
  return { status: lead.status, company: lead.company, industry: lead.industry, country: lead.country, city: lead.city, title: lead.title, score: lead.score, email: lead.email, firstName: lead.firstName, lastName: lead.lastName };
}

/** Факты субъекта прогона: запись (по значениям) или лид (по полям). null если субъекта нет. */
export async function loadSubjectFacts(ctx: ActionCtx): Promise<Facts | null> {
  if (ctx.recordId) {
    const r = await recordFacts(ctx.orgId, ctx.recordId);
    return r ? r.facts : null;
  }
  if (ctx.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: ctx.leadId, orgId: ctx.orgId }, select: { status: true, company: true, industry: true, country: true, city: true, title: true, score: true, email: true, firstName: true, lastName: true } });
    return lead ? leadFacts(lead) : null;
  }
  return null;
}

// ─── Mutating executors (в транзакции движка) ─────────────────────────────────

async function resolveObject(tx: Tx, orgId: string, objectKey: string): Promise<{ id: string }> {
  const obj = await tx.object.findFirst({ where: { orgId, key: objectKey, archivedAt: null }, select: { id: true } });
  if (!obj) throw new Error(`Object not found: ${objectKey}`);
  return obj;
}

function subjectRecordId(ctx: ActionCtx, config: Record<string, unknown>): string {
  const id = (config.recordId as string | undefined) ?? ctx.recordId ?? null;
  if (!id) throw new Error('No subject record for this action (set recordId or trigger on a record)');
  return id;
}

export async function execCreateRecord(tx: Tx, orgId: string, config: Record<string, unknown>): Promise<ActionResult> {
  const objectKey = config.objectKey as string;
  const values = (config.values as Record<string, unknown>) ?? {};
  const obj = await resolveObject(tx, orgId, objectKey);
  const rec = await tx.record.create({ data: { orgId, objectId: obj.id } });
  await writeValues(tx, { id: rec.id, orgId, objectId: obj.id }, values, { enforceRequired: true });
  await tx.activity.create({ data: { orgId, recordId: rec.id, type: 'RECORD_CREATED', title: 'Record created by workflow' } });
  return { summary: `created ${objectKey} record`, output: { recordId: rec.id, objectKey } };
}

export async function execUpdateRecord(tx: Tx, orgId: string, ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResult> {
  const recordId = subjectRecordId(ctx, config);
  const rec = await tx.record.findFirst({ where: { id: recordId, orgId, archivedAt: null }, select: { id: true, orgId: true, objectId: true } });
  if (!rec) throw new Error(`Record not found: ${recordId}`);
  const changed = await writeValues(tx, rec, (config.values as Record<string, unknown>) ?? {}, { valueSource: ValueSource.SYSTEM });
  await tx.activity.create({ data: { orgId, recordId: rec.id, type: 'RECORD_UPDATED', title: 'Record updated by workflow', payload: { changedAttributeIds: changed } } });
  return { summary: changed.length ? `updated ${changed.length} field(s)` : 'no change', output: { recordId: rec.id, changedAttributeIds: changed } };
}

export async function execArchiveRecord(tx: Tx, orgId: string, ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResult> {
  const recordId = subjectRecordId(ctx, config);
  const r = await tx.record.updateMany({ where: { id: recordId, orgId, archivedAt: null }, data: { archivedAt: new Date() } });
  if (r.count > 0) await tx.activity.create({ data: { orgId, recordId, type: 'RECORD_ARCHIVED', title: 'Record archived by workflow' } });
  return { summary: r.count > 0 ? 'record archived' : 'record already archived or not found', output: { recordId, archived: r.count > 0 } };
}

export async function execAddToList(tx: Tx, orgId: string, ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResult> {
  const recordId = subjectRecordId(ctx, config);
  const listId = config.listId as string;
  const list = await tx.list.findFirst({ where: { id: listId, orgId, archivedAt: null }, select: { id: true, name: true, type: true } });
  if (!list) throw new Error(`List not found: ${listId}`);
  // LST-1: членство DYNAMIC-списка вычисляется из правила — авто-добавление ListEntry запрещено
  // (иначе нарушится инвариант «0 ListEntry у DYNAMIC»; движок членства — единственный источник).
  if (list.type === 'DYNAMIC') throw new Error(`Cannot add records to dynamic list "${list.name}": membership is computed from its rule`);
  const rec = await tx.record.findFirst({ where: { id: recordId, orgId }, select: { id: true } });
  if (!rec) throw new Error(`Record not found: ${recordId}`);
  const existing = await tx.listEntry.findUnique({ where: { listId_recordId: { listId, recordId } }, select: { id: true, archivedAt: true } });
  let entryId: string;
  let added = false;
  if (existing) {
    entryId = existing.id;
    if (existing.archivedAt) { await tx.listEntry.update({ where: { id: existing.id }, data: { archivedAt: null } }); added = true; }
  } else {
    const e = await tx.listEntry.create({ data: { orgId, listId, recordId } });
    entryId = e.id; added = true;
  }
  if (added) await tx.activity.create({ data: { orgId, recordId, type: 'RECORD_ADDED_TO_LIST', title: `Added to list ${list.name} by workflow`, payload: { listId: list.id } } });
  return { summary: added ? `added to list ${list.name}` : `already in list ${list.name}`, output: { entryId, listId, recordId, added } };
}

export async function execRemoveFromList(tx: Tx, orgId: string, ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResult> {
  const recordId = subjectRecordId(ctx, config);
  const listId = config.listId as string;
  const list = await tx.list.findFirst({ where: { id: listId, orgId }, select: { id: true, name: true } });
  if (!list) throw new Error(`List not found: ${listId}`);
  const entry = await tx.listEntry.findUnique({ where: { listId_recordId: { listId, recordId } }, select: { id: true, archivedAt: true } });
  let removed = false;
  if (entry && !entry.archivedAt) {
    await tx.listEntry.update({ where: { id: entry.id }, data: { archivedAt: new Date() } });
    await tx.activity.create({ data: { orgId, recordId, type: 'RECORD_REMOVED_FROM_LIST', title: `Removed from list ${list.name} by workflow`, payload: { listId: list.id } } });
    removed = true;
  }
  return { summary: removed ? `removed from list ${list.name}` : `not in list ${list.name}`, output: { entryId: entry?.id ?? null, listId, recordId, removed } };
}

export async function execUpdateListEntry(tx: Tx, orgId: string, ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResult> {
  const recordId = subjectRecordId(ctx, config);
  const listId = config.listId as string;
  const stage = config.stage as string;
  const entry = await tx.listEntry.findUnique({ where: { listId_recordId: { listId, recordId } }, select: { id: true, stage: true, orgId: true } });
  if (!entry || entry.orgId !== orgId) throw new Error(`List entry not found for record ${recordId} in list ${listId}`);
  const before = entry.stage;
  await tx.listEntry.update({ where: { id: entry.id }, data: { stage } });
  await tx.activity.create({ data: { orgId, recordId, type: 'LIST_STAGE_CHANGED', title: `Stage ${before ?? '—'} → ${stage} by workflow`, payload: { listId } } });
  return { summary: `stage ${before ?? '—'} → ${stage}`, output: { entryId: entry.id, listId, recordId, stageBefore: before, stageAfter: stage } };
}

export async function execRoundRobin(tx: Tx, orgId: string, ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResult> {
  const recordId = subjectRecordId(ctx, config);
  const rec = await tx.record.findFirst({ where: { id: recordId, orgId, archivedAt: null }, select: { id: true, orgId: true, objectId: true } });
  if (!rec) throw new Error(`Record not found: ${recordId}`);

  // USER-атрибут: по ключу из config или авто-детект первого USER-атрибута объекта.
  const userAttr = config.attributeKey
    ? await tx.attribute.findFirst({ where: { orgId, objectId: rec.objectId, key: config.attributeKey as string, type: AttributeType.USER, archivedAt: null }, select: { id: true, key: true } })
    : await tx.attribute.findFirst({ where: { orgId, objectId: rec.objectId, type: AttributeType.USER, archivedAt: null }, orderBy: { order: 'asc' }, select: { id: true, key: true } });
  if (!userAttr) throw new Error(config.attributeKey ? `USER attribute not found: ${String(config.attributeKey)}` : 'No USER attribute on this object to assign');

  // Пул: явный poolUserIds (валидируем org+active) или активные пользователи org.
  let pool: { id: string }[];
  if (Array.isArray(config.poolUserIds) && config.poolUserIds.length > 0) {
    const ids = [...new Set(config.poolUserIds as string[])]; // дедуп — дубль в config не должен ложно «выкидывать»
    pool = await tx.user.findMany({ where: { id: { in: ids }, orgId, isActive: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
    if (pool.length !== ids.length) throw new Error('poolUserIds contains users not in this org or not active');
  } else {
    pool = await tx.user.findMany({ where: { orgId, isActive: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
  }
  if (pool.length === 0) throw new Error('No active users in the assignment pool');

  // Справедливо: пользователь с наименьшим числом текущих назначений по этому атрибуту; стабильный tie-break.
  const counts = await tx.value.groupBy({ by: ['userValueId'], where: { orgId, attributeId: userAttr.id, userValueId: { in: pool.map((u) => u.id) } }, _count: { _all: true } });
  const countByUser = new Map(counts.map((c) => [c.userValueId as string, c._count._all]));
  let chosen = pool[0].id;
  let min = Number.POSITIVE_INFINITY;
  for (const u of pool) {
    const c = countByUser.get(u.id) ?? 0;
    if (c < min) { min = c; chosen = u.id; }
  }

  const beforeVal = await tx.value.findUnique({ where: { recordId_attributeId: { recordId, attributeId: userAttr.id } }, select: { userValueId: true } });
  await writeValues(tx, rec, { [userAttr.key]: chosen }, { valueSource: ValueSource.SYSTEM });
  await tx.activity.create({ data: { orgId, recordId, type: 'VALUE_UPDATED', title: `Round-robin assigned → ${chosen}`, payload: { attribute: userAttr.key, before: beforeVal?.userValueId ?? null, after: chosen } } });
  return { summary: `round-robin → user ${chosen}`, output: { attributeKey: userAttr.key, assignedUserId: chosen, previousUserId: beforeVal?.userValueId ?? null, poolSize: pool.length } };
}

// ─── Read-only: FIND_RECORDS ──────────────────────────────────────────────────

export interface FindResult { result: ActionResult; firstRecordId: string | null }

export async function execFindRecords(orgId: string, config: Record<string, unknown>): Promise<FindResult> {
  const objectKey = config.objectKey as string;
  const conditions = (config.conditions as Condition[] | undefined) ?? [];
  const match = (config.match as 'all' | 'any' | undefined) ?? 'all';
  const limit = Math.min(Math.max((config.limit as number | undefined) ?? 10, 1), 100);

  const obj = await prisma.object.findFirst({ where: { orgId, key: objectKey, archivedAt: null }, select: { id: true } });
  if (!obj) throw new Error(`Object not found: ${objectKey}`);
  const attrs = await prisma.attribute.findMany({ where: { orgId, objectId: obj.id, archivedAt: null }, select: { id: true, key: true, type: true } });
  const byId = new Map(attrs.map((a) => [a.id, a]));

  const records = await prisma.record.findMany({ where: { orgId, objectId: obj.id, archivedAt: null }, select: { id: true, values: true }, orderBy: { createdAt: 'asc' } });
  const matchedIds: string[] = [];
  for (const r of records) {
    const facts: Facts = {};
    for (const v of r.values) { const a = byId.get(v.attributeId); if (a) facts[a.key] = valueRowToJs(a.type, v); }
    if (evalConditions(facts, conditions, match).matched) matchedIds.push(r.id);
    if (matchedIds.length >= limit) break;
  }
  const firstRecordId = matchedIds[0] ?? null;
  const assignFirst = config.assignFirstToSubject === true;
  return {
    result: { summary: `found ${matchedIds.length} record(s) in ${objectKey}`, output: { count: matchedIds.length, recordIds: matchedIds, firstRecordId, assignedFirstToSubject: assignFirst && !!firstRecordId } },
    firstRecordId: assignFirst ? firstRecordId : null,
  };
}

// ─── DELAY: вычисление resumeAt ────────────────────────────────────────────────

export function computeResumeAt(type: string, config: Record<string, unknown>, now: Date): Date {
  if (type === 'DELAY_UNTIL') {
    const at = Date.parse(String(config.at));
    return new Date(at);
  }
  const minutes = (config.minutes as number | undefined) ?? 0;
  const hours = (config.hours as number | undefined) ?? 0;
  const days = (config.days as number | undefined) ?? 0;
  return new Date(now.getTime() + ((minutes + hours * 60 + days * 1440) * 60_000));
}

// ─── M17-4 workflow-context + template resolver ───────────────────────────────

export interface ResolveCtx { steps: Record<number, unknown>; vars: Record<string, unknown>; secrets: Map<string, string> }

// Резолв одного токена {{ns.path}} в значение. found=false → переменная не найдена (fail-safe вызывающего).
export function lookupPath(ctx: ResolveCtx, token: string): { val: unknown; secret: boolean; found: boolean } {
  const parts = token.split('.').filter(Boolean);
  const ns = parts[0];
  if (ns === 'secret' || ns === 'secrets') { const name = parts.slice(1).join('.'); const v = ctx.secrets.get(name); return { val: v, secret: true, found: v !== undefined }; }
  let cur: unknown;
  let rest: string[];
  if (ns === 'steps') { cur = ctx.steps[Number(parts[1])]; rest = parts.slice(2); }
  else if (ns === 'var' || ns === 'vars') { cur = ctx.vars; rest = parts.slice(1); }
  else return { val: undefined, secret: false, found: false };
  for (const seg of rest) {
    if (cur == null || typeof cur !== 'object') { return { val: undefined, secret: false, found: false }; }
    cur = (cur as Record<string, unknown>)[seg];
  }
  return { val: cur, secret: false, found: cur !== undefined };
}

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
const EXACT_RE = /^\{\{\s*([A-Za-z0-9_.]+)\s*\}\}$/;

function resolveString(s: string, ctx: ResolveCtx, missing: string[]): { resolved: unknown; sanitized: unknown } {
  if (!s.includes('{{')) return { resolved: s, sanitized: s };
  const exact = s.trim().match(EXACT_RE);
  if (exact) {
    const { val, secret, found } = lookupPath(ctx, exact[1]);
    if (!found) { missing.push(exact[1]); return { resolved: s, sanitized: s }; }
    return { resolved: val, sanitized: secret ? '****' : val };
  }
  // Интерполяция: один global-проход с функцией-заменителем — заменяет ВСЕ вхождения и вставляет значение
  // ЛИТЕРАЛЬНО (никаких $-спецпоследовательностей replace → секреты с '$' не искажаются; маскирование полное).
  const repl = (mask: boolean, collect: boolean) => (full: string, token: string): string => {
    const { val, secret, found } = lookupPath(ctx, token);
    if (!found) { if (collect) missing.push(token); return full; }
    if (mask && secret) return '****';
    return typeof val === 'string' ? val : JSON.stringify(val);
  };
  const resolved = s.replace(TOKEN_RE, repl(false, true));
  const sanitized = s.replace(TOKEN_RE, repl(true, false));
  return { resolved, sanitized };
}

/** Рекурсивно резолвит {{steps.N.path}}/{{var.x}}/{{secret.NAME}} в config. resolved — для исполнения,
 *  sanitized — для логов (секреты → ****), missing — не найденные токены (вызывающий → step FAILED). */
export function resolveTemplates(config: unknown, ctx: ResolveCtx): { resolved: unknown; sanitized: unknown; missing: string[] } {
  const missing: string[] = [];
  function walk(v: unknown): { r: unknown; s: unknown } {
    if (typeof v === 'string') { const x = resolveString(v, ctx, missing); return { r: x.resolved, s: x.sanitized }; }
    if (Array.isArray(v)) { const r: unknown[] = []; const s: unknown[] = []; for (const it of v) { const w = walk(it); r.push(w.r); s.push(w.s); } return { r, s }; }
    if (v && typeof v === 'object') { const r: Record<string, unknown> = {}; const s: Record<string, unknown> = {}; for (const [k, val] of Object.entries(v)) { const w = walk(val); r[k] = w.r; s[k] = w.s; } return { r, s }; }
    return { r: v, s: v };
  }
  const w = walk(config);
  return { resolved: w.r, sanitized: w.s, missing: [...new Set(missing)] };
}

/** TRANSFORM: извлекает поля из context (steps/vars) в ctx.vars. missing required → вызывающий FAILED. */
export function runTransform(config: Record<string, unknown>, ctx: ResolveCtx): { result: ActionResult; extracted: Record<string, unknown>; missing: string[] } {
  const extracts = (config.extract as { as: string; path: string; required?: boolean }[]) ?? [];
  const extracted: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const e of extracts) {
    const { val, found } = lookupPath(ctx, e.path);
    if (!found) { if (e.required !== false) missing.push(e.path); }
    else extracted[e.as] = val;
  }
  return { result: { summary: `extracted ${Object.keys(extracted).length} field(s)`, output: { extracted, missing } }, extracted, missing };
}

// ─── M17-4 AI-блоки ────────────────────────────────────────────────────────────

const AI_BLOCK_COST: Record<string, number> = { AI_CLASSIFY: 1, AI_SUMMARIZE: 1, AI_PROMPT: 1, AI_RESEARCH: 10 };

async function callAiLlm(type: string, config: Record<string, unknown>): Promise<{ result: string; model: string }> {
  const input = String(config.input ?? '');
  if (!llmAvailable()) {
    // deterministic demo (без ключа) — как в M2/M9.
    const demo = type === 'AI_CLASSIFY' ? ((config.categories as string[])?.[0] ?? 'uncategorized')
      : type === 'AI_SUMMARIZE' ? `Summary: ${input.slice(0, 140)}`
      : type === 'AI_RESEARCH' ? `Research notes for: ${input.slice(0, 100)}`
      : `Result: ${(String(config.prompt ?? '') + ' ' + input).trim().slice(0, 140)}`;
    return { result: demo, model: 'demo' };
  }
  const system = type === 'AI_CLASSIFY' ? `Classify the input into exactly one of: ${(config.categories as string[] ?? []).join(', ')}. Reply with ONLY the category label.`
    : type === 'AI_SUMMARIZE' ? 'Summarize the input concisely in 1-2 sentences.'
    : type === 'AI_RESEARCH' ? 'Research the subject and report concise factual findings.'
    : String(config.prompt ?? 'Respond helpfully.');
  const prompt = type === 'AI_PROMPT' ? `${config.prompt ?? ''}\n\n${input}`.trim() : (input || String(config.prompt ?? ''));
  const result = (await llmComplete({ system, prompt, maxTokens: type === 'AI_RESEARCH' ? 800 : 300, temperature: 0.3 })).trim();
  return { result, model: 'deepseek' };
}

/** AI-блок: guard (M16) ДО LLM → LLM → idempotent debit(wf-ai:<runId>:<order>) → опц. запись в атрибут субъекта.
 *  writeFailed=true (LLM ок, запись упала) → вызывающий помечает шаг FAILED с честным output. */
export async function runAiBlock(orgId: string, ctx: ActionCtx, type: string, config: Record<string, unknown>, runId: string, order: number): Promise<ActionResult & { writeFailed?: boolean }> {
  const cost = AI_BLOCK_COST[type] ?? 1;
  const targetAttributeKey = (config.targetAttributeKey as string | undefined) ?? null;
  // адверс-ревью #1 (S352): AI-блок пишет атрибут записи → тоже требует OBJECT automation-грант воркфлоу.
  // Проверяем ДО списания кредитов: нет гранта → PERMISSION_DENIED (step FAILED, кредиты не списаны).
  if (targetAttributeKey && ctx.recordId && ctx.workflowId) {
    const rec = await prisma.record.findFirst({ where: { id: ctx.recordId, orgId }, select: { objectId: true } });
    const have = await automationAccess(orgId, ctx.workflowId, 'OBJECT', rec?.objectId ?? ctx.objectId ?? null);
    if (!meets(have, 'READ_WRITE')) throw new Error(`PERMISSION_DENIED: workflow has no OBJECT automation grant to write "${targetAttributeKey}" (have ${have}). Grant it in Settings → Permissions → Automations.`);
  }
  await assertCredits(orgId, cost, 'WORKFLOW_AI'); // нет кредитов → InsufficientCreditsError ДО LLM
  const { result, model } = await callAiLlm(type, config); // ошибка LLM → throw, кредиты не списаны
  await debitCredits({ orgId, amount: cost, source: 'WORKFLOW_AI', idempotencyKey: `wf-ai:${runId}:${order}`, reason: `workflow ${type}`, metadata: { workflowRunId: runId, stepOrder: order, aiBlockType: type, targetAttributeKey } });

  let writeFailed = false;
  if (targetAttributeKey && ctx.recordId) {
    try {
      await prisma.$transaction(async (tx) => {
        const rec = await tx.record.findFirst({ where: { id: ctx.recordId!, orgId, archivedAt: null }, select: { id: true, orgId: true, objectId: true } });
        if (!rec) throw new Error(`subject record not found: ${ctx.recordId}`);
        // M29-1: вывод workflow-AI — машинное происхождение (SYSTEM), НЕ маскируется под ручное и не создаёт ложную manual-защиту.
        await writeValues(tx, rec, { [targetAttributeKey]: result }, { valueSource: ValueSource.SYSTEM });
        await tx.activity.create({ data: { orgId, recordId: rec.id, type: 'AI_VALUE_APPROVED', title: `Workflow AI (${type}) → ${targetAttributeKey}` } });
      });
    } catch { writeFailed = true; }
  }
  return { summary: `${type.replace('AI_', 'AI ').toLowerCase()} → ${String(result).slice(0, 60)}`, output: { result, creditsCharged: cost, source: 'WORKFLOW_AI', model, targetAttributeKey, writeFailed }, writeFailed };
}

// ─── M17-4 HTTP-блок ─────────────────────────────────────────────────────────

const HTTP_BODY_CAP = 32 * 1024;
const SAFE_METHODS = new Set(['GET', 'HEAD']);

function isPrivateV4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true; // не каноничный dotted-quad → блокируем на всякий случай
  const a = Number(m[1]); const b = Number(m[2]);
  return a === 127 || a === 0 || a === 10 || a >= 224 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}
function isPrivateAddr(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true; // link-local / unique-local
    const mapped = v.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateV4(mapped[1]);
    return false;
  }
  return isPrivateV4(ip);
}

/** SSRF-guard ПОСЛЕ резолва шаблонов/секретов: http/https only, без userinfo; РЕЗОЛВ хоста через DNS и проверка
 *  КАЖДОГО адреса (ловит hostname→internal, octal/hex/dword IPv4, IPv4-mapped IPv6). Блок loopback/private/
 *  link-local/metadata. Редиректы запрещены в runHttpRequest (redirect:'manual'). */
export async function ssrfGuard(rawUrl: string): Promise<void> {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Blocked URL scheme: ${u.protocol}`);
  if (u.username || u.password) throw new Error('Blocked URL with embedded credentials');
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Blocked host (localhost/internal)');
  let addrs: { address: string }[];
  try { addrs = await dnsLookup(host, { all: true }); } catch { throw new Error('DNS resolution failed for host'); }
  for (const a of addrs) { if (isPrivateAddr(a.address)) throw new Error('Blocked private/loopback/link-local/metadata address'); }
}

function pickRespHeaders(h: Headers): Record<string, string> {
  const allow = ['content-type', 'content-length', 'date', 'server', 'x-request-id', 'x-ratelimit-remaining'];
  const out: Record<string, string> = {};
  for (const k of allow) { const v = h.get(k); if (v) out[k] = v; }
  return out;
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HTTP_REQUEST (config УЖЕ с резолв-секретами). Output НЕ содержит request-заголовки (там секреты).
 *  SSRF-guard, timeout, retry (GET/HEAD или retryEnabled), redirects=0, body cap 32KB. */
export async function runHttpRequest(config: Record<string, unknown>): Promise<ActionResult> {
  const method = String(config.method ?? 'GET').toUpperCase();
  const url = String(config.url ?? '');
  await ssrfGuard(url);
  const timeoutMs = Math.min(Math.max(Number(config.timeoutMs ?? 10000), 1), 30000);
  const headers = (config.headers as Record<string, string>) ?? {};
  const rawBody = config.body;
  const safe = SAFE_METHODS.has(method);
  const canRetry = safe || config.retryEnabled === true;
  const maxAttempts = canRetry ? 3 : 1;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method, headers,
        body: rawBody != null && !safe ? (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)) : undefined,
        redirect: 'manual', signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.status >= 300 && resp.status < 400) throw new Error(`Redirect not allowed (status ${resp.status})`);
      const transient = resp.status >= 500 || resp.status === 429;
      if (transient && attempt < maxAttempts && canRetry) { await sleep(300 * attempt); continue; }
      const text = await resp.text();
      const truncated = text.length > HTTP_BODY_CAP;
      const raw = truncated ? text.slice(0, HTTP_BODY_CAP) : text;
      let body: unknown = raw;
      if ((config.parseJson ?? true) && !truncated) { try { body = JSON.parse(text); } catch { /* не JSON — отдаём текст */ } }
      return { summary: `HTTP ${method} → ${resp.status}`, output: { status: resp.status, ok: resp.ok, body, truncated, headers: pickRespHeaders(resp.headers) } };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      const transientNet = (e as Error)?.name === 'AbortError' || /network|econn|fetch failed|timeout|socket/i.test(msg);
      if (transientNet && attempt < maxAttempts && canRetry) { await sleep(300 * attempt); continue; }
      throw e instanceof Error ? e : new Error(msg);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('HTTP request failed');
}

// ─── M17-4 интеграции (sequence / notification) ───────────────────────────────

/** ENROLL_SEQUENCE / UNENROLL_SEQUENCE через shared M11-сервис (НЕ пишем CampaignLead напрямую). */
export async function runSequenceBlock(orgId: string, ctx: ActionCtx, type: string, config: Record<string, unknown>): Promise<ActionResult> {
  if (!ctx.leadId) throw new Error('No lead in context — sequence actions require a lead subject');
  const campaignId = config.campaignId as string;
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId }, select: { id: true, name: true, status: true } });
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  if (type === 'ENROLL_SEQUENCE') {
    const r = await enrollLeadInCampaign({ orgId, leadId: ctx.leadId, actorId: null, campaign });
    return { summary: r.ok ? `enrolled in ${campaign.name}` : `enroll skipped (${r.reason})`, output: { campaignId, ...r } };
  }
  const r = await unenrollLeadFromCampaign({ orgId, leadId: ctx.leadId, actorId: null, campaign: { id: campaign.id, name: campaign.name } });
  return { summary: r.ok ? `unenrolled from ${campaign.name}` : `unenroll skipped (${r.reason})`, output: { campaignId, ...r } };
}

/** SEND_NOTIFICATION — внутреннее уведомление, идемпотентно по dedupeKey (retry не дублирует). */
export async function runSendNotification(orgId: string, ctx: ActionCtx, config: Record<string, unknown>, dedupeKey: string): Promise<ActionResult> {
  await notify({
    orgId, source: 'WORKFLOW', title: String(config.title ?? 'Workflow notification'), body: config.body ? String(config.body) : undefined,
    leadId: ctx.leadId ?? undefined, entityType: ctx.leadId ? 'lead' : 'record', entityId: ctx.leadId ?? ctx.recordId ?? undefined, dedupeKey,
  });
  return { summary: 'notification sent', output: { notified: true, title: String(config.title ?? '') } };
}
