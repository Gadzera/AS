// M9.3 versioning: approve → ушло; новый re-run (значение меняется) → вернулось в очередь.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let login;
for (let i = 0; i < 25; i++) { try { login = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@aisdr.dev', password: 'demo1234' }) })).json(); if (login.token) break } catch {} await sleep(1000) }
const t = login.token; const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t };

const anchor = await prisma.record.findFirst({ where: { id: 'cmqe4zxr3006opiwnkaq0soxr' }, select: { orgId: true, objectId: true } });
const { orgId, objectId } = anchor;
const attrs = await prisma.attribute.findMany({ where: { objectId, key: { in: ['icp_fit', 'icp_confidence'] } }, select: { id: true, key: true } });
const fit = attrs.find((a) => a.key === 'icp_fit'), conf = attrs.find((a) => a.key === 'icp_confidence');

await prisma.valueReview.deleteMany({});
const rec = await prisma.record.findFirst({ where: { orgId, objectId, archivedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
const upv = (attrId, n) => prisma.value.upsert({ where: { recordId_attributeId: { recordId: rec.id, attributeId: attrId } }, create: { orgId, recordId: rec.id, attributeId: attrId, numberValue: n }, update: { numberValue: n } });
await upv(conf.id, 42); await upv(fit.id, 70);

const queue = () => fetch(API + '/api/ai/review-queue?objectKey=companies', { headers: H }).then((r) => r.json());
const inQueue = async () => { const q = await queue(); return (q.items || []).some((i) => i.recordId === rec.id && i.attributeKey === 'icp_fit'); };

console.log('1) before approve, in queue:', await inQueue(), '(expect true)');
const ap = await fetch(API + '/api/ai/review/approve', { method: 'POST', headers: H, body: JSON.stringify({ recordId: rec.id, attributeKey: 'icp_fit' }) });
console.log('   approve status:', ap.status);
console.log('2) after approve, in queue:', await inQueue(), '(expect false)');

await upv(fit.id, 88); // re-run: значение поменялось (70 -> 88), confidence всё ещё низкая
console.log('3) after re-run (value 70->88), in queue:', await inQueue(), '(expect TRUE — новая версия вернулась)');

await prisma.valueReview.deleteMany({});
await prisma.$disconnect();
process.exit(0);
