import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// GET /api/track/open/:messageId — tracking pixel
router.get('/open/:messageId', async (req: Request, res: Response) => {
  prisma.message
    .updateMany({ where: { id: req.params.messageId, openedAt: null }, data: { openedAt: new Date() } })
    .catch(() => {});

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
  });
  res.send(PIXEL);
});

// GET /api/track/click/:messageId/:encodedUrl — link click tracking + redirect
router.get('/click/:messageId/:encodedUrl', async (req: Request, res: Response) => {
  const { messageId, encodedUrl } = req.params;

  let destination = 'https://example.com';
  try {
    destination = Buffer.from(encodedUrl, 'base64url').toString('utf8');
    // Validate it's a real URL to prevent open-redirect abuse
    const url = new URL(destination);
    if (!['http:', 'https:'].includes(url.protocol)) destination = 'https://example.com';
  } catch {
    destination = 'https://example.com';
  }

  // Record click (non-blocking, run both updates in parallel)
  Promise.all([
    prisma.message.updateMany({ where: { id: messageId, clickedAt: null }, data: { clickedAt: new Date() } }),
    prisma.message.update({ where: { id: messageId }, data: { clicks: { increment: 1 } } }),
  ]).catch(() => {});

  res.redirect(302, destination);
});

// GET /api/track/unsubscribe/:token — one-click unsubscribe
router.get('/unsubscribe/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const lead = await prisma.lead.findUnique({ where: { unsubscribeToken: token } });

    if (!lead) {
      res.status(404).send(unsubscribePage('Invalid or expired unsubscribe link.', false));
      return;
    }

    if (lead.status === 'UNSUBSCRIBED') {
      res.send(unsubscribePage(`${lead.firstName}, you're already unsubscribed.`, true));
      return;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'UNSUBSCRIBED' },
    });

    await prisma.campaignLead.updateMany({
      where: { leadId: lead.id, status: { notIn: ['CONVERTED', 'LOST', 'UNSUBSCRIBED'] } },
      data:  { status: 'UNSUBSCRIBED', nextSendAt: null },
    });

    await prisma.message.create({
      data: {
        leadId:    lead.id,
        direction: 'INBOUND',
        channel:   'EMAIL',
        subject:   'Unsubscribe',
        body:      'Lead clicked unsubscribe link',
        replyClass: 'UNSUBSCRIBE',
        sentAt:    new Date(),
      },
    });

    console.log(`[Track] Unsubscribed: ${lead.email}`);
    res.send(unsubscribePage(`${lead.firstName}, you've been unsubscribed successfully.`, true));
  } catch (err) {
    res.status(500).send(unsubscribePage('Something went wrong. Please try again.', false));
  }
});

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 400px; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .dot { width: 40px; height: 40px; border-radius: 50%; margin: 0 auto 16px; }
    .dot-ok { background: #22c55e; }
    .dot-err { background: #ef4444; }
    h1 { font-size: 20px; color: #111; margin: 0 0 8px; }
    p { color: #666; font-size: 14px; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot ${success ? 'dot-ok' : 'dot-err'}"></div>
    <h1>${success ? 'Done' : 'Error'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export default router;
