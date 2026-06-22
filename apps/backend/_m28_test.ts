/**
 * Hermetic-тест M28-1+M28-2 — Compose/Templates/Merge/Preview/Draft/Demo-send. Изолированная org, живой HTTP :3001, zero-mock.
 *
 *   RECIPIENTS  R1 self-email записи · R2 related People через reverse-связь (без email — не кандидат) · R3 RBAC нет READ → 403
 *   VARIABLES   V1 контракт record.* + recipient.* (relationship исключён)
 *   PREVIEW     P1 resolve subject/body+canSend · P2 unknown var → unresolved+canSend=false · P3 empty var → empty (не блок)
 *   DRAFT/SEND  D1 draft → DRAFT+EMAIL_DRAFTED(1) · D2 idempotency → один Email/Activity · S1 send → SENT+sentAt+EMAIL_SENT(1)
 *               S2 send с unknown var → 422, письма нет · S3 manual email → SENT · S4 RBAC READ-only → 403 (нужен READ_WRITE)
 *   ARCHIVED    A1 archived record → send 409
 *   TEMPLATES   T1 owner create · T2 member create → 403 · T3 member list → 200 · T4 send с templateId → сохранён · T5 archived tpl → 400
 *   BODYSAFE    B1 ответ отдаёт snippet, не bodyText
 *   GENERIC     G1 кастомный объект: recipients/variables 200, manual send 201
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', memberTok = '', orgId = '', ownerId = '', memberId = '';
let peopleId = '', companiesId = '', customId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, body?: any, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
async function mkRecord(objectId: string, values?: Record<string, unknown>): Promise<string> {
  const rec = await prisma.record.create({ data: { orgId, objectId, createdById: ownerId, updatedById: ownerId }, select: { id: true, orgId: true, objectId: true } });
  if (values) await prisma.$transaction((tx) => writeValues(tx, rec, values, { actorId: ownerId }));
  return rec.id;
}

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M28 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m28_o_${orgId}@t.local`, passwordHash: 'x', name: 'Olivia Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  memberId = (await prisma.user.create({ data: { email: `m28_m_${orgId}@t.local`, passwordHash: 'x', name: 'Mona Member', role: 'MEMBER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  customId = (await prisma.object.create({ data: { orgId, key: 'widgets', singularName: 'Widget', pluralName: 'Widgets' }, select: { id: true } })).id;
  // primary name-атрибут для кастомного объекта (чтобы запись имела displayName)
  await prisma.attribute.create({ data: { orgId, objectId: customId, key: 'name', name: 'Name', type: 'TEXT', isPrimary: true, isRequired: true, order: 0 } });
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m28_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberTok = jwt.sign({ userId: memberId, orgId, email: `m28_m_${orgId}@t.local`, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  // member: NONE на companies (RBAC GET), READ (не WRITE) на people (RBAC POST)
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: companiesId, level: 'NONE' });
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: peopleId, level: 'READ' });
}
async function cleanup() {
  for (const t of ['activity', 'email', 'emailTemplate', 'relationshipValue', 'value', 'record', 'attribute', 'relationshipDefinition', 'object', 'permissionGrant', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();

  const acme = await mkRecord(companiesId, { name: 'Acme Inc' });
  const alice = await mkRecord(peopleId, { name: 'Alice Smith', email: 'alice@acme.com', title: 'CTO', company: [acme] });
  const bob = await mkRecord(peopleId, { name: 'Bob NoEmail', company: [acme] }); // related, но без email → не кандидат
  void bob;

  // ── R1 self ──
  {
    const r = await api('GET', `/records/${alice}/email-recipients`);
    const self = (r.json?.recipients ?? []).find((x: any) => x.source === 'self');
    check('R1 self-email записи (People)', r.status === 200 && self?.email === 'alice@acme.com', JSON.stringify(r.json?.recipients));
  }
  // ── R2 related via reverse ──
  {
    const r = await api('GET', `/records/${acme}/email-recipients`);
    const list = r.json?.recipients ?? [];
    const related = list.find((x: any) => x.source === 'related' && x.email === 'alice@acme.com');
    const hasBob = list.some((x: any) => x.recordId === bob);
    check('R2 related People через reverse-связь (Alice), Bob без email не кандидат', r.status === 200 && !!related && !hasBob, JSON.stringify(list));
  }
  // ── R3 RBAC ──
  {
    const r = await api('GET', `/records/${acme}/email-recipients`, undefined, memberTok);
    check('R3 нет OBJECT READ (companies) → 403', r.status === 403, `status=${r.status}`);
  }
  // ── V1 variables contract ──
  {
    const r = await api('GET', `/records/${alice}/email-variables`);
    const vars = r.json?.variables ?? [];
    const tokens = vars.map((v: any) => v.token);
    const recName = vars.find((v: any) => v.token === 'record.name');
    const recEmail = vars.find((v: any) => v.token === 'record.email');
    check('V1 контракт: record.name/email + recipient.* присутствуют, relationship (company) исключён',
      r.status === 200 && tokens.includes('record.name') && tokens.includes('record.email') && tokens.includes('recipient.email') && tokens.includes('recipient.name') && !tokens.includes('record.company') && recName?.sample === 'Alice Smith' && recEmail?.sample === 'alice@acme.com',
      JSON.stringify(tokens));
  }
  // ── P1 preview resolve ──
  {
    const r = await api('POST', `/records/${alice}/emails/preview`, { subject: 'Hi {{record.name}}', body: 'Email {{recipient.email}}, title {{record.title}}', recipient: { recordId: alice } });
    const j = r.json;
    check('P1 preview resolve subject/body + canSend + demo-disclaimer',
      r.status === 200 && j?.subject === 'Hi Alice Smith' && j?.body === 'Email alice@acme.com, title CTO' && j?.unresolved?.length === 0 && j?.canSend === true && j?.demo === true && typeof j?.disclaimer === 'string' && j.disclaimer.length > 0,
      JSON.stringify({ s: j?.subject, b: j?.body, canSend: j?.canSend, un: j?.unresolved }));
  }
  // ── P2 unknown var ──
  {
    const r = await api('POST', `/records/${alice}/emails/preview`, { subject: 'X', body: 'Bad {{record.unknownXYZ}}', recipient: { recordId: alice } });
    const j = r.json;
    check('P2 unknown var → unresolved + canSend=false', r.status === 200 && j?.unresolved?.includes('record.unknownXYZ') && j?.canSend === false, JSON.stringify({ un: j?.unresolved, canSend: j?.canSend }));
  }
  // ── P3 empty var ──
  {
    const r = await api('POST', `/records/${alice}/emails/preview`, { subject: 'X', body: 'LinkedIn {{record.linkedin}}', recipient: { recordId: alice } });
    const j = r.json;
    check('P3 empty var → empty (не блок, canSend=true)', r.status === 200 && j?.empty?.includes('record.linkedin') && j?.unresolved?.length === 0 && j?.canSend === true, JSON.stringify({ empty: j?.empty, canSend: j?.canSend }));
  }
  // ── D1 draft ──
  let draftId = '';
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'draft', subject: 'Draft {{record.name}}', body: 'hi there', recipient: { recordId: alice }, idempotencyKey: 'k-draft-1' });
    const e = r.json?.email;
    draftId = e?.id;
    const acts = await prisma.activity.count({ where: { orgId, emailId: e?.id, type: 'EMAIL_DRAFTED' } });
    check('D1 draft → 201 DRAFT + demo + EMAIL_DRAFTED(1)', r.status === 201 && e?.status === 'DRAFT' && e?.demo === true && e?.subject === 'Draft Alice Smith' && acts === 1, JSON.stringify({ st: e?.status, acts }));
  }
  // ── D2 idempotency ──
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'draft', subject: 'Draft {{record.name}}', body: 'hi there', recipient: { recordId: alice }, idempotencyKey: 'k-draft-1' });
    const sameId = r.json?.email?.id === draftId;
    const emailCount = await prisma.email.count({ where: { orgId, idempotencyKey: `${alice}:k-draft-1` } }); // ключ неймспейснут записью на сервере
    const actCount = await prisma.activity.count({ where: { orgId, emailId: draftId } });
    check('D2 idempotency → тот же Email, без второго Email/Activity', r.status === 200 && r.json?.idempotent === true && sameId && emailCount === 1 && actCount === 1, JSON.stringify({ idem: r.json?.idempotent, emailCount, actCount }));
  }
  // ── S1 send ──
  let sentId = '';
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'Hello {{record.name}}', body: 'Body {{recipient.email}}', recipient: { recordId: alice }, idempotencyKey: 'k-send-1' });
    const e = r.json?.email;
    sentId = e?.id;
    const acts = await prisma.activity.count({ where: { orgId, emailId: e?.id, type: 'EMAIL_SENT' } });
    check('S1 send → 201 SENT + sentAt + demo + EMAIL_SENT(1)', r.status === 201 && e?.status === 'SENT' && !!e?.sentAt && e?.demo === true && e?.subject === 'Hello Alice Smith' && acts === 1, JSON.stringify({ st: e?.status, sentAt: !!e?.sentAt, acts }));
  }
  // ── S2 send unresolved → block ──
  {
    const before = await prisma.email.count({ where: { orgId, recordId: alice } });
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'X {{record.bogus}}', body: 'y', recipient: { recordId: alice }, idempotencyKey: 'k-send-bogus' });
    const after = await prisma.email.count({ where: { orgId, recordId: alice } });
    check('S2 send с unknown var → 422 UNRESOLVED_VARIABLES, письмо НЕ создано', r.status === 422 && r.json?.code === 'UNRESOLVED_VARIABLES' && after === before, JSON.stringify({ status: r.status, code: r.json?.code, before, after }));
  }
  // ── S3 manual email ──
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'Manual hi', body: 'plain', recipient: { email: 'manual@external.com' }, idempotencyKey: 'k-send-manual' });
    const e = r.json?.email;
    const to = Array.isArray(e?.toEmails) ? e.toEmails[0] : null;
    check('S3 manual email (single compose) → 201 SENT to manual@external.com', r.status === 201 && e?.status === 'SENT' && to === 'manual@external.com', JSON.stringify({ st: e?.status, to }));
  }
  // ── S4 RBAC READ-only ──
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'draft', subject: 'x', body: 'y', recipient: { recordId: alice }, idempotencyKey: 'k-member' }, memberTok);
    const gr = await api('GET', `/records/${alice}/email-recipients`, undefined, memberTok);
    check('S4 RBAC: member READ → GET 200, POST emails 403 (нужен READ_WRITE)', gr.status === 200 && r.status === 403, `get=${gr.status} post=${r.status}`);
  }
  // ── X1 cross-record related recipient (compose из company → связанный человек) ──
  {
    const r = await api('POST', `/records/${acme}/emails/preview`, { subject: 'Hi {{recipient.name}}', body: 'reach {{recipient.email}}', recipient: { recordId: alice } });
    const j = r.json;
    check('X1 cross-record: company→related person резолвится (whitelist)', r.status === 200 && j?.recipientResolved === true && j?.to === 'alice@acme.com' && j?.canSend === true, JSON.stringify({ to: j?.to, resolved: j?.recipientResolved }));
  }
  // ── X2 CRIT-1 регресс: recordId НЕ из whitelist → отказ ──
  {
    const dave = await mkRecord(peopleId, { name: 'Dave Unrelated', email: 'dave@other.com' }); // НЕ связан с alice
    const before = await prisma.email.count({ where: { orgId, recordId: alice } });
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'x', body: 'y', recipient: { recordId: dave }, idempotencyKey: 'k-crit1' });
    const after = await prisma.email.count({ where: { orgId, recordId: alice } });
    check('X2 CRIT-1: получатель-recordId вне whitelist → 422, письма нет (нет RBAC-обхода)', r.status === 422 && r.json?.code === 'RECIPIENT_UNRESOLVED' && after === before, JSON.stringify({ status: r.status, code: r.json?.code, before, after }));
  }
  // ── X3 spoof регресс: клиентский email при recordId игнорируется ──
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'no spoof', body: 'z', recipient: { recordId: alice, email: 'attacker@evil.com' }, idempotencyKey: 'k-spoof' });
    const e = r.json?.email;
    const to = Array.isArray(e?.toEmails) ? e.toEmails[0] : null;
    check('X3 spoof: клиентский email при recordId игнорируется → ушло на авторитетный alice@acme.com', r.status === 201 && to === 'alice@acme.com', JSON.stringify({ to }));
  }
  // ── X4 idempotency namespaced по записи: тот же клиентский ключ на ДРУГОЙ записи → своё письмо ──
  {
    const erin = await mkRecord(peopleId, { name: 'Erin', email: 'erin@acme.com' });
    const r = await api('POST', `/records/${erin}/emails`, { action: 'draft', subject: 'own', body: 'b', recipient: { recordId: erin }, idempotencyKey: 'k-draft-1' }); // тот же ключ, что у alice (D1)
    const e = r.json?.email;
    check('X4 idempotency namespaced: тот же клиентский ключ на другой записи → отдельное письмо (не alice draft)', r.status === 201 && e?.id !== draftId && r.json?.idempotent !== true, JSON.stringify({ status: r.status, sameAsAlice: e?.id === draftId, idem: r.json?.idempotent }));
  }
  // ── A1 archived ──
  {
    const carol = await mkRecord(peopleId, { name: 'Carol', email: 'carol@acme.com' });
    await prisma.record.update({ where: { id: carol }, data: { archivedAt: new Date() } });
    const r = await api('POST', `/records/${carol}/emails`, { action: 'send', subject: 'x', body: 'y', recipient: { email: 'carol@acme.com' }, idempotencyKey: 'k-arch' });
    check('A1 archived record → send 409 RECORD_ARCHIVED', r.status === 409 && r.json?.code === 'RECORD_ARCHIVED', JSON.stringify({ status: r.status, code: r.json?.code }));
  }
  // ── T1 owner create template ──
  let tplId = '';
  {
    const r = await api('POST', `/email-templates`, { name: 'Intro', subject: 'Hi {{record.name}}', body: 'Reach you at {{recipient.email}}' });
    tplId = r.json?.template?.id;
    check('T1 owner create template → 201', r.status === 201 && !!tplId, JSON.stringify({ status: r.status, id: tplId }));
  }
  // ── T2 member create → 403 ──
  {
    const r = await api('POST', `/email-templates`, { name: 'Nope', subject: 's', body: 'b' }, memberTok);
    check('T2 member create template → 403 TEMPLATE_FORBIDDEN', r.status === 403 && r.json?.code === 'TEMPLATE_FORBIDDEN', JSON.stringify({ status: r.status, code: r.json?.code }));
  }
  // ── T3 member list → 200 ──
  {
    const r = await api('GET', `/email-templates`, undefined, memberTok);
    const has = (r.json?.templates ?? []).some((t: any) => t.id === tplId);
    check('T3 member list templates → 200 + видит шаблон, canManage=false', r.status === 200 && has && r.json?.canManage === false, JSON.stringify({ status: r.status, has, canManage: r.json?.canManage }));
  }
  // ── T4 send with templateId stored ──
  {
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'Hi {{record.name}}', body: 'Reach you at {{recipient.email}}', templateId: tplId, recipient: { recordId: alice }, idempotencyKey: 'k-tpl' });
    const dbEmail = await prisma.email.findFirst({ where: { orgId, idempotencyKey: `${alice}:k-tpl` }, select: { templateId: true, status: true } });
    check('T4 send с templateId → 201 + templateId сохранён в Email', r.status === 201 && dbEmail?.templateId === tplId && dbEmail?.status === 'SENT', JSON.stringify({ status: r.status, tpl: dbEmail?.templateId }));
  }
  // ── T5 archived template rejected ──
  {
    await api('POST', `/email-templates/${tplId}/archive`);
    const r = await api('POST', `/records/${alice}/emails`, { action: 'send', subject: 'x', body: 'y', templateId: tplId, recipient: { recordId: alice }, idempotencyKey: 'k-tpl-arch' });
    check('T5 archived template → 400 TEMPLATE_NOT_FOUND', r.status === 400 && r.json?.code === 'TEMPLATE_NOT_FOUND', JSON.stringify({ status: r.status, code: r.json?.code }));
  }
  // ── B1 body safety ──
  {
    const e = await prisma.email.findFirst({ where: { orgId, id: sentId }, select: { bodyText: true } });
    const r = await api('GET', `/records/${alice}/emails`);
    const row = (r.json?.emails ?? []).find((x: any) => x.id === sentId);
    check('B1 body safety: ответ отдаёт snippet, не bodyText (в БД body есть)', !!e?.bodyText && row && typeof row.snippet === 'string' && row.bodyText === undefined, JSON.stringify({ dbHasBody: !!e?.bodyText, snippet: typeof row?.snippet, body: row?.bodyText }));
  }
  // ── G1 generic custom object ──
  {
    const w = await mkRecord(customId, { name: 'Widget One' });
    const rec = await api('GET', `/records/${w}/email-recipients`);
    const vars = await api('GET', `/records/${w}/email-variables`);
    const send = await api('POST', `/records/${w}/emails`, { action: 'send', subject: 'Hi {{record.name}}', body: 'plain', recipient: { email: 'someone@ext.com' }, idempotencyKey: 'k-widget' });
    const varTokens = (vars.json?.variables ?? []).map((v: any) => v.token);
    check('G1 generic кастомный объект: recipients/variables 200, manual send 201 (no hardcode)',
      rec.status === 200 && vars.status === 200 && varTokens.includes('record.name') && send.status === 201 && send.json?.email?.subject === 'Hi Widget One',
      JSON.stringify({ rec: rec.status, vars: vars.status, send: send.status }));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M28-1+2: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}
main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
