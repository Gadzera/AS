import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { generateStrategy } from '../services/playbook';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// GET /api/playbooks/:campaignId/strategy — стратегия (spine) кампании из реальных данных
router.get('/:campaignId/strategy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.campaignId, orgId },
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const sequences = await prisma.sequence.findMany({
      where: { campaignId: campaign.id },
      orderBy: { stepNumber: 'asc' },
    });

    const result = await generateStrategy({
      campaignName: campaign.name,
      channel: campaign.channel === 'LINKEDIN' ? 'LINKEDIN' : 'EMAIL',
      targetIndustry: campaign.targetIndustry,
      targetCountry: campaign.targetCountry,
      targetSize: campaign.targetSize,
      steps: sequences.map((s) => ({
        stepNumber: s.stepNumber,
        delayDays: s.delayDays,
        subject: s.subject,
        channel: s.channel,
        body: s.body,
      })),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
