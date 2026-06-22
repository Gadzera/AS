/**
 * Security (M23-1, S380) — /api/security. ТОЛЬКО self-service: пользователь управляет своей безопасностью.
 * OWNER/ADMIN НЕ читают/сбрасывают чужие TOTP/recovery (правка GPT). Активные сессии + 2FA (TOTP) + recovery.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { audit } from '../services/audit';
import { listSessions, revokeSession, revokeAllExcept } from '../services/sessions';
import { generateTotpSecret, otpauthUri, encryptSecret, decryptSecret, verifyTotp, generateRecoveryCodes, hashRecoveryCode, matchRecoveryCode } from '../services/twofa';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

const codeSchema = z.object({ code: z.string().min(4).max(20) });

// проверить TOTP ИЛИ одноразовый recovery-код активного 2FA пользователя
async function verifySecondFactor(userId: string, secretEnc: string, code: string): Promise<boolean> {
  if (verifyTotp(decryptSecret(secretEnc), code)) return true;
  const codes = await prisma.userRecoveryCode.findMany({ where: { userId, usedAt: null } });
  for (const rc of codes) {
    if (await matchRecoveryCode(code, rc.codeHash)) {
      // адверс-ревью #1: атомарный CAS против двойного использования recovery-кода
      const claim = await prisma.userRecoveryCode.updateMany({ where: { id: rc.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claim.count === 1) return true;
    }
  }
  return false;
}
async function regenRecovery(userId: string): Promise<string[]> {
  await prisma.userRecoveryCode.deleteMany({ where: { userId } });
  const codes = generateRecoveryCodes(10);
  await prisma.userRecoveryCode.createMany({ data: await Promise.all(codes.map(async (c) => ({ userId, codeHash: await hashRecoveryCode(c) }))) });
  return codes;
}

// ── Sessions ──
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ sessions: await listSessions(req.user!.userId, req.user!.jti) }); } catch (err) { next(err); }
});
router.delete('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await revokeSession(req.user!.userId, req.params.id); // self-only (id+userId)
    if (!ok) { res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' }); return; }
    await audit({ orgId: req.user!.orgId!, actorId: req.user!.userId, action: 'SESSION_REVOKED', targetType: 'session', targetId: req.params.id, summary: 'revoked a device session' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
router.post('/sessions/revoke-others', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const n = await revokeAllExcept(req.user!.userId, req.user!.jti); // НЕ трогаем текущую (exceptJti)
    await audit({ orgId: req.user!.orgId!, actorId: req.user!.userId, action: 'SESSIONS_REVOKED', targetType: 'user', targetId: req.user!.userId, summary: `revoked ${n} other session(s)` });
    res.json({ ok: true, revoked: n });
  } catch (err) { next(err); }
});

// ── 2FA ──
router.get('/2fa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { twoFactorEnabled: true, twoFactorPendingSecret: true } });
    const recoveryLeft = u?.twoFactorEnabled ? await prisma.userRecoveryCode.count({ where: { userId: req.user!.userId, usedAt: null } }) : 0;
    res.json({ enabled: !!u?.twoFactorEnabled, pending: !!u?.twoFactorPendingSecret && !u?.twoFactorEnabled, recoveryLeft });
  } catch (err) { next(err); }
});

// setup — создаёт PENDING secret (twoFactorEnabled НЕ ставим до verify). Возвращает secret + otpauth URI.
router.post('/2fa/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { twoFactorEnabled: true, email: true } });
    if (u?.twoFactorEnabled) { res.status(409).json({ error: 'Two-factor is already enabled', code: 'TWO_FACTOR_ALREADY_ON' }); return; }
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: req.user!.userId }, data: { twoFactorPendingSecret: encryptSecret(secret) } });
    res.json({ secret, otpauthUri: otpauthUri(secret, u!.email) });
  } catch (err) { next(err); }
});

// verify — подтверждает pending TOTP → enabled=true, генерит recovery-коды (возвращаем ОДИН раз).
router.post('/2fa/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = codeSchema.parse(req.body);
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { twoFactorEnabled: true, twoFactorPendingSecret: true } });
    if (u?.twoFactorEnabled) { res.status(409).json({ error: 'Two-factor is already enabled', code: 'TWO_FACTOR_ALREADY_ON' }); return; }
    if (!u?.twoFactorPendingSecret) { res.status(400).json({ error: 'Start setup first', code: 'NO_PENDING_2FA' }); return; }
    if (!verifyTotp(decryptSecret(u.twoFactorPendingSecret), code)) { res.status(401).json({ error: 'Code is incorrect — check your authenticator app', code: 'TWO_FACTOR_INVALID' }); return; }
    await prisma.user.update({ where: { id: req.user!.userId }, data: { twoFactorEnabled: true, twoFactorSecret: u.twoFactorPendingSecret, twoFactorPendingSecret: null } });
    const recoveryCodes = await regenRecovery(req.user!.userId);
    await audit({ orgId: req.user!.orgId!, actorId: req.user!.userId, action: 'TWO_FACTOR_ENABLED', targetType: 'user', targetId: req.user!.userId, summary: '2FA (TOTP) enabled' });
    await audit({ orgId: req.user!.orgId!, actorId: req.user!.userId, action: 'RECOVERY_CODES_REGENERATED', targetType: 'user', targetId: req.user!.userId, summary: 'recovery codes generated' });
    res.json({ ok: true, recoveryCodes });
  } catch (err) { next(err); }
});

// disable — требует валидный TOTP/recovery. Чистит secret + recovery.
router.post('/2fa/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = codeSchema.parse(req.body);
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { twoFactorEnabled: true, twoFactorSecret: true } });
    if (!u?.twoFactorEnabled || !u.twoFactorSecret) { res.status(400).json({ error: 'Two-factor is not enabled', code: 'TWO_FACTOR_OFF' }); return; }
    if (!(await verifySecondFactor(req.user!.userId, u.twoFactorSecret, code))) { res.status(401).json({ error: 'Code is incorrect', code: 'TWO_FACTOR_INVALID' }); return; }
    await prisma.user.update({ where: { id: req.user!.userId }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null } });
    await prisma.userRecoveryCode.deleteMany({ where: { userId: req.user!.userId } });
    await audit({ orgId: req.user!.orgId!, actorId: req.user!.userId, action: 'TWO_FACTOR_DISABLED', targetType: 'user', targetId: req.user!.userId, summary: '2FA disabled' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// recovery-codes — перевыпуск (требует валидный код). Возвращаем новые ОДИН раз.
router.post('/2fa/recovery-codes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = codeSchema.parse(req.body);
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { twoFactorEnabled: true, twoFactorSecret: true } });
    if (!u?.twoFactorEnabled || !u.twoFactorSecret) { res.status(400).json({ error: 'Two-factor is not enabled', code: 'TWO_FACTOR_OFF' }); return; }
    if (!(await verifySecondFactor(req.user!.userId, u.twoFactorSecret, code))) { res.status(401).json({ error: 'Code is incorrect', code: 'TWO_FACTOR_INVALID' }); return; }
    const recoveryCodes = await regenRecovery(req.user!.userId);
    await audit({ orgId: req.user!.orgId!, actorId: req.user!.userId, action: 'RECOVERY_CODES_REGENERATED', targetType: 'user', targetId: req.user!.userId, summary: 'recovery codes regenerated' });
    res.json({ ok: true, recoveryCodes });
  } catch (err) { next(err); }
});

export default router;
