/**
 * Hermetic-тест M29-1 — Manual-value protection + value provenance. Изолированная org, живой HTTP :3001, zero-mock.
 *   P1  AI-run (CELL) на пустом поле → SUCCEEDED, value.source=AI + lastAiRunId, кредит списан (один раз)
 *   P2  ручная запись (PATCH /records) AI-поля → value.source=MANUAL, lastAiRunId=null
 *   P3  single AI-run поверх MANUAL без overwrite → 409 MANUAL_VALUE_CONFLICT, значение НЕ тронуто, кредит НЕ списан, нет нового SUCCEEDED-run
 *   P4  single AI-run с overwrite=true → SUCCEEDED, value.source=AI, кредит списан
 *   P5  bulk по [manual, fresh] → success=1, skipped=1 (manual не тронут), кредит только за success
 *   P6  preflight по [manual, fresh] skipExisting=false → manualProtected=1, willRun=1 (manual исключён из биллинга)
 *   P7  no-op ручная запись тем же значением поверх AI → source остаётся AI (didChange-guard, не флипает)
 *   P8  writeValues valueSource=IMPORT → value.source=IMPORT (плумбинг импорта)
 */
import { PrismaClient, ValueSource } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
let ownerTok = '', orgId = '', ownerId = '', peopleId = '', aiAttrId = '', aiAttrKey = 'ai_summary';

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
async function valOf(recordId: string) {
  return prisma.value.findUnique({ where: { recordId_attributeId: { recordId, attributeId: aiAttrId } }, select: { source: true, lastAiRunId: true, longTextValue: true, textValue: true } });
}
async function balance(): Promise<number> {
  const b = await prisma.creditBalance.findUnique({ where: { orgId }, select: { remainingCredits: true } });
  return b?.remainingCredits ?? 0;
}
const succeededRuns = (recordId: string) => prisma.aiRun.count({ where: { orgId, recordId, attributeId: aiAttrId, status: 'SUCCEEDED' } });

// AI-run может уйти в live-LLM (DeepSeek). SUMMARIZE без валидации → стабильно SUCCEEDED; крошечный ретрай на сетевой сбой.
async function runAi(recordId: string, overwrite = false): Promise<{ status: number; json: any }> {
  let r = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId, source: 'CELL', overwrite });
  if (r.status === 503 && !overwrite) { await new Promise((s) => setTimeout(s, 1500)); r = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId, source: 'CELL', overwrite }); }
  return r;
}

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M29-1 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m291_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  // щедрый баланс кредитов, чтобы тесты не упёрлись в 402
  await prisma.creditBalance.upsert({ where: { orgId }, create: { orgId, monthlyCredits: 1000, purchasedCredits: 0, usedCredits: 0, remainingCredits: 1000 }, update: { remainingCredits: 1000 } });
  // AI-атрибут SUMMARIZE (LONG_TEXT) на people
  aiAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: aiAttrKey, name: 'AI Summary', type: 'LONG_TEXT', aiEnabled: true, aiType: 'SUMMARIZE', order: 50 }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m291_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
}
async function cleanup() {
  for (const t of ['activity', 'creditTransaction', 'aiRun', 'aiBulkRun', 'value', 'record', 'attribute', 'object', 'creditBalance', 'auditLog', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

async function pollBulk(bulkRunId: string): Promise<any> {
  for (let i = 0; i < 30; i++) {
    const r = await api('GET', `/ai/bulk-runs/${bulkRunId}`);
    const st = r.json?.status;
    if (st === 'SUCCEEDED' || st === 'FAILED') return r.json;
    await new Promise((s) => setTimeout(s, 800));
  }
  return null;
}

async function main() {
  await setup();
  const rec1 = await mkRecord({ name: 'Acme Lead One', email: 'one@acme.co' });

  // ── P1 AI-run на пустом поле → source=AI ──
  {
    const bBefore = await balance();
    const r = await runAi(rec1);
    const v = await valOf(rec1);
    const bAfter = await balance();
    check('P1 AI-run (CELL) пустое поле → SUCCEEDED, source=AI + lastAiRunId, кредит списан один раз',
      r.status === 200 && r.json?.status === 'SUCCEEDED' && v?.source === ValueSource.AI && !!v?.lastAiRunId && bAfter < bBefore && (await succeededRuns(rec1)) === 1,
      JSON.stringify({ st: r.json?.status, src: v?.source, lar: !!v?.lastAiRunId, charged: bBefore - bAfter }));
  }

  // ── P2 ручная запись AI-поля → source=MANUAL ──
  {
    const r = await api('PATCH', `/records/${rec1}`, { values: { [aiAttrKey]: 'Hand-written summary by a human.' } });
    const v = await valOf(rec1);
    check('P2 ручная правка (PATCH /records) AI-поля → source=MANUAL, lastAiRunId=null',
      r.status === 200 && v?.source === ValueSource.MANUAL && v?.lastAiRunId === null && v?.longTextValue === 'Hand-written summary by a human.',
      JSON.stringify({ st: r.status, src: v?.source, lar: v?.lastAiRunId }));
  }

  // ── P3 single AI-run поверх MANUAL без overwrite → 409 ──
  {
    const bBefore = await balance();
    const succBefore = await succeededRuns(rec1);
    const r = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId: rec1, source: 'CELL' });
    const v = await valOf(rec1);
    const bAfter = await balance();
    check('P3 single AI-run поверх MANUAL без overwrite → 409 MANUAL_VALUE_CONFLICT, значение не тронуто, кредит не списан, нет нового run',
      r.status === 409 && r.json?.code === 'MANUAL_VALUE_CONFLICT' && v?.source === ValueSource.MANUAL && v?.longTextValue === 'Hand-written summary by a human.' && bAfter === bBefore && (await succeededRuns(rec1)) === succBefore,
      JSON.stringify({ st: r.status, code: r.json?.code, src: v?.source, charged: bBefore - bAfter }));
  }

  // ── P4 single AI-run с overwrite=true → SUCCEEDED, source=AI ──
  {
    const bBefore = await balance();
    const r = await runAi(rec1, true);
    const v = await valOf(rec1);
    const bAfter = await balance();
    check('P4 single AI-run overwrite=true поверх MANUAL → SUCCEEDED, source=AI, кредит списан',
      r.status === 200 && r.json?.status === 'SUCCEEDED' && v?.source === ValueSource.AI && !!v?.lastAiRunId && bAfter < bBefore,
      JSON.stringify({ st: r.json?.status, src: v?.source, charged: bBefore - bAfter }));
  }

  // ── P5 bulk по [manual, fresh] → success=1, skipped=1 ──
  let manualRec = '', freshRec = '';
  {
    manualRec = await mkRecord({ name: 'Manual Person', email: 'manual@acme.co' });
    await api('PATCH', `/records/${manualRec}`, { values: { [aiAttrKey]: 'Manually curated note.' } }); // source=MANUAL
    freshRec = await mkRecord({ name: 'Fresh Person', email: 'fresh@acme.co' });

    const bBefore = await balance();
    const start = await api('POST', `/attributes/${aiAttrId}/ai/run-view`, { recordIds: [manualRec, freshRec], skipExisting: false, clientRequestId: 'm29-bulk-1' });
    const bulk = start.json?.bulkRunId ? await pollBulk(start.json.bulkRunId) : null;
    const vm = await valOf(manualRec);
    const vf = await valOf(freshRec);
    const bAfter = await balance();
    check('P5 bulk [manual,fresh] → success=1 skipped=1, manual не тронут (MANUAL), fresh=AI, списано только за success',
      !!bulk && bulk.successCount === 1 && bulk.skippedCount === 1 && bulk.failedCount === 0 && vm?.source === ValueSource.MANUAL && vm?.longTextValue === 'Manually curated note.' && vf?.source === ValueSource.AI && (bBefore - bAfter) >= 1,
      JSON.stringify({ succ: bulk?.successCount, skip: bulk?.skippedCount, fail: bulk?.failedCount, vmSrc: vm?.source, vfSrc: vf?.source, charged: bBefore - bAfter }));
  }

  // ── P6 preflight manualProtected ──
  {
    const r = await api('POST', `/attributes/${aiAttrId}/ai/run-view/preflight`, { recordIds: [manualRec, freshRec], skipExisting: false });
    check('P6 preflight [manual,fresh] skipExisting=false → manualProtected=1, willRun=1 (manual вне биллинга)',
      r.status === 200 && r.json?.manualProtected === 1 && r.json?.willRun === 1 && r.json?.totalInScope === 2,
      JSON.stringify({ mp: r.json?.manualProtected, wr: r.json?.willRun, tot: r.json?.totalInScope }));
  }

  // ── P7 no-op ручная запись тем же значением поверх AI → source остаётся AI ──
  {
    const before = await valOf(freshRec); // source=AI после bulk
    const same = before?.longTextValue ?? '';
    const r = await api('PATCH', `/records/${freshRec}`, { values: { [aiAttrKey]: same } }); // то же значение → didChange=false
    const after = await valOf(freshRec);
    check('P7 no-op ручная запись тем же значением поверх AI → source НЕ флипается (остаётся AI)',
      r.status === 200 && before?.source === ValueSource.AI && after?.source === ValueSource.AI && !!after?.lastAiRunId,
      JSON.stringify({ beforeSrc: before?.source, afterSrc: after?.source, lar: !!after?.lastAiRunId }));
  }

  // ── P8 writeValues valueSource=IMPORT → source=IMPORT ──
  {
    const rec = await mkRecord({ name: 'Import Person' });
    const recRow = await prisma.record.findUniqueOrThrow({ where: { id: rec }, select: { id: true, orgId: true, objectId: true } });
    await prisma.$transaction((tx) => writeValues(tx, recRow, { [aiAttrKey]: 'Imported summary text.' }, { actorId: ownerId, valueSource: ValueSource.IMPORT }));
    const v = await valOf(rec);
    check('P8 writeValues valueSource=IMPORT → source=IMPORT (плумбинг импорта)',
      v?.source === ValueSource.IMPORT && v?.longTextValue === 'Imported summary text.',
      JSON.stringify({ src: v?.source }));
  }

  // ── Итог ──
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} PASS`);
  if (pass !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await cleanup(); await prisma.$disconnect(); });
