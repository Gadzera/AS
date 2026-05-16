import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireOrg, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireOrg);

const inviteSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
  password: z.string().min(8).max(128),
});

const patchRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

// GET /api/team
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await prisma.user.findMany({
      where: { orgId: req.user!.orgId! },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// POST /api/team/invite
router.post(
  '/invite',
  requireRole('OWNER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = inviteSchema.parse(req.body);
      const actorRole = req.user!.role;

      if (data.role === 'ADMIN' && actorRole !== 'OWNER') {
        res.status(403).json({ error: 'Only OWNERs can invite ADMINs' });
        return;
      }

      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const orgUserCount = await prisma.user.count({ where: { orgId: req.user!.orgId! } });
      if (orgUserCount >= 20) {
        res.status(400).json({ error: 'Organization has reached the maximum of 20 members' });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, 12);

      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: data.role,
          orgId: req.user!.orgId!,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/team/:userId/role
router.patch(
  '/:userId/role',
  requireRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const data = patchRoleSchema.parse(req.body);

      if (userId === req.user!.userId) {
        res.status(400).json({ error: 'Cannot change your own role' });
        return;
      }

      const target = await prisma.user.findFirst({
        where: { id: userId, orgId: req.user!.orgId! },
      });

      if (!target) {
        res.status(404).json({ error: 'User not found in your organization' });
        return;
      }

      if (target.role === 'OWNER') {
        res.status(400).json({ error: 'Cannot change the role of another OWNER' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { role: data.role },
        select: { id: true, name: true, email: true, role: true },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/team/:userId
router.delete(
  '/:userId',
  requireRole('OWNER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const actor = req.user!;

      if (userId === actor.userId) {
        res.status(400).json({ error: 'Cannot remove yourself from the organization' });
        return;
      }

      const target = await prisma.user.findFirst({
        where: { id: userId, orgId: actor.orgId! },
      });

      if (!target) {
        res.status(404).json({ error: 'User not found in your organization' });
        return;
      }

      if (actor.role === 'ADMIN' && (target.role === 'OWNER' || target.role === 'ADMIN')) {
        res.status(403).json({ error: 'ADMINs can only remove MEMBERs' });
        return;
      }

      if (target.role === 'OWNER') {
        const ownerCount = await prisma.user.count({
          where: { orgId: actor.orgId!, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          res.status(400).json({ error: 'Cannot remove the last OWNER of the organization' });
          return;
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: { orgId: null },
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
