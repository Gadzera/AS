/**
 * Hermetic-тест M27-1 — Activity redaction по правам (обязательная правка GPT #1) + generic record page.
 * Изолированная org, живой HTTP :3001, zero-mock.
 *   R1  self-активность (без ссылок на другие сущности) видна member'у целиком
 *   R2  relationship-активность на запись ЧУЖОГО объекта (нет OBJECT READ) → redacted:true, без title/body
 *   R3  list-активность на список без LIST READ → redacted:true
 *   R4  relationship-активность на доступную запись (companies) → видна
 *   R5  list-активность на доступный список → видна
 *   R6  сырой payload НИКОГДА не отдаётся наружу
 *   R7  OWNER (FULL) видит всё нередактированным
 *   R8  generic: GET /activities работает на записи КАСТОМНОГО объекта (не hardcode companies)
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerToken = '', memberToken = '', orgId = '', userId = '', memberId = '';
let companiesId = '', secretObjId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }

async function api(method: string, path: string, token = ownerToken): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}` } });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
async function mkRecord(objectId: string): Promise<string> {
  const r = await prisma.record.create({ data: { orgId, objectId, createdById: userId, updatedById: userId }, select: { id: true } });
  return r.id;
}
async function mkActivity(recordId: string, type: string, title: string, payload: any): Promise<string> {
  const a = await prisma.activity.create({ data: { orgId, recordId, actorId: userId, type: type as any, title, payload: payload ?? undefined }, select: { id: true } });
  return a.id;
}

async function setup() {
  const org = await prisma.organization.create({ data: { name: 'M27-1 Org' } });
  orgId = org.id;
  const u = await prisma.user.create({ data: { email: `m27_owner_${org.id}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } });
  userId = u.id;
  const m = await prisma.user.create({ data: { email: `m27_member_${org.id}@t.local`, passwordHash: 'x', name: 'Member', role: 'MEMBER', orgId, tokenVersion: 0 } });
  memberId = m.id;
  await ensureCrmForOrg(orgId);
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  // кастомный объект «secret» (generic-проверка + цель для redaction)
  const secret = await prisma.object.create({ data: { orgId, key: 'secret', singularName: 'Secret', pluralName: 'Secrets' }, select: { id: true } });
  secretObjId = secret.id;
  ownerToken = jwt.sign({ userId, orgId, email: u.email, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberToken = jwt.sign({ userId: memberId, orgId, email: m.email, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}
async function cleanup() {
  await prisma.activity.deleteMany({ where: { orgId } });
  await prisma.listEntry.deleteMany({ where: { orgId } });
  await prisma.list.deleteMany({ where: { orgId } });
  await prisma.value.deleteMany({ where: { orgId } });
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

  const R = await mkRecord(companiesId);        // subject (member имеет OBJECT READ на companies)
  const C2 = await mkRecord(companiesId);       // доступная цель связи
  const S = await mkRecord(secretObjId);        // цель связи на ЧУЖОМ объекте
  const lAllowed = await prisma.list.create({ data: { orgId, name: 'Allowed', primaryObjectId: companiesId, type: 'STATIC', createdById: userId }, select: { id: true } });
  const lRestricted = await prisma.list.create({ data: { orgId, name: 'Restricted', primaryObjectId: companiesId, type: 'STATIC', createdById: userId }, select: { id: true } });

  // member: индивидуально OBJECT secret = NONE, LIST lRestricted = NONE (остальное по дефолту READ_WRITE)
  await setGrant(orgId, userId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: secretObjId, level: 'NONE' });
  await setGrant(orgId, userId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'LIST', entityKey: lRestricted.id, level: 'NONE' });

  const aSelf = await mkActivity(R, 'RECORD_UPDATED', 'Field updated', null);
  const aRelSecret = await mkActivity(R, 'RELATIONSHIP_CREATED', 'Linked to Secret X', { targetRecordId: S });
  const aListRestricted = await mkActivity(R, 'RECORD_ADDED_TO_LIST', 'Added to list Restricted', { listId: lRestricted.id });
  const aRelOk = await mkActivity(R, 'RELATIONSHIP_CREATED', 'Linked to Acme', { targetRecordId: C2 });
  const aListOk = await mkActivity(R, 'RECORD_ADDED_TO_LIST', 'Added to list Allowed', { listId: lAllowed.id });
  // fail-closed: кросс-сущностные активности БЕЗ id (legacy/будущие fire-site) → redacted у ВСЕХ, даже owner
  const aListNoId = await mkActivity(R, 'RECORD_ADDED_TO_LIST', 'Added to list Mystery', null);
  const aRelNoId = await mkActivity(R, 'RELATIONSHIP_CREATED', 'Linked to someone', { reverse: true });

  // ── member view ──
  const mv = await api('GET', `/records/${R}/activities?limit=200`, memberToken);
  check('R0 member GET activities 200', mv.status === 200, `status=${mv.status}`);
  const byId: Record<string, any> = {};
  for (const a of (mv.json?.activities ?? [])) byId[a.id] = a;

  check('R1 self-активность видна (redacted:false, есть title)', byId[aSelf]?.redacted === false && byId[aSelf]?.title === 'Field updated', JSON.stringify(byId[aSelf]));
  check('R2 rel→secret-объект redacted (нет title/body)', byId[aRelSecret]?.redacted === true && byId[aRelSecret]?.title === undefined && byId[aRelSecret]?.body === undefined, JSON.stringify(byId[aRelSecret]));
  check('R3 list без LIST READ redacted', byId[aListRestricted]?.redacted === true && byId[aListRestricted]?.title === undefined, JSON.stringify(byId[aListRestricted]));
  check('R4 rel→доступную запись видна', byId[aRelOk]?.redacted === false && byId[aRelOk]?.title === 'Linked to Acme', JSON.stringify(byId[aRelOk]));
  check('R5 list с LIST READ видна', byId[aListOk]?.redacted === false && byId[aListOk]?.title === 'Added to list Allowed', JSON.stringify(byId[aListOk]));
  const noPayload = (mv.json?.activities ?? []).every((a: any) => !('payload' in a));
  check('R6 сырой payload НЕ отдаётся ни в одной активности', noPayload, JSON.stringify((mv.json?.activities ?? []).map((a: any) => Object.keys(a))));
  // redacted-активность отдаёт только безопасные поля
  const safeShape = byId[aRelSecret] && Object.keys(byId[aRelSecret]).sort().join(',') === 'actor,createdAt,id,redacted,type';
  check('R6b redacted-активность = {id,type,actor,createdAt,redacted}', safeShape, JSON.stringify(Object.keys(byId[aRelSecret] ?? {})));

  // ── fail-closed (член): кросс-сущностные активности без id → redacted, даже если у члена есть LIST/OBJECT доступ ──
  check('R9 list-активность без listId → fail-closed redacted', byId[aListNoId]?.redacted === true && byId[aListNoId]?.title === undefined, JSON.stringify(byId[aListNoId]));
  check('R10 rel-активность без targetRecordId → fail-closed redacted', byId[aRelNoId]?.redacted === true && byId[aRelNoId]?.title === undefined, JSON.stringify(byId[aRelNoId]));

  // ── owner view (FULL) ──
  const ov = await api('GET', `/records/${R}/activities?limit=200`, ownerToken);
  const ovById: Record<string, any> = {};
  for (const a of (ov.json?.activities ?? [])) ovById[a.id] = a;
  const idActivities = [aSelf, aRelSecret, aListRestricted, aRelOk, aListOk];
  const allIdFull = idActivities.every((id) => ovById[id]?.redacted === false);
  check('R7 OWNER видит активности-с-id нередактированными', allIdFull, JSON.stringify(idActivities.map((id) => ovById[id]?.redacted)));
  check('R7b fail-closed применяется даже к OWNER (no-id → redacted)', ovById[aListNoId]?.redacted === true && ovById[aRelNoId]?.redacted === true, `list=${ovById[aListNoId]?.redacted} rel=${ovById[aRelNoId]?.redacted}`);

  // ── generic: activities на записи КАСТОМНОГО объекта (owner) ──
  await mkActivity(S, 'RECORD_CREATED', 'Created', null);
  const gv = await api('GET', `/records/${S}/activities`, ownerToken);
  check('R8 generic: GET activities на кастомном объекте 200 + видно', gv.status === 200 && (gv.json?.activities ?? []).length >= 1, `status=${gv.status} n=${gv.json?.activities?.length}`);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M27-1: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
