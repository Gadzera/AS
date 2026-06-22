// Восстановить архивированную для демо запись (archivedAt = null).
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();
const id = (process.argv[2] || readFileSync('C:/Users/gadze/chatgpt-bridge/_victim_id.txt', 'utf8')).trim();
const r = await prisma.record.update({ where: { id }, data: { archivedAt: null } });
console.log('restored record:', r.id, 'archivedAt:', r.archivedAt);
await prisma.$disconnect();
process.exit(0);
