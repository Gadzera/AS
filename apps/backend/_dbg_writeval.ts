import { PrismaClient } from '@prisma/client';
import { writeValues } from './src/services/crm/values';
const prisma = new PrismaClient();
async function main() {
  const TAG = '__DBG_WV__';
  const org = await prisma.organization.create({ data: { name: TAG, plan: 'STARTER' as any } });
  const user = await prisma.user.create({ data: { orgId: org.id, email: `${TAG}@t.local`, name: 'U', passwordHash: 'x', role: 'OWNER' as any } });
  const obj = await prisma.object.create({ data: { orgId: org.id, key: 'companies', singularName: 'C', pluralName: 'Cs', createdById: user.id } });
  const attr = await prisma.attribute.create({ data: { orgId: org.id, objectId: obj.id, key: 'website', name: 'Website', type: 'TEXT' as any } });
  const rec = await prisma.record.create({ data: { orgId: org.id, objectId: obj.id, createdById: user.id, updatedById: user.id } });
  const minimal = { id: rec.id, orgId: org.id, objectId: obj.id };
  const c1 = await prisma.$transaction((tx) => writeValues(tx as any, minimal, { website: 'acme.com' }));
  const c2 = await prisma.$transaction((tx) => writeValues(tx as any, minimal, { website: 'acme.com' }));
  const c3 = await prisma.$transaction((tx) => writeValues(tx as any, minimal, { website: 'acme.io' }));
  const v = await prisma.value.findFirst({ where: { recordId: rec.id, attributeId: attr.id } });
  console.log(JSON.stringify({ c1, c2, c3, storedValue: { textValue: v?.textValue, longTextValue: v?.longTextValue, numberValue: v?.numberValue, jsonValue: v?.jsonValue, currencyAmount: v?.currencyAmount, dateValue: v?.dateValue } }, null, 2));
  await prisma.value.deleteMany({ where: { orgId: org.id } });
  await prisma.record.deleteMany({ where: { orgId: org.id } });
  await prisma.attribute.deleteMany({ where: { orgId: org.id } });
  await prisma.object.deleteMany({ where: { orgId: org.id } });
  await prisma.user.deleteMany({ where: { orgId: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
