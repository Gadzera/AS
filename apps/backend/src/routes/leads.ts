import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, ActivityType } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { searchLeads, enrichLead, mapApolloPersonToLead } from '../services/apollo';
import { scoreLeadLocal, scoreLeadAI } from '../services/scorer';
import { pauseEnrollment, resumeEnrollment, writeEnrollmentAudit, enrollLeadInCampaign } from '../services/enrollment';
import { parseCSV } from '../utils/csv';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const createLeadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  companySize: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
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
    const limit = parseInt(req.query.limit as string) || 25;
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
      },
    });

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

// GET /api/leads/:id/timeline — Lead 360: единая карточка из РЕАЛЬНЫХ источников (messages/calls/
// meetings/workflow-runs) + текущее состояние (статус/активная последовательность/следующий шаг/
// последний контакт/owner). Никакого мок-агрегатора — всё из БД.
router.get('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, orgId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const [messages, calls, meetings, runs, campaignLeads, enrollmentEvents] = await Promise.all([
      prisma.message.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.call.findMany({ where: { orgId, leadId: lead.id, archivedAt: null }, orderBy: { createdAt: 'desc' } }),
      prisma.meeting.findMany({ where: { orgId, leadId: lead.id, archivedAt: null }, orderBy: { createdAt: 'desc' } }),
      prisma.workflowRun.findMany({ where: { orgId, leadId: lead.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.campaignLead.findMany({ where: { leadId: lead.id, campaign: { orgId } }, include: { campaign: { include: { user: { select: { name: true } }, sequences: { select: { id: true } } } } } }),
      // M11-3/M11-7: аудит enrollment'а лида (enroll/exit/pause/resume, payload.leadId == этот лид) — в таймлайн Lead 360.
      prisma.activity.findMany({ where: { orgId, type: { in: [ActivityType.SEQUENCE_ENROLLED, ActivityType.SEQUENCE_EXITED, ActivityType.SEQUENCE_PAUSED, ActivityType.SEQUENCE_RESUMED] }, payload: { path: ['leadId'], equals: lead.id } }, orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);

    type Ev = { id: string; kind: string; title: string; detail: string; at: string };
    const timeline: Ev[] = [];
    for (const m of messages) {
      timeline.push(m.direction === 'INBOUND'
        ? { id: m.id, kind: 'reply', title: 'Reply received', detail: `${m.replyClass ? `[${m.replyClass.toLowerCase()}] ` : ''}${(m.body || '').slice(0, 120)}`, at: (m.repliedAt ?? m.createdAt).toISOString() }
        : { id: m.id, kind: 'email', title: m.subject ? `Email sent · ${m.subject}` : 'Email sent', detail: (m.body || '').slice(0, 120), at: (m.sentAt ?? m.createdAt).toISOString() });
    }
    for (const c of calls) timeline.push({ id: c.id, kind: 'call', title: `Call · ${c.direction.toLowerCase()}${c.outcome ? ` · ${c.outcome.replace('_', ' ').toLowerCase()}` : ''}`, detail: c.summary || c.notes || '', at: c.createdAt.toISOString() });
    for (const mt of meetings) timeline.push({ id: mt.id, kind: 'meeting', title: `Meeting · ${mt.status.toLowerCase()}`, detail: `${mt.title}${mt.outcome ? ` — ${mt.outcome}` : ''}`, at: (mt.scheduledAt ?? mt.createdAt).toISOString() });
    for (const r of runs) timeline.push({ id: r.id, kind: 'workflow', title: 'Automation ran', detail: r.summary, at: r.createdAt.toISOString() });
    for (const a of enrollmentEvents) timeline.push({ id: a.id, kind: 'enrollment', title: a.title ?? 'Sequence update', detail: a.body ?? '', at: a.createdAt.toISOString() });
    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // Текущее состояние
    // M11-2: «активный» enrollment = не терминальный (не COMPLETED/STOPPED); PAUSED/REPLIED ещё релевантны.
    const activeCl = campaignLeads.find((cl) => !['COMPLETED', 'STOPPED'].includes(cl.status)) ?? campaignLeads[0] ?? null;
    const nextActions = campaignLeads.map((cl) => cl.nextSendAt).filter(Boolean).map((d) => new Date(d as Date).getTime());
    const upcomingMeeting = meetings.filter((m) => m.scheduledAt && m.status === 'SCHEDULED' && new Date(m.scheduledAt) > new Date()).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];
    const lastTouch = timeline.find((e) => e.kind === 'email' || e.kind === 'call' || e.kind === 'meeting' || e.kind === 'reply');

    const state = {
      status: lead.status,
      score: lead.score,
      owner: activeCl?.campaign.user?.name ?? null,
      activeSequence: activeCl ? { campaignId: activeCl.campaignId, name: activeCl.campaign.name, status: activeCl.status, stopReason: activeCl.stopReason, pausedAt: activeCl.pausedAt, completedAt: activeCl.completedAt, currentStep: activeCl.currentStep, totalSteps: activeCl.campaign.sequences.length, nextSendAt: activeCl.nextSendAt } : null,
      nextActionAt: upcomingMeeting?.scheduledAt ? new Date(upcomingMeeting.scheduledAt).toISOString() : (nextActions.length ? new Date(Math.min(...nextActions)).toISOString() : null),
      lastTouchAt: lastTouch?.at ?? null,
    };

    res.json({
      lead: { id: lead.id, firstName: lead.firstName, lastName: lead.lastName, email: lead.email, title: lead.title, company: lead.company, industry: lead.industry, country: lead.country, city: lead.city, website: lead.website, linkedinUrl: lead.linkedinUrl, score: lead.score, status: lead.status },
      state,
      counts: { emails: messages.filter((m) => m.direction === 'OUTBOUND').length, replies: messages.filter((m) => m.direction === 'INBOUND').length, calls: calls.length, meetings: meetings.length, automations: runs.length },
      timeline: timeline.slice(0, 60),
    });
  } catch (err) {
    next(err);
  }
});

const enrollSchema = z.object({ campaignId: z.string() });
const bulkEnrollSchema = z.object({ campaignId: z.string(), leadIds: z.array(z.string()).min(1).max(1000) });

// POST /api/leads/:id/enroll — добавить лида в последовательность. Через общий enrollLeadInCampaign
// (dedupe + аудит SEQUENCE_ENROLLED) — единый путь с bulk-enroll.
router.post('/:id/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { campaignId } = enrollSchema.parse(req.body);
    const [lead, campaign] = await Promise.all([
      prisma.lead.findFirst({ where: { id: req.params.id, orgId }, select: { id: true } }),
      prisma.campaign.findFirst({ where: { id: campaignId, orgId }, select: { id: true, name: true, status: true } }),
    ]);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const result = await enrollLeadInCampaign({ orgId, leadId: lead.id, actorId: req.user!.userId, campaign });
    if (!result.ok) { res.status(409).json({ error: result.reason === 'already_enrolled' ? 'Lead is already in this sequence' : 'Cannot enroll', reason: result.reason }); return; }
    res.status(201).json({ enrolled: true, campaignName: campaign.name });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/enroll-bulk — массовое зачисление выбранных лидов в кампанию. Dedupe (повторный
// enroll не плодит второй CampaignLead), аудит SEQUENCE_ENROLLED по каждому, сводка skipped+reason.
router.post('/enroll-bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { campaignId, leadIds } = bulkEnrollSchema.parse(req.body);
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId }, select: { id: true, name: true, status: true } });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const uniqueIds = [...new Set(leadIds)];
    let enrolled = 0;
    const skipped: { leadId: string; reason: string }[] = [];
    for (const leadId of uniqueIds) {
      const r = await enrollLeadInCampaign({ orgId, leadId, actorId: req.user!.userId, campaign });
      if (r.ok) enrolled++;
      else skipped.push({ leadId, reason: r.reason ?? 'failed' });
    }
    res.json({ enrolled, skipped, requested: uniqueIds.length, campaign: { id: campaign.id, name: campaign.name } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/leads/:id/enrollment — снять лида с кампании (unenroll). Удаляет CampaignLead и пишет
// аудит SEQUENCE_EXITED. Лид снова доступен для повторного enroll (свежий CampaignLead).
router.delete('/:id/enrollment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : (req.body?.campaignId as string | undefined);
    if (!campaignId) { res.status(400).json({ error: 'campaignId required' }); return; }
    const cl = await prisma.campaignLead.findFirst({
      where: { campaignId, leadId: req.params.id, campaign: { orgId } },
      select: { id: true, campaign: { select: { name: true } }, lead: { select: { firstName: true, lastName: true } } },
    });
    if (!cl) { res.status(404).json({ error: 'Enrollment not found' }); return; }
    await prisma.campaignLead.delete({ where: { id: cl.id } });
    await prisma.activity.create({
      data: {
        orgId, actorId: req.user!.userId, type: ActivityType.SEQUENCE_EXITED,
        title: `Sequence exited · ${cl.campaign.name}`,
        body: `${cl.lead.firstName} ${cl.lead.lastName} removed from “${cl.campaign.name}”`,
        payload: { leadId: req.params.id, campaignId, action: 'unenroll' },
      },
    });
    res.json({ ok: true, unenrolled: true });
  } catch (err) {
    next(err);
  }
});

// M11-3: пауза/возобновление enrollment'а конкретного лида (per-lead). Реальное действие + аудит.
const enrollActionSchema = z.object({ campaignId: z.string() });

// Найти enrollment лида в кампании (в рамках org) + данные для аудита/ответа.
async function findEnrollment(orgId: string, leadId: string, campaignId: string) {
  return prisma.campaignLead.findFirst({
    where: { campaignId, leadId, campaign: { orgId } },
    select: { id: true, status: true, campaign: { select: { name: true } }, lead: { select: { firstName: true, lastName: true } } },
  });
}

// POST /api/leads/:id/enrollment/pause — приостановить (ACTIVE/PENDING → PAUSED). REPLIED/COMPLETED/STOPPED → 409.
router.post('/:id/enrollment/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { campaignId } = enrollActionSchema.parse(req.body);
    const cl = await findEnrollment(orgId, req.params.id, campaignId);
    if (!cl) { res.status(404).json({ error: 'Enrollment not found' }); return; }
    const result = await pauseEnrollment(cl.id);
    if (!result.ok) { res.status(409).json({ error: 'Cannot pause', reason: result.reason }); return; }
    await writeEnrollmentAudit({ action: 'pause', orgId, actorId: req.user!.userId, leadId: req.params.id, campaignId, campaignLeadId: cl.id, campaignName: cl.campaign.name, lead: cl.lead, nextSendAt: result.nextSendAt ?? null });
    res.json({ ok: true, status: result.status, nextSendAt: result.nextSendAt });
  } catch (err) { next(err); }
});

// POST /api/leads/:id/enrollment/resume — возобновить (PAUSED → ACTIVE) со сдвигом расписания + clamp к окну.
router.post('/:id/enrollment/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { campaignId } = enrollActionSchema.parse(req.body);
    const cl = await findEnrollment(orgId, req.params.id, campaignId);
    if (!cl) { res.status(404).json({ error: 'Enrollment not found' }); return; }
    const result = await resumeEnrollment(cl.id);
    if (!result.ok) { res.status(409).json({ error: 'Cannot resume', reason: result.reason }); return; }
    await writeEnrollmentAudit({ action: 'resume', orgId, actorId: req.user!.userId, leadId: req.params.id, campaignId, campaignLeadId: cl.id, campaignName: cl.campaign.name, lead: cl.lead, nextSendAt: result.nextSendAt ?? null });
    res.json({ ok: true, status: result.status, nextSendAt: result.nextSendAt });
  } catch (err) { next(err); }
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

      const limit = org?.leadsLimit ?? 500;
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
    const { csvContent } = z.object({ csvContent: z.string().min(1) }).parse(req.body);

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const currentCount = await prisma.lead.count({ where: { orgId } });
    const limit = org?.leadsLimit ?? 500;
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
    let imported = 0;
    let skipped = 0;

    for (const row of toImport) {
      const firstName = row.firstName ?? row.email?.split('@')[0] ?? 'Unknown';
      const lastName = row.lastName ?? '';

      try {
        const score = scoreLeadLocal({
          title: row.title,
          company: row.company,
          companySize: undefined,
          industry: row.industry,
          country: row.country,
          email: row.email,
          linkedinUrl: row.linkedinUrl,
        });

        await prisma.lead.create({
          data: {
            orgId,
            firstName,
            lastName,
            email: row.email || null,
            linkedinUrl: row.linkedinUrl || null,
            title: row.title || null,
            company: row.company || null,
            industry: row.industry || null,
            country: row.country || null,
            city: row.city || null,
            website: row.website || null,
            source: 'csv',
            score,
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
      total: rows.length,
      limitReached: rows.length > available,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
