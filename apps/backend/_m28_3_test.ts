/**
 * Hermetic-тест M28-3 — Global Emails list + safe detail + hidden-count. Изолированная org, живой HTTP :3001, zero-mock.
 *   LIST   L1 owner видит record-linked письма (snippet, без bodyText) · L2 member без READ(people) → person-письма скрыты (hidden-count)
 *          L3 фильтр status · L4 фильтр direction · L5 фильтр recordId (+ member hidden) · L6 пагинация (pageSize/hasMore)
 *          L7 null-record и archived письма ИСКЛЮЧЕНЫ
 *   DETAIL D1 owner READ → bodyText отдаётся · D2 member без READ → 403 · D3 null-record → 404 · D4 archived → 404
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', memberTok = '', orgId = '', ownerId = '', memberId = '', peopleId = '', companiesId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${tok}` } });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
async function mkRecord(objectId: string, values: Record<string, unknown>): Promise<string> {
  const rec = await prisma.record.create({ data: { orgId, objectId, createdById: ownerId, updatedById: ownerId }, select: { id: true, orgId: true, objectId: true } });
  await prisma.$transaction((tx) => writeValues(tx, rec, values, { actorId: ownerId }));
  return rec.id;
}
async function mkEmail(d: { recordId: string | null; status?: any; direction?: any; body?: string; archived?: boolean }): Promise<string> {
  const e = await prisma.email.create({
    data: {
      orgId, recordId: d.recordId, direction: d.direction ?? 'OUTBOUND', channel: 'EMAIL', status: d.status ?? 'SENT',
      fromEmail: 'sender@demo.dev', toEmails: ['to@acme.com'] as any, subject: `Subj ${d.status ?? 'SENT'} ${d.direction ?? 'OUTBOUND'}`,
      bodyText: d.body ?? 'plain body', demo: true, sentAt: new Date(), archivedAt: d.archived ? new Date() : null,
    }, select: { id: true },
  });
  return e.id;
}

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M28-3 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m283_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  memberId = (await prisma.user.create({ data: { email: `m283_m_${orgId}@t.local`, passwordHash: 'x', name: 'Member', role: 'MEMBER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m283_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberTok = jwt.sign({ userId: memberId, orgId, email: `m283_m_${orgId}@t.local`, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  // member: NONE на people → person-письма скрыты (hidden-count); companies остаётся доступен (default READ_WRITE)
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: peopleId, level: 'NONE' });
}
async function cleanup() {
  for (const t of ['activity', 'email', 'emailTemplate', 'relationshipValue', 'value', 'record', 'attribute', 'relationshipDefinition', 'object', 'permissionGrant', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();
  const company = await mkRecord(companiesId, { name: 'Acme Inc' });
  const person = await mkRecord(peopleId, { name: 'Alice Smith', email: 'alice@acme.com' });

  const C1 = await mkEmail({ recordId: company, status: 'SENT', direction: 'OUTBOUND', body: 'SECRET COMPANY BODY '.repeat(20) });
  await mkEmail({ recordId: company, status: 'SENT', direction: 'INBOUND' });   // C2
  await mkEmail({ recordId: company, status: 'DRAFT', direction: 'OUTBOUND' }); // C3
  const P1 = await mkEmail({ recordId: person, status: 'SENT', direction: 'OUTBOUND', body: 'PERSON PRIVATE BODY' });
  const nullEmail = await mkEmail({ recordId: null, status: 'SENT' });          // excluded (null-record)
  const archivedEmail = await mkEmail({ recordId: company, status: 'SENT', archived: true }); // excluded (archived)

  // ── L1 owner list ──
  {
    const r = await api('GET', '/emails');
    const first = (r.json?.emails ?? [])[0];
    check('L1 owner: 4 record-linked письма (snippet, без bodyText), hidden=0',
      r.status === 200 && r.json?.total === 4 && r.json?.hiddenCount === 0 && typeof first?.snippet === 'string' && first?.bodyText === undefined && first?.bodyHtml === undefined && !!first?.linkedRecord,
      JSON.stringify({ total: r.json?.total, hidden: r.json?.hiddenCount, snippet: typeof first?.snippet, body: first?.bodyText }));
  }
  // ── L2 member hidden-count ──
  {
    const r = await api('GET', '/emails', memberTok);
    const ids = (r.json?.emails ?? []).map((e: any) => e.id);
    check('L2 member без READ(people): company-письма видны, person скрыто → hiddenCount=1',
      r.status === 200 && r.json?.total === 3 && r.json?.hiddenCount === 1 && !ids.includes(P1),
      JSON.stringify({ total: r.json?.total, hidden: r.json?.hiddenCount, hasP1: ids.includes(P1) }));
  }
  // ── L3 filter status ──
  {
    const r = await api('GET', '/emails?status=SENT');
    check('L3 фильтр status=SENT → 3 (C1,C2,P1; C3 DRAFT исключён)', r.status === 200 && r.json?.total === 3, JSON.stringify({ total: r.json?.total }));
  }
  // ── L4 filter direction ──
  {
    const r = await api('GET', '/emails?direction=INBOUND');
    check('L4 фильтр direction=INBOUND → 1 (C2)', r.status === 200 && r.json?.total === 1, JSON.stringify({ total: r.json?.total }));
  }
  // ── L5 filter recordId + member ──
  {
    const ro = await api('GET', `/emails?recordId=${person}`);
    const rm = await api('GET', `/emails?recordId=${person}`, memberTok);
    check('L5 фильтр recordId=person → owner 1, member 0 видим + hiddenCount=1',
      ro.json?.total === 1 && rm.json?.total === 0 && rm.json?.hiddenCount === 1,
      JSON.stringify({ owner: ro.json?.total, member: rm.json?.total, memberHidden: rm.json?.hiddenCount }));
  }
  // ── L6 pagination ──
  {
    const p1 = await api('GET', '/emails?pageSize=2&page=1');
    const p2 = await api('GET', '/emails?pageSize=2&page=2');
    check('L6 пагинация pageSize=2 → page1 2 rows hasMore=true, page2 2 rows hasMore=false, total=4',
      (p1.json?.emails?.length === 2) && p1.json?.hasMore === true && (p2.json?.emails?.length === 2) && p2.json?.hasMore === false && p1.json?.total === 4,
      JSON.stringify({ p1: p1.json?.emails?.length, more1: p1.json?.hasMore, p2: p2.json?.emails?.length, more2: p2.json?.hasMore }));
  }
  // ── L7 null & archived excluded ──
  {
    const r = await api('GET', '/emails?pageSize=100');
    const ids = (r.json?.emails ?? []).map((e: any) => e.id);
    check('L7 null-record и archived письма ИСКЛЮЧЕНЫ из списка', !ids.includes(nullEmail) && !ids.includes(archivedEmail) && r.json?.total === 4, JSON.stringify({ total: r.json?.total, hasNull: ids.includes(nullEmail), hasArch: ids.includes(archivedEmail) }));
  }
  // ── D1 detail owner READ ──
  {
    const r = await api('GET', `/emails/${C1}`);
    const e = r.json?.email;
    check('D1 detail owner READ → bodyText отдаётся (полный), linkedRecord есть, без provider/html',
      r.status === 200 && typeof e?.bodyText === 'string' && e.bodyText.includes('SECRET COMPANY BODY') && !!e?.linkedRecord && e?.bodyHtml === undefined && e?.provider === undefined && e?.providerMessageId === undefined,
      JSON.stringify({ status: r.status, hasBody: typeof e?.bodyText, prov: e?.provider }));
  }
  // ── D2 detail member without READ → 403 ──
  {
    const r = await api('GET', `/emails/${P1}`, memberTok);
    check('D2 detail member без READ(people) → 403 (bodyText не утёк)', r.status === 403 && !r.json?.email, `status=${r.status}`);
  }
  // ── D3 detail null-record → 404 ──
  {
    const r = await api('GET', `/emails/${nullEmail}`);
    check('D3 detail null-record письма → 404 (не часть global surface)', r.status === 404 && r.json?.code === 'EMAIL_NOT_FOUND', `status=${r.status}`);
  }
  // ── D4 detail archived → 404 ──
  {
    const r = await api('GET', `/emails/${archivedEmail}`);
    check('D4 detail archived письма → 404', r.status === 404, `status=${r.status}`);
  }

  // ── A1 письмо записи АРХИВНОГО объекта исключено отовсюду (адверс HIGH) ──
  {
    const arcObj = await prisma.object.create({ data: { orgId, key: 'secret_obj', singularName: 'Secret', pluralName: 'Secrets', archivedAt: new Date() }, select: { id: true } });
    const arcRec = await prisma.record.create({ data: { orgId, objectId: arcObj.id, displayName: 'Hidden Rec', createdById: ownerId, updatedById: ownerId }, select: { id: true } });
    const arcEmail = await mkEmail({ recordId: arcRec.id, status: 'SENT', body: 'ARCHIVED OBJECT SECRET' });
    const r = await api('GET', '/emails?pageSize=100');
    const ids = (r.json?.emails ?? []).map((e: any) => e.id);
    const det = await api('GET', `/emails/${arcEmail}`);
    check('A1 письмо записи АРХИВНОГО объекта: вне списка, НЕ в hiddenCount, detail 404',
      !ids.includes(arcEmail) && r.json?.total === 4 && r.json?.hiddenCount === 0 && det.status === 404,
      JSON.stringify({ total: r.json?.total, hidden: r.json?.hiddenCount, inList: ids.includes(arcEmail), detail: det.status }));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M28-3: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}
main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
