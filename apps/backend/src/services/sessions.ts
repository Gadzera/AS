/**
 * Активные сессии/устройства (M23-1) поверх stateless-JWT. jti в токене ↔ UserSession.
 * Middleware проверяет revokedAt; lastSeenAt обновляется throttled (правка GPT). Токены БЕЗ jti
 * (legacy/служебные) session-check пропускают — обратная совместимость (revoke действует через tokenVersion).
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LAST_SEEN_THROTTLE_MS = 2 * 60_000; // не чаще раза в 2 минуты пишем lastSeenAt

export function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
}
export function newJti(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function createSession(args: { userId: string; orgId?: string | null; jti: string; userAgent?: string | null; ip?: string | null }): Promise<void> {
  await prisma.userSession.create({
    data: { userId: args.userId, orgId: args.orgId ?? null, jti: args.jti, userAgent: (args.userAgent ?? null)?.slice(0, 300) ?? null, ipHash: hashIp(args.ip) },
  });
}

// для middleware: статус сессии по jti + throttled lastSeenAt. missing (jti есть, сессии нет) = revoked.
export async function touchSession(jti: string | undefined): Promise<'ok' | 'revoked' | 'no-jti'> {
  if (!jti) return 'no-jti';
  const s = await prisma.userSession.findUnique({ where: { jti }, select: { id: true, revokedAt: true, lastSeenAt: true } });
  if (!s || s.revokedAt) return 'revoked';
  if (Date.now() - s.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.userSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return 'ok';
}

export async function listSessions(userId: string, currentJti?: string) {
  const rows = await prisma.userSession.findMany({ where: { userId, revokedAt: null }, orderBy: { lastSeenAt: 'desc' }, take: 50 });
  return rows.map((s) => ({ id: s.id, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: !!currentJti && s.jti === currentJti }));
}

// revoke ровно одной сессии (self-only): по id+userId. Возвращает true если отозвана активная.
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const r = await prisma.userSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count > 0;
}

// revoke все мои сессии КРОМЕ текущей (exceptJti не трогаем). Возвращает число отозванных.
export async function revokeAllExcept(userId: string, exceptJti?: string): Promise<number> {
  const r = await prisma.userSession.updateMany({ where: { userId, revokedAt: null, ...(exceptJti ? { jti: { not: exceptJti } } : {}) }, data: { revokedAt: new Date() } });
  return r.count;
}
