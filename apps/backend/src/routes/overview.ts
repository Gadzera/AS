/**
 * Сводка для Agent Cockpit / командных экранов (реальные агрегаты по орг.).
 * GET /api/overview
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      recordsTotal,
      objectsTotal,
      aiRunsTotal,
      aiRunsToday,
      balance,
      campaignsAll,
      enrolledTotal,
      enrolledActive,
    ] = await Promise.all([
      prisma.record.count({ where: { orgId, archivedAt: null } }),
      prisma.object.count({ where: { orgId, archivedAt: null } }),
      prisma.aiRun.count({ where: { orgId } }),
      prisma.aiRun.count({ where: { orgId, createdAt: { gte: startOfToday } } }),
      prisma.creditBalance.findUnique({ where: { orgId } }),
      prisma.campaign.findMany({ where: { orgId }, select: { status: true } }),
      prisma.campaignLead.count({ where: { campaign: { orgId } } }),
      prisma.campaignLead.count({ where: { campaign: { orgId, status: 'ACTIVE' } } }),
    ]);

    const byStatus = (s: string) => campaignsAll.filter((c) => c.status === s).length;

    res.json({
      records: { total: recordsTotal, objects: objectsTotal },
      ai: {
        runsTotal: aiRunsTotal,
        runsToday: aiRunsToday,
        credits: {
          balance: balance?.remainingCredits ?? 0,
          used: balance?.usedCredits ?? 0,
          included: balance?.monthlyCredits ?? 0,
        },
      },
      campaigns: {
        total: campaignsAll.length,
        active: byStatus('ACTIVE'),
        paused: byStatus('PAUSED'),
        draft: byStatus('DRAFT'),
        enrolled: enrolledTotal,
        enrolledActive,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/overview/onboarding — чек-лист первичной настройки на ЖИВЫХ счётчиках.
// Воркспейс считается «новым», пока не выполнены ключевые шаги. Демо-данные в живой воркспейс не
// подмешиваются — новый зарегистрированный воркспейс стартует пустым.
router.get('/onboarding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const [mailboxes, leads, records, sequenceSteps, calendar] = await Promise.all([
      prisma.mailbox.count({ where: { orgId, archivedAt: null } }),
      prisma.lead.count({ where: { orgId } }),
      prisma.record.count({ where: { orgId, archivedAt: null } }),
      prisma.sequence.count({ where: { campaign: { orgId } } }),
      prisma.organization.findUnique({ where: { id: orgId }, select: { calendarProvider: true } }),
    ]);

    const peopleCount = leads + records;
    const steps = [
      { key: 'mailbox', label: 'Connect a sending mailbox', description: 'Add an email account so the agent can send and warm up.', done: mailboxes > 0, count: mailboxes, href: '/settings' },
      { key: 'leads', label: 'Add your first leads', description: 'Import a CSV or add contacts to start outreach.', done: peopleCount > 0, count: peopleCount, href: '/data' },
      { key: 'sequence', label: 'Create a sequence', description: 'Let the agent author an outbound sequence for a campaign.', done: sequenceSteps > 0, count: sequenceSteps, href: '/sequences' },
      { key: 'calendar', label: 'Connect your calendar', description: 'Sync booked meetings to Google or Microsoft 365.', done: !!calendar?.calendarProvider, count: calendar?.calendarProvider ? 1 : 0, href: '/meetings' },
    ];
    const completed = steps.filter((s) => s.done).length;
    res.json({ steps, completed, total: steps.length, complete: completed === steps.length, isNew: peopleCount === 0 || mailboxes === 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
