/**
 * Hermetic-тест M28-4 — Bulk productivity actions. Изолированная org, живой HTTP :3001, zero-mock.
 *   SEND PREVIEW  BP1 per-record ready/skipped(no_recipient)+disclaimer · BP2 unknown var → skipped(unresolved_variables)
 *   SEND          BS1 alice succeeded(email+Activity), bob skipped(no_recipient, no-op без Activity) · BS2 idempotency (без дубля)
 *                 BS3 company → resolve via related People (alice) succeeded · BS4 member RBAC → skipped(no_access) · BS5 unresolved → skipped
 *   ENROLL        EN1 alice enrolled(Lead+CampaignLead+Activity), bob skipped(no_recipient) · EN2 dedup already_enrolled (no Activity)
 *                 EN3 member RBAC skipped · EN4 campaign 404
 *   ADD-TO-LIST   AL1 bulk add 2 (reuse /lists/:id/entries) · AL2 re-add dedup skipped
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', memberTok = '', orgId = '', ownerId = '', memberId = '', peopleId = '', companiesId = '', campaignId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, body?: any, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
async function mkRecord(objectId: string, values: Record<string, unknown>): Promise<string> {
  const rec = await prisma.record.create({ data: { orgId, objectId, createdById: ownerId, updatedById: ownerId }, select: { id: true, orgId: true, objectId: true } });
  await prisma.$transaction((tx) => writeValues(tx, rec, values, { actorId: ownerId }));
  return rec.id;
}
const emailCount = (recordId: string) => prisma.email.count({ where: { orgId, recordId } });
const sentActs = (recordId: string) => prisma.activity.count({ where: { orgId, recordId, type: 'EMAIL_SENT' } });

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M28-4 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m284_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  memberId = (await prisma.user.create({ data: { email: `m284_m_${orgId}@t.local`, passwordHash: 'x', name: 'Member', role: 'MEMBER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  campaignId = (await prisma.campaign.create({ data: { orgId, userId: ownerId, name: 'Q3 Outbound' }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m284_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberTok = jwt.sign({ userId: memberId, orgId, email: `m284_m_${orgId}@t.local`, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  // member READ (не WRITE) на people → bulk send/enroll → no_access
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: peopleId, level: 'READ' });
}
async function cleanup() {
  for (const t of ['activity', 'email', 'emailTemplate', 'campaignLead', 'sequence', 'campaign', 'lead', 'listEntry', 'list', 'relationshipValue', 'value', 'record', 'attribute', 'relationshipDefinition', 'object', 'permissionGrant', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();
  const acme = await mkRecord(companiesId, { name: 'Acme Inc' });
  const alice = await mkRecord(peopleId, { name: 'Alice Smith', email: 'alice@acme.com', company: [acme] });
  const bob = await mkRecord(peopleId, { name: 'Bob NoEmail', company: [acme] });

  // ── BP1 preview ──
  {
    const r = await api('POST', '/bulk/send-email/preview', { recordIds: [alice, bob], subject: 'Hi {{record.name}}', body: 'reach {{recipient.email}}' });
    const a = (r.json?.items ?? []).find((x: any) => x.recordId === alice);
    const b = (r.json?.items ?? []).find((x: any) => x.recordId === bob);
    check('BP1 preview: alice ready (to+subject resolved), bob skipped(no_recipient) + disclaimer',
      r.status === 200 && a?.status === 'ready' && a?.to === 'alice@acme.com' && a?.subject === 'Hi Alice Smith' && b?.status === 'skipped' && b?.reason === 'no_recipient' && r.json?.summary?.ready === 1 && r.json?.summary?.skipped === 1 && typeof r.json?.disclaimer === 'string',
      JSON.stringify({ a: a?.status, b: b?.reason, sum: r.json?.summary }));
  }
  // ── BP2 preview unresolved ──
  {
    const r = await api('POST', '/bulk/send-email/preview', { recordIds: [alice], subject: 'X', body: '{{record.bogus}}' });
    const a = (r.json?.items ?? [])[0];
    check('BP2 preview unknown var → skipped(unresolved_variables)', r.status === 200 && a?.status === 'skipped' && a?.reason === 'unresolved_variables' && a?.unresolved?.includes('record.bogus'), JSON.stringify({ st: a?.status, un: a?.unresolved }));
  }
  // ── BS1 send ──
  {
    const r = await api('POST', '/bulk/send-email', { recordIds: [alice, bob], subject: 'Hi {{record.name}}', body: 'reach {{recipient.email}}', idempotencyKey: 'bk1' });
    const aliceEmails = await emailCount(alice);
    const bobEmails = await emailCount(bob);
    const aliceActs = await sentActs(alice);
    check('BS1 send: alice succeeded(email+Activity), bob skipped(no_recipient, no-op без Activity/email)',
      r.json?.summary?.succeeded === 1 && r.json?.summary?.skipped === 1 && aliceEmails === 1 && aliceActs === 1 && bobEmails === 0 && (await sentActs(bob)) === 0,
      JSON.stringify({ sum: r.json?.summary, aliceEmails, bobEmails, aliceActs }));
  }
  // ── BS2 idempotency ──
  {
    const r = await api('POST', '/bulk/send-email', { recordIds: [alice, bob], subject: 'Hi {{record.name}}', body: 'reach {{recipient.email}}', idempotencyKey: 'bk1' });
    const aliceEmails = await emailCount(alice);
    const aliceActs = await sentActs(alice);
    check('BS2 idempotency: повтор same key → alice succeeded без второго email/Activity', r.json?.summary?.succeeded === 1 && aliceEmails === 1 && aliceActs === 1, JSON.stringify({ sum: r.json?.summary, aliceEmails, aliceActs }));
  }
  // ── BS3 company → resolve via related People ──
  {
    const r = await api('POST', '/bulk/send-email', { recordIds: [acme], subject: 'Hi', body: 'to {{recipient.email}}', idempotencyKey: 'bk-acme' });
    const acmeEmails = await prisma.email.findFirst({ where: { orgId, recordId: acme }, select: { toEmails: true } });
    const to = Array.isArray(acmeEmails?.toEmails) ? (acmeEmails!.toEmails as any)[0] : null;
    check('BS3 company (не person) → recipient резолвится через связанного Person (alice), succeeded', r.json?.summary?.succeeded === 1 && to === 'alice@acme.com', JSON.stringify({ sum: r.json?.summary, to }));
  }
  // ── BS4 RBAC member ──
  {
    const r = await api('POST', '/bulk/send-email', { recordIds: [alice], subject: 'Hi', body: 'x', idempotencyKey: 'bk-mem' }, memberTok);
    const res0 = (r.json?.results ?? [])[0];
    check('BS4 member READ-only → skipped(no_access), 0 succeeded', r.json?.summary?.succeeded === 0 && res0?.reason === 'no_access', JSON.stringify({ sum: r.json?.summary, reason: res0?.reason }));
  }
  // ── BS5 unresolved blocks ──
  {
    const before = await emailCount(alice);
    const r = await api('POST', '/bulk/send-email', { recordIds: [alice], subject: 'X', body: '{{record.bogus}}', idempotencyKey: 'bk-bogus' });
    const after = await emailCount(alice);
    check('BS5 unknown var → skipped(unresolved_variables), письмо НЕ создано', r.json?.summary?.skipped === 1 && (r.json?.results ?? [])[0]?.reason === 'unresolved_variables' && after === before, JSON.stringify({ sum: r.json?.summary, before, after }));
  }
  // ── EN1 enroll ──
  {
    const r = await api('POST', '/bulk/enroll-sequence', { recordIds: [alice, bob], campaignId });
    const lead = await prisma.lead.findFirst({ where: { orgId, email: 'alice@acme.com' }, select: { id: true } });
    const cl = lead ? await prisma.campaignLead.count({ where: { campaignId, leadId: lead.id } }) : 0;
    const enrollActs = await prisma.activity.count({ where: { orgId, recordId: alice, type: 'SEQUENCE_ENROLLED' } });
    check('EN1 enroll: alice enrolled(Lead+CampaignLead+Activity), bob skipped(no_recipient)',
      r.json?.summary?.succeeded === 1 && r.json?.summary?.skipped === 1 && cl === 1 && enrollActs === 1,
      JSON.stringify({ sum: r.json?.summary, cl, enrollActs }));
  }
  // ── EN2 dedup ──
  {
    const r = await api('POST', '/bulk/enroll-sequence', { recordIds: [alice], campaignId });
    const enrollActs = await prisma.activity.count({ where: { orgId, recordId: alice, type: 'SEQUENCE_ENROLLED' } });
    check('EN2 dedup: повтор → skipped(already_enrolled), без второго Activity', r.json?.summary?.skipped === 1 && (r.json?.results ?? [])[0]?.reason === 'already_enrolled' && enrollActs === 1, JSON.stringify({ sum: r.json?.summary, enrollActs }));
  }
  // ── EN5 Lead-мост дедуп: существующий Lead по email переиспользуется (без дубля) ──
  {
    const carol = await mkRecord(peopleId, { name: 'Carol Existing', email: 'carol@acme.com' });
    await prisma.lead.create({ data: { orgId, firstName: 'Carol', lastName: 'Pre', email: 'carol@acme.com' } }); // уже есть Lead
    const r = await api('POST', '/bulk/enroll-sequence', { recordIds: [carol], campaignId });
    const leadCount = await prisma.lead.count({ where: { orgId, email: 'carol@acme.com' } });
    check('EN5 Lead-мост: существующий Lead по email переиспользован (count=1, не дубль), enrolled', r.json?.summary?.succeeded === 1 && leadCount === 1, JSON.stringify({ sum: r.json?.summary, leadCount }));
  }
  // ── EN3 RBAC ──
  {
    const r = await api('POST', '/bulk/enroll-sequence', { recordIds: [alice], campaignId }, memberTok);
    check('EN3 member READ-only → skipped(no_access)', r.json?.summary?.succeeded === 0 && (r.json?.results ?? [])[0]?.reason === 'no_access', JSON.stringify({ sum: r.json?.summary }));
  }
  // ── EN4 campaign 404 ──
  {
    const r = await api('POST', '/bulk/enroll-sequence', { recordIds: [alice], campaignId: 'nope' });
    check('EN4 campaign не найдена → 404', r.status === 404 && r.json?.code === 'CAMPAIGN_NOT_FOUND', `status=${r.status}`);
  }
  // ── AL1 add-to-list (reuse) ──
  let listId = '';
  {
    listId = (await prisma.list.create({ data: { orgId, name: 'Bulk List', type: 'STATIC', primaryObjectId: peopleId, createdById: ownerId }, select: { id: true } })).id;
    const r = await api('POST', `/lists/${listId}/entries`, { recordIds: [alice, bob] });
    check('AL1 bulk add-to-list (reuse /lists/:id/entries) → added 2', r.status === 200 && r.json?.added === 2, JSON.stringify({ added: r.json?.added }));
  }
  // ── AL2 dedup ──
  {
    const r = await api('POST', `/lists/${listId}/entries`, { recordIds: [alice] });
    const entries = await prisma.listEntry.count({ where: { orgId, listId, recordId: alice, archivedAt: null } });
    check('AL2 re-add → dedup: added 0, запись alice по-прежнему одна (дубль не создан)', r.status === 200 && r.json?.added === 0 && entries === 1, JSON.stringify({ added: r.json?.added, entries }));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M28-4: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}
main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
