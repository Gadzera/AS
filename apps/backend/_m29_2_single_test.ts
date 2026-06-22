/**
 * Hermetic-тест M29-2 — Одиночный AI-run + кредиты. Изолированная org, живой HTTP :3001, zero-mock, live-LLM.
 *   S1  single SUMMARIZE run → SUCCEEDED: Value записан (source=AI), AiRun=SUCCEEDED, РОВНО одна Activity VALUE_UPDATED,
 *       РОВНО одна CreditTransaction DEBIT (ai-run:<runId>), баланс −creditsCost.
 *   S2  charge-once: один успешный run = РОВНО один DEBIT (idempotent дебет по ключу ai-run:<runId>); повторный run даёт новый runId.
 *   S3  FAILED не списывает: CLASSIFY без опций/categories → run FAILED (503/status FAILED): Value НЕ записан, AiRun=FAILED,
 *       баланс НЕ изменился, нет Activity VALUE_UPDATED по этой записи.
 *   S4  credit-guard 402: remainingCredits=0 → SUMMARIZE run → HTTP 402 {code:INSUFFICIENT_CREDITS, required, available, source};
 *       AiRun RUNNING/SUCCEEDED НЕ создан, баланс не ушёл в минус. Затем баланс возвращён.
 *   S5  dedup на уровне сервиса: runAiForRecord дважды с одним idempotencyKey 'k1' → 2-й ответ DEDUPED, второго AiRun/charge нет
 *       (count AiRun по этому ключу = 1, DEBIT по ключу один).
 */
import { PrismaClient, ValueSource } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { runAiForRecord } from './src/services/ai/index';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', orgId = '', ownerId = '', peopleId = '', sumAttrId = '', classAttrId = '';
const sumKey = 'ai_summary', classKey = 'ai_tier';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); }
async function api(method: string, path: string, body?: any, tok = ownerTok): Promise<{ status: number; json: any }> {
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
// Пустая запись с контекстом (значения через прямую запись Value, без AI-атрибута — чтобы LLM было что суммаризировать).
async function mkRecord(): Promise<string> {
  return (await prisma.record.create({ data: { orgId, objectId: peopleId, displayName: 'Acme Lead', createdById: ownerId, updatedById: ownerId }, select: { id: true } })).id;
}
async function setContext(recordId: string) {
  const nameAttr = await prisma.attribute.findFirstOrThrow({ where: { orgId, objectId: peopleId, key: 'name' }, select: { id: true } });
  await prisma.value.upsert({
    where: { recordId_attributeId: { recordId, attributeId: nameAttr.id } },
    create: { orgId, recordId, attributeId: nameAttr.id, textValue: 'Acme Lead, VP Sales at Acme Inc, evaluating outbound tooling, 120 employees, Series A' },
    update: { textValue: 'Acme Lead, VP Sales at Acme Inc, evaluating outbound tooling, 120 employees, Series A' },
  });
}
async function balance(): Promise<number> {
  const b = await prisma.creditBalance.findUnique({ where: { orgId }, select: { remainingCredits: true } });
  return b?.remainingCredits ?? 0;
}
const valOf = (recordId: string, attributeId: string) =>
  prisma.value.findUnique({ where: { recordId_attributeId: { recordId, attributeId } }, select: { source: true, lastAiRunId: true, longTextValue: true, textValue: true } });

// SUMMARIZE стабильно SUCCEEDED на live-LLM; на сетевой 503 — один ретрай (как runAi() в _m29_1_test.ts).
async function runSummarize(recordId: string): Promise<{ status: number; json: any }> {
  let r = await api('POST', `/attributes/${sumAttrId}/ai/run`, { recordId, source: 'CELL' });
  if (r.status === 503) { await new Promise((s) => setTimeout(s, 1500)); r = await api('POST', `/attributes/${sumAttrId}/ai/run`, { recordId, source: 'CELL' }); }
  return r;
}

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M29-2 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m292_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  await prisma.creditBalance.upsert({ where: { orgId }, create: { orgId, monthlyCredits: 1000, purchasedCredits: 0, usedCredits: 0, remainingCredits: 1000 }, update: { remainingCredits: 1000, usedCredits: 0 } });
  // SUMMARIZE (LONG_TEXT) — стабильный успех; CLASSIFY (TEXT) без опций и без aiConfig.categories — гарантированный FAILED.
  sumAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: sumKey, name: 'AI Summary', type: 'LONG_TEXT', aiEnabled: true, aiType: 'SUMMARIZE', order: 50 }, select: { id: true } })).id;
  classAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: classKey, name: 'AI Tier', type: 'TEXT', aiEnabled: true, aiType: 'CLASSIFY', order: 51 }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m292_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}
async function cleanup() {
  for (const t of ['activity', 'creditTransaction', 'aiRun', 'aiBulkRun', 'value', 'record', 'attribute', 'object', 'creditBalance', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

// Счётчики
const valueUpdatedActs = (recordId: string) => prisma.activity.count({ where: { orgId, recordId, type: 'VALUE_UPDATED' } });
const debitTxns = (recordId: string) => prisma.creditTransaction.count({ where: { orgId, type: 'DEBIT', metadata: { path: ['recordId'], equals: recordId } } });
const debitByKey = (key: string) => prisma.creditTransaction.count({ where: { orgId, type: 'DEBIT', idempotencyKey: key } });
const aiRunsByKey = (key: string) => prisma.aiRun.count({ where: { orgId, idempotencyKey: key } });

async function main() {
  await setup();

  // ── S1 single SUMMARIZE → SUCCEEDED ──
  const rec1 = await mkRecord();
  await setContext(rec1);
  let s1run: any = null;
  {
    const bBefore = await balance();
    const r = await runSummarize(rec1);
    s1run = r.json;
    const v = await valOf(rec1, sumAttrId);
    const bAfter = await balance();
    const run = s1run?.aiRunId ? await prisma.aiRun.findUnique({ where: { id: s1run.aiRunId }, select: { status: true, creditsCost: true } }) : null;
    const acts = await valueUpdatedActs(rec1);
    const debits = await debitTxns(rec1);
    const cost = s1run?.creditTransaction ? Math.abs(s1run.creditTransaction.amount) : (run?.creditsCost ?? -1);
    check('S1 single SUMMARIZE → SUCCEEDED: Value(source=AI)+lastAiRunId, AiRun=SUCCEEDED, ровно 1 Activity VALUE_UPDATED, ровно 1 DEBIT, баланс −creditsCost',
      r.status === 200 && s1run?.status === 'SUCCEEDED' && v?.source === ValueSource.AI && !!v?.lastAiRunId && (v?.longTextValue ?? '').length > 0 &&
      run?.status === 'SUCCEEDED' && acts === 1 && debits === 1 && cost >= 1 && (bBefore - bAfter) === cost,
      JSON.stringify({ http: r.status, st: s1run?.status, src: v?.source, runSt: run?.status, acts, debits, cost, charged: bBefore - bAfter }));
  }

  // ── S2 charge-once: один успешный run = РОВНО один DEBIT (idempotent по ai-run:<runId>) ──
  {
    const runId = s1run?.aiRunId;
    const byKey = runId ? await debitByKey(`ai-run:${runId}`) : -1;
    const totalDebitsRec1 = await debitTxns(rec1);
    // второй run по той же записи → новый runId, новый отдельный DEBIT (charge-once на КАЖДЫЙ run, не двойной на один runId)
    const bBefore = await balance();
    const r2 = await runSummarize(rec1);
    const run2Id = r2.json?.aiRunId;
    const byKey2 = run2Id ? await debitByKey(`ai-run:${run2Id}`) : -1;
    const bAfter = await balance();
    const cost2 = r2.json?.creditTransaction ? Math.abs(r2.json.creditTransaction.amount) : -1;
    check('S2 charge-once: DEBIT по ключу ai-run:<runId> ровно 1 на run (после S1: 1 DEBIT); второй run = новый runId = ещё ровно 1 DEBIT, баланс −cost',
      byKey === 1 && totalDebitsRec1 === 1 && r2.json?.status === 'SUCCEEDED' && run2Id && run2Id !== runId && byKey2 === 1 && cost2 >= 1 && (bBefore - bAfter) === cost2,
      JSON.stringify({ byKeyRun1: byKey, totalAfterS1: totalDebitsRec1, run2New: run2Id !== runId, byKeyRun2: byKey2, charged2: bBefore - bAfter }));
  }

  // ── S3 FAILED не списывает: CLASSIFY без опций/categories ──
  {
    const recF = await mkRecord();
    await setContext(recF);
    const bBefore = await balance();
    const actsBefore = await valueUpdatedActs(recF);
    const r = await api('POST', `/attributes/${classAttrId}/ai/run`, { recordId: recF, source: 'CELL' });
    const v = await valOf(recF, classAttrId);
    const bAfter = await balance();
    const actsAfter = await valueUpdatedActs(recF);
    // route отдаёт 503 {code:AI_RUN_FAILED, aiRunId} при FAILED-прогоне
    const failedRunId = r.json?.aiRunId;
    const run = failedRunId ? await prisma.aiRun.findUnique({ where: { id: failedRunId }, select: { status: true } }) : null;
    const debitsForRun = failedRunId ? await debitByKey(`ai-run:${failedRunId}`) : 0;
    check('S3 FAILED не списывает: CLASSIFY без опций → 503 AI_RUN_FAILED, AiRun=FAILED, Value НЕ записан, баланс не изменился, нет Activity VALUE_UPDATED, нет DEBIT по run',
      r.status === 503 && r.json?.code === 'AI_RUN_FAILED' && run?.status === 'FAILED' && v === null && bAfter === bBefore && actsAfter === actsBefore && debitsForRun === 0,
      JSON.stringify({ http: r.status, code: r.json?.code, runSt: run?.status, valExists: !!v, balDelta: bBefore - bAfter, actsDelta: actsAfter - actsBefore, debitsForRun }));
  }

  // ── S4 credit-guard 402: remainingCredits=0 ──
  {
    const recG = await mkRecord();
    await setContext(recG);
    const runsBefore = await prisma.aiRun.count({ where: { orgId, recordId: recG, attributeId: sumAttrId } });
    await prisma.creditBalance.update({ where: { orgId }, data: { remainingCredits: 0 } });
    const r = await api('POST', `/attributes/${sumAttrId}/ai/run`, { recordId: recG, source: 'CELL' });
    const balZero = await balance();
    // ни RUNNING, ни SUCCEEDED AiRun по записи не создан (guard до создания AiRun)
    const runsAfter = await prisma.aiRun.count({ where: { orgId, recordId: recG, attributeId: sumAttrId, status: { in: ['RUNNING', 'SUCCEEDED'] } } });
    check('S4 credit-guard: баланс=0 → SUMMARIZE run → 402 INSUFFICIENT_CREDITS {required,available,source}, AiRun RUNNING/SUCCEEDED не создан, баланс не в минусе',
      r.status === 402 && r.json?.code === 'INSUFFICIENT_CREDITS' && typeof r.json?.required === 'number' && r.json?.required >= 1 &&
      r.json?.available === 0 && typeof r.json?.source === 'string' && runsAfter === runsBefore && balZero === 0,
      JSON.stringify({ http: r.status, code: r.json?.code, required: r.json?.required, available: r.json?.available, source: r.json?.source, runsAfter, bal: balZero }));
    // вернуть баланс
    await prisma.creditBalance.update({ where: { orgId }, data: { remainingCredits: 1000 } });
  }

  // ── S5 dedup на уровне сервиса: один idempotencyKey 'k1' → 2-й DEDUPED, второго AiRun/charge нет ──
  {
    const recD = await mkRecord();
    await setContext(recD);
    const key = `m292-k1-${orgId}`;
    const bBefore = await balance();
    const first = await runAiForRecord({ orgId, recordId: recD, attributeId: sumAttrId, source: 'CELL', triggeredById: ownerId, idempotencyKey: key });
    const second = await runAiForRecord({ orgId, recordId: recD, attributeId: sumAttrId, source: 'CELL', triggeredById: ownerId, idempotencyKey: key });
    const bAfter = await balance();
    const runsByKey = await aiRunsByKey(key);
    const debitsForFirst = first.aiRunId ? await debitByKey(`ai-run:${first.aiRunId}`) : -1;
    const cost = first.creditTransaction ? Math.abs(first.creditTransaction.amount) : -1;
    check('S5 service-dedup: 2× runAiForRecord один idempotencyKey → 1-й SUCCEEDED, 2-й DEDUPED (тот же aiRunId), count AiRun по ключу=1, DEBIT один, баланс списан раз',
      first.status === 'SUCCEEDED' && second.status === 'DEDUPED' && second.aiRunId === first.aiRunId && runsByKey === 1 && debitsForFirst === 1 && cost >= 1 && (bBefore - bAfter) === cost,
      JSON.stringify({ st1: first.status, st2: second.status, sameRun: second.aiRunId === first.aiRunId, runsByKey, debitsForFirst, charged: bBefore - bAfter }));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n===== M29-2: ${pass}/${results.length} PASS =====`);
  if (pass !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(' | '));
  return pass === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
