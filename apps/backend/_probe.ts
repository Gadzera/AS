import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const org = await p.organization.findFirst({ where: { name: 'M26-2 Test Co' }, orderBy: { createdAt: 'desc' } });
  if (!org) { console.log('no org'); return; }
  const objs = await p.object.findMany({ where: { orgId: org.id }, select: { id: true, key: true } });
  console.log('objects:', objs.map(o => o.key).join(', '));
  const comp = objs.find(o => o.key === 'companies');
  if (comp) {
    const attrs = await p.attribute.findMany({ where: { objectId: comp.id }, select: { key: true, type: true, isPrimary: true, isSystem: true, aiEnabled: true, isArchived: true } });
    for (const a of attrs) console.log(`  ${a.key}: ${a.type} primary=${a.isPrimary} sys=${a.isSystem} ai=${a.aiEnabled} arch=${a.isArchived}`);
  }
  await p.$disconnect();
})();
