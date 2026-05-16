import { prisma } from '../lib/prisma';
import { createNotification } from '../services/onboarding';

import { outreachQueue, redis } from './queue';



export async function enqueueDueSends(): Promise<void> {
  const lockKey = 'scheduler:lock';
  const lockTtl = 55_000;

  const acquired = await redis.set(lockKey, '1', 'PX', lockTtl, 'NX');
  if (!acquired) {
    console.log('[Scheduler] Another instance is running, skipping');
    return;
  }

  try {
    const now = new Date();

    const dueSends = await prisma.campaignLead.findMany({
      where: {
        nextSendAt: { lte: now, not: null },
        campaign: { status: 'ACTIVE' },
        status: { notIn: ['LOST', 'UNSUBSCRIBED', 'CONVERTED'] },
      },
      select: { id: true },
      take: 1000,
    });

    if (dueSends.length === 0) return;

    await outreachQueue.addBulk(
      dueSends.map((cl) => ({
        name: 'send-outreach',
        data: { campaignLeadId: cl.id },
        opts: {
          jobId: `send-${cl.id}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 10_000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 100 },
        },
      }))
    );

    console.log(`[Scheduler] Enqueued ${dueSends.length} outreach jobs`);
  } finally {
    await redis.del(lockKey).catch(() => null);
  }
}

// Campaign health monitor: auto-pause when bounce rate exceeds threshold
const BOUNCE_RATE_THRESHOLD = 0.05; // 5%
const MIN_SENDS_FOR_HEALTH_CHECK = 20; // only check after 20+ sends

export async function checkCampaignHealth(): Promise<void> {
  const lockKey = 'health:check:lock';
  const acquired = await redis.set(lockKey, '1', 'PX', 10 * 60_000, 'NX');
  if (!acquired) return;

  try {
    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, orgId: true },
    });

    for (const campaign of activeCampaigns) {
      try {
        const [totalSent, totalBounced] = await Promise.all([
          prisma.message.count({
            where: { direction: 'OUTBOUND', lead: { campaignLeads: { some: { campaignId: campaign.id } } }, sentAt: { not: null } },
          }),
          prisma.message.count({
            where: { direction: 'OUTBOUND', bounced: true, lead: { campaignLeads: { some: { campaignId: campaign.id } } } },
          }),
        ]);

        if (totalSent < MIN_SENDS_FOR_HEALTH_CHECK) continue;

        const bounceRate = totalBounced / totalSent;
        if (bounceRate <= BOUNCE_RATE_THRESHOLD) continue;

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' },
        });

        createNotification(campaign.orgId, {
          type: 'CAMPAIGN_PAUSED',
          title: `Кампания приостановлена: ${campaign.name}`,
          body: `Процент отказов достиг ${Math.round(bounceRate * 100)}% (порог: ${BOUNCE_RATE_THRESHOLD * 100}%). Проверьте качество базы.`,
          link: `/campaigns/${campaign.id}`,
        }).catch(() => null);

        console.log(`[Health] Campaign ${campaign.name} paused — bounce rate ${Math.round(bounceRate * 100)}%`);
      } catch (err) {
        console.error('[Health] Error checking campaign:', (err as Error).message);
      }
    }
  } finally {
    await redis.del(lockKey).catch(() => null);
  }
}

// Минимальный интервал между запусками автопилота для одной организации (10 минут)
const AUTOPILOT_MIN_INTERVAL_MS = 10 * 60_000;

export async function runAutopilotDiscovery(): Promise<void> {
  const lockKey = 'autopilot:discovery:lock';
  const lockTtl = 5 * 60_000; // 5 минут — максимальное время одного прохода

  const acquired = await redis.set(lockKey, '1', 'PX', lockTtl, 'NX');
  if (!acquired) return;

  try {
    const configs = await prisma.autopilotConfig.findMany({
      where: { enabled: true, targetCampaignId: { not: null } },
    });

    for (const cfg of configs) {
      try {
        // Пропускаем если прошло меньше минимального интервала
        if (cfg.lastRunAt) {
          const elapsed = Date.now() - cfg.lastRunAt.getTime();
          if (elapsed < AUTOPILOT_MIN_INTERVAL_MS) continue;
        }

        await outreachQueue.add(
          'autopilot-discover',
          { orgId: cfg.orgId, configId: cfg.id },
          {
            jobId: `autopilot-${cfg.orgId}-${Date.now()}`,
            attempts: 2,
            removeOnComplete: true,
            removeOnFail: { count: 20 },
          }
        );

        await prisma.autopilotConfig.update({
          where: { id: cfg.id },
          data: { lastRunAt: new Date() },
        });

        console.log(`[Scheduler] Autopilot discovery queued for org ${cfg.orgId}`);
      } catch (err) {
        console.error('[Scheduler] Autopilot error:', (err as Error).message);
      }
    }
  } finally {
    await redis.del(lockKey).catch(() => null);
  }
}
