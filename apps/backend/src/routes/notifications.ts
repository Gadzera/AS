import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// GET /api/notifications — list unread + recent
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const notifications = await prisma.notification.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
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
