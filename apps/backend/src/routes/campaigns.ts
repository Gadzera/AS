import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['EMAIL', 'LINKEDIN']).default('EMAIL'),
  targetIndustry: z.string().optional(),
  targetCountry: z.string().optional(),
  targetSize: z.string().optional(),
  dailyLimit: z.number().int().positive().max(500).default(50),
});

// GET /api/campaigns
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const campaigns = await prisma.campaign.findMany({
      where: { orgId },
      include: {
        _count: { select: { campaignLeads: true, sequences: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const data = createCampaignSchema.parse(req.body);

    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        orgId,
        userId,
        status: 'DRAFT',
      },
    });

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
      include: {
        sequences: { orderBy: { stepNumber: 'asc' } },
        _count: { select: { campaignLeads: true } },
        user: { select: { name: true, email: true } },
        campaignLeads: {
          include: { lead: true },
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// PUT /api/campaigns/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createCampaignSchema.partial().parse(req.body);

    const existing = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (existing.status === 'ACTIVE') {
      res.status(400).json({ error: 'Cannot edit an active campaign. Pause it first.' });
      return;
    }

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data,
    });

    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Delete related records first
    await prisma.campaignLead.deleteMany({ where: { campaignId: req.params.id } });
    await prisma.sequence.deleteMany({ where: { campaignId: req.params.id } });
    await prisma.campaign.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/start
router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
      include: { sequences: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.status === 'ACTIVE') {
      res.status(400).json({ error: 'Campaign is already active' });
      return;
    }

    if (campaign.sequences.length === 0) {
      res.status(400).json({ error: 'Campaign must have at least one sequence step before starting' });
      return;
    }

    // Find leads matching campaign criteria
    const leadWhere: Record<string, unknown> = {
      orgId,
      status: { in: ['NEW', 'CONTACTED'] },
    };

    if (campaign.targetIndustry) {
      leadWhere.industry = { contains: campaign.targetIndustry, mode: 'insensitive' };
    }
    if (campaign.targetCountry) {
      leadWhere.country = { contains: campaign.targetCountry, mode: 'insensitive' };
    }
    if (campaign.targetSize) {
      leadWhere.companySize = campaign.targetSize;
    }

    // Exclude leads already in this campaign
    const existingCampaignLeadIds = await prisma.campaignLead.findMany({
      where: { campaignId: campaign.id },
      select: { leadId: true },
    });
    const excludedIds = existingCampaignLeadIds.map((cl) => cl.leadId);
    if (excludedIds.length > 0) {
      leadWhere.id = { notIn: excludedIds };
    }

    const leads = await prisma.lead.findMany({
      where: leadWhere,
      take: campaign.dailyLimit * 7, // One week's worth
      orderBy: { score: 'desc' },
    });

    if (leads.length === 0) {
      res.status(400).json({
        error: 'No matching leads found. Import leads first or adjust campaign filters.',
      });
      return;
    }

    // Create CampaignLead records
    const firstStep = campaign.sequences[0];
    const now = new Date();
    const nextSendAt = new Date(now.getTime() + firstStep.delayDays * 24 * 60 * 60 * 1000);

    await prisma.campaignLead.createMany({
      data: leads.map((lead) => ({
        campaignId: campaign.id,
        leadId: lead.id,
        currentStep: 0,
        status: 'NEW',
        nextSendAt,
      })),
      skipDuplicates: true,
    });

    // Update campaign status
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'ACTIVE' },
    });

    res.json({
      campaign: updatedCampaign,
      leadsEnrolled: leads.length,
      nextSendAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'PAUSED' },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
