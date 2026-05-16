import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// GET /api/track/open/:messageId
// Called when recipient opens the email (tracking pixel)
router.get('/open/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;

  // Fire-and-forget — never block the response
  prisma.message
    .updateMany({
      where: { id: messageId, openedAt: null },
      data: { openedAt: new Date() },
    })
    .catch(() => {});

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
  });
  res.send(PIXEL);
});

export default router;
