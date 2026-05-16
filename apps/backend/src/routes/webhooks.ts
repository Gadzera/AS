import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireOrg);

const VALID_EVENTS = ['reply', 'open', 'bounce', 'unsubscribe', 'interested', 'converted'];

const webhookSchema = z.object({
  name:   z.string().min(1),
  url:    z.string().url(),
  events: z.array(z.string()).min(1).refine(
    evts => evts.every(e => VALID_EVENTS.includes(e)),
    { message: `Events must be one of: ${VALID_EVENTS.join(', ')}` }
  ),
});

// GET /api/webhooks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhooks = await prisma.webhook.findMany({ where: { orgId: req.user!.orgId! } });
    res.json(webhooks);
  } catch (err) { next(err); }
});

// POST /api/webhooks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = webhookSchema.parse(req.body);
    const wh   = await prisma.webhook.create({ data: { ...data, orgId: req.user!.orgId! } });
    res.status(201).json(wh);
  } catch (err) { next(err); }
});

// PUT /api/webhooks/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.webhook.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId! } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const data    = webhookSchema.partial().parse(req.body);
    const updated = await prisma.webhook.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/webhooks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.webhook.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId! } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.webhook.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
