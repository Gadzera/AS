import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireOrg);

// GET /api/tags
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const tags = await prisma.tag.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    res.json(tags);
  } catch (err) { next(err); }
});

// POST /api/tags
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { name, color } = z.object({
      name: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }).parse(req.body);
    const tag = await prisma.tag.create({ data: { orgId, name, color: color ?? '#6366f1' } });
    res.status(201).json(tag);
  } catch (err) { next(err); }
});

// DELETE /api/tags/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await prisma.tag.deleteMany({ where: { id: req.params.id, orgId } });
    if (result.count === 0) { res.status(404).json({ error: 'Tag not found' }); return; }
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// POST /api/tags/:tagId/leads/:leadId — add tag to lead
router.post('/:tagId/leads/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { tagId, leadId } = req.params;
    const [tag, lead] = await Promise.all([
      prisma.tag.findFirst({ where: { id: tagId, orgId } }),
      prisma.lead.findFirst({ where: { id: leadId, orgId } }),
    ]);
    if (!tag || !lead) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId } },
      create: { leadId, tagId },
      update: {},
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/tags/:tagId/leads/:leadId — remove tag from lead
router.delete('/:tagId/leads/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tagId, leadId } = req.params;
    await prisma.leadTag.delete({ where: { leadId_tagId: { leadId, tagId } } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
