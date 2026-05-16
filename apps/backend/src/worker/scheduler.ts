import { prisma } from '../lib/prisma';

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
