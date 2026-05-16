import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { listBannerbearTemplates, generatePersonalizedImage } from '../services/bannerbear';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// GET /api/bannerbear/templates — list available templates
router.get('/templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await listBannerbearTemplates();
    res.json(templates);
  } catch (err) { next(err); }
});

// POST /api/bannerbear/preview — generate a preview image for a lead
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { leadId, templateId } = z.object({
      leadId:     z.string(),
      templateId: z.string(),
    }).parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const imageUrl = await generatePersonalizedImage(lead, templateId);
    if (!imageUrl) {
      res.status(503).json({ error: 'Image generation failed. Check BANNERBEAR_API_KEY and template ID.' });
      return;
    }

    res.json({ imageUrl });
  } catch (err) { next(err); }
});

// PUT /api/bannerbear/campaign/:id — set template ID on a campaign
router.put('/campaign/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { templateId } = z.object({ templateId: z.string().nullable() }).parse(req.body);

    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId } });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data:  { bannerbearTemplateId: templateId },
    });
    res.json({ id: updated.id, bannerbearTemplateId: updated.bannerbearTemplateId });
  } catch (err) { next(err); }
});

export default router;
