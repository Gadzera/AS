import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthPayload } from '../middleware/auth';
import { authenticate, requireOrg } from '../middleware/auth';
import { registerSSEClient, unregisterSSEClient, broadcastToOrg } from '../utils/sse';

const router = Router();

// GET /api/notifications/stream — SSE stream for real-time notifications
// Must be declared before router.use(authenticate) so we can handle
// token-via-query-param (EventSource cannot send custom headers).
router.get('/stream', async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  let orgId: string;
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as AuthPayload;

    // Verify user still exists
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, orgId: true },
    });
    if (!dbUser?.orgId) {
      res.status(401).json({ error: 'Token invalid or user not found' });
      return;
    }
    orgId = dbUser.orgId;
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send initial ping
  res.write('event: ping\ndata: {}\n\n');

  // Heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n');
  }, 25_000);

  registerSSEClient(orgId, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregisterSSEClient(orgId, res);
  });
});

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
