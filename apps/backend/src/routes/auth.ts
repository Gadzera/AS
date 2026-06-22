import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { createSession, newJti, revokeAllExcept } from '../services/sessions';
import { decryptSecret, verifyTotp, matchRecoveryCode } from '../services/twofa';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();

function clientIp(req: Request): string | undefined {
  const xf = req.headers['x-forwarded-for']; const ip = Array.isArray(xf) ? xf[0] : (xf?.split(',')[0]);
  return (ip || req.socket?.remoteAddress || undefined)?.trim();
}
function userAgent(req: Request): string | undefined { return req.headers['user-agent']?.toString(); }

// M23-1: выдать полноценный токен + создать сессию (jti). Возвращает токен.
async function issueSession(req: Request, user: { id: string; orgId: string | null; email: string; role: string; tokenVersion: number }): Promise<string> {
  const jti = newJti();
  await createSession({ userId: user.id, orgId: user.orgId, jti, userAgent: userAgent(req), ip: clientIp(req) });
  return signToken({ userId: user.id, orgId: user.orgId, email: user.email, role: user.role, tv: user.tokenVersion, jti });
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  orgName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(payload: { userId: string; orgId: string | null; email: string; role: string; tv: number; jti?: string }): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const org = await prisma.organization.create({
      data: { name: data.orgName },
    });

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: 'OWNER',
        orgId: org.id,
      },
    });

    const token = await issueSession(req, user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated' });
      return;
    }

    // M23-1: при включённом 2FA логин НЕ выдаёт полноценный токен — только короткоживущий ОДНОРАЗОВЫЙ challenge.
    if (user.twoFactorEnabled) {
      const cjti = newJti();
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      await prisma.loginChallenge.create({ data: { jti: cjti, userId: user.id, expiresAt } });
      const challenge = jwt.sign({ userId: user.id, purpose: '2fa', cjti }, config.jwt.secret, { expiresIn: '5m' });
      res.json({ requiresTwoFactor: true, challenge });
      return;
    }

    const token = await issueSession(req, user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/verify-login — второй шаг логина: challenge + TOTP/recovery → полноценный токен+сессия.
const verifyLoginSchema = z.object({ challenge: z.string().min(10), code: z.string().min(4).max(20) });
router.post('/2fa/verify-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { challenge, code } = verifyLoginSchema.parse(req.body);
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(challenge, config.jwt.secret) as jwt.JwtPayload; } catch { res.status(400).json({ error: 'Two-factor challenge expired — sign in again', code: 'CHALLENGE_EXPIRED' }); return; }
    if (payload?.purpose !== '2fa' || !payload?.userId || !payload?.cjti) { res.status(400).json({ error: 'Invalid challenge' }); return; }
    const user = await prisma.user.findUnique({ where: { id: String(payload.userId) } });
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) { res.status(400).json({ error: 'Invalid challenge' }); return; }

    // проверяем код: TOTP ИЛИ одноразовый recovery (CAS против двойного использования, адверс-ревью #1)
    let ok = verifyTotp(decryptSecret(user.twoFactorSecret), code);
    if (!ok) {
      const codes = await prisma.userRecoveryCode.findMany({ where: { userId: user.id, usedAt: null } });
      for (const rc of codes) {
        if (await matchRecoveryCode(code, rc.codeHash)) {
          const claim = await prisma.userRecoveryCode.updateMany({ where: { id: rc.id, usedAt: null }, data: { usedAt: new Date() } });
          if (claim.count === 1) { ok = true; break; } // выиграли гонку
        }
      }
    }
    if (!ok) { res.status(401).json({ error: 'Invalid two-factor code', code: 'TWO_FACTOR_INVALID' }); return; } // неверный код → challenge НЕ гасим (retry)

    // адверс-ревью #2: код верный → атомарно «гасим» challenge (один успешный mint на challenge — нельзя реиграть).
    const claimCh = await prisma.loginChallenge.updateMany({ where: { jti: String(payload.cjti), userId: user.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimCh.count !== 1) { res.status(400).json({ error: 'Two-factor challenge already used or expired — sign in again', code: 'CHALLENGE_EXPIRED' }); return; }

    const token = await issueSession(req, user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId } });
  } catch (err) { next(err); }
});

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(8) });

// POST /api/auth/forgot-password — реальный flow восстановления. Внешняя только отправка письма
// (подключим позже); токен сброса — короткоживущий JWT (purpose=pwreset), без отдельной таблицы.
// Анти-энумерация: ответ одинаков вне зависимости от существования аккаунта. В демо-режиме (почта
// не подключена) ссылку сброса возвращаем в ответе (demoToken), чтобы flow можно было пройти.
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    let demoToken: string | undefined;
    if (user) {
      demoToken = jwt.sign(
        { userId: user.id, email: user.email, purpose: 'pwreset' },
        config.jwt.secret,
        { expiresIn: '30m' },
      );
      // TODO: отправка письма со ссылкой сброса — внешний email-сервис (подключим позже).
    }
    res.json({
      ok: true,
      message: 'If an account exists for this email, a reset link has been sent.',
      demo: true, // реальная почта не подключена → демо-режим
      ...(demoToken ? { demoToken } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — установка нового пароля по токену сброса.
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = resetSchema.parse(req.body);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
    } catch {
      res.status(400).json({ error: 'Reset link is invalid or has expired' });
      return;
    }
    if (payload?.purpose !== 'pwreset' || !payload?.userId) {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: String(payload.userId) } });
    if (!user) {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({ name: z.string().min(1).max(120).optional(), themePref: z.enum(['light', 'dark']).nullish() });

// PATCH /api/auth/me — профиль (имя) + M23-2 тема (per-user, серверный source-of-truth).
router.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.themePref !== undefined) update.themePref = data.themePref;
    const user = await prisma.user.update({ where: { id: req.user!.userId }, data: update, include: { org: true } });
    res.json({
      id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, themePref: user.themePref,
      org: user.org ? { id: user.org.id, name: user.org.name, plan: user.org.plan, leadsLimit: user.org.leadsLimit } : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid profile update', code: 'PROFILE_INVALID', issues: err.issues }); return; }
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// POST /api/auth/change-password — смена пароля залогиненным пользователем (реальная, для
// текущего аккаунта). Проверяем текущий пароль, затем сохраняем bcrypt-хэш нового.
router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      res.status(400).json({ error: 'New password must differ from the current one' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const newTv = user.tokenVersion + 1;
    // M23-1 (правка GPT): bump tokenVersion → старые токены 401; revoke ВСЕ прочие сессии;
    // текущей сессии выдаём НОВЫЙ токен (jti+tv), чтобы пользователь не вылетел сразу после смены.
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: newTv } });
    await revokeAllExcept(user.id); // отзываем все сессии (включая старую текущую — токен всё равно tv-stale)
    const token = await issueSession(req, { id: user.id, orgId: user.orgId, email: user.email, role: user.role, tokenVersion: newTv });
    await audit({ orgId: user.orgId ?? '', actorId: user.id, action: 'PASSWORD_CHANGED', targetType: 'user', targetId: user.id, summary: 'password changed · other sessions revoked' });
    res.json({ ok: true, message: 'Password updated.', token });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { org: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      themePref: user.themePref, // M23-2
      org: user.org
        ? {
            id: user.org.id,
            name: user.org.name,
            plan: user.org.plan,
            leadsLimit: user.org.leadsLimit,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
