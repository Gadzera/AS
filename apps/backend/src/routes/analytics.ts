import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

// GET /api/analytics/stats
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      totalLeads,
      activeCampaigns,
      hotLeads,
      emailsSentThisWeek,
      emailsReplied,
      emailsOpened,
      recentMessages,
      leadsByStatus,
      last7DaysSent,
      last7DaysReplies,
    ] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.campaign.count({ where: { orgId, status: 'ACTIVE' } }),
      prisma.lead.findMany({
        where: { orgId, status: 'HOT' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.message.count({
        where: { lead: { orgId }, direction: 'OUTBOUND', sentAt: { gte: oneWeekAgo } },
      }),
      prisma.message.count({
        where: { lead: { orgId }, direction: 'INBOUND', createdAt: { gte: oneWeekAgo } },
      }),
      prisma.message.count({
        where: { lead: { orgId }, direction: 'OUTBOUND', openedAt: { not: null }, sentAt: { gte: oneWeekAgo } },
      }),
      prisma.message.findMany({
        where: { lead: { orgId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { lead: { select: { firstName: true, lastName: true, company: true } } },
      }),
      prisma.lead.groupBy({ by: ['status'], where: { orgId }, _count: true }),
      // Outbound per day for last 7 days
      prisma.message.findMany({
        where: { lead: { orgId }, direction: 'OUTBOUND', sentAt: { gte: oneWeekAgo } },
        select: { sentAt: true },
      }),
      prisma.message.findMany({
        where: { lead: { orgId }, direction: 'INBOUND', createdAt: { gte: oneWeekAgo } },
        select: { createdAt: true },
      }),
    ]);

    const replyRate = emailsSentThisWeek > 0
      ? Math.round((emailsReplied / emailsSentThisWeek) * 100) : 0;
    const openRate = emailsSentThisWeek > 0
      ? Math.round((emailsOpened / emailsSentThisWeek) * 100) : 0;

    // Build daily chart data for last 7 days
    const dailyMap: Record<string, { sent: number; replies: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      dailyMap[d.toISOString().slice(0, 10)] = { sent: 0, replies: 0 };
    }
    last7DaysSent.forEach((m) => {
      if (!m.sentAt) return;
      const key = new Date(m.sentAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].sent++;
    });
    last7DaysReplies.forEach((m) => {
      const key = new Date(m.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].replies++;
    });
    const dailyChart = Object.entries(dailyMap).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      sent: v.sent,
      replies: v.replies,
    }));

    res.json({
      totalLeads,
      activeCampaigns,
      emailsSentThisWeek,
      replyRate,
      openRate,
      hotLeads,
      dailyChart,
      recentActivity: recentMessages.map((m) => ({
        id: m.id,
        leadName: `${m.lead.firstName} ${m.lead.lastName}`,
        company: m.lead.company,
        direction: m.direction,
        channel: m.channel,
        subject: m.subject,
        replyClass: m.replyClass,
        createdAt: m.createdAt,
      })),
      leadsByStatus: leadsByStatus.reduce<Record<string, number>>((acc, g) => {
        acc[g.status] = g._count;
        return acc;
      }, {}),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/campaign/:id
router.get('/campaign/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const [totalEnrolled, byStatus, totalSent, totalOpened] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId: campaign.id } }),
      prisma.campaignLead.groupBy({ by: ['status'], where: { campaignId: campaign.id }, _count: true }),
      prisma.message.count({
        where: { lead: { campaignLeads: { some: { campaignId: campaign.id } } }, direction: 'OUTBOUND', sentAt: { not: null } },
      }),
      prisma.message.count({
        where: { lead: { campaignLeads: { some: { campaignId: campaign.id } } }, direction: 'OUTBOUND', openedAt: { not: null } },
      }),
    ]);

    const statusCounts = byStatus.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {});

    res.json({
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status, channel: campaign.channel, createdAt: campaign.createdAt },
      totalEnrolled,
      statusBreakdown: statusCounts,
      totalMessages: totalSent,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      replyRate: totalEnrolled > 0
        ? Math.round(((statusCounts.REPLIED ?? 0) + (statusCounts.HOT ?? 0)) / totalEnrolled * 100)
        : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/ab/:campaignId — A/B test comparison
router.get('/ab/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId   = req.user!.orgId!;
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.campaignId, orgId } });
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const variants = ['A', 'B'] as const;
    const stats: Record<string, { totalLeads: number; sent: number; opened: number; clicked: number; replied: number }> = {};

    await Promise.all(variants.map(async (v) => {
      const [totalLeads, sent, opened, clicked, replied] = await Promise.all([
        prisma.campaignLead.count({ where: { campaignId: campaign.id, abVariant: v } }),
        prisma.message.count({
          where: { direction: 'OUTBOUND', abVariant: v, sentAt: { not: null }, lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
        }),
        prisma.message.count({
          where: { direction: 'OUTBOUND', abVariant: v, openedAt: { not: null }, lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
        }),
        prisma.message.count({
          where: { direction: 'OUTBOUND', abVariant: v, clickedAt: { not: null }, lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
        }),
        prisma.campaignLead.count({
          where: { campaignId: campaign.id, abVariant: v, status: { in: ['REPLIED', 'HOT', 'CONVERTED'] } },
        }),
      ]);
      stats[v] = { totalLeads, sent, opened, clicked, replied };
    }));

    const fmt = (v: typeof stats.A) => ({
      totalLeads: v.totalLeads,
      sent:       v.sent,
      openRate:   v.sent > 0 ? Math.round((v.opened  / v.sent)        * 100) : 0,
      clickRate:  v.sent > 0 ? Math.round((v.clicked / v.sent)        * 100) : 0,
      replyRate:  v.totalLeads > 0 ? Math.round((v.replied / v.totalLeads) * 100) : 0,
    });

    const aScore = stats.A.sent > 0 ? stats.A.opened / stats.A.sent + (stats.A.replied / Math.max(stats.A.totalLeads, 1)) : 0;
    const bScore = stats.B.sent > 0 ? stats.B.opened / stats.B.sent + (stats.B.replied / Math.max(stats.B.totalLeads, 1)) : 0;
    const winner = stats.A.sent === 0 || stats.B.sent === 0 ? null : aScore >= bScore ? 'A' : 'B';

    res.json({
      campaign: { id: campaign.id, name: campaign.name, abTestEnabled: campaign.abTestEnabled },
      A: fmt(stats.A),
      B: fmt(stats.B),
      winner,
    });
  } catch (err) { next(err); }
});

export default router;
