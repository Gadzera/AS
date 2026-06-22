// Сохранить текущий баланс в файл и занизить remaining до argv[2] (по умолч. 2). Для M9.6 UI-скрина.
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
const prisma = new PrismaClient();
const REC = 'cmqe4zxr3006opiwnkaq0soxr';
const target = Number(process.argv[2] || '2');
const anchor = await prisma.record.findFirst({ where: { id: REC }, select: { orgId: true } });
const bal = await prisma.creditBalance.findFirst({ where: { orgId: anchor.orgId } });
writeFileSync('C:/Users/gadze/chatgpt-bridge/_bal_backup.json', JSON.stringify({ id: bal.id, usedCredits: bal.usedCredits, remainingCredits: bal.remainingCredits }));
await prisma.creditBalance.update({ where: { id: bal.id }, data: { usedCredits: bal.monthlyCredits + bal.purchasedCredits - target, remainingCredits: target } });
console.log('balance set to', target, '(was', bal.remainingCredits + ')');
await prisma.$disconnect();
process.exit(0);
