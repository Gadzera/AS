import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';

export interface AuthPayload {
  userId: string;
  orgId: string | null;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as AuthPayload;

    // Verify user still exists in DB (soft revocation)
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, orgId: true },
    });
    if (!dbUser) {
      res.status(401).json({ error: 'Token invalid or expired' });
      return;
    }

    req.user = {
      ...payload,
      orgId: dbUser.orgId, // always taken from DB
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

export function requireOrg(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.orgId) {
    res.status(403).json({ error: 'Organization required' });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  if (roles.length === 0) throw new Error('requireRole: at least one role must be specified');
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
