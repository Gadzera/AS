/**
 * Hermetic-тест M28-5 — Outbox / drafts / demo-resend. Изолированная org, живой HTTP :3001, zero-mock.
 *   DETAIL  E1 owner draft detail READ_WRITE → bodyText · E2 member READ-only draft → 403 · E3 member READ sent → 200+body
 *   EDIT    ED1 PATCH draft → subject/body обновлены · ED2 PATCH sent → 409 NOT_DRAFT · ED3 PATCH member READ-only → 403
 *   SEND    SD1 POST /send draft → SENT+sentAt+EMAIL_SENT(1) · SD2 повторный /send → idempotent, без второго Activity · SD3 member → 403
 *   RESEND  RS1 /resend SENT demo → +1 EMAIL_SENT (новый attempt) · RS2 второй /resend → +1 (2 attempts, не дубль-ноль) ·
 *           RS3 /resend draft → 409 NOT_RESENDABLE · RS4 /resend non-demo → 409 NOT_DEMO_RESENDABLE
 *   ARCH    AR1 archived record → PATCH/send/resend = 409 RECORD_ARCHIVED
 *   LIST    BS1 GET /emails?status=DRAFT → черновик в списке, snippet без bodyText
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', memberTok = '', orgId = '', ownerId = '', memberId = '', peopleId = '';

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
async function mkEmail(recordId: string, status: any, demo = true, subject = 'Subj', body = 'body text'): Promise<string> {
  const e = await prisma.email.create({ data: { orgId, recordId, direction: 'OUTBOUND', channel: 'EMAIL', status, fromEmail: 'me@demo.dev', toEmails: ['to@acme.com'] as any, subject, bodyText: body, demo, sentAt: status === 'DRAFT' ? null : new Date() }, select: { id: true } });
  return e.id;
}
const sentActs = (emailId: string) => prisma.activity.count({ where: { orgId, emailId, type: 'EMAIL_SENT' } });

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M28-5 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m285_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  memberId = (await prisma.user.create({ data: { email: `m285_m_${orgId}@t.local`, passwordHash: 'x', name: 'Member', role: 'MEMBER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m285_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberTok = jwt.sign({ userId: memberId, orgId, email: `m285_m_${orgId}@t.local`, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  // member: READ (не WRITE) на people → видит sent detail, но draft-detail/edit/send закрыты
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
  const person = await mkRecord(peopleId, { name: 'Alice Smith', email: 'alice@acme.com' });

  const draft = await mkEmail(person, 'DRAFT', true, 'Draft subj', 'draft body');
  const sent = await mkEmail(person, 'SENT', true, 'Sent subj', 'sent body content');
  const resendable = await mkEmail(person, 'SENT', true, 'Resend subj', 'resend body');
  const realSent = await mkEmail(person, 'SENT', false, 'Real subj', 'real body'); // demo=false

  // ── E1 owner draft detail (READ_WRITE) ──
  {
    const r = await api('GET', `/emails/${draft}`);
    check('E1 owner draft detail READ_WRITE → 200 + bodyText', r.status === 200 && r.json?.email?.bodyText === 'draft body', JSON.stringify({ status: r.status, body: r.json?.email?.bodyText }));
  }
  // ── E2 member READ-only draft → 403 ──
  {
    const r = await api('GET', `/emails/${draft}`, undefined, memberTok);
    check('E2 member READ-only → draft detail 403 (нужен READ_WRITE)', r.status === 403 && !r.json?.email, `status=${r.status}`);
  }
  // ── E3 member READ sent → 200 + body ──
  {
    const r = await api('GET', `/emails/${sent}`, undefined, memberTok);
    check('E3 member READ → sent detail 200 + bodyText', r.status === 200 && r.json?.email?.bodyText === 'sent body content', `status=${r.status}`);
  }
  // ── ED1 PATCH draft ──
  {
    const r = await api('PATCH', `/emails/${draft}`, { subject: 'Edited subject', body: 'edited body now' });
    const db = await prisma.email.findUnique({ where: { id: draft }, select: { subject: true, bodyText: true } });
    check('ED1 PATCH draft → subject/body обновлены', r.status === 200 && db?.subject === 'Edited subject' && db?.bodyText === 'edited body now', JSON.stringify({ status: r.status, subj: db?.subject }));
  }
  // ── ED2 PATCH sent → 409 ──
  {
    const r = await api('PATCH', `/emails/${sent}`, { subject: 'x' });
    check('ED2 PATCH sent email → 409 NOT_DRAFT', r.status === 409 && r.json?.code === 'NOT_DRAFT', `status=${r.status}`);
  }
  // ── ED3 PATCH member READ-only → 403 ──
  {
    const r = await api('PATCH', `/emails/${draft}`, { subject: 'hack' }, memberTok);
    check('ED3 PATCH draft member READ-only → 403', r.status === 403, `status=${r.status}`);
  }
  // ── SD1 send draft ──
  {
    const r = await api('POST', `/emails/${draft}/send`);
    const acts = await sentActs(draft);
    const db = await prisma.email.findUnique({ where: { id: draft }, select: { status: true, sentAt: true } });
    check('SD1 /send draft → SENT + sentAt + EMAIL_SENT(1)', r.status === 200 && r.json?.email?.status === 'SENT' && !!db?.sentAt && acts === 1, JSON.stringify({ status: r.json?.email?.status, acts }));
  }
  // ── SD2 повторный send → idempotent, без второго Activity ──
  {
    const r = await api('POST', `/emails/${draft}/send`);
    const acts = await sentActs(draft);
    check('SD2 повторный /send → idempotent, EMAIL_SENT всё ещё 1', r.status === 200 && r.json?.idempotent === true && acts === 1, JSON.stringify({ idem: r.json?.idempotent, acts }));
  }
  // ── SD3 send member READ-only → 403 ──
  {
    const d2 = await mkEmail(person, 'DRAFT');
    const r = await api('POST', `/emails/${d2}/send`, undefined, memberTok);
    check('SD3 /send draft member READ-only → 403', r.status === 403, `status=${r.status}`);
  }
  // ── RS1 resend SENT demo → +1 EMAIL_SENT ──
  {
    const before = await sentActs(resendable);
    const r = await api('POST', `/emails/${resendable}/resend`);
    const after = await sentActs(resendable);
    check('RS1 /resend SENT demo → 200 + новый EMAIL_SENT attempt (+1)', r.status === 200 && r.json?.resent === true && after === before + 1, JSON.stringify({ status: r.status, before, after }));
  }
  // ── RS2 второй resend → +1 (2 attempts, честный per-attempt audit) ──
  {
    const before = await sentActs(resendable);
    const r = await api('POST', `/emails/${resendable}/resend`);
    const after = await sentActs(resendable);
    check('RS2 второй /resend → ещё +1 (per-attempt audit, не дубль-ноль)', r.status === 200 && after === before + 1, JSON.stringify({ before, after }));
  }
  // ── RS5 resend idempotency: тот же idempotencyKey дважды → только +1 EMAIL_SENT (один attempt) ──
  {
    const before = await sentActs(resendable);
    const r1 = await api('POST', `/emails/${resendable}/resend`, { idempotencyKey: 'attempt-xyz' });
    const mid = await sentActs(resendable);
    const r2 = await api('POST', `/emails/${resendable}/resend`, { idempotencyKey: 'attempt-xyz' });
    const after = await sentActs(resendable);
    check('RS5 resend тот же idempotencyKey дважды → только +1 EMAIL_SENT (network-retry не плодит дубль)',
      r1.status === 200 && r1.json?.resent === true && mid === before + 1 && r2.status === 200 && r2.json?.idempotent === true && after === before + 1,
      JSON.stringify({ before, mid, after, r2idem: r2.json?.idempotent }));
  }
  // ── RS3 resend draft → 409 ──
  {
    const d3 = await mkEmail(person, 'DRAFT');
    const r = await api('POST', `/emails/${d3}/resend`);
    check('RS3 /resend draft → 409 NOT_RESENDABLE', r.status === 409 && r.json?.code === 'NOT_RESENDABLE', JSON.stringify({ status: r.status, code: r.json?.code }));
  }
  // ── RS4 resend non-demo → 409 ──
  {
    const r = await api('POST', `/emails/${realSent}/resend`);
    check('RS4 /resend non-demo email → 409 NOT_DEMO_RESENDABLE', r.status === 409 && r.json?.code === 'NOT_DEMO_RESENDABLE', JSON.stringify({ status: r.status, code: r.json?.code }));
  }
  // ── AR1 archived record → мутации 409 ──
  {
    const arcRec = await mkRecord(peopleId, { name: 'Bob', email: 'bob@acme.com' });
    const arcDraft = await mkEmail(arcRec, 'DRAFT');
    const arcSent = await mkEmail(arcRec, 'SENT');
    await prisma.record.update({ where: { id: arcRec }, data: { archivedAt: new Date() } });
    const p = await api('PATCH', `/emails/${arcDraft}`, { subject: 'x' });
    const s = await api('POST', `/emails/${arcDraft}/send`);
    const rs = await api('POST', `/emails/${arcSent}/resend`);
    check('AR1 archived record → PATCH/send/resend = 409 RECORD_ARCHIVED', p.status === 409 && s.status === 409 && rs.status === 409 && p.json?.code === 'RECORD_ARCHIVED', JSON.stringify({ patch: p.status, send: s.status, resend: rs.status }));
  }
  // ── BS1 list body safety (drafts) ──
  {
    const r = await api('GET', `/emails?status=DRAFT&pageSize=100`);
    const first = (r.json?.emails ?? [])[0];
    check('BS1 GET /emails?status=DRAFT → черновики в списке, snippet без bodyText', r.status === 200 && (r.json?.emails ?? []).length >= 1 && typeof first?.snippet === 'string' && first?.bodyText === undefined, JSON.stringify({ n: r.json?.emails?.length, body: first?.bodyText }));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M28-5: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}
main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
