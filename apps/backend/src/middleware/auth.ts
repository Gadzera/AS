import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { touchSession } from '../services/sessions';

const prisma = new PrismaClient();

export interface AuthPayload {
  userId: string;
  orgId: string | null;
  email: string;
  role: string;
  /** Версия токена на момент выпуска (для инвалидации после смены роли/удаления/деактивации). */
  tv?: number;
  /** M23-1: id сессии (UserSession.jti). Есть → проверяем revokedAt; нет (legacy/служебные) → пропускаем. */
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// Аутентификация: проверяем подпись JWT + сверяем версию токена и активность пользователя с БД.
// Это инвалидирует старые токены после смены роли/удаления/деактивации (прод-готовность).
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
    return;
  }

  try {
    // Лёгкая сверка с БД: версия токена и активность. Без неё смена роли/удаление не вступали бы в силу
    // до истечения JWT. Берём только нужные поля.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true, isActive: true, role: true, orgId: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Session is no longer valid', code: 'SESSION_REVOKED' });
      return;
    }
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Session expired — please sign in again', code: 'TOKEN_STALE' });
      return;
    }
    // M23-1: если токен несёт jti — проверяем, что сессия не отозвана (revoke устройства/сессии).
    if (payload.jti) {
      const st = await touchSession(payload.jti);
      if (st === 'revoked') {
        res.status(401).json({ error: 'This session was signed out', code: 'SESSION_REVOKED' });
        return;
      }
    }
    // Актуальные роль/orgId из БД (а не из устаревшего токена) — на случай рассинхрона.
    req.user = { ...payload, role: user.role, orgId: user.orgId };
    next();
  } catch {
    res.status(401).json({ error: 'Auth check failed' });
  }
}

export function requireOrg(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.orgId) {
    res.status(403).json({ error: 'Organization required' });
    return;
  }
  next();
}
