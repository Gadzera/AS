/**
 * Hermetic-тест LST-1 (Module 6 Lists · dynamic). Изолированная org, живой HTTP :3001, zero-mock.
 * Покрывает acceptance-матрицу плана GPT:
 *   T1  create DYNAMIC + rule → matchedCount-preview корректен
 *   T2  GET /:id → computed members = матчащие rule (0 ListEntry создано)
 *   T3  GET /:id/records two-step: rule ∩ view-filter
 *   T4  ручной add → 409 LIST_DYNAMIC_READONLY_MEMBERSHIP
 *   T5  ручной remove → 409 LIST_DYNAMIC_READONLY_MEMBERSHIP
 *   T6  invalid rule strict → 422 в namespace списка (attr-not-found / unsupported-op / malformed)
 *   T7  DYNAMIC без rule → ПУСТО (не «все»), хотя записи в объекте есть
 *   T8  membership пересчитывается на чтение после правки записи (match → unmatch и наоборот)
 *   T9  PATCH rule → matchedCount меняется + audit LIST_RULE_UPDATED записан (metadata-only)
 *   T10 preview-rule эндпоинт: matchedCount + warnings + 422 на кривом правиле
 *   T11 RBAC: LIST READ есть, OBJECT READ нет → restrictedSource + hiddenCount, без записей/правила
 *   T12 PATCH rule на не-DYNAMIC списке → 400 LIST_RULE_REQUIRES_DYNAMIC
 *   T13 за весь прогон у DYNAMIC-списков 0 строк ListEntry
 */
import { PrismaClient, AttributeType } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';
import { execAddToList } from './src/services/workflowActions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerToken = '';
let memberToken = '';
let orgId = '';
let userId = '';
let memberId = '';
let companiesId = '';
let locKey = 'location';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }

async function api(method: string, path: string, body?: unknown, token = ownerToken): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function seedCompany(values: Record<string, unknown>): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const rec = await tx.record.create({ data: { orgId, objectId: companiesId, createdById: userId, updatedById: userId } });
    await writeValues(tx, rec, values, { actorId: userId });
    return rec.id;
  });
}
async function editCompany(recordId: string, values: Record<string, unknown>) {
  await prisma.$transaction(async (tx) => {
    await writeValues(tx, { id: recordId, orgId, objectId: companiesId }, values, { actorId: userId });
    await tx.record.update({ where: { id: recordId }, data: { updatedById: userId } });
  });
}

const ruleLoc = (val: string) => ({ op: 'AND', children: [{ attributeKey: locKey, op: 'eq', value: val }] });

async function setup() {
  const org = await prisma.organization.create({ data: { name: 'LST-1 Dynamic Org' } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { email: `lst1_owner_${org.id}@test.local`, passwordHash: 'x', name: 'LST1 Owner', role: 'OWNER', orgId, tokenVersion: 0 } });
  userId = user.id;
  const member = await prisma.user.create({ data: { email: `lst1_member_${org.id}@test.local`, passwordHash: 'x', name: 'LST1 Member', role: 'MEMBER', orgId, tokenVersion: 0 } });
  memberId = member.id;
  await ensureCrmForOrg(orgId);
  const companies = await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } });
  companiesId = companies.id;
  // подберём текстовый атрибут для rule (location ожидаемо TEXT; иначе fallback на первый TEXT)
  const loc = await prisma.attribute.findFirst({ where: { objectId: companiesId, key: 'location', isArchived: false }, select: { type: true } });
  if (!loc || loc.type !== AttributeType.TEXT) {
    const anyText = await prisma.attribute.findFirstOrThrow({ where: { objectId: companiesId, isArchived: false, type: AttributeType.TEXT }, select: { key: true } });
    locKey = anyText.key;
  }
  ownerToken = jwt.sign({ userId, orgId, email: user.email, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberToken = jwt.sign({ userId: memberId, orgId, email: member.email, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}

async function cleanup() {
  await prisma.importCreatedListEntry.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.importJob.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.listEntry.deleteMany({ where: { orgId } });
  await prisma.list.deleteMany({ where: { orgId } });
  await prisma.relationshipValue.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.value.deleteMany({ where: { orgId } });
  await prisma.activity.deleteMany({ where: { orgId } });
  await prisma.record.deleteMany({ where: { orgId } });
  await prisma.attribute.deleteMany({ where: { orgId } });
  await prisma.object.deleteMany({ where: { orgId } });
  await prisma.permissionGrant.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.automationGrant.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();

  // 3 компании: A(NY), B(NY), C(LA)
  const recA = await seedCompany({ name: 'Alpha', [locKey]: 'NY' });
  const recB = await seedCompany({ name: 'Bravo', [locKey]: 'NY' });
  const recC = await seedCompany({ name: 'Charlie', [locKey]: 'LA' });

  // ── T1: create DYNAMIC + rule → matchedCount-preview ──
  let dynId = '';
  {
    const r = await api('POST', '/lists', { name: 'NY companies', objectKey: 'companies', type: 'DYNAMIC', rule: ruleLoc('NY') });
    check('T1a create DYNAMIC → 201', r.status === 201, `status=${r.status} ${JSON.stringify(r.json?.error ?? '')}`);
    dynId = r.json?.id;
    check('T1b matchedCount=2 (A,B)', r.json?.matchedCount === 2, `got ${r.json?.matchedCount}`);
    check('T1c type DYNAMIC', r.json?.type === 'DYNAMIC', JSON.stringify(r.json?.type));
  }

  // ── T2: GET /:id computed membership = матчащие rule, 0 ListEntry ──
  {
    const r = await api('GET', `/lists/${dynId}`);
    const ids = (r.json?.records ?? []).map((x: any) => x.id).sort();
    check('T2a GET /:id вернул 2 записи', r.json?.records?.length === 2, `got ${r.json?.records?.length}`);
    check('T2b именно A,B (rule NY)', JSON.stringify(ids) === JSON.stringify([recA, recB].sort()), JSON.stringify(ids));
    check('T2c entryId=null (computed, без ListEntry)', (r.json?.records ?? []).every((x: any) => x.entryId === null), JSON.stringify((r.json?.records ?? []).map((x: any) => x.entryId)));
    check('T2d matchedCount=2', r.json?.matchedCount === 2, `got ${r.json?.matchedCount}`);
    const entryCount = await prisma.listEntry.count({ where: { orgId, listId: dynId } });
    check('T2e 0 строк ListEntry создано', entryCount === 0, `count=${entryCount}`);
  }

  // ── T3: GET /:id/records two-step rule ∩ view-filter ──
  {
    const vt = { op: 'AND', children: [{ attributeKey: 'name', op: 'contains', value: 'Alpha' }] };
    const r = await api('GET', `/lists/${dynId}/records?filterTree=${encodeURIComponent(JSON.stringify(vt))}`);
    const ids = (r.json?.records ?? []).map((x: any) => x.id);
    check('T3a two-step: rule(NY)∩filter(name~Alpha) = 1', r.json?.records?.length === 1, `got ${r.json?.records?.length}`);
    check('T3b именно Alpha', ids[0] === recA, JSON.stringify(ids));
    check('T3c total=1 в pagination', r.json?.pagination?.total === 1, JSON.stringify(r.json?.pagination));
    // без view-filter — 2 (членство)
    const r2 = await api('GET', `/lists/${dynId}/records`);
    check('T3d без view-filter membership=2', r2.json?.records?.length === 2, `got ${r2.json?.records?.length}`);
  }

  // ── T4 / T5: ручной add/remove → 409 ──
  {
    const add = await api('POST', `/lists/${dynId}/entries`, { recordIds: [recC] });
    check('T4 ручной add → 409 LIST_DYNAMIC_READONLY_MEMBERSHIP', add.status === 409 && add.json?.code === 'LIST_DYNAMIC_READONLY_MEMBERSHIP', `status=${add.status} code=${add.json?.code}`);
    const del = await api('DELETE', `/lists/${dynId}/entries/${recA}`);
    check('T5 ручной remove → 409 LIST_DYNAMIC_READONLY_MEMBERSHIP', del.status === 409 && del.json?.code === 'LIST_DYNAMIC_READONLY_MEMBERSHIP', `status=${del.status} code=${del.json?.code}`);
    const entryCount = await prisma.listEntry.count({ where: { orgId, listId: dynId } });
    check('T4/5b всё ещё 0 ListEntry', entryCount === 0, `count=${entryCount}`);
  }

  // ── T6: invalid rule strict → 422 в namespace списка ──
  {
    const notFound = await api('POST', '/lists', { name: 'bad1', objectKey: 'companies', type: 'DYNAMIC', rule: { op: 'AND', children: [{ attributeKey: 'no_such_attr', op: 'eq', value: 'x' }] } });
    check('T6a unknown attr → 422 LIST_RULE_ATTRIBUTE_NOT_FOUND', notFound.status === 422 && notFound.json?.code === 'LIST_RULE_ATTRIBUTE_NOT_FOUND', `status=${notFound.status} code=${notFound.json?.code}`);
    const badOp = await api('POST', '/lists', { name: 'bad2', objectKey: 'companies', type: 'DYNAMIC', rule: { op: 'AND', children: [{ attributeKey: locKey, op: 'gt', value: '5' }] } });
    check('T6b unsupported op для TEXT → 422 UNSUPPORTED_LIST_RULE_OPERATOR', badOp.status === 422 && badOp.json?.code === 'UNSUPPORTED_LIST_RULE_OPERATOR', `status=${badOp.status} code=${badOp.json?.code}`);
    const malformed = await api('POST', '/lists', { name: 'bad3', objectKey: 'companies', type: 'DYNAMIC', rule: { op: 'AND', children: [{ attributeKey: locKey }] } });
    check('T6c malformed leaf → 422 INVALID_LIST_RULE', malformed.status === 422 && malformed.json?.code === 'INVALID_LIST_RULE', `status=${malformed.status} code=${malformed.json?.code}`);
    // ни один кривой запрос не создал список
    const badCount = await prisma.list.count({ where: { orgId, name: { in: ['bad1', 'bad2', 'bad3'] } } });
    check('T6d кривые правила НЕ создали список', badCount === 0, `count=${badCount}`);
  }

  // ── T7: DYNAMIC без rule → пусто (не «все») ──
  {
    const r = await api('POST', '/lists', { name: 'empty dynamic', objectKey: 'companies', type: 'DYNAMIC' });
    check('T7a create DYNAMIC без rule → 201, matchedCount=0', r.status === 201 && r.json?.matchedCount === 0, `status=${r.status} mc=${r.json?.matchedCount}`);
    const g = await api('GET', `/lists/${r.json?.id}`);
    check('T7b GET → 0 записей (не все 3 компании)', g.json?.records?.length === 0, `got ${g.json?.records?.length}`);
  }

  // ── T8: пересчёт membership на чтение после правки записи ──
  {
    // C: LA → NY ⇒ теперь матчит (3); затем A: NY → LA ⇒ выпадает (2)
    await editCompany(recC, { [locKey]: 'NY' });
    const r1 = await api('GET', `/lists/${dynId}/records`);
    check('T8a после C→NY membership=3', r1.json?.records?.length === 3, `got ${r1.json?.records?.length}`);
    await editCompany(recA, { [locKey]: 'LA' });
    const r2 = await api('GET', `/lists/${dynId}/records`);
    const ids = (r2.json?.records ?? []).map((x: any) => x.id).sort();
    check('T8b после A→LA membership=2 (B,C)', JSON.stringify(ids) === JSON.stringify([recB, recC].sort()), JSON.stringify(ids));
    // вернём состояние: A→NY, C→LA (исходное)
    await editCompany(recA, { [locKey]: 'NY' });
    await editCompany(recC, { [locKey]: 'LA' });
  }

  // ── T9: PATCH rule → matchedCount меняется + audit LIST_RULE_UPDATED ──
  {
    const r = await api('PATCH', `/lists/${dynId}`, { rule: ruleLoc('LA') });
    check('T9a PATCH rule→LA, matchedCount=1 (C)', r.status === 200 && r.json?.matchedCount === 1, `status=${r.status} mc=${r.json?.matchedCount}`);
    const g = await api('GET', `/lists/${dynId}`);
    check('T9b GET после PATCH → Charlie', g.json?.records?.length === 1 && g.json?.records?.[0]?.id === recC, JSON.stringify((g.json?.records ?? []).map((x: any) => x.id)));
    const auditCount = await prisma.auditLog.count({ where: { orgId, action: 'LIST_RULE_UPDATED', targetId: dynId } });
    check('T9c audit LIST_RULE_UPDATED записан', auditCount >= 1, `count=${auditCount}`);
    const last = await prisma.auditLog.findFirst({ where: { orgId, action: 'LIST_RULE_UPDATED', targetId: dynId }, orderBy: { createdAt: 'desc' } });
    check('T9d audit summary metadata-only (без filterTree)', !!last && !/children|attributeKey/.test(last.summary), JSON.stringify(last?.summary));
    // вернём rule на NY
    await api('PATCH', `/lists/${dynId}`, { rule: ruleLoc('NY') });
  }

  // ── T10: preview-rule эндпоинт ──
  {
    const ok = await api('POST', '/lists/preview-rule', { objectKey: 'companies', rule: ruleLoc('NY') });
    check('T10a preview matchedCount=2', ok.status === 200 && ok.json?.matchedCount === 2, `status=${ok.status} mc=${ok.json?.matchedCount}`);
    const bad = await api('POST', '/lists/preview-rule', { objectKey: 'companies', rule: { op: 'AND', children: [{ attributeKey: 'nope', op: 'eq', value: '1' }] } });
    check('T10b preview кривого правила → 422 LIST_RULE_ATTRIBUTE_NOT_FOUND', bad.status === 422 && bad.json?.code === 'LIST_RULE_ATTRIBUTE_NOT_FOUND', `status=${bad.status} code=${bad.json?.code}`);
  }

  // ── T11: RBAC restrictedSource + hiddenCount ──
  {
    // member: LIST READ (workspace default READ_WRITE), но OBJECT '*' → NONE
    await setGrant(orgId, userId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: '*', level: 'NONE' });
    const g = await api('GET', `/lists/${dynId}`, undefined, memberToken);
    check('T11a member GET /:id → restrictedSource', g.status === 200 && g.json?.restrictedSource === true, `status=${g.status} rs=${g.json?.restrictedSource}`);
    check('T11b records пуст', (g.json?.records ?? []).length === 0, `len=${g.json?.records?.length}`);
    check('T11c hiddenCount=2 (matched), правило скрыто (config=null)', g.json?.hiddenCount === 2 && g.json?.list?.config === null, `hc=${g.json?.hiddenCount} cfg=${JSON.stringify(g.json?.list?.config)}`);
    const gr = await api('GET', `/lists/${dynId}/records`, undefined, memberToken);
    check('T11d member GET /:id/records → restrictedSource + hiddenCount=2', gr.status === 200 && gr.json?.restrictedSource === true && gr.json?.hiddenCount === 2, `rs=${gr.json?.restrictedSource} hc=${gr.json?.hiddenCount}`);
    check('T11e member preview-rule (нет OBJECT READ) → 403', (await api('POST', '/lists/preview-rule', { objectKey: 'companies', rule: ruleLoc('NY') }, memberToken)).status === 403);
  }

  // ── T12: PATCH rule на STATIC → 400 LIST_RULE_REQUIRES_DYNAMIC ──
  {
    const s = await api('POST', '/lists', { name: 'static list', objectKey: 'companies', type: 'STATIC' });
    const r = await api('PATCH', `/lists/${s.json?.id}`, { rule: ruleLoc('NY') });
    check('T12 PATCH rule на STATIC → 400 LIST_RULE_REQUIRES_DYNAMIC', r.status === 400 && r.json?.code === 'LIST_RULE_REQUIRES_DYNAMIC', `status=${r.status} code=${r.json?.code}`);
    // STATIC add работает (контроль регрессии)
    const add = await api('POST', `/lists/${s.json?.id}/entries`, { recordIds: [recA] });
    check('T12b STATIC ручной add по-прежнему работает (added=1)', add.status === 200 && add.json?.added === 1, JSON.stringify(add.json));
  }

  // ── T14: import в DYNAMIC-список → 409 (закрытие дыры адверс-ревью) ──
  {
    const r = await api('POST', '/imports', { targetType: 'LIST', listId: dynId, fileName: 'x.csv', headers: ['Name'], rows: [{ Name: 'ZZZ' }] });
    check('T14 import в DYNAMIC → 409 LIST_DYNAMIC_READONLY_MEMBERSHIP', r.status === 409 && r.json?.code === 'LIST_DYNAMIC_READONLY_MEMBERSHIP', `status=${r.status} code=${r.json?.code}`);
  }

  // ── T15: workflow execAddToList на DYNAMIC → throw, 0 ListEntry (закрытие дыры адверс-ревью) ──
  {
    let threw = false;
    try { await prisma.$transaction((tx) => execAddToList(tx, orgId, { orgId, recordId: recC }, { listId: dynId })); }
    catch { threw = true; }
    check('T15a execAddToList на DYNAMIC бросает', threw);
    const cnt = await prisma.listEntry.count({ where: { orgId, listId: dynId } });
    check('T15b после попытки 0 ListEntry', cnt === 0, `count=${cnt}`);
  }

  // ── T13: 0 ListEntry у DYNAMIC-списков за весь прогон ──
  {
    const dynLists = await prisma.list.findMany({ where: { orgId, type: 'DYNAMIC' }, select: { id: true } });
    const total = await prisma.listEntry.count({ where: { orgId, listId: { in: dynLists.map((l) => l.id) } } });
    check('T13 у всех DYNAMIC-списков 0 ListEntry', total === 0, `count=${total}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== LST-1: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup err', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
