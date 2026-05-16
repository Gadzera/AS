import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { authenticate, requireOrg } from '../middleware/auth';
import { testHubSpotConnection, upsertHubSpotContact } from '../services/hubspot';
import { testPipedriveConnection, upsertPipedriveContact } from '../services/pipedrive';
import { encrypt } from '../utils/encryption';
import { redis } from '../worker/queue';

const crmSyncBatchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as Request & { user?: { orgId?: string } }).user?.orgId ?? req.ip ?? 'anon',
  message: { error: 'Too many CRM sync-batch requests, try again later' },
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(args[0], ...args.slice(1)) as Promise<number>,
    prefix: 'rl:crm_sync:',
  }),
});


const router = Router();

router.use(authenticate, requireOrg);

// GET /api/crm/status — test connections for configured CRMs (per-org)
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [hubspot, pipedrive] = await Promise.all([
      testHubSpotConnection(orgId),
      testPipedriveConnection(orgId),
    ]);
    res.json({ hubspot, pipedrive });
  } catch (err) { next(err); }
});

// PUT /api/crm/keys — save per-org API keys for HubSpot / Pipedrive
router.put('/keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const schema = z.object({
      hubspotToken:      z.string().optional().nullable(),
      pipedriveApiKey:   z.string().optional().nullable(),
      pipedriveDomain:   z.string().optional().nullable(),
    });
    const { hubspotToken, pipedriveApiKey, pipedriveDomain } = schema.parse(req.body);

    const upsertKey = async (service: string, value: string | null | undefined) => {
      if (value === undefined) return;
      if (!value) {
        await prisma.apiKey.deleteMany({ where: { orgId, service } });
        return;
      }
      await prisma.apiKey.upsert({
        where: { orgId_service: { orgId, service } } as never,
        create: { orgId, service, keyValue: encrypt(value) },
        update: { keyValue: encrypt(value) },
      });
    };

    await Promise.all([
      upsertKey('hubspot', hubspotToken),
      upsertKey('pipedrive_key', pipedriveApiKey),
      upsertKey('pipedrive_domain', pipedriveDomain ? pipedriveDomain : undefined),
    ]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/crm/keys — return which integrations are configured (no secrets)
router.get('/keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const keys = await prisma.apiKey.findMany({ where: { orgId }, select: { service: true } });
    const services = new Set(keys.map(k => k.service));
    res.json({
      hubspot:   services.has('hubspot'),
      pipedrive: services.has('pipedrive_key') && services.has('pipedrive_domain'),
    });
  } catch (err) { next(err); }
});

// POST /api/crm/sync/:leadId — manually sync a lead to all CRMs
router.post('/sync/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, orgId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    await Promise.allSettled([
      upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: lead.status, orgId }),
      upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, orgId }),
    ]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/crm/sync-batch — sync all HOT leads to CRMs
router.post('/sync-batch', crmSyncBatchLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
        upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: lead.status, orgId }),
        upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, orgId }),
      ]);
      synced++;
    }));

    res.json({ synced });
  } catch (err) { next(err); }
});

export default router;
