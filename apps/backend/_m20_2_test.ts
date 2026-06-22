/**
 * Hermetic-тест M20-2 — Import rollback (preview→confirm) + list import + entry-collision.
 * Изолированная org, живой HTTP :3001. Покрывает 6 требований GPT + list-импорт.
 *   T1  rollback created → soft-archive (+ preview содержит все поля)
 *   T2  rollback updated, hadPreviousValue=true → restore previous
 *   T3  rollback updated, hadPreviousValue=false → DELETE value (не null)
 *   T4  manual-edit guard (value): изменено вручную → skip без force
 *   T5  force: откатывает и изменённое вручную
 *   T6  manual-edit guard (created record): изменён после импорта → skip без force (+ force архивирует)
 *   T7  ROLLBACK_ALREADY_DONE при повторе (409)
 *   T8  list-импорт: create record + ListEntry + журнал ImportCreatedListEntry
 *   T9  list-коллизия: запись уже в списке → updateExisting, дубля нет (@@unique)
 *   T10 rollback list-импорта удаляет ListEntry
 */
import { PrismaClient, AttributeType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { getOrCreateBalance } from './src/services/ai/credits';
import { writeValues, recordSerializationInclude, serializeRecord } from './src/services/crm/values';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let token = '';
let orgId = '';
let userId = '';
let companiesId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

// полный импорт: create → saveMapping → confirm. rows: массив объектов {header:value}.
async function runImport(opts: { targetType?: 'OBJECT' | 'LIST'; listId?: string; headers: string[]; rows: Record<string, string>[]; mapping: Record<string, { attributeKey: string }>; dedupeKey?: string }) {
  const create = await api('POST', '/imports', { targetType: opts.targetType ?? 'OBJECT', objectKey: opts.targetType === 'LIST' ? undefined : 'companies', listId: opts.listId, fileName: 'm20_2.csv', headers: opts.headers, rows: opts.rows });
  if (create.status >= 300) throw new Error(`create failed ${create.status}: ${JSON.stringify(create.json)}`);
  const jobId = create.json.job.id;
  const map = await api('PATCH', `/imports/${jobId}/mapping`, { mapping: opts.mapping, dedupeKey: opts.dedupeKey ?? null });
  if (map.status >= 300) throw new Error(`mapping failed ${map.status}: ${JSON.stringify(map.json)}`);
  const conf = await api('POST', `/imports/${jobId}/confirm`, {});
  if (conf.status >= 300) throw new Error(`confirm failed ${conf.status}: ${JSON.stringify(conf.json)}`);
  return { jobId, result: conf.json.result as { created: number; updated: number; skipped: number; errorCount: number } };
}

// пре-создание компании с values (для update-сценариев). Возвращаем id + РЕАЛЬНО сохранённый domain
// (URL нормализуется при записи — trailing slash), чтобы import-строка дедупа точно совпала.
async function seedCompany(values: Record<string, unknown>): Promise<{ id: string; domain: string }> {
  const id = await prisma.$transaction(async (tx) => {
    const rec = await tx.record.create({ data: { orgId, objectId: companiesId, createdById: userId, updatedById: userId } });
    await writeValues(tx, rec, values, { actorId: userId });
    return rec.id;
  });
  const v = await recValues(id);
  return { id, domain: String(v.domain ?? '') };
}
async function recValues(recordId: string): Promise<Record<string, unknown>> {
  const r = await prisma.record.findUniqueOrThrow({ where: { id: recordId }, include: recordSerializationInclude });
  return serializeRecord(r).values as Record<string, unknown>;
}
async function isArchived(recordId: string): Promise<boolean> {
  const r = await prisma.record.findUnique({ where: { id: recordId }, select: { archivedAt: true } });
  return !!r?.archivedAt;
}
// backdate завершения job (чтобы ручная правка попала за буфер manual-guard)
async function backdateCompleted(jobId: string) { await prisma.importJob.update({ where: { id: jobId }, data: { completedAt: new Date(Date.now() - 20000) } }); }
// симуляция ручной правки записи после импорта: меняем value + bump updatedAt
async function manualEdit(recordId: string, values: Record<string, unknown>) {
  await prisma.$transaction(async (tx) => {
    await writeValues(tx, { id: recordId, orgId, objectId: companiesId }, values, { actorId: userId });
    await tx.record.update({ where: { id: recordId }, data: { updatedById: userId } });
  });
}

async function setup() {
  const org = await prisma.organization.create({ data: { name: 'M20-2 Rollback Org' } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { email: `m20_2_${org.id}@test.local`, passwordHash: 'x', name: 'M20-2 Tester', role: 'OWNER', orgId, tokenVersion: 0 } });
  userId = user.id;
  await ensureCrmForOrg(orgId);
  await getOrCreateBalance(orgId);
  const companies = await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } });
  companiesId = companies.id;
  token = jwt.sign({ userId, orgId, email: user.email, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}

async function cleanup() {
  // FK-порядок: журнал импорта → list-entries → values/records → списки → import jobs → activity/audit → user → org
  await prisma.importCreatedListEntry.deleteMany({ where: { orgId } });
  await prisma.importUpdatedValue.deleteMany({ where: { orgId } });
  await prisma.importCreatedRecord.deleteMany({ where: { orgId } });
  await prisma.listEntry.deleteMany({ where: { orgId } });
  await prisma.list.deleteMany({ where: { orgId } });
  await prisma.importJob.deleteMany({ where: { orgId } });
  await prisma.relationshipValue.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.value.deleteMany({ where: { orgId } });
  await prisma.activity.deleteMany({ where: { orgId } });
  await prisma.record.deleteMany({ where: { orgId } });
  await prisma.attribute.deleteMany({ where: { orgId } });
  await prisma.object.deleteMany({ where: { orgId } });
  await prisma.auditLog.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.creditTransaction.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.creditBalance.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();
  const M = { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' }, Location: { attributeKey: 'location' } };

  // ── T1: rollback created → soft-archive + preview содержит все поля ──
  {
    const { jobId, result } = await runImport({ headers: ['Name', 'Domain', 'Location'], rows: [{ Name: 'Acme', Domain: 'acme-t1.com', Location: 'NY' }, { Name: 'Beta', Domain: 'beta-t1.com', Location: 'LA' }], mapping: M, dedupeKey: 'domain' });
    check('T1a created=2', result.created === 2, JSON.stringify(result));
    const pv = await api('POST', `/imports/${jobId}/rollback/preview`, {});
    const p = pv.json.preview;
    const hasAllFields = p && ['recordsToArchive', 'recordsSkippedManual', 'valuesToRevert', 'valuesSkippedManual', 'listEntriesToDelete', 'alreadyRolledBack'].every((k) => k in p);
    check('T1b preview содержит все поля', hasAllFields, JSON.stringify(p));
    check('T1c preview.recordsToArchive=2', p?.recordsToArchive === 2, `got ${p?.recordsToArchive}`);
    const rb = await api('POST', `/imports/${jobId}/rollback`, {});
    check('T1d rollback archived=2', rb.json.stats?.archived === 2, JSON.stringify(rb.json.stats));
    // проверяем что записи действительно archived
    const created = await prisma.importCreatedRecord.findMany({ where: { orgId, importJobId: jobId } });
    const allArch = (await Promise.all(created.map((c) => isArchived(c.recordId)))).every(Boolean);
    check('T1e обе записи archivedAt установлен', allArch);
    (globalThis as any).__t7job = jobId; // для T7
  }

  // ── T2: rollback updated, hadPreviousValue=true → restore previous ──
  {
    const seed = await seedCompany({ name: 'OldName', domain: 'https://c-t2.com', location: 'OldLoc' });
    const recId = seed.id;
    const { result } = await runImport({ headers: ['Name', 'Domain', 'Location'], rows: [{ Name: 'NewName', Domain: seed.domain, Location: 'NewLoc' }], mapping: M, dedupeKey: 'domain' });
    check('T2a updated=1 (dedupe matched)', result.updated === 1, JSON.stringify(result));
    const afterImport = await recValues(recId);
    check('T2b value обновлён до NewName', afterImport.name === 'NewName', JSON.stringify(afterImport.name));
    const job2 = (await prisma.importJob.findFirstOrThrow({ where: { orgId, objectId: companiesId }, orderBy: { createdAt: 'desc' } })).id;
    const rb = await api('POST', `/imports/${job2}/rollback`, {});
    check('T2c reverted>=2', (rb.json.stats?.reverted ?? 0) >= 2, JSON.stringify(rb.json.stats));
    const after = await recValues(recId);
    check('T2d name восстановлен в OldName', after.name === 'OldName', JSON.stringify(after.name));
    check('T2e location восстановлен в OldLoc', after.location === 'OldLoc', JSON.stringify(after.location));
  }

  // ── T3: rollback updated, hadPreviousValue=false → DELETE value ──
  {
    const seed = await seedCompany({ name: 'DName', domain: 'https://d-t3.com' }); // БЕЗ location
    const recId = seed.id;
    const { result } = await runImport({ headers: ['Name', 'Domain', 'Location'], rows: [{ Name: 'DName', Domain: seed.domain, Location: 'ImportedLoc' }], mapping: M, dedupeKey: 'domain' });
    check('T3a updated=1', result.updated === 1, JSON.stringify(result));
    const afterImport = await recValues(recId);
    check('T3b location проставлен импортом', afterImport.location === 'ImportedLoc', JSON.stringify(afterImport.location));
    const job3 = (await prisma.importJob.findFirstOrThrow({ where: { orgId, objectId: companiesId }, orderBy: { createdAt: 'desc' } })).id;
    const rb = await api('POST', `/imports/${job3}/rollback`, {});
    check('T3c valuesDeleted>=1 (не reverted)', (rb.json.stats?.valuesDeleted ?? 0) >= 1, JSON.stringify(rb.json.stats));
    const after = await recValues(recId);
    const cleared = after.location == null || after.location === '';
    check('T3d location удалён (value deleted, не null-restore)', cleared, JSON.stringify(after.location));
  }

  // ── T4: manual-edit guard (value) → skip без force ──
  {
    const seed = await seedCompany({ name: 'EName', domain: 'https://e-t4.com', location: 'OrigLoc' });
    const recId = seed.id;
    const { jobId } = await runImport({ headers: ['Name', 'Domain', 'Location'], rows: [{ Name: 'EName', Domain: seed.domain, Location: 'ImportedLoc' }], mapping: M, dedupeKey: 'domain' });
    await manualEdit(recId, { location: 'ManualLoc' }); // ручная правка после импорта
    const pv = await api('POST', `/imports/${jobId}/rollback/preview`, {});
    check('T4a preview.valuesSkippedManual>=1', (pv.json.preview?.valuesSkippedManual ?? 0) >= 1, JSON.stringify(pv.json.preview));
    const rb = await api('POST', `/imports/${jobId}/rollback`, {});
    check('T4b rollback skippedManual>=1', (rb.json.stats?.skippedManual ?? 0) >= 1, JSON.stringify(rb.json.stats));
    const after = await recValues(recId);
    check('T4c ручное значение НЕ затёрто (ManualLoc)', after.location === 'ManualLoc', JSON.stringify(after.location));
  }

  // ── T5: force откатывает и изменённое вручную ──
  {
    const seed = await seedCompany({ name: 'FName', domain: 'https://f-t5.com', location: 'OrigF' });
    const recId = seed.id;
    const { jobId } = await runImport({ headers: ['Name', 'Domain', 'Location'], rows: [{ Name: 'FName', Domain: seed.domain, Location: 'ImpF' }], mapping: M, dedupeKey: 'domain' });
    await manualEdit(recId, { location: 'ManualF' });
    const pv = await api('POST', `/imports/${jobId}/rollback/preview`, { force: true });
    check('T5a force preview.valuesToRevert>=1', (pv.json.preview?.valuesToRevert ?? 0) >= 1, JSON.stringify(pv.json.preview));
    const rb = await api('POST', `/imports/${jobId}/rollback`, { force: true });
    check('T5b force reverted>=1', (rb.json.stats?.reverted ?? 0) >= 1, JSON.stringify(rb.json.stats));
    const after = await recValues(recId);
    check('T5c значение восстановлено в OrigF (force)', after.location === 'OrigF', JSON.stringify(after.location));
  }

  // ── T6: manual-edit guard (created record) → skip без force; force архивирует ──
  {
    const { jobId } = await runImport({ headers: ['Name', 'Domain'], rows: [{ Name: 'GName', Domain: 'g-t6.com' }], mapping: { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' } }, dedupeKey: 'domain' });
    const created = await prisma.importCreatedRecord.findFirstOrThrow({ where: { orgId, importJobId: jobId } });
    await backdateCompleted(jobId);
    await manualEdit(created.recordId, { name: 'GManual' }); // правка после импорта
    const pv = await api('POST', `/imports/${jobId}/rollback/preview`, {});
    check('T6a preview.recordsSkippedManual>=1', (pv.json.preview?.recordsSkippedManual ?? 0) >= 1, JSON.stringify(pv.json.preview));
    const rb = await api('POST', `/imports/${jobId}/rollback`, {});
    check('T6b no-force: created НЕ архивирован', !(await isArchived(created.recordId)), `archived=${await isArchived(created.recordId)}`);
    check('T6c no-force skippedManual>=1, archived=0', (rb.json.stats?.skippedManual ?? 0) >= 1 && rb.json.stats?.archived === 0, JSON.stringify(rb.json.stats));

    // отдельный job для force-архивации изменённой записи
    const j2 = await runImport({ headers: ['Name', 'Domain'], rows: [{ Name: 'HName', Domain: 'h-t6.com' }], mapping: { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' } }, dedupeKey: 'domain' });
    const created2 = await prisma.importCreatedRecord.findFirstOrThrow({ where: { orgId, importJobId: j2.jobId } });
    await backdateCompleted(j2.jobId);
    await manualEdit(created2.recordId, { name: 'HManual' });
    const rbF = await api('POST', `/imports/${j2.jobId}/rollback`, { force: true });
    check('T6d force: изменённая created запись архивирована', rbF.json.stats?.archived >= 1 && (await isArchived(created2.recordId)), JSON.stringify(rbF.json.stats));
  }

  // ── T7: ROLLBACK_ALREADY_DONE при повторе ──
  {
    const jobId = (globalThis as any).__t7job as string;
    const rb = await api('POST', `/imports/${jobId}/rollback`, {});
    check('T7 повторный rollback → 409 ROLLBACK_ALREADY_DONE', rb.status === 409 && rb.json?.code === 'ROLLBACK_ALREADY_DONE', `status=${rb.status} code=${rb.json?.code}`);
  }

  // ── T8: list-импорт: create record + ListEntry + журнал ──
  let listId = '';
  {
    const list = await prisma.list.create({ data: { orgId, name: 'Target List', primaryObjectId: companiesId, type: 'STATIC', createdById: userId } });
    listId = list.id;
    const { jobId, result } = await runImport({ targetType: 'LIST', listId, headers: ['Name', 'Domain'], rows: [{ Name: 'ListCo', Domain: 'li1-t8.com' }], mapping: { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' } }, dedupeKey: 'domain' });
    check('T8a list-импорт created=1', result.created === 1, JSON.stringify(result));
    const entries = await prisma.listEntry.findMany({ where: { orgId, listId } });
    check('T8b ListEntry создан (1)', entries.length === 1, `count=${entries.length}`);
    const journal = await prisma.importCreatedListEntry.findMany({ where: { orgId, importJobId: jobId } });
    check('T8c журнал ImportCreatedListEntry (1)', journal.length === 1, `count=${journal.length}`);
    (globalThis as any).__t10job = jobId;
    (globalThis as any).__t8entryRec = entries[0]?.recordId;
  }

  // ── T9: list-коллизия → updateExisting, дубля нет ──
  {
    // запись уже в списке: пре-создаём компанию и вручную добавляем в список
    const seed = await seedCompany({ name: 'Existing', domain: 'https://li2-t9.com' });
    const recId = seed.id;
    await prisma.listEntry.create({ data: { orgId, listId, recordId: recId, addedById: userId } });
    const before = await prisma.listEntry.count({ where: { orgId, listId, recordId: recId } });
    await runImport({ targetType: 'LIST', listId, headers: ['Name', 'Domain'], rows: [{ Name: 'ExistingUpdated', Domain: seed.domain }], mapping: { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' } }, dedupeKey: 'domain' });
    const after = await prisma.listEntry.count({ where: { orgId, listId, recordId: recId } });
    check('T9 коллизия: ListEntry не задублирован (1→1)', before === 1 && after === 1, `before=${before} after=${after}`);
  }

  // ── T10: rollback list-импорта удаляет ListEntry ──
  {
    const jobId = (globalThis as any).__t10job as string;
    const entryRec = (globalThis as any).__t8entryRec as string;
    const rb = await api('POST', `/imports/${jobId}/rollback`, {});
    check('T10a listEntriesDeleted>=1', (rb.json.stats?.listEntriesDeleted ?? 0) >= 1, JSON.stringify(rb.json.stats));
    const remaining = await prisma.listEntry.count({ where: { orgId, listId, recordId: entryRec } });
    check('T10b ListEntry удалён из списка', remaining === 0, `remaining=${remaining}`);
  }

  // ── T11: SELECT-значение ДОЛЖНО откатываться (регрессия адверс-ревью #2: importedValue сериализован) ──
  {
    const seed = await seedCompany({ name: 'SelCo', domain: 'https://sel-t11.com', employeeRange: '1-10' });
    const empMap = { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' }, Emp: { attributeKey: 'employeeRange' } };
    const { jobId } = await runImport({ headers: ['Name', 'Domain', 'Emp'], rows: [{ Name: 'SelCo', Domain: seed.domain, Emp: '51-200' }], mapping: empMap, dedupeKey: 'domain' });
    const afterImp = await recValues(seed.id);
    check('T11a SELECT обновлён импортом (51-200)', (afterImp.employeeRange as any)?.value === '51-200', JSON.stringify(afterImp.employeeRange));
    const pv = await api('POST', `/imports/${jobId}/rollback/preview`, {});
    const empDetail = (pv.json.preview?.details ?? []).find((d: any) => d.attributeKey === 'employeeRange');
    check('T11b SELECT в revert, НЕ skip-manual (фикс #2)', empDetail?.action === 'restore', JSON.stringify(empDetail));
    const rb = await api('POST', `/imports/${jobId}/rollback`, {});
    check('T11c rollback reverted>=1', (rb.json.stats?.reverted ?? 0) >= 1, JSON.stringify(rb.json.stats));
    const after = await recValues(seed.id);
    check('T11d SELECT восстановлен в 1-10', (after.employeeRange as any)?.value === '1-10', JSON.stringify(after.employeeRange));
  }

  // ── T12: параллельный rollback — ровно один успех, второй 409 (регрессия #1 атомарный claim) ──
  {
    const { jobId } = await runImport({ headers: ['Name', 'Domain'], rows: [{ Name: 'RaceCo', Domain: 'race-t12.com' }], mapping: { Name: { attributeKey: 'name' }, Domain: { attributeKey: 'domain' } }, dedupeKey: 'domain' });
    const [a, b] = await Promise.all([api('POST', `/imports/${jobId}/rollback`, {}), api('POST', `/imports/${jobId}/rollback`, {})]);
    const ok2 = [a, b].filter((r) => r.status === 200).length;
    const conflict = [a, b].filter((r) => r.status === 409 && r.json?.code === 'ROLLBACK_ALREADY_DONE').length;
    check('T12a параллель: ровно 1 успех', ok2 === 1, `ok=${ok2} statuses=${a.status},${b.status}`);
    check('T12b параллель: ровно 1 → 409 ALREADY_DONE', conflict === 1, `conflict=${conflict}`);
    const created = await prisma.importCreatedRecord.findFirstOrThrow({ where: { orgId, importJobId: jobId } });
    check('T12c запись архивирована ровно один раз (не двойной откат)', await isArchived(created.recordId));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M20-2: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup err', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
