/**
 * Hermetic-тест M27-3 — Calls/Emails surfaces на записи. Изолированная org, живой HTTP :3001, zero-mock.
 *   C1 GET /calls → реальные звонки через CallAssociatedRecord (summary/aiIntent/associationType)
 *   C2 unlink call → ассоциация удалена, сам Call НЕ удалён
 *   C3 нет OBJECT READ → /calls 403 (не раскрываем чужие звонки)
 *   E1 GET /emails → только Email.recordId===record; snippet есть, полный bodyText НЕ отдаётся
 *   E3 нет OBJECT READ → /emails 403
 *   G1 generic: calls/emails на КАСТОМНОМ объекте → 200 (пусто)
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', memberTok = '', orgId = '', ownerId = '', memberId = '', companiesId = '', customId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${tok}` } });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const mkRecord = (objectId: string) => prisma.record.create({ data: { orgId, objectId, createdById: ownerId, updatedById: ownerId }, select: { id: true } }).then((r) => r.id);

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M27-3 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m27_3_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  memberId = (await prisma.user.create({ data: { email: `m27_3_m_${orgId}@t.local`, passwordHash: 'x', name: 'Member', role: 'MEMBER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  customId = (await prisma.object.create({ data: { orgId, key: 'widgets', singularName: 'Widget', pluralName: 'Widgets' }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m27_3_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberTok = jwt.sign({ userId: memberId, orgId, email: `m27_3_m_${orgId}@t.local`, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: companiesId, level: 'NONE' });
}
async function cleanup() {
  for (const t of ['callAssociatedRecord', 'callParticipant', 'call', 'email', 'note', 'task', 'activity', 'value', 'record', 'attribute', 'object', 'permissionGrant', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();
  const R = await mkRecord(companiesId);

  // звонок + ассоциация
  const call = await prisma.call.create({ data: { orgId, direction: 'OUTBOUND', status: 'COMPLETED', durationSec: 180, summary: 'Discussed pricing and timeline.', aiIntent: 'evaluating', nextStep: 'Send proposal' }, select: { id: true } });
  await prisma.callAssociatedRecord.create({ data: { orgId, callId: call.id, objectKey: 'companies', recordId: R, associationType: 'manual', createdById: ownerId } });
  // письмо на запись
  await prisma.email.create({ data: { orgId, recordId: R, direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT', subject: 'Proposal follow-up', fromEmail: 'me@demo.dev', toEmails: ['lead@acme.com'] as any, bodyText: 'SECRET BODY CONTENT that should appear only as a capped snippet '.repeat(10), aiGenerated: true } });
  // архивное письмо — НЕ должно показываться (адверс HIGH-фикс)
  await prisma.email.create({ data: { orgId, recordId: R, direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT', subject: 'Archived email', toEmails: ['x@y.com'] as any, archivedAt: new Date() } });

  // ── C1 ──
  {
    const r = await api('GET', `/records/${R}/calls`);
    const c = (r.json?.calls ?? [])[0];
    check('C1 GET /calls → 1 звонок с summary/aiIntent/associationType', r.status === 200 && r.json?.calls?.length === 1 && c?.summary && c?.aiIntent === 'evaluating' && c?.associationType === 'manual', JSON.stringify(c));
  }
  // ── C2 unlink ──
  {
    const d = await api('DELETE', `/records/${R}/calls/${call.id}`);
    check('C2 unlink → 204', d.status === 204);
    const after = await api('GET', `/records/${R}/calls`);
    check('C2b ассоциация удалена (0 звонков)', (after.json?.calls ?? []).length === 0, `n=${after.json?.calls?.length}`);
    const stillExists = await prisma.call.count({ where: { orgId, id: call.id } });
    check('C2c сам Call НЕ удалён', stillExists === 1, `count=${stillExists}`);
  }
  // ── C3 RBAC ──
  {
    const r = await api('GET', `/records/${R}/calls`, memberTok);
    check('C3 нет OBJECT READ → /calls 403', r.status === 403, `status=${r.status}`);
  }
  // ── E1 ──
  {
    const r = await api('GET', `/records/${R}/emails`);
    const e = (r.json?.emails ?? [])[0];
    check('E1 GET /emails → 1 письмо записи', r.status === 200 && r.json?.emails?.length === 1 && e?.subject === 'Proposal follow-up', JSON.stringify({ n: r.json?.emails?.length, subj: e?.subject }));
    check('E1b snippet есть, полный bodyText НЕ отдаётся', typeof e?.snippet === 'string' && e.snippet.length <= 180 && e?.bodyText === undefined, `snippetLen=${e?.snippet?.length} body=${e?.bodyText}`);
  }
  // ── E3 RBAC ──
  {
    const r = await api('GET', `/records/${R}/emails`, memberTok);
    check('E3 нет OBJECT READ → /emails 403', r.status === 403, `status=${r.status}`);
  }
  // ── G1 generic ──
  {
    const CR = await mkRecord(customId);
    const c = await api('GET', `/records/${CR}/calls`);
    const e = await api('GET', `/records/${CR}/emails`);
    check('G1 generic: calls/emails на кастомном объекте → 200 (пусто)', c.status === 200 && e.status === 200 && (c.json?.calls ?? []).length === 0 && (e.json?.emails ?? []).length === 0, `calls=${c.status} emails=${e.status}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M27-3: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}
main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
