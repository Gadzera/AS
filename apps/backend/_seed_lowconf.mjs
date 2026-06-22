// Демо-сид M9.3: выставить нескольким companies icp_confidence < 60 (+ icp_fit) и сбросить ValueReview.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const anchor = await prisma.record.findFirst({ where: { id: 'cmqe4zxr3006opiwnkaq0soxr' }, select: { orgId: true, objectId: true } });
const orgId = anchor.orgId, objectId = anchor.objectId;
const attrs = await prisma.attribute.findMany({ where: { objectId, key: { in: ['icp_confidence', 'icp_fit'] } }, select: { id: true, key: true } });
const conf = attrs.find((a) => a.key === 'icp_confidence');
const fit = attrs.find((a) => a.key === 'icp_fit');

const recs = await prisma.record.findMany({ where: { orgId, objectId, archivedAt: null }, orderBy: { createdAt: 'asc' }, take: 6, select: { id: true } });
const confVals = [35, 44, 52, 56, 58, 49];
const fitVals = [72, 68, 75, 80, 76, 70];

const del = await prisma.valueReview.deleteMany({});
for (let i = 0; i < recs.length; i++) {
  await prisma.value.upsert({ where: { recordId_attributeId: { recordId: recs[i].id, attributeId: conf.id } }, create: { orgId, recordId: recs[i].id, attributeId: conf.id, numberValue: confVals[i] }, update: { numberValue: confVals[i] } });
  await prisma.value.upsert({ where: { recordId_attributeId: { recordId: recs[i].id, attributeId: fit.id } }, create: { orgId, recordId: recs[i].id, attributeId: fit.id, numberValue: fitVals[i] }, update: { numberValue: fitVals[i] } });
}
console.log('seeded low-conf for', recs.length, 'records; reviews reset:', del.count);
await prisma.$disconnect();
process.exit(0);
