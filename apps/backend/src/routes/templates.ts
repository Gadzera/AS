import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireOrg);

const templateSchema = z.object({
  name:    z.string().min(1).max(100),
  subject: z.string().optional(),
  body:    z.string().min(1),
  channel: z.enum(['EMAIL', 'LINKEDIN']).default('EMAIL'),
});

// GET /api/templates
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId    = req.user!.orgId!;
    const channel  = req.query.channel as string | undefined;
    const templates = await prisma.template.findMany({
      where: { orgId, ...(channel ? { channel: channel as 'EMAIL' | 'LINKEDIN' } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(templates);
  } catch (err) { next(err); }
});

// POST /api/templates
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data  = templateSchema.parse(req.body);
    const tpl   = await prisma.template.create({ data: { ...data, orgId } });
    res.status(201).json(tpl);
  } catch (err) { next(err); }
});

// PUT /api/templates/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId    = req.user!.orgId!;
    const existing = await prisma.template.findFirst({ where: { id: req.params.id, orgId } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const data    = templateSchema.partial().parse(req.body);
    const updated = await prisma.template.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId    = req.user!.orgId!;
    const existing = await prisma.template.findFirst({ where: { id: req.params.id, orgId } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.template.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
