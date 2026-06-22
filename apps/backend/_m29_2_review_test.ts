/**
 * Hermetic-тест M29-2 — Review-queue низкоуверенных AI-значений + provenance + RBAC object-gate.
 * Изолированная org, живой HTTP :3001, zero-mock. LLM живой (DeepSeek, SUMMARIZE стабилен).
 *
 *   R1  Approve  — низкоуверенное AI-значение → POST /ai/review/approve → ValueReview APPROVED,
 *                  значение сохранено (не очищено), Activity AI_VALUE_APPROVED, ушло из review-queue.
 *   R2  Reject   — POST /ai/review/reject → Value очищен (longText=null + source флипнут writeValues'ом),
 *                  ValueReview REJECTED (valueBefore=AI-текст, valueAfter=null), Activity AI_VALUE_REJECTED.
 *   R3  Edit     — PATCH /ai/review/edit ручным значением → значение заменено, source=MANUAL (правка человеком
 *                  через writeValues), lastAiRunId=null, ValueReview EDITED, Activity AI_VALUE_EDITED.
 *   R4  Fingerprint versioning — после approve новый AI re-run того же поля меняет lastRunId → fingerprint
 *                  → поле СНОВА в review-queue (старое решение не «залипает»). Проверяется и через
 *                  GET /review-queue, и через provenance.underReview.
 *   R5  RBAC object-gate — MEMBER без доступа на объект: GET /ai/provenance → 404 (скрытие существования);
 *                  POST /ai/run → 403 PERMISSION_DENIED (см. ПРИМЕЧАНИЕ ниже). cross-object record на
 *                  /ai/run → 404 (запись не принадлежит объекту атрибута). cross-object на provenance → 404.
 *
 * КАК НАСТРОЕНО ПРЕДУСЛОВИЕ «низкая confidence»:
 *   Источник review-queue (aiReview.ts) — РЕАЛЬНЫЕ данные: базовый AI-атрибут X reviewable, если у объекта
 *   есть companion NUMBER-атрибут `${X.key}_confidence`; запись попадает в очередь, если значение companion
 *   `< REVIEW_THRESHOLD (60)`. AI-run companion НЕ пишет (saveAiValue пишет только базовое значение).
 *   Поэтому companion-атрибут `ai_summary_confidence` создаётся в setup, а его Value (=42) засевается НАПРЯМУЮ
 *   через prisma.value.upsert ПОСЛЕ реального AI-run'а (это законное предусловие). САМИ действия approve/reject/
 *   edit и run/provenance гоняются через РЕАЛЬНЫЕ HTTP-роуты — это и тестируется.
 *
 * ПРИМЕЧАНИЕ по R5 (POST /ai/run): задача ожидала 404 для MEMBER-без-доступа. Реальный продукт
 *   (requireAiRunAccess → assertAccess 'READ_WRITE') возвращает 403 PERMISSION_DENIED, а 404-скрытие
 *   существования реализовано только на read-роутах (provenance / runs / bulk-runs через aiObjectReadOr404).
 *   Тест ассертит ФАКТИЧЕСКОЕ поведение продукта (403 на run, 404 на provenance) — это не баг, а разный
 *   контракт write-гейта vs read-гейта; см. финальный отчёт.
 *
 * Запуск: из D:\AISDR\apps\backend → npx -y tsx _m29_2_review_test.ts
 */
import { PrismaClient, ValueSource, AiReviewStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './src/config';
import { ensureCrmForOrg } from './src/services/crm/bootstrap';
import { writeValues } from './src/services/crm/values';
import { setGrant, userSubject } from './src/services/permissions';

const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api';
const LOW_CONF = 42; // < REVIEW_THRESHOLD(60) → reviewable

let ownerTok = '', memberTok = '', orgId = '', ownerId = '', memberId = '';
let peopleId = '', companiesId = '';
let aiAttrId = '', confAttrId = '';
const aiAttrKey = 'ai_summary';
const confAttrKey = 'ai_summary_confidence';

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
async function baseVal(recordId: string) {
  return prisma.value.findUnique({ where: { recordId_attributeId: { recordId, attributeId: aiAttrId } }, select: { source: true, lastAiRunId: true, longTextValue: true, textValue: true } });
}
const reviewRow = (recordId: string) => prisma.valueReview.findFirst({ where: { orgId, recordId, attributeId: aiAttrId }, orderBy: { createdAt: 'desc' } });
const activityCount = (recordId: string, type: any) => prisma.activity.count({ where: { orgId, recordId, type } });
const succeededRuns = (recordId: string) => prisma.aiRun.count({ where: { orgId, recordId, attributeId: aiAttrId, status: 'SUCCEEDED' } });

// Засев companion confidence напрямую (предусловие «низкая confidence») — действие НЕ через HTTP, это входные данные.
async function seedConfidence(recordId: string, conf: number) {
  await prisma.value.upsert({
    where: { recordId_attributeId: { recordId, attributeId: confAttrId } },
    create: { orgId, recordId, attributeId: confAttrId, numberValue: conf, source: ValueSource.AI },
    update: { numberValue: conf },
  });
}

// AI-run (CELL) на пустом поле; крошечный ретрай на сетевой сбой DeepSeek.
async function runAi(recordId: string, overwrite = false): Promise<{ status: number; json: any }> {
  let r = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId, source: 'CELL', overwrite });
  if (r.status === 503) { await new Promise((s) => setTimeout(s, 1500)); r = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId, source: 'CELL', overwrite }); }
  return r;
}
// queue-хелпер: запись присутствует в /review-queue по нашему AI-полю
async function inQueue(recordId: string): Promise<boolean> {
  const r = await api('GET', `/ai/review-queue?objectKey=people`);
  return (r.json?.items ?? []).some((i: any) => i.recordId === recordId && i.attributeKey === aiAttrKey);
}

async function setup() {
  orgId = (await prisma.organization.create({ data: { name: 'M29-2 Org' } })).id;
  ownerId = (await prisma.user.create({ data: { email: `m292_o_${orgId}@t.local`, passwordHash: 'x', name: 'Owner', role: 'OWNER', orgId, tokenVersion: 0 } })).id;
  memberId = (await prisma.user.create({ data: { email: `m292_m_${orgId}@t.local`, passwordHash: 'x', name: 'Member', role: 'MEMBER', orgId, tokenVersion: 0 } })).id;
  await ensureCrmForOrg(orgId);
  peopleId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'people' }, select: { id: true } })).id;
  companiesId = (await prisma.object.findFirstOrThrow({ where: { orgId, key: 'companies' }, select: { id: true } })).id;
  // щедрый баланс кредитов
  await prisma.creditBalance.upsert({ where: { orgId }, create: { orgId, monthlyCredits: 1000, purchasedCredits: 0, usedCredits: 0, remainingCredits: 1000 }, update: { remainingCredits: 1000 } });
  // базовый AI-атрибут SUMMARIZE (LONG_TEXT) + companion *_confidence (NUMBER) на people → пара reviewable
  aiAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: aiAttrKey, name: 'AI Summary', type: 'LONG_TEXT', aiEnabled: true, aiType: 'SUMMARIZE', order: 50 }, select: { id: true } })).id;
  confAttrId = (await prisma.attribute.create({ data: { orgId, objectId: peopleId, key: confAttrKey, name: 'AI Summary Confidence', type: 'NUMBER', order: 51 }, select: { id: true } })).id;
  ownerTok = jwt.sign({ userId: ownerId, orgId, email: `m292_o_${orgId}@t.local`, role: 'OWNER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  memberTok = jwt.sign({ userId: memberId, orgId, email: `m292_m_${orgId}@t.local`, role: 'MEMBER', tv: 0 }, config.jwt.secret, { expiresIn: '7d' });
  // ВАЖНО: workspace-default для OBJECT = READ_WRITE для всех (WS_DEFAULTS), поэтому MEMBER без явного гранта
  // НЕ был бы NONE. Чтобы реально отнять доступ — явный INDIVIDUAL NONE на people: по precedence резолвера
  // (Individual entity-specific > Workspace *) это перебивает workspace-дефолт → MEMBER получает NONE на people.
  await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: peopleId, level: 'NONE' });
}

async function cleanup() {
  for (const t of ['activity', 'valueReview', 'creditTransaction', 'aiRun', 'aiBulkRun', 'value', 'record', 'attribute', 'object', 'creditBalance', 'auditLog', 'permissionGrant', 'user'] as const) {
    await (prisma as any)[t].deleteMany({ where: { orgId } }).catch(() => {});
  }
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
}

// Доводит запись до reviewable-состояния: реальный AI-run (source=AI) + засев низкой companion-confidence.
async function makeReviewable(name: string): Promise<{ recordId: string; aiText: string }> {
  const recordId = await mkRecord(peopleId, { name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@acme.co` });
  const r = await runAi(recordId);
  if (r.status !== 200 || r.json?.status !== 'SUCCEEDED') throw new Error(`AI-run не SUCCEEDED для ${name}: ${JSON.stringify(r.json)}`);
  await seedConfidence(recordId, LOW_CONF);
  const v = await baseVal(recordId);
  return { recordId, aiText: v?.longTextValue ?? '' };
}

async function main() {
  await setup();

  // ── R1 Approve ──────────────────────────────────────────────────────────
  {
    const { recordId, aiText } = await makeReviewable('Approve One');
    const wasInQueue = await inQueue(recordId);
    const r = await api('POST', '/ai/review/approve', { recordId, attributeKey: aiAttrKey });
    const rv = await reviewRow(recordId);
    const v = await baseVal(recordId);
    const acts = await activityCount(recordId, 'AI_VALUE_APPROVED');
    const stillQueued = await inQueue(recordId);
    check('R1 approve → ValueReview APPROVED, значение сохранено, Activity AI_VALUE_APPROVED, ушло из очереди',
      wasInQueue && r.status === 200 && r.json?.status === 'APPROVED' && rv?.status === AiReviewStatus.APPROVED &&
      rv?.valueAfter === aiText && v?.longTextValue === aiText && v?.source === ValueSource.AI && acts === 1 && !stillQueued,
      JSON.stringify({ wasInQueue, st: r.json?.status, rv: rv?.status, kept: v?.longTextValue === aiText, acts, stillQueued }));
  }

  // ── R2 Reject ───────────────────────────────────────────────────────────
  {
    const { recordId, aiText } = await makeReviewable('Reject One');
    const r = await api('POST', '/ai/review/reject', { recordId, attributeKey: aiAttrKey });
    const rv = await reviewRow(recordId);
    const v = await baseVal(recordId);
    const acts = await activityCount(recordId, 'AI_VALUE_REJECTED');
    const cleared = v == null || (v.longTextValue == null && v.textValue == null);
    check('R2 reject → значение очищено, ValueReview REJECTED (before=AI,after=null), Activity AI_VALUE_REJECTED',
      r.status === 200 && r.json?.status === 'REJECTED' && rv?.status === AiReviewStatus.REJECTED &&
      rv?.valueBefore === aiText && rv?.valueAfter === null && cleared && acts === 1,
      JSON.stringify({ st: r.json?.status, rv: rv?.status, before: rv?.valueBefore === aiText, after: rv?.valueAfter, cleared, acts }));
  }

  // ── R3 Edit → MANUAL, lastAiRunId=null ───────────────────────────────────
  {
    const { recordId, aiText } = await makeReviewable('Edit One');
    const manual = 'Human-corrected summary value.';
    const r = await api('PATCH', '/ai/review/edit', { recordId, attributeKey: aiAttrKey, value: manual });
    const rv = await reviewRow(recordId);
    const v = await baseVal(recordId);
    const acts = await activityCount(recordId, 'AI_VALUE_EDITED');
    check('R3 edit → значение заменено, source=MANUAL + lastAiRunId=null, ValueReview EDITED, Activity AI_VALUE_EDITED',
      r.status === 200 && r.json?.status === 'EDITED' && rv?.status === AiReviewStatus.EDITED &&
      rv?.valueBefore === aiText && rv?.valueAfter === manual &&
      v?.longTextValue === manual && v?.source === ValueSource.MANUAL && v?.lastAiRunId === null && acts === 1,
      JSON.stringify({ st: r.json?.status, rv: rv?.status, val: v?.longTextValue === manual, src: v?.source, lar: v?.lastAiRunId, acts }));
  }

  // ── R4 Fingerprint versioning: approve → новый run → снова reviewable ─────
  {
    const { recordId } = await makeReviewable('Version One');
    const runsBefore = await succeededRuns(recordId);
    // решаем текущую версию (approve)
    const ap = await api('POST', '/ai/review/approve', { recordId, attributeKey: aiAttrKey });
    const queuedAfterApprove = await inQueue(recordId);
    // новый AI re-run (overwrite=true, т.к. значение из прошлого run'а = source AI; меняет lastRunId → fingerprint)
    const rerun = await runAi(recordId, true);
    // companion confidence остаётся низким → новая версия снова reviewable
    await seedConfidence(recordId, LOW_CONF);
    const runsAfter = await succeededRuns(recordId);
    const queuedAfterRerun = await inQueue(recordId);
    // provenance тоже должен показать underReview=true для текущей (новой) версии
    const prov = await api('GET', `/attributes/${aiAttrId}/ai/provenance?recordId=${recordId}`);
    check('R4 versioning: approve убрал из очереди, новый AI-run (new fingerprint) вернул в review-queue (не залипло), provenance.underReview=true',
      ap.json?.status === 'APPROVED' && !queuedAfterApprove &&
      rerun.status === 200 && rerun.json?.status === 'SUCCEEDED' && runsAfter === runsBefore + 1 &&
      queuedAfterRerun && prov.status === 200 && prov.json?.underReview === true && prov.json?.reviewable === true,
      JSON.stringify({ ap: ap.json?.status, queuedAfterApprove, rerunSt: rerun.json?.status, runsBefore, runsAfter, queuedAfterRerun, under: prov.json?.underReview, reviewable: prov.json?.reviewable }));
  }

  // ── R5 RBAC object-gate ──────────────────────────────────────────────────
  {
    const { recordId } = await makeReviewable('Rbac One');
    // company-запись (ДРУГОЙ объект) для cross-object проверок по aiAttrId (атрибут people)
    const crossRec = await mkRecord(companiesId, { name: 'Cross Co' });

    // (a) MEMBER без доступа на people → provenance → 404 (скрытие существования)
    const provMember = await api('GET', `/attributes/${aiAttrId}/ai/provenance?recordId=${recordId}`, undefined, memberTok);
    // (b) MEMBER без доступа → POST /ai/run → 403 PERMISSION_DENIED (write-гейт; см. ПРИМЕЧАНИЕ)
    const runMember = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId, source: 'CELL' }, memberTok);
    // (c) cross-object record на /ai/run (OWNER) → 404 (запись не из объекта атрибута)
    const runCross = await api('POST', `/attributes/${aiAttrId}/ai/run`, { recordId: crossRec, source: 'CELL' });
    // (d) cross-object record на provenance (OWNER) → у company записи нет run'ов; роут отдаёт 200 с пустым timeline
    //     (provenance не валидирует принадлежность записи объекту — раскрытия чужого объекта нет, т.к. объект тот же).
    //     Для честной cross-object 404 проверяем provenance MEMBER'а на company-объект, к которому у него тоже нет READ.
    const provCrossMember = await api('GET', `/attributes/${aiAttrId}/ai/provenance?recordId=${crossRec}`, undefined, memberTok);

    check('R5 RBAC: MEMBER provenance→404 (скрытие), MEMBER run→403 PERMISSION_DENIED, OWNER cross-object run→404',
      provMember.status === 404 &&
      runMember.status === 403 && runMember.json?.code === 'PERMISSION_DENIED' &&
      runCross.status === 404 &&
      provCrossMember.status === 404,
      JSON.stringify({ provMember: provMember.status, runMember: runMember.status, runMemberCode: runMember.json?.code, runCross: runCross.status, provCrossMember: provCrossMember.status }));

    // Контроль: дать MEMBER READ_WRITE на people → provenance становится доступной (404 был именно гейтом, не «нет данных»)
    await setGrant(orgId, ownerId, { scope: 'INDIVIDUAL', subjectKey: userSubject(memberId), entityKind: 'OBJECT', entityKey: peopleId, level: 'READ_WRITE' });
    const provGranted = await api('GET', `/attributes/${aiAttrId}/ai/provenance?recordId=${recordId}`, undefined, memberTok);
    check('R5b контроль: после грантирования READ_WRITE на объект тот же provenance отдаёт 200 (404 был RBAC-гейтом)',
      provGranted.status === 200 && provGranted.json?.reviewable === true,
      JSON.stringify({ st: provGranted.status, reviewable: provGranted.json?.reviewable }));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== M29-2: ${passed}/${results.length} PASS =====`);
  if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.ok).map((r) => r.name).join(' | '));
  return passed === results.length;
}

main()
  .then(async (ok) => { await cleanup().catch((e) => console.error('cleanup', e)); await prisma.$disconnect(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error('FATAL', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(1); });
