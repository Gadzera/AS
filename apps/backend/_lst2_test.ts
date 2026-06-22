/**
 * Hermetic-тест LST-2 (Module 6 Lists · pipeline). Изолированная org, живой HTTP :3001, zero-mock.
 *   P1  create PIPELINE → дефолтные стадии seeded + audit LIST_STAGE_CONFIG_UPDATED
 *   P2  custom stages валидируются; duplicate keys → 422; пустые → 422
 *   P3  bulk add → первая стадия, позиции 0..n append; дедуп; честные created/skipped
 *   P4  move в другую стадию/позицию персистит; rebalance 0..n-1; GET показывает новую стадию
 *   P5  move идемпотентен: та же стадия+индекс → {moved:false}, без новой Activity
 *   P6  move в несуществующую стадию → 422 INVALID_STAGE
 *   P7  два move подряд → детерминированный порядок после reload
 *   P8  PATCH config reorder → entries НЕ двигаются (стадия по key стабильна); label/color правятся
 *   P9  удалить стадию с entries без moveToStage → 409 STAGE_HAS_ENTRIES; с moveToStage → переселяет
 *   P10 move пишет Activity LIST_STAGE_CHANGED + audit LIST_ENTRY_STAGE_MOVED; НЕ трогает values (move ≠ record update)
 *   P11 move/config на STATIC → 400 (LIST_MOVE_REQUIRES_PIPELINE / LIST_STAGES_REQUIRE_PIPELINE)
 *   P12 RBAC: move/config требуют LIST READ_WRITE (member с LIST READ → 403)
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues, recordSerializationInclude, serializeRecord } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerToken = '';
let memberToken = '';
let orgId = '';
let userId = '';
let memberId = '';
let companiesId = '';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }

async function api(method: string, path: string, body?: unknown, token = ownerToken): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}
async function seedCompany(name: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const rec = await tx.record.create({ data: { orgId, objectId: companiesId, createdById: userId, updatedById: userId } });
    await writeValues(tx, rec, { name }, { actorId: userId });
    return rec.id;
  });
}
async function recValues(recordId: string): Promise<Record<string, unknown>> {
  const r = await prisma.record.findUniqueOrThrow({ where: { id: recordId }, include: recordSerializationInclude });
  return serializeRecord(r).values as Record<string, unknown>;
}
// карта recordId → {stage, position} из GET /:id
async function membership(listId: string): Promise<Record<string, { stage: string | null; pos: number }>> {
  const g = await api('GET', `/lists/${listId}`);
  const out: Record<string, { stage: string | null; pos: number }> = {};
  (g.json?.records ?? []).forEach((r: any, i: number) => { out[r.id] = { stage: r.stage ?? null, pos: i }; });
  return out;
}
// порядок recordId внутри стадии по факту (через /:id/records, отсортирован position asc)
async function stageOrder(listId: string, stage: string): Promise<string[]> {
  const g = await api('GET', `/lists/${listId}/records?limit=200`);
  return (g.json?.records ?? []).filter((r: any) => r.stage === stage).map((r: any) => r.id);
}

async function setup() {
  const org = await prisma.organization.create({ data: { name: 'LST-2 Pipeline Org' } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { email: `lst2_owner_${org.id}@test.local`, passwordHash: 'x', name: 'LST2 Owner', role: 'OWNER', orgId, tokenVersion: 0 } });
  userId = user.id;
  const member = await prisma.user.create({ data: { email: `lst2_member_${org.id}@test.local`, passwordHash: 'x', name: 'LST2 Member', role: 'MEMBER', orgId, tokenVersion: 0 } });
  memberId = member.id;
  await ensureCrmForOrg(orgId);
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  ownerToken = jwt.sign({ userId, orgId, email: user.email, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberToken = jwt.sign({ userId: memberId, orgId, email: member.email, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}
async function cleanup() {
  await prisma.listEntry.deleteMany({ where: { orgId } });
  await prisma.list.deleteMany({ where: { orgId } });
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
  const recA = await seedCompany('Alpha');
  const recB = await seedCompany('Bravo');
  const recC = await seedCompany('Charlie');

  // ── P1: create PIPELINE → дефолтные стадии ──
  let pipeId = '';
  {
    const r = await api('POST', '/lists', { name: 'Sales pipeline', objectKey: 'companies', type: 'PIPELINE' });
    check('P1a create PIPELINE → 201', r.status === 201, `status=${r.status}`);
    pipeId = r.json?.id;
    const stages = r.json?.config?.stages ?? [];
    check('P1b дефолтные стадии (lead,in_progress,won,lost)', stages.map((s: any) => s.key).join(',') === 'lead,in_progress,won,lost', JSON.stringify(stages.map((s: any) => s.key)));
    const a = await prisma.auditLog.count({ where: { orgId, action: 'LIST_STAGE_CONFIG_UPDATED', targetId: pipeId } });
    check('P1c audit LIST_STAGE_CONFIG_UPDATED', a >= 1, `count=${a}`);
  }

  // ── P2: custom stages валидация ──
  {
    const dup = await api('POST', '/lists', { name: 'dup', objectKey: 'companies', type: 'PIPELINE', stages: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A2' }] });
    check('P2a duplicate keys → 422 DUPLICATE_STAGE_KEY', dup.status === 422 && dup.json?.code === 'DUPLICATE_STAGE_KEY', `status=${dup.status} code=${dup.json?.code}`);
    const empty = await api('POST', '/lists', { name: 'empty', objectKey: 'companies', type: 'PIPELINE', stages: [] });
    // пустой массив → zod min(1)? нет, stages в createSchema = z.array(z.unknown()).optional() без min; validateStages бросит INVALID_STAGES
    check('P2b пустые стадии → 422 INVALID_STAGES', empty.status === 422 && empty.json?.code === 'INVALID_STAGES', `status=${empty.status} code=${empty.json?.code}`);
    const custom = await api('POST', '/lists', { name: 'custom', objectKey: 'companies', type: 'PIPELINE', stages: [{ key: 'new', label: 'New', color: '#111' }, { key: 'done', label: 'Done' }] });
    check('P2c custom stages приняты', custom.status === 201 && (custom.json?.config?.stages ?? []).length === 2, JSON.stringify(custom.json?.config?.stages));
  }

  // ── P3: bulk add → первая стадия, позиции append, дедуп ──
  {
    const add = await api('POST', `/lists/${pipeId}/entries`, { recordIds: [recA, recB, recC] });
    check('P3a added=3', add.json?.added === 3, JSON.stringify(add.json));
    const m = await membership(pipeId);
    check('P3b все в первой стадии lead', [recA, recB, recC].every((id) => m[id]?.stage === 'lead'), JSON.stringify(m));
    const order = await stageOrder(pipeId, 'lead');
    check('P3c порядок append A,B,C', JSON.stringify(order) === JSON.stringify([recA, recB, recC]), JSON.stringify(order));
    // дедуп: повторный add → skipped, не дублируется
    const again = await api('POST', `/lists/${pipeId}/entries`, { recordIds: [recA, recB] });
    check('P3d повторный add → added=0 (дедуп)', again.json?.added === 0, JSON.stringify(again.json));
    const cnt = await prisma.listEntry.count({ where: { orgId, listId: pipeId, archivedAt: null } });
    check('P3e ровно 3 entries', cnt === 3, `count=${cnt}`);
  }

  // ── P4: move в другую стадию/позицию ──
  {
    const mv = await api('PATCH', `/lists/${pipeId}/entries/${recA}/move`, { stage: 'in_progress', position: 0 });
    check('P4a move A→in_progress[0] → moved:true', mv.status === 200 && mv.json?.moved === true && mv.json?.to === 'in_progress', JSON.stringify(mv.json));
    const m = await membership(pipeId);
    check('P4b A теперь in_progress', m[recA]?.stage === 'in_progress', JSON.stringify(m[recA]));
    const lead = await stageOrder(pipeId, 'lead');
    check('P4c lead уплотнён до B,C', JSON.stringify(lead) === JSON.stringify([recB, recC]), JSON.stringify(lead));
  }

  // ── P5: идемпотентность (no-op без Activity) ──
  {
    const before = await prisma.activity.count({ where: { orgId, recordId: recA, type: 'LIST_STAGE_CHANGED' } });
    const mv = await api('PATCH', `/lists/${pipeId}/entries/${recA}/move`, { stage: 'in_progress', position: 0 });
    check('P5a повтор того же move → moved:false', mv.status === 200 && mv.json?.moved === false, JSON.stringify(mv.json));
    const after = await prisma.activity.count({ where: { orgId, recordId: recA, type: 'LIST_STAGE_CHANGED' } });
    check('P5b no-op НЕ создал новую Activity', before === after, `before=${before} after=${after}`);
  }

  // ── P6: invalid stage ──
  {
    const mv = await api('PATCH', `/lists/${pipeId}/entries/${recB}/move`, { stage: 'nonexistent', position: 0 });
    check('P6 move в несуществующую стадию → 422 INVALID_STAGE', mv.status === 422 && mv.json?.code === 'INVALID_STAGE', `status=${mv.status} code=${mv.json?.code}`);
  }

  // ── P7: два move подряд → детерминированный порядок после reload ──
  {
    await api('PATCH', `/lists/${pipeId}/entries/${recB}/move`, { stage: 'in_progress', position: 0 }); // B перед A
    await api('PATCH', `/lists/${pipeId}/entries/${recC}/move`, { stage: 'in_progress', position: 2 }); // C в конец
    const order = await stageOrder(pipeId, 'in_progress');
    check('P7 порядок после двух move (reload): B,A,C', JSON.stringify(order) === JSON.stringify([recB, recA, recC]), JSON.stringify(order));
  }

  // ── P8: reorder стадий НЕ двигает entries ──
  {
    const before = await membership(pipeId);
    const r = await api('PATCH', `/lists/${pipeId}/config`, { stages: [{ key: 'in_progress', label: 'Working', color: '#0af' }, { key: 'lead', label: 'Lead' }, { key: 'won', label: 'Won' }, { key: 'lost', label: 'Lost' }] });
    check('P8a reorder+rename config → 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json?.error ?? '')}`);
    const after = await membership(pipeId);
    const sameStages = Object.keys(before).every((id) => before[id].stage === after[id].stage);
    check('P8b entries сохранили свои стадии (reorder не двигает)', sameStages, JSON.stringify({ before, after }));
    const stages = r.json?.config?.stages ?? [];
    check('P8c label/color обновлены (in_progress→Working #0af)', stages[0]?.key === 'in_progress' && stages[0]?.label === 'Working' && stages[0]?.color === '#0af', JSON.stringify(stages[0]));
  }

  // ── P9: удалить стадию с entries ──
  {
    // 'in_progress' содержит B,A,C → удаление без moveToStage запрещено
    const no = await api('PATCH', `/lists/${pipeId}/config`, { stages: [{ key: 'lead', label: 'Lead' }, { key: 'won', label: 'Won' }, { key: 'lost', label: 'Lost' }] });
    check('P9a remove стадии с entries без moveToStage → 409 STAGE_HAS_ENTRIES', no.status === 409 && no.json?.code === 'STAGE_HAS_ENTRIES', `status=${no.status} code=${no.json?.code}`);
    const yes = await api('PATCH', `/lists/${pipeId}/config`, { stages: [{ key: 'lead', label: 'Lead' }, { key: 'won', label: 'Won' }, { key: 'lost', label: 'Lost' }], moveToStage: 'lead' });
    check('P9b с moveToStage=lead → 200', yes.status === 200, `status=${yes.status} ${JSON.stringify(yes.json?.error ?? '')}`);
    const m = await membership(pipeId);
    check('P9c B,A,C переселены в lead', [recA, recB, recC].every((id) => m[id]?.stage === 'lead'), JSON.stringify(m));
  }

  // ── P10: move пишет Activity+audit, НЕ трогает values ──
  {
    const valsBefore = await recValues(recA);
    const auditBefore = await prisma.auditLog.count({ where: { orgId, action: 'LIST_ENTRY_STAGE_MOVED' } });
    await api('PATCH', `/lists/${pipeId}/entries/${recA}/move`, { stage: 'won', position: 0 });
    const valsAfter = await recValues(recA);
    check('P10a move НЕ изменил values записи (move ≠ record update)', JSON.stringify(valsBefore) === JSON.stringify(valsAfter), 'values changed?');
    const recUpd = await prisma.activity.count({ where: { orgId, recordId: recA, type: 'RECORD_UPDATED' } });
    check('P10b move НЕ создал RECORD_UPDATED Activity', recUpd === 0, `count=${recUpd}`);
    const stageAct = await prisma.activity.count({ where: { orgId, recordId: recA, type: 'LIST_STAGE_CHANGED' } });
    check('P10c есть Activity LIST_STAGE_CHANGED на запись', stageAct >= 1, `count=${stageAct}`);
    const auditAfter = await prisma.auditLog.count({ where: { orgId, action: 'LIST_ENTRY_STAGE_MOVED' } });
    check('P10d audit LIST_ENTRY_STAGE_MOVED +1', auditAfter === auditBefore + 1, `before=${auditBefore} after=${auditAfter}`);
  }

  // ── P11: move/config на STATIC → 400 ──
  {
    const s = await api('POST', '/lists', { name: 'static', objectKey: 'companies', type: 'STATIC' });
    await api('POST', `/lists/${s.json?.id}/entries`, { recordIds: [recA] });
    const mv = await api('PATCH', `/lists/${s.json?.id}/entries/${recA}/move`, { stage: 'x', position: 0 });
    check('P11a move на STATIC → 400 LIST_MOVE_REQUIRES_PIPELINE', mv.status === 400 && mv.json?.code === 'LIST_MOVE_REQUIRES_PIPELINE', `status=${mv.status} code=${mv.json?.code}`);
    const cfg = await api('PATCH', `/lists/${s.json?.id}/config`, { stages: [{ key: 'a', label: 'A' }] });
    check('P11b config на STATIC → 400 LIST_STAGES_REQUIRE_PIPELINE', cfg.status === 400 && cfg.json?.code === 'LIST_STAGES_REQUIRE_PIPELINE', `status=${cfg.status} code=${cfg.json?.code}`);
  }

  // ── P12: RBAC — move/config требуют LIST READ_WRITE ──
  {
    await setGrant(orgId, userId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'LIST', entityKey: '*', level: 'READ' });
    const mv = await api('PATCH', `/lists/${pipeId}/entries/${recB}/move`, { stage: 'won', position: 0 }, memberToken);
    check('P12a member (LIST READ) move → 403', mv.status === 403, `status=${mv.status}`);
    const cfg = await api('PATCH', `/lists/${pipeId}/config`, { stages: [{ key: 'lead', label: 'Lead' }] }, memberToken);
    check('P12b member (LIST READ) config → 403', cfg.status === 403, `status=${cfg.status}`);
  }

  // ── P13: реактивация архивной entry в УДАЛЁННУЮ стадию → первая стадия, не Unknown (адверс-фикс) ──
  {
    const p = await api('POST', '/lists', { name: 'reactivation', objectKey: 'companies', type: 'PIPELINE', stages: [{ key: 'lead', label: 'Lead' }, { key: 'work', label: 'Work' }] });
    const pid = p.json?.id;
    await api('POST', `/lists/${pid}/entries`, { recordIds: [recA] }); // recA → lead
    await api('DELETE', `/lists/${pid}/entries/${recA}`); // архивируем
    // удаляем стадию lead (recA архивна → affected=0, удаление разрешено)
    const cfg = await api('PATCH', `/lists/${pid}/config`, { stages: [{ key: 'work', label: 'Work' }] });
    check('P13a удаление стадии lead (entry архивна) → 200', cfg.status === 200, `status=${cfg.status}`);
    // заново добавляем recA — прежняя стадия lead удалена → должна стать первой (work), не Unknown
    await api('POST', `/lists/${pid}/entries`, { recordIds: [recA] });
    const m = await membership(pid);
    check('P13b реактивация в первую стадию (work), не в удалённую/Unknown', m[recA]?.stage === 'work', JSON.stringify(m[recA]));
  }

  // ── P14: конкурентные move в одну стадию → позиции уникальны 0..n-1 (Serializable+retry, адверс-фикс) ──
  {
    const p = await api('POST', '/lists', { name: 'race', objectKey: 'companies', type: 'PIPELINE', stages: [{ key: 'lead', label: 'Lead' }, { key: 'won', label: 'Won' }] });
    const pid = p.json?.id;
    await api('POST', `/lists/${pid}/entries`, { recordIds: [recA, recB, recC] }); // все в lead
    // три параллельных move в won на позицию 0
    await Promise.all([
      api('PATCH', `/lists/${pid}/entries/${recA}/move`, { stage: 'won', position: 0 }),
      api('PATCH', `/lists/${pid}/entries/${recB}/move`, { stage: 'won', position: 0 }),
      api('PATCH', `/lists/${pid}/entries/${recC}/move`, { stage: 'won', position: 0 }),
    ]);
    const won = await prisma.listEntry.findMany({ where: { orgId, listId: pid, archivedAt: null, stage: 'won' }, select: { position: true } });
    const positions = won.map((e) => e.position).sort((a, b) => a - b);
    const distinct = new Set(positions).size === positions.length;
    check('P14a все 3 в won', won.length === 3, `count=${won.length}`);
    check('P14b позиции уникальны без дублей (гонка не сломала rebalance)', distinct && JSON.stringify(positions) === JSON.stringify([0, 1, 2]), JSON.stringify(positions));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== LST-2: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup err', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
