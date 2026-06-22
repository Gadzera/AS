/**
 * Import rollback (M20-2, S337). Откат импорта ИЗ ЖУРНАЛА M20-1 (НЕ пересчёт из CSV).
 *
 * preview: показывает affected/skipped(manual-modified)/errors ДО выполнения.
 * confirm: soft-archive созданных записей (только если не изменены вручную после импорта, иначе skip без force),
 *          восстановление обновлённых values (hadPreviousValue=false → УДАЛЕНИЕ value, не null), удаление list-entry.
 *          Manual-edit guard: текущее значение != importedValue → skip без forceModified.
 *
 * Адверс-ревью M20-2:
 *  #1 confirm атомарно «застолбляет» rolledBackAt (updateMany CAS) → параллельный/повторный откат не дублирует.
 *  #4 при errors>0 rolledBackAt сбрасывается обратно в null → откат остаётся ретраебельным (шаги идемпотентны).
 *  #5 clear required-атрибута невозможен (writeValues бросит) → такие values пропускаем без hard-error (не отравляем retry).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { recordSerializationInclude, serializeRecord, writeValues } from './crm/values';
import { audit } from './audit';
import { ImportError } from './importJob';

const prisma = new PrismaClient();

// Сравнимый токен значения (для manual-edit guard): errs safe — при сомнении считаем «изменено».
function valueToken(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(valueToken).sort().join('|');
  if (typeof v === 'object') { const o = v as Record<string, unknown>; return valueToken(o.id ?? o.value ?? o.amount ?? o.label ?? JSON.stringify(o)); }
  return String(v).trim().toLowerCase();
}

export type RollbackPreview = {
  recordsToArchive: number;
  recordsSkippedManual: number; // созданные, но изменённые вручную после импорта
  valuesToRevert: number;
  valuesSkippedManual: number; // обновлённые, но затем изменённые вручную (или required-clear невозможен)
  listEntriesToDelete: number;
  alreadyRolledBack: boolean;
  details: { type: 'create' | 'update' | 'listEntry'; recordId?: string; attributeKey?: string; action: 'archive' | 'restore' | 'delete-value' | 'delete-entry' | 'skip-manual' | 'skip-required' | 'missing' }[];
};

export type RollbackStats = { reverted: number; skippedManual: number; archived: number; valuesDeleted: number; listEntriesDeleted: number; errors: number };

async function loadJob(orgId: string, jobId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, orgId } });
  if (!job) throw new ImportError('IMPORT_NOT_FOUND', 'Import not found', 404);
  return job;
}

// Запись «materially changed после импорта» = updatedAt позже завершения job (правка после импорта).
function recordChangedAfterImport(recordUpdatedAt: Date, completedAt: Date | null): boolean {
  if (!completedAt) return false;
  return recordUpdatedAt.getTime() > completedAt.getTime() + 1500; // буфер на clock-skew
}

// набор `${objectId}:${attrKey}` required-атрибутов (clear required при откате невозможен — writeValues бросит)
async function requiredKeySet(orgId: string, objectIds: string[]): Promise<Set<string>> {
  if (!objectIds.length) return new Set();
  const attrs = await prisma.attribute.findMany({ where: { orgId, objectId: { in: objectIds }, isRequired: true, isArchived: false }, select: { objectId: true, key: true } });
  return new Set(attrs.map((a) => `${a.objectId}:${a.key}`));
}

async function loadJournal(orgId: string, jobId: string) {
  const [created, updated, listEntries] = await Promise.all([
    prisma.importCreatedRecord.findMany({ where: { orgId, importJobId: jobId } }),
    prisma.importUpdatedValue.findMany({ where: { orgId, importJobId: jobId } }),
    prisma.importCreatedListEntry.findMany({ where: { orgId, importJobId: jobId } }),
  ]);
  const recIds = [...new Set(updated.map((u) => u.recordId))];
  const recs = recIds.length ? await prisma.record.findMany({ where: { id: { in: recIds }, orgId }, include: recordSerializationInclude }) : [];
  const curValues = new Map(recs.map((r) => [r.id, serializeRecord(r).values as Record<string, unknown>]));
  const objByRec = new Map(recs.map((r) => [r.id, r.objectId]));
  const required = await requiredKeySet(orgId, [...new Set(recs.map((r) => r.objectId))]);
  return { created, updated, listEntries, curValues, objByRec, required };
}

export async function rollbackPreview(orgId: string, jobId: string, force = false): Promise<RollbackPreview> {
  const job = await loadJob(orgId, jobId);
  const pv: RollbackPreview = { recordsToArchive: 0, recordsSkippedManual: 0, valuesToRevert: 0, valuesSkippedManual: 0, listEntriesToDelete: 0, alreadyRolledBack: !!job.rolledBackAt, details: [] };
  const { created, updated, listEntries, curValues, objByRec, required } = await loadJournal(orgId, jobId);

  for (const c of created) {
    const rec = await prisma.record.findFirst({ where: { id: c.recordId, orgId }, select: { updatedAt: true, archivedAt: true } });
    if (!rec || rec.archivedAt) { pv.details.push({ type: 'create', recordId: c.recordId, action: 'missing' }); continue; }
    if (!force && recordChangedAfterImport(rec.updatedAt, job.completedAt)) { pv.recordsSkippedManual++; pv.details.push({ type: 'create', recordId: c.recordId, action: 'skip-manual' }); }
    else { pv.recordsToArchive++; pv.details.push({ type: 'create', recordId: c.recordId, action: 'archive' }); }
  }

  // обновлённые values: восстановить только если текущее == importedValue (не изменено вручную)
  for (const u of updated) {
    const objectId = objByRec.get(u.recordId);
    const cur = curValues.get(u.recordId)?.[u.attributeKey];
    const isRequired = objectId ? required.has(`${objectId}:${u.attributeKey}`) : false;
    // #5: clear required невозможен → пропускаем как skip-required (preview == confirm)
    if (!u.hadPreviousValue && isRequired) { pv.valuesSkippedManual++; pv.details.push({ type: 'update', recordId: u.recordId, attributeKey: u.attributeKey, action: 'skip-required' }); continue; }
    const unchanged = valueToken(cur) === valueToken(u.importedValue);
    if (!force && !unchanged) { pv.valuesSkippedManual++; pv.details.push({ type: 'update', recordId: u.recordId, attributeKey: u.attributeKey, action: 'skip-manual' }); }
    else { pv.valuesToRevert++; pv.details.push({ type: 'update', recordId: u.recordId, attributeKey: u.attributeKey, action: u.hadPreviousValue ? 'restore' : 'delete-value' }); }
  }

  pv.listEntriesToDelete = listEntries.length;
  for (const le of listEntries) pv.details.push({ type: 'listEntry', recordId: le.recordId, action: 'delete-entry' });

  return pv;
}

export async function rollbackConfirm(orgId: string, jobId: string, userId: string, force = false): Promise<RollbackStats> {
  const job = await loadJob(orgId, jobId);
  // #1 атомарный claim: только переход null → now выигрывает; повтор/гонка → 409.
  const claim = await prisma.importJob.updateMany({ where: { id: jobId, orgId, rolledBackAt: null }, data: { rolledBackAt: new Date() } });
  if (claim.count === 0) throw new ImportError('ROLLBACK_ALREADY_DONE', 'This import was already rolled back', 409);

  const { created, updated, listEntries, curValues, objByRec, required } = await loadJournal(orgId, jobId);
  let archived = 0, skippedManual = 0, valuesReverted = 0, valuesDeleted = 0, listEntriesDeleted = 0, errors = 0, fatal = false;

  try {
    // 1) list-entry удаляем (rollback list-импорта) — идемпотентно (deleteMany)
    for (const le of listEntries) {
      try { await prisma.listEntry.deleteMany({ where: { id: le.listEntryId, orgId } }); listEntriesDeleted++; }
      catch { errors++; }
    }

    // 2) обновлённые values: restore previous ИЛИ delete (hadPreviousValue=false), только если не изменено вручную
    for (const u of updated) {
      const objectId = objByRec.get(u.recordId);
      if (!objectId) { errors++; continue; }
      // #5: clear required невозможен → пропускаем без hard-error (иначе откат «отравлен» и не довершится)
      if (!u.hadPreviousValue && required.has(`${objectId}:${u.attributeKey}`)) { skippedManual++; continue; }
      const cur = curValues.get(u.recordId)?.[u.attributeKey];
      const unchanged = valueToken(cur) === valueToken(u.importedValue);
      if (!force && !unchanged) { skippedManual++; continue; } // изменено вручную → не трогаем
      try {
        await prisma.$transaction(async (tx) => {
          const input = u.hadPreviousValue ? { [u.attributeKey]: u.previousValue } : { [u.attributeKey]: null };
          await writeValues(tx, { id: u.recordId, orgId, objectId }, input as Record<string, unknown>, { actorId: userId });
        });
        if (u.hadPreviousValue) valuesReverted++; else valuesDeleted++;
      } catch { errors++; }
    }

    // 3) созданные записи: soft-archive (только если не изменены вручную после импорта, иначе skip без force)
    for (const c of created) {
      const rec = await prisma.record.findFirst({ where: { id: c.recordId, orgId }, select: { updatedAt: true, archivedAt: true } });
      if (!rec || rec.archivedAt) continue;
      if (!force && recordChangedAfterImport(rec.updatedAt, job.completedAt)) { skippedManual++; continue; }
      try { await prisma.record.updateMany({ where: { id: c.recordId, orgId }, data: { archivedAt: new Date(), updatedById: userId } }); archived++; }
      catch { errors++; }
    }
  } catch (e) { fatal = true; throw e; } finally {
    const stats: RollbackStats = { reverted: valuesReverted, skippedManual, archived, valuesDeleted, listEntriesDeleted, errors };
    // #4: при errors>0 (или fatal-throw) откат НЕ финализируем (rolledBackAt → null), чтобы остался ретраебельным; шаги идемпотентны.
    await prisma.importJob.update({ where: { id: jobId }, data: { rollbackStats: stats as unknown as Prisma.InputJsonValue, ...(errors > 0 || fatal ? { rolledBackAt: null } : {}) } });
    await audit({ orgId, actorId: userId, action: 'IMPORT_ROLLED_BACK', targetType: 'import', targetId: jobId, summary: `archived ${archived} · reverted ${valuesReverted} · deleted-values ${valuesDeleted} · entries ${listEntriesDeleted} · skipped ${skippedManual} · errors ${errors}` });
  }

  return { reverted: valuesReverted, skippedManual, archived, valuesDeleted, listEntriesDeleted, errors };
}
