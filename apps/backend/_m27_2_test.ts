/**
 * Hermetic-тест M27-2 — Notes/Tasks CRUD на странице записи. Изолированная org, живой HTTP :3001, zero-mock.
 * NOTES: N1 create+Activity; N2 list; N3 edit author+editedAt; N4 non-author 403; N5 admin edit ok;
 *        N6 soft-delete (body→null+placeholder, Activity kept); N7 archived→409; N8 нет OBJECT READ→403.
 * TASKS: T1 create+assign(≠actor)→TASK_ASSIGNED+Activity; T2 self-assign→НЕТ notify; T3 list;
 *        T4 complete+идемпотентность (1 TASK_COMPLETED); T5 reassign A→B→A версия+notify каждый раз;
 *        T6 invalid assignee 422; T7 ownership non-owner 403; T8 archived 409; T9 bad dueAt 422; T10 generic custom object.
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', adminTok = '', memberTok = '', member2Tok = '';
let orgId = '', ownerId = '', adminId = '', memberId = '', member2Id = '';
let companiesId = '', customId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, body?: unknown, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const mkUser = (email: string, role: string) => prisma.user.create({ data: { email, passwordHash: 'x', name: role, role: role as any, orgId, tokenVersion: 0, isActive: true }, select: { id: true } });
const tok = (id: string, email: string, role: string) => jwt.sign({ userId: id, orgId, email, role, tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
const mkRecord = (objectId: string, archived = false) => prisma.record.create({ data: { orgId, objectId, createdById: ownerId, updatedById: ownerId, ...(archived ? { archivedAt: new Date() } : {}) }, select: { id: true } }).then((r) => r.id);
const actCount = (recordId: string, type: string) => prisma.activity.count({ where: { orgId, recordId, type: type as any } });
const notifCount = (userId: string) => prisma.notificationRecipient.count({ where: { userId, notification: { orgId, type: 'TASK_ASSIGNED' } } });

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M27-2 Org' } })).id;
  ownerId = (await mkUser(`m27_2_owner_${orgId}@t.local`, 'OWNER')).id;
  adminId = (await mkUser(`m27_2_admin_${orgId}@t.local`, 'ADMIN')).id;
  memberId = (await mkUser(`m27_2_member_${orgId}@t.local`, 'MEMBER')).id;
  member2Id = (await mkUser(`m27_2_member2_${orgId}@t.local`, 'MEMBER')).id;
  await ensureCrmForOrg(orgId);
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  customId = (await prisma.object.create({ data: { orgId, key: 'widgets', singularName: 'Widget', pluralName: 'Widgets' }, select: { id: true } })).id;
  ownerTok = tok(ownerId, `m27_2_owner_${orgId}@t.local`, 'OWNER');
  adminTok = tok(adminId, `m27_2_admin_${orgId}@t.local`, 'ADMIN');
  memberTok = tok(memberId, `m27_2_member_${orgId}@t.local`, 'MEMBER');
  member2Tok = tok(member2Id, `m27_2_member2_${orgId}@t.local`, 'MEMBER');
  // member2 — без OBJECT READ на companies (для N8)
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(member2Id), entityKind: 'OBJECT', entityKey: companiesId, level: 'NONE' });
}
async function cleanup() {
  for (const t of ['notificationRecipient', 'notification', 'note', 'task', 'activity', 'listEntry', 'list', 'value', 'record', 'attribute', 'object', 'permissionGrant', 'automationGrant', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function main() {
  await setup();
  const R = await mkRecord(companiesId);
  const AR = await mkRecord(companiesId, true);

  // ── NOTES ──
  let noteId = '';
  {
    const c = await api('POST', `/records/${R}/notes`, { body: 'First note' });
    check('N1 create note 201 + body', c.status === 201 && c.json?.body === 'First note', `status=${c.status}`);
    noteId = c.json?.id;
    check('N1b Activity NOTE_CREATED', (await actCount(R, 'NOTE_CREATED')) === 1);
    const l = await api('GET', `/records/${R}/notes`);
    check('N2 list shows note + author', (l.json?.notes ?? []).length === 1 && l.json.notes[0].author?.id === ownerId, JSON.stringify(l.json?.notes?.[0]));
    const e = await api('PATCH', `/records/${R}/notes/${noteId}`, { body: 'Edited note' });
    check('N3 author edit → body+edited', e.status === 200 && e.json?.body === 'Edited note' && e.json?.edited === true, JSON.stringify(e.json));
    const e2 = await api('PATCH', `/records/${R}/notes/${noteId}`, { body: 'Hack' }, memberTok);
    check('N4 non-author MEMBER edit → 403', e2.status === 403, `status=${e2.status}`);
    const e3 = await api('PATCH', `/records/${R}/notes/${noteId}`, { body: 'Admin edit' }, adminTok);
    check('N5 ADMIN edit чужую заметку → 200', e3.status === 200 && e3.json?.body === 'Admin edit', `status=${e3.status}`);
    const d = await api('DELETE', `/records/${R}/notes/${noteId}`);
    check('N6 soft-delete → 204', d.status === 204);
    const l2 = await api('GET', `/records/${R}/notes`);
    const dn = (l2.json?.notes ?? [])[0];
    check('N6b deleted note: body=null + placeholder + deleted=true', dn?.deleted === true && dn?.body === null && typeof dn?.placeholder === 'string', JSON.stringify(dn));
    const an = await api('POST', `/records/${AR}/notes`, { body: 'x' });
    check('N7 note на archived record → 409 RECORD_ARCHIVED', an.status === 409 && an.json?.code === 'RECORD_ARCHIVED', `status=${an.status} code=${an.json?.code}`);
    const noacc = await api('GET', `/records/${R}/notes`, undefined, member2Tok);
    check('N8 нет OBJECT READ → notes 403', noacc.status === 403, `status=${noacc.status}`);
  }

  // ── TASKS ──
  {
    const t1 = await api('POST', `/records/${R}/tasks`, { title: 'Call lead', assigneeId: memberId, priority: 'HIGH' });
    check('T1 create+assign(member) 201', t1.status === 201 && t1.json?.assignee?.id === memberId, `status=${t1.status}`);
    check('T1b Activity TASK_CREATED', (await actCount(R, 'TASK_CREATED')) >= 1);
    check('T1c TASK_ASSIGNED notify member (1)', (await notifCount(memberId)) === 1, `count=${await notifCount(memberId)}`);
    const taskId = t1.json?.id;

    const tSelf = await api('POST', `/records/${R}/tasks`, { title: 'Self task', assigneeId: ownerId });
    check('T2 self-assign → НЕТ TASK_ASSIGNED (owner)', (await notifCount(ownerId)) === 0, `ownerNotif=${await notifCount(ownerId)}`);

    const l = await api('GET', `/records/${R}/tasks`);
    check('T3 list tasks (2) + assignee/creator', (l.json?.tasks ?? []).length === 2, `n=${l.json?.tasks?.length}`);

    const c1 = await api('PATCH', `/records/${R}/tasks/${taskId}`, { status: 'COMPLETED' });
    check('T4 complete → completedAt set', c1.status === 200 && c1.json?.completedAt != null, JSON.stringify(c1.json?.completedAt));
    check('T4b Activity TASK_COMPLETED (1)', (await actCount(R, 'TASK_COMPLETED')) === 1);
    const c2 = await api('PATCH', `/records/${R}/tasks/${taskId}`, { status: 'COMPLETED' });
    check('T4c повторный complete идемпотентен (всё ещё 1 TASK_COMPLETED)', (await actCount(R, 'TASK_COMPLETED')) === 1, `count=${await actCount(R, 'TASK_COMPLETED')}`);

    // T5 reassign chain: member → admin → member (notify каждый реальный переход)
    const memberBefore = await notifCount(memberId);
    await api('PATCH', `/records/${R}/tasks/${taskId}`, { assigneeId: adminId });
    await api('PATCH', `/records/${R}/tasks/${taskId}`, { assigneeId: memberId });
    check('T5 reassign→admin→member: admin notif=1, member +1', (await notifCount(adminId)) === 1 && (await notifCount(memberId)) === memberBefore + 1, `admin=${await notifCount(adminId)} member=${await notifCount(memberId)}`);

    const bad = await api('POST', `/records/${R}/tasks`, { title: 'x', assigneeId: 'nonexistent-user' });
    check('T6 invalid assignee → 422 INVALID_ASSIGNEE', bad.status === 422 && bad.json?.code === 'INVALID_ASSIGNEE', `status=${bad.status} code=${bad.json?.code}`);

    const own = await api('PATCH', `/records/${R}/tasks/${taskId}`, { title: 'hijack' }, member2Tok);
    check('T7 не-owner/assignee/admin PATCH → 403', own.status === 403, `status=${own.status}`);

    const arch = await api('POST', `/records/${AR}/tasks`, { title: 'x' });
    check('T8 task на archived record → 409', arch.status === 409 && arch.json?.code === 'RECORD_ARCHIVED', `status=${arch.status}`);

    const badDue = await api('POST', `/records/${R}/tasks`, { title: 'x', dueAt: '2026/13/40 not-iso' });
    check('T9 не-ISO dueAt → 422', badDue.status === 422 || badDue.status === 400, `status=${badDue.status}`);
    const okDue = await api('POST', `/records/${R}/tasks`, { title: 'due ok', dueAt: '2026-07-01T00:00:00.000Z' });
    check('T9b ISO dueAt принят', okDue.status === 201 && okDue.json?.dueAt != null, JSON.stringify(okDue.json?.dueAt));
  }

  // ── адверс-фиксы: transition matrix + DELETE ownership order ──
  {
    const t = await api('POST', `/records/${R}/tasks`, { title: 'transition' });
    const tid = t.json?.id;
    await api('PATCH', `/records/${R}/tasks/${tid}`, { status: 'COMPLETED' });
    const bad = await api('PATCH', `/records/${R}/tasks/${tid}`, { status: 'CANCELED' });
    check('F1 COMPLETED→CANCELED → 422 INVALID_STATUS_TRANSITION', bad.status === 422 && bad.json?.code === 'INVALID_STATUS_TRANSITION', `status=${bad.status} code=${bad.json?.code}`);
    const reopen = await api('PATCH', `/records/${R}/tasks/${tid}`, { status: 'OPEN' });
    check('F1b COMPLETED→OPEN (reopen) разрешён + completedAt очищен', reopen.status === 200 && reopen.json?.completedAt == null, JSON.stringify(reopen.json?.completedAt));

    // note: не-владелец не получает «успех» на чужой УДАЛЁННОЙ заметке
    const nn = await api('POST', `/records/${R}/notes`, { body: 'owner note' });
    await api('DELETE', `/records/${R}/notes/${nn.json?.id}`); // owner удалил
    const nd = await api('DELETE', `/records/${R}/notes/${nn.json?.id}`, undefined, memberTok); // member по чужой удалённой
    check('F2 не-владелец DELETE чужой удалённой заметки → 403 (не 204)', nd.status === 403, `status=${nd.status}`);
  }

  // ── GENERIC custom object ──
  {
    const CR = await mkRecord(customId);
    const n = await api('POST', `/records/${CR}/notes`, { body: 'note on widget' });
    const t = await api('POST', `/records/${CR}/tasks`, { title: 'task on widget' });
    check('T10 generic: notes/tasks на КАСТОМНОМ объекте работают', n.status === 201 && t.status === 201, `note=${n.status} task=${t.status}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M27-2: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}
main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
