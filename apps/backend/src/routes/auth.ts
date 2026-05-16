import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { triggerOnboarding } from '../services/onboarding';

const router = Router();

// Pre-hashed constant for timing-safe login (prevents email enumeration via response time)
const DUMMY_HASH = '$2b$12$invalidhashfortimingprotectiononly000000000000000000000';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  orgName: z.string().min(1).max(100),
  referralCode: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(payload: { userId: string; orgId: string | null; email: string; role: string }): string {
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

    const token = signToken({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
    });

    // Apply referral code if provided (validated via schema)
    const refCode = data.referralCode;
    if (refCode) {
      const referrer = await prisma.organization.findUnique({ where: { referralCode: refCode } });
      if (referrer && referrer.id !== org.id) {
        // Use a transaction with idempotency guard to prevent double-credit
        await prisma.$transaction([
          prisma.organization.update({
            where: { id: org.id, referredByOrgId: null },
            data: { referredByOrgId: referrer.id, bonusLeads: 200 },
          }),
          prisma.organization.update({
            where: { id: referrer.id },
            data: { bonusLeads: { increment: 500 } },
          }),
        ]).catch(() => null); // Ignore if already credited (unique constraint on referredByOrgId)
      }
    }

    // Trigger onboarding emails + initial notification (non-blocking)
    triggerOnboarding(user.id, org.id).catch(() => null);

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
    // Always run bcrypt to prevent timing-based email enumeration
    const valid = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      role: user.role,
    });

    res.json({
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

// PUT /api/auth/me — update name and/or password
router.put('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).max(128).optional(),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const updates: { name?: string; passwordHash?: string } = {};

    if (data.name) updates.name = data.name;

    if (data.newPassword) {
      if (!data.currentPassword) {
        res.status(400).json({ error: 'currentPassword required to set a new password' });
        return;
      }
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }
      updates.passwordHash = await bcrypt.hash(data.newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data: updates });
    res.json({ id: updated.id, email: updated.email, name: updated.name, role: updated.role });
  } catch (err) {
    next(err);
  }
});

export default router;
