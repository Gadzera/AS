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
      recentMessages,
      leadsByStatus,
    ] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.campaign.count({ where: { orgId, status: 'ACTIVE' } }),
      prisma.lead.findMany({
        where: { orgId, status: 'HOT' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.message.count({
        where: {
          lead: { orgId },
          direction: 'OUTBOUND',
          sentAt: { gte: oneWeekAgo },
        },
      }),
      prisma.message.count({
        where: {
          lead: { orgId },
          direction: 'INBOUND',
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.message.findMany({
        where: { lead: { orgId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          lead: { select: { firstName: true, lastName: true, company: true } },
        },
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
      }),
    ]);

    const replyRate = emailsSentThisWeek > 0
      ? Math.round((emailsReplied / emailsSentThisWeek) * 100)
      : 0;

    res.json({
      totalLeads,
      activeCampaigns,
      emailsSentThisWeek,
      replyRate,
      hotLeads,
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

    const [totalEnrolled, byStatus, messageStats] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId: campaign.id } }),
      prisma.campaignLead.groupBy({
        by: ['status'],
        where: { campaignId: campaign.id },
        _count: true,
      }),
      prisma.message.aggregate({
        where: { lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
        _count: true,
      }),
    ]);

    const statusCounts = byStatus.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {});

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channel: campaign.channel,
        createdAt: campaign.createdAt,
      },
      totalEnrolled,
      statusBreakdown: statusCounts,
      totalMessages: messageStats._count,
      openRate: 0, // Would require pixel tracking implementation
      replyRate: totalEnrolled > 0
        ? Math.round(((statusCounts.REPLIED ?? 0) + (statusCounts.HOT ?? 0)) / totalEnrolled * 100)
        : 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
