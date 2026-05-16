import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireOrg);

// GET /api/organization — get org details
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, plan: true, leadsLimit: true, referralCode: true, createdAt: true, bonusLeads: true },
    });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    res.json(org);
  } catch (err) { next(err); }
});

// PUT /api/organization — update org name
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { name } = z.object({ name: z.string().min(2).max(100) }).parse(req.body);
    const org = await prisma.organization.update({ where: { id: orgId }, data: { name } });
    res.json({ id: org.id, name: org.name });
  } catch (err) { next(err); }
});

export default router;
