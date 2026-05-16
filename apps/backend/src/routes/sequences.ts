import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();


router.use(authenticate, requireOrg);

const sequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  subject: z.string().optional(),
  body: z.string().min(1),
  channel: z.enum(['EMAIL', 'LINKEDIN']).default('EMAIL'),
});

// GET /api/sequences/:campaignId
router.get('/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    // Verify campaign belongs to org
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.campaignId, orgId },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const sequences = await prisma.sequence.findMany({
      where: { campaignId: req.params.campaignId },
      orderBy: { stepNumber: 'asc' },
    });

    res.json(sequences);
  } catch (err) {
    next(err);
  }
});

// POST /api/sequences/:campaignId
router.post('/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = sequenceStepSchema.parse(req.body);

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.campaignId, orgId },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Check for duplicate step number
    const existing = await prisma.sequence.findFirst({
      where: { campaignId: req.params.campaignId, stepNumber: data.stepNumber },
    });

    if (existing) {
      res.status(409).json({ error: `Step ${data.stepNumber} already exists` });
      return;
    }

    const sequence = await prisma.sequence.create({
      data: {
        ...data,
        campaignId: req.params.campaignId,
      },
    });

    res.status(201).json(sequence);
  } catch (err) {
    next(err);
  }
});

// PUT /api/sequences/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = sequenceStepSchema.partial().parse(req.body);

    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id },
      include: { campaign: true },
    });

    if (!sequence || sequence.campaign.orgId !== orgId) {
      res.status(404).json({ error: 'Sequence step not found' });
      return;
    }

    const updated = await prisma.sequence.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sequences/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id },
      include: { campaign: true },
    });

    if (!sequence || sequence.campaign.orgId !== orgId) {
      res.status(404).json({ error: 'Sequence step not found' });
      return;
    }

    await prisma.sequence.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
