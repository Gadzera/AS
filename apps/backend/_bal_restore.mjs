// Восстановить баланс из бэкапа.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();
const b = JSON.parse(readFileSync('C:/Users/gadze/chatgpt-bridge/_bal_backup.json', 'utf8'));
await prisma.creditBalance.update({ where: { id: b.id }, data: { usedCredits: b.usedCredits, remainingCredits: b.remainingCredits } });
console.log('balance restored to', b.remainingCredits);
await prisma.$disconnect();
process.exit(0);
