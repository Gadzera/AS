// M9.4 API-сверка: value before == after, AiRun.status=FAILED, creditsSpent=0 (без слома ключа — через недоступность записи).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const TIER = 'cmqeegesj000540w3pc9k0wrr', REC = 'cmqe4zxr3006opiwnkaq0soxr';
const j = (v) => JSON.stringify(v);

const login = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@aisdr.dev', password: 'demo1234' }) })).json();
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };

const valOf = async () => { const v = await prisma.value.findFirst({ where: { recordId: REC, attributeId: TIER } }); return v ? (v.selectValue ?? v.textValue ?? v.numberValue ?? null) : null; };
const balOf = async () => { const b = await prisma.creditBalance.findFirst({ where: { orgId: login.user.orgId } }); return { remaining: b.remainingCredits, used: b.usedCredits }; };

const vBefore = await valOf();
const bBefore = await balOf();
console.log('value BEFORE   :', j(vBefore));
console.log('balance BEFORE :', j(bBefore));

// сделать запись недоступной (архив) → run упадёт FAILED ещё до записи значения
await fetch(API + '/api/records/' + REC, { method: 'DELETE', headers: H });
const r = await fetch(API + `/api/attributes/${TIER}/ai/run`, { method: 'POST', headers: H, body: JSON.stringify({ recordId: REC }) });
const body = await r.json().catch(() => ({}));
console.log('RUN status     :', r.status, '| code:', body.code, '| aiRunId:', body.aiRunId);
// восстановить запись
await prisma.record.update({ where: { id: REC }, data: { archivedAt: null } });

const run = body.aiRunId ? await prisma.aiRun.findUnique({ where: { id: body.aiRunId } }) : null;
const tx = body.aiRunId ? await prisma.creditTransaction.count({ where: { aiRunId: body.aiRunId } }) : 0;
const vAfter = await valOf();
const bAfter = await balOf();
console.log('AiRun.status   :', run ? run.status : '(no run)');
console.log('creditTx for run:', tx, '(ожидаем 0)');
console.log('value AFTER    :', j(vAfter));
console.log('balance AFTER  :', j(bAfter));
console.log('--- ИНВАРИАНТЫ ---');
console.log('value unchanged :', j(vBefore) === j(vAfter) ? 'OK (before==after)' : 'FAIL');
console.log('status FAILED   :', run && run.status === 'FAILED' ? 'OK' : 'FAIL');
console.log('creditsSpent=0  :', (bBefore.used === bAfter.used && tx === 0) ? 'OK (0 списано)' : 'FAIL');
await prisma.$disconnect();
process.exit(0);
