import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const REC = 'cmqlessqw0084wm0s1x47k4b2'; // Wonka logistics (deals)
(async () => {
  const rec = await prisma.record.findUniqueOrThrow({ where: { id: REC }, select: { orgId: true } });
  const orgId = rec.orgId;
  // идемпотентность демо: убрать прежние demo-звонки этой записи
  const old = await prisma.callAssociatedRecord.findMany({ where: { orgId, recordId: REC }, select: { callId: true } });
  if (old.length) { await prisma.callAssociatedRecord.deleteMany({ where: { orgId, recordId: REC } }); await prisma.call.deleteMany({ where: { orgId, id: { in: old.map(o=>o.callId) }, summary: { contains: 'logistics evaluation' } } }).catch(()=>{}); }
  const c1 = await prisma.call.create({ data: { orgId, direction: 'OUTBOUND', status: 'COMPLETED', outcome: 'CONNECTED', durationSec: 1325, summary: 'Discovery call for the logistics evaluation. Walked through current routing pain and integration needs; strong interest, budget confirmed for Q3.', aiIntent: 'high intent', nextStep: 'Send pricing proposal by Fri' } });
  await prisma.callAssociatedRecord.create({ data: { orgId, callId: c1.id, objectKey: 'deals', recordId: REC, associationType: 'manual' } });
  const c2 = await prisma.call.create({ data: { orgId, direction: 'INBOUND', status: 'COMPLETED', outcome: 'CONNECTED', durationSec: 410, summary: 'Follow-up: champion asked about onboarding timeline and SSO. Reassured on 2-week rollout.', aiIntent: 'evaluating', nextStep: 'Share onboarding plan' } });
  await prisma.callAssociatedRecord.create({ data: { orgId, callId: c2.id, objectKey: 'deals', recordId: REC, associationType: 'manual' } });
  console.log('seeded 2 calls on', REC);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
