import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../middleware/auth';
import { testHubSpotConnection, upsertHubSpotContact } from '../services/hubspot';
import { testPipedriveConnection, upsertPipedriveContact } from '../services/pipedrive';


const router = Router();

router.use(authenticate, requireOrg);

// GET /api/crm/status — test connections for all configured CRMs
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [hubspot, pipedrive] = await Promise.all([
      testHubSpotConnection(),
      testPipedriveConnection(),
    ]);
    res.json({ hubspot, pipedrive });
  } catch (err) { next(err); }
});

// POST /api/crm/sync/:leadId — manually sync a lead to all CRMs
router.post('/sync/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, orgId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    await Promise.allSettled([
      upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: lead.status }),
      upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title }),
    ]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/crm/sync-batch — sync all HOT leads to CRMs
router.post('/sync-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { status = 'HOT' } = z.object({
      status: z.enum(['NEW', 'CONTACTED', 'REPLIED', 'HOT', 'CONVERTED', 'LOST', 'UNSUBSCRIBED']).optional(),
    }).parse(req.body);

    const leads = await prisma.lead.findMany({
      where: { orgId, status },
      take: 500,
    });

    let synced = 0;
    await Promise.allSettled(leads.map(async (lead) => {
      await Promise.allSettled([
        upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: lead.status }),
        upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title }),
      ]);
      synced++;
    }));

    res.json({ synced });
  } catch (err) { next(err); }
});

export default router;
