/**
 * Import / Migration — движок import-JOB (M20-1, S330–S338).
 *
 * КЛЮЧЕВОЕ: ЕДИНЫЙ planImportRows(job) — preview читает план БЕЗ мутаций, confirm применяет ТОТ ЖЕ план.
 * Никаких двух реализаций. План = per-row {action: create|update|skip|error, values, relationship, errors, warnings}.
 * executeImport применяет план через writeValues (единая CRM-истина) + пишет журнал created/updated (typed snapshot)
 * для честного rollback (M20-2). Required-валидация от Attribute.isRequired + стратегия; relationship резолвится
 * в org+target-object (multiple → row error, не first-match). Raw rows валидируются заново (caps/headers).
 */

import { ActivityType, AttributeType, ImportStatus, ImportTargetType, Prisma, PrismaClient, ValueSource } from '@prisma/client';
import { recordSerializationInclude, serializeRecord, writeValues } from './crm/values';
import { audit } from './audit';

const prisma = new PrismaClient();

export const MAX_IMPORT_ROWS = 5000;
export const MAX_CELL_LEN = 10000;
export const MAX_TOTAL_CELLS = 300000;

export class ImportError extends Error {
  statusCode: number;
  code: string;
  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type RequiredStrategy = 'error' | 'skip';
export type MappingEntry = { attributeKey: string; asRelationship?: boolean; requiredStrategy?: RequiredStrategy };
// Дедуп допустим только по unique scalar-атрибуту (не relationship/multiselect/json — их сериализация не даёт стабильный ключ).
const DEDUPE_OK_TYPES = new Set<AttributeType>([AttributeType.TEXT, AttributeType.EMAIL, AttributeType.URL, AttributeType.PHONE, AttributeType.NUMBER, AttributeType.CURRENCY, AttributeType.SELECT, AttributeType.LONG_TEXT]);
export type ImportMapping = { [csvColumn: string]: MappingEntry };

export type RowAction = 'create' | 'update' | 'skip' | 'error';
export type RowPlan = {
  row: number; // 1-based
  action: RowAction;
  recordId: string | null; // существующая запись для update
  values: Record<string, unknown>;
  errors: string[];
  warnings: string[];
};
export type ImportPlan = {
  rows: RowPlan[];
  estimate: { created: number; updated: number; skipped: number; errors: number };
  detectedTypes: Record<string, string>;
  warnings: string[];
};

// ── Валидация сырых строк (caps/headers/malformed) ──
export function validateRawRows(headers: unknown, rows: unknown): { headers: string[]; rows: Record<string, string>[] } {
  if (!Array.isArray(headers) || headers.length === 0) throw new ImportError('NO_HEADERS', 'CSV has no header row');
  const cols = headers.map((h) => String(h ?? '').trim());
  if (cols.some((h) => !h)) throw new ImportError('EMPTY_HEADER', 'CSV has an empty column header');
  const seen = new Set<string>();
  for (const h of cols) { const k = h.toLowerCase(); if (seen.has(k)) throw new ImportError('DUPLICATE_HEADER', `Duplicate column header "${h}"`); seen.add(k); }
  if (!Array.isArray(rows)) throw new ImportError('NO_ROWS', 'CSV has no rows');
  if (rows.length > MAX_IMPORT_ROWS) throw new ImportError('IMPORT_FILE_TOO_LARGE', `Too many rows (${rows.length} > ${MAX_IMPORT_ROWS})`, 413);
  if (rows.length * cols.length > MAX_TOTAL_CELLS) throw new ImportError('IMPORT_FILE_TOO_LARGE', 'Too many cells in file', 413);

  const out: Record<string, string>[] = [];
  for (const r of rows) {
    const obj: Record<string, string> = {};
    if (Array.isArray(r)) {
      for (let i = 0; i < cols.length; i++) { const v = String(r[i] ?? ''); if (v.length > MAX_CELL_LEN) throw new ImportError('CELL_TOO_LONG', `A cell exceeds ${MAX_CELL_LEN} characters`, 413); obj[cols[i]] = v; }
    } else if (r && typeof r === 'object') {
      for (const c of cols) { const v = String((r as Record<string, unknown>)[c] ?? ''); if (v.length > MAX_CELL_LEN) throw new ImportError('CELL_TOO_LONG', `A cell exceeds ${MAX_CELL_LEN} characters`, 413); obj[c] = v; }
    } else {
      throw new ImportError('MALFORMED_ROW', 'A row is not an array or object');
    }
    out.push(obj);
  }
  return { headers: cols, rows: out };
}

// ── Авто-маппинг по нормализованному имени/типу ──
const ALIASES: Record<string, string[]> = {
  name: ['name', 'company', 'company name', 'full name', 'title'],
  email: ['email', 'e-mail', 'email address', 'work email'],
  domain: ['domain', 'website', 'url', 'site'],
  value: ['value', 'amount', 'deal value', 'arr'],
  stage: ['stage', 'status'],
};
function norm(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
export function autoMap(headers: string[], attributes: { key: string; type: AttributeType }[]): ImportMapping {
  const mapping: ImportMapping = {};
  const attrByNorm = new Map(attributes.map((a) => [norm(a.key), a.key]));
  for (const h of headers) {
    const hn = norm(h);
    let attrKey = attrByNorm.get(hn);
    if (!attrKey) for (const a of attributes) { const al = ALIASES[a.key]; if (al && al.some((x) => norm(x) === hn)) { attrKey = a.key; break; } }
    if (attrKey) mapping[h] = { attributeKey: attrKey };
  }
  return mapping;
}

// ── Detected type на колонку (по сэмплу) ──
export function detectTypes(headers: string[], rows: Record<string, string>[]): Record<string, string> {
  const out: Record<string, string> = {};
  const sample = rows.slice(0, 50);
  for (const h of headers) {
    const vals = sample.map((r) => (r[h] ?? '').trim()).filter(Boolean);
    if (!vals.length) { out[h] = 'text'; continue; }
    const all = (re: RegExp) => vals.every((v) => re.test(v));
    if (all(/^-?\d+(\.\d+)?$/)) out[h] = 'number';
    else if (all(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) out[h] = 'email';
    else if (all(/^(https?:\/\/|www\.)/i)) out[h] = 'url';
    else if (all(/^\$?\s?-?[\d,]+(\.\d+)?$/)) out[h] = 'currency';
    else if (all(/^\d{4}-\d{2}-\d{2}/) || all(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) out[h] = 'date';
    else out[h] = 'text';
  }
  return out;
}

// ── Коэрция значения CSV под тип атрибута ──
function coerce(type: AttributeType | undefined, raw: string): unknown {
  const v = raw.trim();
  if (!v) return undefined;
  if (type === AttributeType.URL && !/^https?:\/\//i.test(v)) return 'https://' + v;
  if (type === AttributeType.NUMBER) { const n = Number(v.replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : undefined; }
  if (type === AttributeType.CURRENCY) { const n = Number(v.replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? { amount: n, currencyCode: 'USD' } : undefined; }
  if (type === AttributeType.BOOLEAN) return /^(true|yes|1|да|y)$/i.test(v);
  return v;
}

export function normalizeDedupe(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') { const o = v as Record<string, unknown>; return String(o.value ?? o.label ?? o.id ?? o.amount ?? JSON.stringify(o)).trim().toLowerCase(); }
  return String(v).trim().toLowerCase();
}

type AttrInfo = { key: string; type: AttributeType; isRequired: boolean; isUnique: boolean };
type JobForPlan = {
  orgId: string; objectId: string | null; headers: string[]; rows: Record<string, string>[];
  mapping: ImportMapping; dedupeKey: string | null;
};

// ── ЕДИНЫЙ ПЛАНИРОВЩИК (preview == confirm) ──
export async function planImportRows(job: JobForPlan): Promise<{ plan: ImportPlan; attrs: Map<string, AttrInfo> }> {
  if (!job.objectId) throw new ImportError('NO_TARGET', 'Import has no target object');
  const attributes = await prisma.attribute.findMany({ where: { objectId: job.objectId, isArchived: false }, select: { key: true, type: true, isRequired: true, isUnique: true } });
  const attrs = new Map<string, AttrInfo>(attributes.map((a) => [a.key, a]));
  const warnings: string[] = [];

  const mapEntries = Object.entries(job.mapping).filter(([, m]) => attrs.has(m.attributeKey));

  // required-атрибуты, которые НЕ замаплены → файл-warning (каждая строка без них будет error на required)
  const mappedAttrKeys = new Set(mapEntries.map(([, m]) => m.attributeKey));
  for (const a of attributes) if (a.isRequired && !mappedAttrKeys.has(a.key)) warnings.push(`Required attribute "${a.key}" is not mapped — rows will error on it.`);

  // dedup map существующих записей — ТОЛЬКО по unique scalar-атрибуту (адверс-ревью C1/M5)
  const dedupeAttr = job.dedupeKey ? attrs.get(job.dedupeKey) : undefined;
  const dedupeUsable = !!dedupeAttr && dedupeAttr.isUnique && DEDUPE_OK_TYPES.has(dedupeAttr.type);
  if (job.dedupeKey && !dedupeUsable) warnings.push(`Dedupe by "${job.dedupeKey}" ignored — pick a unique text/email/number attribute.`);
  const dedupeKey = dedupeUsable ? job.dedupeKey : null;
  const dedupeMap = new Map<string, string>();
  if (dedupeKey) {
    const existing = await prisma.record.findMany({ where: { orgId: job.orgId, objectId: job.objectId, archivedAt: null }, include: recordSerializationInclude });
    for (const r of existing) { const v = (serializeRecord(r).values as Record<string, unknown>)[dedupeKey]; if (v) dedupeMap.set(normalizeDedupe(v), r.id); }
  }

  // relationship-резолв: target-object по RelationshipDefinition + индекс displayName→recordId (в org)
  const relCols = mapEntries.filter(([, m]) => m.asRelationship && attrs.get(m.attributeKey)?.type === AttributeType.RELATIONSHIP);
  const relTargetIndex = new Map<string, Map<string, string[]>>(); // attrKey → (normName → recordIds[])
  for (const [, m] of relCols) {
    const def = await prisma.relationshipDefinition.findFirst({ where: { orgId: job.orgId, sourceAttribute: { key: m.attributeKey, objectId: job.objectId } }, select: { targetObjectId: true } });
    if (!def) { warnings.push(`Relationship target for "${m.attributeKey}" not found.`); continue; }
    const targets = await prisma.record.findMany({ where: { orgId: job.orgId, objectId: def.targetObjectId, archivedAt: null }, select: { id: true, displayName: true } });
    const idx = new Map<string, string[]>();
    for (const t of targets) { const k = (t.displayName ?? '').trim().toLowerCase(); if (!k) continue; idx.set(k, [...(idx.get(k) ?? []), t.id]); }
    relTargetIndex.set(m.attributeKey, idx);
  }

  const localDedupe = new Map<string, number>(); // дубли ВНУТРИ файла
  const rows: RowPlan[] = job.rows.map((row, i) => {
    const rp: RowPlan = { row: i + 1, action: 'skip', recordId: null, values: {}, errors: [], warnings: [] };
    if (mapEntries.length === 0) { rp.errors.push('No valid column mapping'); rp.action = 'error'; return rp; }

    for (const [col, m] of mapEntries) {
      const attr = attrs.get(m.attributeKey)!;
      const rawV = (row[col] ?? '').trim();
      if (attr.type === AttributeType.RELATIONSHIP) {
        // адверс-ревью M2: relationship импортируем ТОЛЬКО как link (резолв по имени), иначе НЕ коэрсим имя в id
        if (!m.asRelationship) { if (rawV) rp.warnings.push(`Column "${col}" → relationship "${m.attributeKey}": enable "link" to import it`); continue; }
        if (!rawV) continue;
        const idx = relTargetIndex.get(m.attributeKey);
        const hits = idx?.get(rawV.toLowerCase()) ?? [];
        if (hits.length === 1) rp.values[m.attributeKey] = hits[0];
        else if (hits.length === 0) rp.warnings.push(`No "${m.attributeKey}" match for "${rawV}" — left unlinked`);
        else { rp.errors.push(`Ambiguous "${m.attributeKey}" match for "${rawV}" (${hits.length} records)`); }
        continue;
      }
      const coerced = coerce(attr.type, rawV);
      if (coerced !== undefined) rp.values[m.attributeKey] = coerced;
    }

    // required-валидация (от Attribute.isRequired + strategy)
    for (const [, m] of mapEntries) {
      const attr = attrs.get(m.attributeKey)!;
      if (!attr.isRequired) continue;
      const has = rp.values[m.attributeKey] !== undefined && rp.values[m.attributeKey] !== '';
      if (!has) {
        const strat = m.requiredStrategy ?? 'error';
        if (strat === 'error') rp.errors.push(`Required "${m.attributeKey}" is empty`);
        else if (strat === 'skip') { rp.action = 'skip'; rp.warnings.push(`Skipped — required "${m.attributeKey}" empty`); }
      }
    }
    // required-атрибуты вне маппинга → error (нельзя создать валидную запись)
    for (const a of attributes) if (a.isRequired && !mappedAttrKeys.has(a.key)) rp.errors.push(`Required "${a.key}" not mapped`);

    if (rp.errors.length) { rp.action = 'error'; return rp; }
    if (Object.keys(rp.values).length === 0) { rp.action = 'skip'; if (!rp.warnings.length) rp.warnings.push('No values to import'); return rp; }
    if (rp.action === 'skip' && rp.warnings.some((w) => /required.*empty/i.test(w))) return rp; // skip по стратегии

    // dedup: существующая запись (в файле или БД) → update
    if (dedupeKey) {
      const dv = rp.values[dedupeKey];
      const norm = dv != null ? normalizeDedupe(dv) : '';
      if (norm) {
        const existingId = dedupeMap.get(norm);
        if (existingId) { rp.action = 'update'; rp.recordId = existingId; return rp; }
        if (localDedupe.has(norm)) { rp.action = 'skip'; rp.warnings.push('Duplicate of an earlier row in this file'); return rp; }
        localDedupe.set(norm, i);
      }
    }
    rp.action = 'create';
    return rp;
  });

  const estimate = { created: 0, updated: 0, skipped: 0, errors: 0 };
  for (const r of rows) { if (r.action === 'create') estimate.created++; else if (r.action === 'update') estimate.updated++; else if (r.action === 'error') estimate.errors++; else estimate.skipped++; }

  return { plan: { rows, estimate, detectedTypes: detectTypes(job.headers, job.rows), warnings }, attrs };
}

// ── ИСПОЛНЕНИЕ ИМПОРТА (применяет ТОТ ЖЕ план) + журнал created/updated ──
export type RowResult = { row: number; action: RowAction; recordId?: string | null; errors?: string[]; warnings?: string[] };

/**
 * List-импорт (S335/S336): добавить запись в список. Коллизия ListEntry @@unique([listId,recordId]):
 * запись уже в списке → updateExisting (no-op, дубль НЕ создаём); иначе создаём entry + журнал ImportCreatedListEntry.
 * Возвращает 'created' | 'exists'. Вне per-row tx — P2002 (гонка) не абортит чужую транзакцию.
 */
async function ensureListEntry(orgId: string, listId: string, recordId: string, jobId: string, userId: string): Promise<'created' | 'exists'> {
  const existing = await prisma.listEntry.findFirst({ where: { orgId, listId, recordId }, select: { id: true } });
  if (existing) return 'exists';
  try {
    // адверс-ревью #7: entry + журнал в ОДНОЙ транзакции — иначе сбой между ними оставит
    // ListEntry без журнальной записи (rollback его не удалит = orphan).
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.listEntry.create({ data: { orgId, listId, recordId, addedById: userId } });
      await tx.importCreatedListEntry.create({ data: { orgId, importJobId: jobId, listEntryId: entry.id, recordId } });
      return 'created' as const;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'exists'; // гонка: уже добавлена
    throw e;
  }
}

export async function executeImport(orgId: string, jobId: string, userId: string): Promise<{ created: number; updated: number; skipped: number; errorCount: number; status: ImportStatus }> {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, orgId } });
  if (!job) throw new ImportError('IMPORT_NOT_FOUND', 'Import not found', 404);
  if (!job.objectId) throw new ImportError('NO_TARGET', 'Import has no target object');

  const headers = (job.headers as string[]) ?? [];
  const rows = (job.rawRows as Record<string, string>[]) ?? [];
  const mapping = (job.mapping as ImportMapping) ?? {};
  const { plan, attrs } = await planImportRows({ orgId, objectId: job.objectId, headers, rows, mapping, dedupeKey: job.dedupeKey });
  // адверс-ревью M1: previousValue в журнал — в write-совместимой форме (relationship → id[], иначе сериализованное round-trips)
  const toJournalValue = (attrKey: string, v: unknown): unknown => {
    if (v == null) return null;
    if (attrs.get(attrKey)?.type === AttributeType.RELATIONSHIP) { const arr = Array.isArray(v) ? v : [v]; return arr.map((x) => (typeof x === 'object' && x ? (x as { id?: string }).id : x)).filter(Boolean); }
    return v;
  };

  let created = 0, updated = 0, skipped = 0, errorCount = 0, processed = 0;
  const rowResults: RowResult[] = [];

  for (const rp of plan.rows) {
    processed++;
    if (rp.action === 'error') { errorCount++; rowResults.push({ row: rp.row, action: 'error', errors: rp.errors }); }
    else if (rp.action === 'skip') { skipped++; rowResults.push({ row: rp.row, action: 'skip', warnings: rp.warnings }); }
    else {
      try {
        if (rp.action === 'update' && rp.recordId) {
          const rid = rp.recordId;
          const existing = await prisma.record.findFirst({ where: { id: rid, orgId }, include: recordSerializationInclude });
          const prevValues = existing ? (serializeRecord(existing).values as Record<string, unknown>) : {};
          await prisma.$transaction(async (tx) => {
            await writeValues(tx, { id: rid, orgId, objectId: job.objectId! }, rp.values, { actorId: userId, valueSource: ValueSource.IMPORT });
            await tx.record.update({ where: { id: rid }, data: { updatedById: userId } });
            // адверс-ревью #2: importedValue журналим в СЕРИАЛИЗОВАННОЙ форме (как отдаёт serializeRecord),
            // а не сырой CSV — иначе manual-edit guard на rollback сравнивает option-объект (cuid) со строкой CSV
            // и для SELECT/relationship всегда видит «ручную правку» → значение НИКОГДА не откатывается.
            const after = await tx.record.findUniqueOrThrow({ where: { id: rid }, include: recordSerializationInclude });
            const afterVals = serializeRecord(after).values as Record<string, unknown>;
            for (const attrKey of Object.keys(rp.values)) {
              const prevRaw = prevValues[attrKey];
              const had = prevRaw !== undefined && prevRaw !== null && !(Array.isArray(prevRaw) && prevRaw.length === 0) && prevRaw !== '';
              const prevForJournal = had ? toJournalValue(attrKey, prevRaw) : null;
              await tx.importUpdatedValue.create({ data: { orgId, importJobId: jobId, recordId: rid, attributeKey: attrKey, hadPreviousValue: had, previousValue: had ? (prevForJournal as Prisma.InputJsonValue) : Prisma.DbNull, importedValue: (afterVals[attrKey] ?? null) as Prisma.InputJsonValue } });
            }
          });
          if (job.targetType === ImportTargetType.LIST && job.listId) await ensureListEntry(orgId, job.listId, rid, jobId, userId);
          updated++; rowResults.push({ row: rp.row, action: 'update', recordId: rid, warnings: rp.warnings });
        } else {
          const newId = await prisma.$transaction(async (tx) => {
            const rec = await tx.record.create({ data: { orgId, objectId: job.objectId!, createdById: userId, updatedById: userId } });
            await writeValues(tx, rec, rp.values, { actorId: userId, valueSource: ValueSource.IMPORT });
            await tx.activity.create({ data: { orgId, recordId: rec.id, actorId: userId, type: ActivityType.RECORD_CREATED, title: 'Record imported (CSV)', payload: { imported: true, importJobId: jobId } as Prisma.InputJsonValue } });
            await tx.importCreatedRecord.create({ data: { orgId, importJobId: jobId, recordId: rec.id } });
            return rec.id;
          });
          if (job.targetType === ImportTargetType.LIST && job.listId) await ensureListEntry(orgId, job.listId, newId, jobId, userId);
          created++; rowResults.push({ row: rp.row, action: 'create', recordId: newId, warnings: rp.warnings });
        }
      } catch (e) {
        errorCount++; rowResults.push({ row: rp.row, action: 'error', errors: [(e instanceof Error ? e.message : 'failed').slice(0, 160)] });
      }
    }
    if (processed % 50 === 0) await prisma.importJob.update({ where: { id: jobId }, data: { processedRows: processed } }).catch(() => undefined);
  }

  const status: ImportStatus = errorCount > 0 ? ImportStatus.COMPLETED_WITH_ERRORS : ImportStatus.COMPLETED;
  await prisma.importJob.update({ where: { id: jobId }, data: { status, processedRows: plan.rows.length, createdCount: created, updatedCount: updated, skippedCount: skipped, errorCount, rowResults: rowResults as unknown as Prisma.InputJsonValue, completedAt: new Date() } });
  await audit({ orgId, actorId: userId, action: 'IMPORT_COMPLETED', targetType: 'import', targetId: jobId, summary: `${created} created · ${updated} updated · ${skipped} skipped · ${errorCount} errors` });
  return { created, updated, skipped, errorCount, status };
}

// Откат частичного импорта при FAILED (адверс-ревью C2): hard-delete созданных записей + чистка журнала,
// чтобы FAILED-job был чистым и повторный confirm не дублировал. Updated-values идемпотентны (writeValues no-op).
export async function cleanupPartialImport(orgId: string, jobId: string): Promise<void> {
  const created = await prisma.importCreatedRecord.findMany({ where: { orgId, importJobId: jobId }, select: { recordId: true } });
  for (const c of created) await prisma.record.delete({ where: { id: c.recordId } }).catch(() => undefined); // cascade values/rels/activities
  await prisma.importCreatedRecord.deleteMany({ where: { orgId, importJobId: jobId } });
  await prisma.importUpdatedValue.deleteMany({ where: { orgId, importJobId: jobId } });
  await prisma.importJob.update({ where: { id: jobId }, data: { processedRows: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, errorCount: 0, rowResults: Prisma.DbNull } }).catch(() => undefined);
}
