import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess } from '../services/permissions';
import { generateSequence } from '../services/sequenceGen';
import { effectiveCampaignAgeDays, warmupLimit, warmupStage } from '../lib/warmup';
import { reorderSequenceSteps } from '../services/sequenceOrder';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const sequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  subject: z.string().optional(),
  body: z.string().min(1),
  channel: z.enum(['EMAIL', 'LINKEDIN']).default('EMAIL'),
});

const generateSchema = z.object({
  steps: z.number().int().min(1).max(6).optional(),
  language: z.enum(['en', 'ru', 'de']).optional(),
  tone: z.enum(['professional', 'casual', 'friendly']).optional(),
  valueProposition: z.string().max(500).optional(),
  senderName: z.string().max(120).optional(),
  senderCompany: z.string().max(120).optional(),
  /** Заменить существующие шаги (по умолчанию — только если их нет). */
  replace: z.boolean().optional(),
});

// POST /api/sequences/:campaignId/generate — AI пишет последовательность
router.post('/:campaignId/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ_WRITE', req.params.campaignId))) return;
    const data = generateSchema.parse(req.body ?? {});

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.campaignId, orgId },
    });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const existingCount = await prisma.sequence.count({ where: { campaignId: campaign.id } });
    if (existingCount > 0 && !data.replace) {
      res.status(409).json({
        error: 'Sequence already has steps. Pass replace=true to regenerate.',
        code: 'SEQUENCE_EXISTS',
      });
      return;
    }

    const channel = campaign.channel === 'LINKEDIN' ? 'LINKEDIN' : 'EMAIL';
    const result = await generateSequence({
      campaignName: campaign.name,
      channel,
      targetIndustry: campaign.targetIndustry,
      targetCountry: campaign.targetCountry,
      targetSize: campaign.targetSize,
      steps: data.steps,
      language: data.language,
      tone: data.tone,
      valueProposition: data.valueProposition,
      senderName: data.senderName,
      senderCompany: data.senderCompany,
    });

    // Пересоздаём шаги атомарно.
    const created = await prisma.$transaction(async (tx) => {
      if (data.replace) {
        await tx.sequence.deleteMany({ where: { campaignId: campaign.id } });
      }
      const rows = [];
      for (const step of result.steps) {
        rows.push(
          await tx.sequence.create({
            data: {
              campaignId: campaign.id,
              stepNumber: step.stepNumber,
              delayDays: step.delayDays,
              subject: step.subject || null,
              body: step.body,
              channel: step.channel,
            },
          }),
        );
      }
      return rows;
    });

    res.status(201).json({ sequences: created, generatedBy: result.generatedBy });
  } catch (err) {
    next(err);
  }
});

// GET /api/sequences/:campaignId/overview — полная структура последовательности + воронка enrollment
// + конфиг движка отправки (лимит/прогрев/окно/ящик/scheduler). Всё на живых данных. Используется
// модулем Sequences. Формула прогрева совпадает с воркером (processor.ts), чтобы UI не врал.
router.get('/:campaignId/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ', req.params.campaignId))) return;
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.campaignId, orgId } });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const [steps, campaignLeads, org, defaultMailbox] = await Promise.all([
      prisma.sequence.findMany({ where: { campaignId: campaign.id }, orderBy: { stepNumber: 'asc' } }),
      prisma.campaignLead.findMany({ where: { campaignId: campaign.id }, select: { currentStep: true, status: true, nextSendAt: true } }),
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.mailbox.findFirst({ where: { orgId, archivedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }),
    ]);

    // Воронка по шагам и статусам
    const byStep: Record<number, number> = {};
    const byStatus: Record<string, number> = {};
    for (const cl of campaignLeads) {
      byStep[cl.currentStep] = (byStep[cl.currentStep] ?? 0) + 1;
      byStatus[cl.status] = (byStatus[cl.status] ?? 0) + 1;
    }
    const stepFunnel = steps.map((s, idx) => ({ stepNumber: s.stepNumber, atStep: byStep[idx] ?? 0 }));

    // M11-9: движок отправки — ЕДИНЫЙ lib/warmup (как воркер). Возраст исключает простой
    // (pausedDaysAccum, M11-4) → UI показывает ровно тот лимит, по которому реально шлёт воркер.
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const campaignAgeDays = effectiveCampaignAgeDays(campaign.createdAt, campaign.pausedDaysAccum ?? 0);
    const effectiveLimit = warmupLimit(campaignAgeDays, campaign.dailyLimit);
    const warmupStageLabel = warmupStage(campaignAgeDays);
    const sentToday = await prisma.message.count({
      where: { sentAt: { gte: todayStart }, direction: 'OUTBOUND', lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
    });

    const totalSent = await prisma.message.count({
      where: { direction: 'OUTBOUND', lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
    });

    // dueNow честен только когда движок реально может слать: кампания ACTIVE и есть рабочий ящик.
    const mailboxSendable = !!defaultMailbox && (defaultMailbox.status === 'CONNECTED' || defaultMailbox.status === 'WARMING');
    const dueNow = (campaign.status === 'ACTIVE' && mailboxSendable)
      ? campaignLeads.filter((cl) => cl.nextSendAt && new Date(cl.nextSendAt) <= new Date() && ['PENDING', 'ACTIVE'].includes(cl.status)).length
      : 0;

    res.json({
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status, channel: campaign.channel, dailyLimit: campaign.dailyLimit, createdAt: campaign.createdAt },
      steps,
      enrollment: { total: campaignLeads.length, byStep: stepFunnel, byStatus, dueNow },
      engine: {
        dailyLimit: campaign.dailyLimit,
        effectiveLimit,
        warmupStage: warmupStageLabel,
        warmupActive: effectiveLimit < campaign.dailyLimit,
        sentToday,
        totalSent,
        remainingToday: Math.max(0, effectiveLimit - sentToday),
        schedulerActive: campaign.status === 'ACTIVE',
        window: org ? { start: org.sendWindowStart, end: org.sendWindowEnd, days: org.sendDays.split(',').filter(Boolean), timezone: org.timezone } : null,
        mailbox: defaultMailbox ? { address: defaultMailbox.address, status: defaultMailbox.status, provider: defaultMailbox.provider } : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sequences/:campaignId
router.get('/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ', req.params.campaignId))) return;

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
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ_WRITE', req.params.campaignId))) return;
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
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ_WRITE', sequence.campaignId))) return;

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
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ_WRITE', sequence.campaignId))) return;

    await prisma.sequence.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sequences/:campaignId/reorder — переупорядочить шаги (persist + order validation).
// ПОЛИТИКА M11-9: уже активные enrolled лиды НЕ ломаются молча. Их currentStep мигрируется по
// ИДЕНТИЧНОСТИ шага — «следующий шаг» лида остаётся тем же логическим шагом после перестановки.
// Новые enrollments естественно используют новый порядок. Ответ сообщает migratedEnrollments (прозрачно).
const reorderSchema = z.object({ orderedIds: z.array(z.string()).min(1) });
router.post('/:campaignId/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ_WRITE', req.params.campaignId))) return;
    const { orderedIds } = reorderSchema.parse(req.body);
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.campaignId, orgId }, select: { id: true } });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const result = await reorderSequenceSteps(campaign.id, orderedIds);
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    const stepsAfter = await prisma.sequence.findMany({ where: { campaignId: campaign.id }, orderBy: { stepNumber: 'asc' } });
    res.json({ reordered: result.reordered, activeEnrollments: result.activeEnrollments, migratedEnrollments: result.migratedEnrollments, steps: stepsAfter });
  } catch (err) {
    next(err);
  }
});

export default router;
