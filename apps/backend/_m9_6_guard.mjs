// M9.6 credit-guard: при нехватке кредитов run → 402 ДО LLM; баланс не в минус; AiRun не создан. Затем restore.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const TIER = 'cmqeegesj000540w3pc9k0wrr', REC = 'cmqe4zxr3006opiwnkaq0soxr';

const anchor = await prisma.record.findFirst({ where: { id: REC }, select: { orgId: true } });
const orgId = anchor.orgId;
const bal0 = await prisma.creditBalance.findFirst({ where: { orgId } });
console.log('balance before:', { remaining: bal0.remainingCredits, used: bal0.usedCredits, monthly: bal0.monthlyCredits, purchased: bal0.purchasedCredits });

// загнать остаток в 0: used = monthly + purchased
const usedFull = bal0.monthlyCredits + bal0.purchasedCredits;
await prisma.creditBalance.update({ where: { id: bal0.id }, data: { usedCredits: usedFull, remainingCredits: 0 } });

const runsBefore = await prisma.aiRun.count({ where: { orgId, attributeId: TIER, recordId: REC } });
const owner = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@aisdr.dev', password: 'demo1234' }) })).json();
const resp = await fetch(API + `/api/attributes/${TIER}/ai/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + owner.token }, body: JSON.stringify({ recordId: REC }) });
const body = await resp.json().catch(() => ({}));
console.log('RUN with 0 credits ->', resp.status, JSON.stringify(body), resp.status === 402 ? 'OK(402)' : 'FAIL');

const bal1 = await prisma.creditBalance.findFirst({ where: { orgId } });
const runsAfter = await prisma.aiRun.count({ where: { orgId, attributeId: TIER, recordId: REC } });
console.log('balance after:', bal1.remainingCredits, bal1.remainingCredits >= 0 ? 'OK(no negative)' : 'FAIL(negative)');
console.log('AiRun created during attempt:', runsAfter - runsBefore, (runsAfter - runsBefore) === 0 ? 'OK(none, blocked before LLM)' : 'note: a run was created');

// restore
await prisma.creditBalance.update({ where: { id: bal0.id }, data: { usedCredits: bal0.usedCredits, remainingCredits: bal0.remainingCredits } });
const balR = await prisma.creditBalance.findFirst({ where: { orgId } });
console.log('balance restored to:', balR.remainingCredits);
await prisma.$disconnect();
process.exit(0);
