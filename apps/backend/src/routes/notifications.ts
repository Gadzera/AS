import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';

import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireOrg);

// GET /api/notifications — list with pagination
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip  = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { orgId } }),
    ]);

    const unreadCount = await prisma.notification.count({ where: { orgId, read: false } });
    res.json({ notifications, total, page, pages: Math.ceil(total / limit), unreadCount });
  } catch (err) { next(err); }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    await prisma.notification.updateMany({ where: { orgId, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    await prisma.notification.deleteMany({ where: { id: req.params.id, orgId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/notifications/onboarding — progress
router.get('/onboarding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const progress = await prisma.onboardingProgress.findUnique({ where: { orgId } });
    res.json(progress ?? {
      smtpAdded: false, firstLeadAdded: false,
      firstCampaign: false, firstSent: false, firstReply: false,
    });
  } catch (err) { next(err); }
});

export default router;
