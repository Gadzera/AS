import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireOrg);

const configSchema = z.object({
  enabled:             z.boolean().optional(),
  targetCampaignId:    z.string().optional().nullable(),
  discoverySource:     z.enum(['apollo', 'web', 'both']).optional(),
  targetKeywords:      z.array(z.string().max(100)).max(20).optional(),
  targetIndustry:      z.string().max(200).optional().nullable(),
  targetCountry:       z.string().max(100).optional().nullable(),
  targetTitles:        z.array(z.string().max(100)).max(20).optional(),
  dailyDiscoveryLimit: z.number().int().min(1).max(100).optional(),
  autoReplyEnabled:    z.boolean().optional(),
  calendlyUrl:         z.string().url().max(500).optional().nullable(),
  senderName:          z.string().max(100).optional().nullable(),
  senderTitle:         z.string().max(100).optional().nullable(),
  followUpDelayDays:   z.number().int().min(1).max(30).optional(),
});

// GET /api/autopilot — получить конфиг и статистику
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const cfg = await prisma.autopilotConfig.findUnique({ where: { orgId } });
    res.json(cfg ?? { enabled: false, orgId });
  } catch (err) { next(err); }
});

// PUT /api/autopilot — обновить конфиг
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = configSchema.parse(req.body);

    const cfg = await prisma.autopilotConfig.upsert({
      where:  { orgId },
      create: { orgId, ...data },
      update: data,
    });

    res.json(cfg);
  } catch (err) { next(err); }
});

// GET /api/autopilot/pipeline — воронка продаж
router.get('/pipeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const [discovered, contacted, replied, interested, converted] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.lead.count({ where: { orgId, status: { in: ['CONTACTED'] } } }),
      prisma.lead.count({ where: { orgId, status: { in: ['REPLIED'] } } }),
      prisma.lead.count({ where: { orgId, status: 'HOT' } }),
      prisma.lead.count({ where: { orgId, status: 'CONVERTED' } }),
    ]);

    const recentHot = await prisma.lead.findMany({
      where: { orgId, status: 'HOT' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, firstName: true, lastName: true, email: true, company: true, updatedAt: true },
    });

    res.json({ discovered, contacted, replied, interested, converted, recentHot });
  } catch (err) { next(err); }
});

export default router;
