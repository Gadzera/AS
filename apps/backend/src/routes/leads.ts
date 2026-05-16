import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { searchLeads, enrichLead, mapApolloPersonToLead } from '../services/apollo';
import { updateOnboardingStep } from '../services/onboarding';
import { scoreLeadLocal, scoreLeadAI } from '../services/scorer';
import { parseCSV, exportRowToCsv } from '../utils/csv';
import { searchPDL } from '../services/pdl';
import { generateUnsubscribeToken } from '../utils/unsubscribe';

const router = Router();


router.use(authenticate, requireOrg);

const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().max(500).optional(),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  companySize: z.string().max(50).optional(),
  industry: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(100).optional(),
});

const apolloSearchSchema = z.object({
  personTitles: z.array(z.string()).optional(),
  personLocations: z.array(z.string()).optional(),
  organizationNumEmployeesRanges: z.array(z.string()).optional(),
  organizationIndustryTagIds: z.array(z.string()).optional(),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().max(100).optional(),
  importToOrg: z.boolean().optional(),
});

// GET /api/leads
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 200);
    const search = (req.query.search as string) || '';
    const status = req.query.status as string | undefined;
    const country = req.query.country as string | undefined;
    const industry = req.query.industry as string | undefined;

    const where: Record<string, unknown> = { orgId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (country) where.country = { contains: country, mode: 'insensitive' };
    if (industry) where.industry = { contains: industry, mode: 'insensitive' };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      leads,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createLeadSchema.parse(req.body);

    const score = scoreLeadLocal({ ...data });

    const lead = await prisma.lead.create({
      data: {
        ...data,
        orgId,
        score,
        source: data.source ?? 'manual',
        unsubscribeToken: generateUnsubscribeToken(),
      },
    });

    updateOnboardingStep(orgId, 'firstLeadAdded').catch(() => null);
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, orgId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        campaignLeads: {
          include: { campaign: true },
        },
      },
    });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createLeadSchema.partial().parse(req.body);

    const existing = await prisma.lead.findFirst({ where: { id: req.params.id, orgId } });
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const merged = { ...existing, ...data };
    const score = scoreLeadLocal(merged);

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { ...data, score },
    });

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.lead.findFirst({ where: { id: req.params.id, orgId } });
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/search — Apollo.io search
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filters = apolloSearchSchema.parse(req.body);

    const results = await searchLeads(filters);
    const mappedPeople = results.people.map(mapApolloPersonToLead);

    if (filters.importToOrg) {
      // Import leads to database
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const currentCount = await prisma.lead.count({ where: { orgId } });

      const limit = (org?.leadsLimit ?? 500) + (org?.bonusLeads ?? 0);
      const available = limit - currentCount;

      if (available <= 0) {
        res.status(402).json({ error: 'Leads limit reached for your plan' });
        return;
      }

      const toImport = mappedPeople.slice(0, available);
      const scores = toImport.map((l) => scoreLeadLocal(l));

      const created = await prisma.$transaction(
        toImport.map((person, i) =>
          prisma.lead.create({
            data: {
              ...person,
              orgId,
              score: scores[i],
            },
          })
        )
      );

      res.json({
        imported: created.length,
        total: results.total,
        leads: created,
      });
    } else {
      // Return preview without importing
      const scored = mappedPeople.map((p) => ({
        ...p,
        score: scoreLeadLocal(p),
      }));
      res.json({ people: scored, total: results.total, page: results.page });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/enrich
router.post('/:id/enrich', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, orgId } });

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    if (!lead.email) {
      res.status(400).json({ error: 'Lead must have email to enrich' });
      return;
    }

    const enriched = await enrichLead(lead.email);
    if (!enriched) {
      res.status(404).json({ error: 'No enrichment data found for this email' });
      return;
    }

    const updates: Record<string, unknown> = { enriched: true };
    if (enriched.title && !lead.title) updates.title = enriched.title;
    if (enriched.linkedinUrl && !lead.linkedinUrl) updates.linkedinUrl = enriched.linkedinUrl;
    if (enriched.organization?.name && !lead.company) updates.company = enriched.organization.name;
    if (enriched.organization?.industry && !lead.industry)
      updates.industry = enriched.organization.industry;
    if (enriched.country && !lead.country) updates.country = enriched.country;
    if (enriched.city && !lead.city) updates.city = enriched.city;

    const updatedLead = { ...lead, ...updates };
    updates.score = scoreLeadLocal(updatedLead as typeof lead);

    const saved = await prisma.lead.update({
      where: { id: req.params.id },
      data: updates,
    });

    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/import — bulk import from CSV
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { csvContent } = z.object({ csvContent: z.string().min(1).max(5_000_000) }).parse(req.body);

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const currentCount = await prisma.lead.count({ where: { orgId } });
    const limit = (org?.leadsLimit ?? 500) + (org?.bonusLeads ?? 0);
    const available = limit - currentCount;

    if (available <= 0) {
      res.status(402).json({ error: 'Leads limit reached for your plan. Upgrade to import more.' });
      return;
    }

    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      res.status(400).json({ error: 'No valid rows found. Check your CSV format.' });
      return;
    }

    const toImport = rows.slice(0, available);

    // Deduplication: find existing emails in this org
    const incomingEmails = toImport.map(r => r.email?.toLowerCase()).filter(Boolean) as string[];
    const existingEmails = new Set(
      (await prisma.lead.findMany({
        where: { orgId, email: { in: incomingEmails } },
        select: { email: true },
      })).map(l => l.email!.toLowerCase())
    );

    let imported = 0;
    let skipped  = 0;
    let duplicates = 0;

    for (const row of toImport) {
      // Skip duplicates
      if (row.email && existingEmails.has(row.email.toLowerCase())) {
        duplicates++;
        continue;
      }

      const firstName = row.firstName ?? row.email?.split('@')[0] ?? 'Unknown';
      const lastName  = row.lastName ?? '';

      try {
        const score = scoreLeadLocal({
          title: row.title, company: row.company, companySize: undefined,
          industry: row.industry, country: row.country, email: row.email, linkedinUrl: row.linkedinUrl,
        });
        await prisma.lead.create({
          data: {
            orgId, firstName, lastName,
            email: row.email || null, linkedinUrl: row.linkedinUrl || null,
            title: row.title || null, company: row.company || null,
            industry: row.industry || null, country: row.country || null,
            city: row.city || null, website: row.website || null,
            source: 'csv', score,
            unsubscribeToken: generateUnsubscribeToken(),
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    res.json({
      imported,
      skipped,
      duplicates,
      total: rows.length,
      limitReached: rows.length > available,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/search/pdl — People Data Labs search
const pdlSearchSchema = z.object({
  jobTitles:    z.array(z.string()).optional(),
  countries:    z.array(z.string()).optional(),
  industries:   z.array(z.string()).optional(),
  companySizes: z.array(z.string()).optional(),
  keywords:     z.string().optional(),
  size:         z.number().int().min(1).max(100).optional(),
  importAll:    z.boolean().optional(),
});

router.post('/search/pdl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const params = pdlSearchSchema.parse(req.body);

    const { results, total } = await searchPDL(params);

    if (!params.importAll) {
      return res.json({ results, total });
    }

    // Import all results into org's lead DB
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const existingCount = await prisma.lead.count({ where: { orgId } });
    const available = ((org?.leadsLimit ?? 500) + (org?.bonusLeads ?? 0)) - existingCount;

    if (available <= 0) {
      return res.status(402).json({ error: 'Lead limit reached. Upgrade your plan.' });
    }

    let imported = 0;
    let skipped  = 0;

    for (const p of results.slice(0, available)) {
      try {
        const exists = p.email
          ? await prisma.lead.findFirst({ where: { orgId, email: p.email } })
          : null;
        if (exists) { skipped++; continue; }

        const token = generateUnsubscribeToken();
        await prisma.lead.create({
          data: {
            orgId,
            firstName:       p.firstName,
            lastName:        p.lastName,
            email:           p.email,
            linkedinUrl:     p.linkedinUrl,
            title:           p.title,
            company:         p.company,
            companySize:     p.companySize,
            industry:        p.industry,
            country:         p.country,
            city:            p.city,
            website:         p.website,
            source:          'pdl',
            unsubscribeToken: token,
            score:           scoreLeadLocal({
              title: p.title, industry: p.industry,
              companySize: p.companySize, country: p.country,
            }),
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    res.json({ imported, skipped, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/bulk — bulk operations on multiple leads
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId  = req.user!.orgId!;
    const schema = z.object({
      action:     z.enum(['delete', 'add-to-campaign', 'update-status', 'export']),
      leadIds:    z.array(z.string()).min(1).max(1000),
      campaignId: z.string().optional(),
      status:     z.enum(['NEW', 'CONTACTED', 'REPLIED', 'HOT', 'CONVERTED', 'LOST', 'UNSUBSCRIBED']).optional(),
    });
    const { action, leadIds, campaignId, status } = schema.parse(req.body);

    // Fetch only lead IDs that actually belong to this org
    const ownedLeads = await prisma.lead.findMany({ where: { id: { in: leadIds }, orgId }, select: { id: true } });
    const ownedIds = ownedLeads.map(l => l.id);
    if (ownedIds.length === 0) { res.status(400).json({ error: 'No valid leads found' }); return; }

    if (action === 'delete') {
      const [,, { count: deleted }] = await prisma.$transaction([
        prisma.campaignLead.deleteMany({ where: { leadId: { in: ownedIds } } }),
        prisma.message.deleteMany({ where: { leadId: { in: ownedIds } } }),
        prisma.lead.deleteMany({ where: { id: { in: ownedIds }, orgId } }),
      ]);
      res.json({ deleted });
      return;
    }

    if (action === 'update-status') {
      if (!status) { res.status(400).json({ error: 'status required' }); return; }
      const { count: updated } = await prisma.lead.updateMany({ where: { id: { in: leadIds }, orgId }, data: { status } });
      res.json({ updated });
      return;
    }

    if (action === 'add-to-campaign') {
      if (!campaignId) { res.status(400).json({ error: 'campaignId required' }); return; }
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, orgId },
        include: { sequences: { orderBy: { stepNumber: 'asc' }, take: 1 } },
      });
      if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
      const firstStep  = campaign.sequences[0];
      const nextSendAt = new Date(Date.now() + (firstStep?.delayDays ?? 0) * 86_400_000);
      const result = await prisma.campaignLead.createMany({
        data: ownedIds.map(leadId => ({ campaignId, leadId, currentStep: 0, status: 'NEW', nextSendAt })),
        skipDuplicates: true,
      });
      res.json({ added: result.count });
      return;
    }

    if (action === 'export') {
      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds }, orgId },
        select: { firstName: true, lastName: true, email: true, title: true, company: true, industry: true, country: true, city: true, status: true, score: true },
      });
      const header = 'firstName,lastName,email,title,company,industry,country,city,status,score\n';
      const csv    = leads.map(l => exportRowToCsv(Object.values(l))).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
      res.send(header + csv);
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) { next(err); }
});

export default router;
