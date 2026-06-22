/**
 * Hermetic-тест M29-2 — BULK-run + auto-rerun. Изолированная org, живой HTTP :3001, live-LLM (DeepSeek), zero-mock.
 *
 *   B1  Bulk SUMMARIZE [s1,s2] → SUCCEEDED, successCount=2 failedCount=0 skippedCount=0,
 *       creditsSpent = success*costPerRow, оба значения source=AI; кредит списан ровно за 2.
 *   B2  Bulk CLASSIFY-без-категорий [f1,f2] → каждая строка FAILED (CLASSIFY_REQUIRES_OPTIONS),
 *       батч завершается SUCCEEDED (один упавший НЕ валит весь батч), failedCount=2 successCount=0,
 *       creditsSpent=0 (failed-строки НЕ списаны), значений нет.
 *   B3  Bulk dedup по clientRequestId: второй POST run-view с тем же clientRequestId → deduped:true,
 *       тот же bulkRunId, второго AiBulkRun/reserve нет, кредит НЕ списан повторно.
 *   B4  Bulk manual-skip [manual,fresh] skipExisting:false → SUCCEEDED success=1 skipped=1 failed=0;
 *       manual-запись НЕ изменена (source=MANUAL, текст тот же); кредит только за success.
 *   P1  Preflight [manual,fresh] skipExisting:false → manualProtected=1 willRun=1 totalInScope=2.
 *   P2  Preflight [filled,fresh] skipExisting:true → alreadyFilled=1 willRun=1 (учтено заполненное).
 *   A1  Auto-rerun: изменение НЕ-AI поля (name) → triggerAutoRerunForChange → AI-поле заполнено,
 *       AiRun.input.source='AUTO', Value.source=AI, кредит списан.
 *   A2  Идемпотентность auto-rerun: повтор с тем же sourceActivityId → второго AI-run НЕ создаётся (DEDUPED).
 *   A3  Recursion-guard: «изменение» самого AI-поля (changedAttributeId = AI-атрибут) → rerun НЕ триггерится.
 *   A4  Auto-rerun поверх MANUAL → AiRun.status=SKIPPED_MANUAL_VALUE, ручное значение НЕ перезаписано, не списано.
 */
import { PrismaClient, ValueSource, AiRunStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { runAiForRecord, triggerAutoRerunForChange } from './src/services/ai/index';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', orgId = '', ownerId = '', peopleId = '';
let sumAttrId = '', classifyAttrId = '', autoAttrId = '', nameAttrId = '';
const sumKey = 'ai_summary', classifyKey = 'ai_tier', autoKey = 'ai_autosummary';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, body?: any, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
async function mkRecord(values: Record<string, unknown>): Promise<string> {
  const rec = await prisma.record.create({ data: { orgId, objectId: peopleId, createdById: ownerId, updatedById: ownerId }, select: { id: true, orgId: true, objectId: true } });
  await prisma.$transaction((tx) => writeValues(tx, rec, values, { actorId: ownerId }));
  return rec.id;
}
async function valOf(recordId: string, attributeId: string) {
  return prisma.value.findUnique({ where: { recordId_attributeId: { recordId, attributeId } }, select: { source: true, lastAiRunId: true, longTextValue: true, textValue: true } });
}
async function balance(): Promise<number> {
  const b = await prisma.creditBalance.findUnique({ where: { orgId }, select: { remainingCredits: true } });
  return b?.remainingCredits ?? 0;
}

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M29-2 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m292_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  nameAttrId = (await prisma.attribute.findFirstOrThrow({ where: { orgId, objectId: peopleId, key: 'name' }, select: { id: true } })).id;
  // щедрый баланс, чтобы тесты не упёрлись в 402
  await prisma.creditBalance.upsert({ where: { orgId }, create: { orgId, monthlyCredits: 1000, purchasedCredits: 0, usedCredits: 0, remainingCredits: 1000 }, update: { remainingCredits: 1000, usedCredits: 0, monthlyCredits: 1000 } });
  // SUMMARIZE (стабилен на live-LLM)
  sumAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: sumKey, name: 'AI Summary', type: 'LONG_TEXT', aiEnabled: true, aiType: 'SUMMARIZE', order: 50 }, select: { id: true } })).id;
  // CLASSIFY БЕЗ опций/categories → каждая строка FAILED (CLASSIFY_REQUIRES_OPTIONS)
  classifyAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: classifyKey, name: 'AI Tier', type: 'TEXT', aiEnabled: true, aiType: 'CLASSIFY', order: 51 }, select: { id: true } })).id;
  // SUMMARIZE c autoRerun (зависит от любого не-AI поля)
  autoAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: autoKey, name: 'AI Auto Summary', type: 'LONG_TEXT', aiEnabled: true, aiType: 'SUMMARIZE', order: 52, aiConfig: { autoRerun: true, sourceMode: 'all_non_ai' } }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m292_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}
async function cleanup() {
  for (const t of ['activity', 'creditTransaction', 'aiRun', 'aiBulkRun', 'value', 'record', 'attribute', 'object', 'creditBalance', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

// bulk асинхронный: поллим GET /api/ai/bulk-runs/:id до SUCCEEDED/FAILED. skippedCount теперь в ответе.
async function pollBulk(bulkRunId: string): Promise<any> {
  for (let i = 0; i < 30; i++) {
    const r = await api('GET', `/ai/bulk-runs/${bulkRunId}`);
    const st = r.json?.status;
    if (st === 'SUCCEEDED' || st === 'FAILED') return r.json;
    await new Promise((s) => setTimeout(s, 800));
  }
  return null;
}

// run-view с retry на 503 (сетевой сбой live-LLM на старте редок, но подстрахуемся)
async function startBulk(attributeId: string, body: any): Promise<{ status: number; json: any }> {
  let r = await api('POST', `/attributes/${attributeId}/ai/run-view`, body);
  if (r.status === 503) { await new Promise((s) => setTimeout(s, 1500)); r = await api('POST', `/attributes/${attributeId}/ai/run-view`, body); }
  return r;
}

async function main() {
  await setup();

  // ── B1 bulk SUMMARIZE [s1,s2] → success=2, оба source=AI, списано ровно 2 ──
  let s1 = '', s2 = '';
  {
    s1 = await mkRecord({ name: 'Acme One', email: 'one@acme.co' });
    s2 = await mkRecord({ name: 'Acme Two', email: 'two@acme.co' });
    const bBefore = await balance();
    const start = await startBulk(sumAttrId, { recordIds: [s1, s2], skipExisting: false, clientRequestId: 'm292-sum-1' });
    const bulk = start.json?.bulkRunId ? await pollBulk(start.json.bulkRunId) : null;
    const v1 = await valOf(s1, sumAttrId);
    const v2 = await valOf(s2, sumAttrId);
    const bAfter = await balance();
    const charged = bBefore - bAfter;
    check('B1 bulk SUMMARIZE [s1,s2] → SUCCEEDED success=2 failed=0 skipped=0, оба source=AI, creditsSpent=success*cost, списано ровно 2',
      !!bulk && bulk.status === 'SUCCEEDED' && bulk.successCount === 2 && bulk.failedCount === 0 && bulk.skippedCount === 0 &&
      bulk.creditsSpent === 2 && v1?.source === ValueSource.AI && v2?.source === ValueSource.AI && charged === 2,
      JSON.stringify({ st: bulk?.status, succ: bulk?.successCount, fail: bulk?.failedCount, skip: bulk?.skippedCount, spent: bulk?.creditsSpent, charged }));
  }

  // ── B2 bulk CLASSIFY-без-категорий [f1,f2] → каждая FAILED, батч SUCCEEDED, не списано ──
  {
    const f1 = await mkRecord({ name: 'Fail One', email: 'f1@acme.co' });
    const f2 = await mkRecord({ name: 'Fail Two', email: 'f2@acme.co' });
    const bBefore = await balance();
    const start = await startBulk(classifyAttrId, { recordIds: [f1, f2], skipExisting: false, clientRequestId: 'm292-cls-1' });
    const bulk = start.json?.bulkRunId ? await pollBulk(start.json.bulkRunId) : null;
    const vf1 = await valOf(f1, classifyAttrId);
    const bAfter = await balance();
    // sanity: per-record runs действительно FAILED именно из-за отсутствия категорий
    const failedRuns = await prisma.aiRun.count({ where: { orgId, attributeId: classifyAttrId, status: AiRunStatus.FAILED } });
    check('B2 bulk CLASSIFY-no-options [f1,f2] → батч SUCCEEDED (один упавший не валит батч), failed=2 success=0, creditsSpent=0, значений нет, кредит не списан',
      !!bulk && bulk.status === 'SUCCEEDED' && bulk.failedCount === 2 && bulk.successCount === 0 && bulk.creditsSpent === 0 &&
      vf1 === null && bBefore === bAfter && failedRuns === 2,
      JSON.stringify({ st: bulk?.status, fail: bulk?.failedCount, succ: bulk?.successCount, spent: bulk?.creditsSpent, charged: bBefore - bAfter, failedRuns }));
  }

  // ── B3 bulk dedup по clientRequestId: повтор → deduped:true, тот же bulkRunId, без второго AiBulkRun/charge ──
  {
    const d1 = await mkRecord({ name: 'Dedup One', email: 'd1@acme.co' });
    const crid = 'm292-dedup-1';
    const first = await startBulk(sumAttrId, { recordIds: [d1], skipExisting: false, clientRequestId: crid });
    const firstId = first.json?.bulkRunId;
    if (firstId) await pollBulk(firstId); // дождаться завершения первого
    const bAfterFirst = await balance();
    const bulkCountBefore = await prisma.aiBulkRun.count({ where: { orgId, clientRequestId: crid } });
    // второй POST с тем же ключом
    const second = await api('POST', `/attributes/${sumAttrId}/ai/run-view`, { recordIds: [d1], skipExisting: false, clientRequestId: crid });
    const bAfterSecond = await balance();
    const bulkCountAfter = await prisma.aiBulkRun.count({ where: { orgId, clientRequestId: crid } });
    check('B3 bulk dedup: повтор run-view с тем же clientRequestId → deduped:true, тот же bulkRunId, второго AiBulkRun нет, кредит не списан повторно',
      second.json?.deduped === true && second.json?.bulkRunId === firstId && bulkCountBefore === 1 && bulkCountAfter === 1 && bAfterSecond === bAfterFirst,
      JSON.stringify({ deduped: second.json?.deduped, sameId: second.json?.bulkRunId === firstId, before: bulkCountBefore, after: bulkCountAfter, chargedAgain: bAfterFirst - bAfterSecond }));
  }

  // ── B4 bulk manual-skip [manual,fresh] skipExisting:false → success=1 skipped=1, manual не тронут ──
  let manualRec = '', freshRec = '';
  {
    manualRec = await mkRecord({ name: 'Manual Person', email: 'manual@acme.co' });
    await api('PATCH', `/records/${manualRec}`, { values: { [sumKey]: 'Manually curated note.' } }); // source=MANUAL
    freshRec = await mkRecord({ name: 'Fresh Person', email: 'fresh@acme.co' });
    const bBefore = await balance();
    const start = await startBulk(sumAttrId, { recordIds: [manualRec, freshRec], skipExisting: false, clientRequestId: 'm292-skip-1' });
    const bulk = start.json?.bulkRunId ? await pollBulk(start.json.bulkRunId) : null;
    const vm = await valOf(manualRec, sumAttrId);
    const vf = await valOf(freshRec, sumAttrId);
    const bAfter = await balance();
    check('B4 bulk [manual,fresh] skipExisting:false → SUCCEEDED success=1 skipped=1 failed=0, manual НЕ изменён (MANUAL, текст тот же), fresh=AI, списано только за success',
      !!bulk && bulk.status === 'SUCCEEDED' && bulk.successCount === 1 && bulk.skippedCount === 1 && bulk.failedCount === 0 &&
      vm?.source === ValueSource.MANUAL && vm?.longTextValue === 'Manually curated note.' && vf?.source === ValueSource.AI &&
      bulk.creditsSpent === 1 && (bBefore - bAfter) === 1,
      JSON.stringify({ st: bulk?.status, succ: bulk?.successCount, skip: bulk?.skippedCount, fail: bulk?.failedCount, vmSrc: vm?.source, vfSrc: vf?.source, spent: bulk?.creditsSpent, charged: bBefore - bAfter }));
  }

  // ── P1 preflight [manual,fresh] skipExisting:false → manualProtected=1 willRun=1 totalInScope=2 ──
  {
    const r = await api('POST', `/attributes/${sumAttrId}/ai/run-view/preflight`, { recordIds: [manualRec, freshRec], skipExisting: false });
    check('P1 preflight [manual,fresh] skipExisting:false → manualProtected=1, willRun=1, totalInScope=2',
      r.status === 200 && r.json?.manualProtected === 1 && r.json?.willRun === 1 && r.json?.totalInScope === 2,
      JSON.stringify({ mp: r.json?.manualProtected, wr: r.json?.willRun, tot: r.json?.totalInScope }));
  }

  // ── P2 preflight [filled,fresh] skipExisting:true → alreadyFilled=1 willRun=1 ──
  {
    // freshRec теперь заполнен AI после B4; берём ещё одну пустую запись
    const fresh2 = await mkRecord({ name: 'Fresh Two', email: 'fresh2@acme.co' });
    const r = await api('POST', `/attributes/${sumAttrId}/ai/run-view/preflight`, { recordIds: [freshRec, fresh2], skipExisting: true });
    check('P2 preflight [filled,fresh] skipExisting:true → alreadyFilled=1, willRun=1, totalInScope=2 (заполненное учтено)',
      r.status === 200 && r.json?.alreadyFilled === 1 && r.json?.willRun === 1 && r.json?.totalInScope === 2,
      JSON.stringify({ af: r.json?.alreadyFilled, wr: r.json?.willRun, tot: r.json?.totalInScope }));
  }

  // ── A1 auto-rerun: изменение НЕ-AI поля → AI-поле заполнено (source AUTO в run, AI в value), списано ──
  let arRec = '';
  let arActivityId = '';
  {
    arRec = await mkRecord({ name: 'Auto Person', email: 'auto@acme.co' });
    // реальный sourceActivityId — Activity об изменении не-AI поля (как делает records.ts)
    arActivityId = (await prisma.activity.create({ data: { orgId, recordId: arRec, actorId: ownerId, type: 'VALUE_UPDATED', title: 'name changed', payload: { attributeId: nameAttrId } as any }, select: { id: true } })).id;
    const bBefore = await balance();
    await triggerAutoRerunForChange({ orgId, recordId: arRec, objectId: peopleId, changedAttributeId: nameAttrId, sourceActivityId: arActivityId });
    const v = await valOf(arRec, autoAttrId);
    const bAfter = await balance();
    // последний AiRun по autoAttr+arRec должен иметь input.source='AUTO' и SUCCEEDED
    const run = await prisma.aiRun.findFirst({ where: { orgId, attributeId: autoAttrId, recordId: arRec }, orderBy: { createdAt: 'desc' }, select: { status: true, input: true } });
    const runSource = (run?.input as { source?: string } | null)?.source ?? null;
    check('A1 auto-rerun: изменение не-AI поля → AI-поле заполнено, AiRun.input.source=AUTO, Value.source=AI, кредит списан',
      run?.status === AiRunStatus.SUCCEEDED && runSource === 'AUTO' && v?.source === ValueSource.AI && !!v?.lastAiRunId && (bBefore - bAfter) === 1,
      JSON.stringify({ runSt: run?.status, runSrc: runSource, vSrc: v?.source, charged: bBefore - bAfter }));
  }

  // ── A2 идемпотентность auto-rerun: повтор с тем же sourceActivityId → нет второго run, не списано ──
  {
    const runsBefore = await prisma.aiRun.count({ where: { orgId, attributeId: autoAttrId, recordId: arRec } });
    const bBefore = await balance();
    await triggerAutoRerunForChange({ orgId, recordId: arRec, objectId: peopleId, changedAttributeId: nameAttrId, sourceActivityId: arActivityId });
    const runsAfter = await prisma.aiRun.count({ where: { orgId, attributeId: autoAttrId, recordId: arRec } });
    const bAfter = await balance();
    check('A2 idempotency auto-rerun: повтор с тем же sourceActivityId → второго AI-run НЕ создано (dedup по auto-rerun:<rec>:<attr>:<srcAct>), не списано',
      runsBefore === runsAfter && bBefore === bAfter && runsBefore >= 1,
      JSON.stringify({ before: runsBefore, after: runsAfter, chargedAgain: bBefore - bAfter }));
  }

  // ── A3 recursion-guard: «изменение» самого AI-поля → rerun НЕ триггерится ──
  {
    const rec = await mkRecord({ name: 'Recursion Person', email: 'rec@acme.co' });
    const act = (await prisma.activity.create({ data: { orgId, recordId: rec, actorId: ownerId, type: 'VALUE_UPDATED', title: 'ai field changed', payload: { attributeId: autoAttrId } as any }, select: { id: true } })).id;
    const runsBefore = await prisma.aiRun.count({ where: { orgId, attributeId: autoAttrId, recordId: rec } });
    // changedAttributeId = САМ AI-атрибут (aiEnabled=true) → guard должен вернуть без rerun
    await triggerAutoRerunForChange({ orgId, recordId: rec, objectId: peopleId, changedAttributeId: autoAttrId, sourceActivityId: act });
    const runsAfter = await prisma.aiRun.count({ where: { orgId, attributeId: autoAttrId, recordId: rec } });
    check('A3 recursion-guard: изменение самого AI-поля (changedAttributeId=AI-атрибут) → rerun НЕ запущен (нет нового AiRun)',
      runsBefore === 0 && runsAfter === 0,
      JSON.stringify({ before: runsBefore, after: runsAfter }));
  }

  // ── A4 auto-rerun поверх MANUAL → SKIPPED_MANUAL_VALUE, ручное не перезаписано, не списано ──
  {
    const rec = await mkRecord({ name: 'Manual Auto Person', email: 'ma@acme.co' });
    // вручную заполняем AUTO-атрибут → source=MANUAL
    await api('PATCH', `/records/${rec}`, { values: { [autoKey]: 'Human wrote this auto-field.' } });
    const act = (await prisma.activity.create({ data: { orgId, recordId: rec, actorId: ownerId, type: 'VALUE_UPDATED', title: 'name changed', payload: { attributeId: nameAttrId } as any }, select: { id: true } })).id;
    const bBefore = await balance();
    await triggerAutoRerunForChange({ orgId, recordId: rec, objectId: peopleId, changedAttributeId: nameAttrId, sourceActivityId: act });
    const v = await valOf(rec, autoAttrId);
    const bAfter = await balance();
    const run = await prisma.aiRun.findFirst({ where: { orgId, attributeId: autoAttrId, recordId: rec }, orderBy: { createdAt: 'desc' }, select: { status: true } });
    check('A4 auto-rerun поверх MANUAL → AiRun.status=SKIPPED_MANUAL_VALUE, ручное значение НЕ перезаписано (MANUAL, текст тот же), не списано',
      run?.status === AiRunStatus.SKIPPED_MANUAL_VALUE && v?.source === ValueSource.MANUAL && v?.longTextValue === 'Human wrote this auto-field.' && bBefore === bAfter,
      JSON.stringify({ runSt: run?.status, vSrc: v?.source, charged: bBefore - bAfter }));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M29-2: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(', '));
  return passed === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
