import { PrismaClient } from '@prisma/client';
import { outreachQueue } from './queue';

const prisma = new PrismaClient();

export async function enqueueDueSends(): Promise<void> {
  const now = new Date();

  const dueSends = await prisma.campaignLead.findMany({
    where: {
      // M11-2: решение об отправке — ПО status enrollment'а (PENDING/ACTIVE отправляемы),
      // nextSendAt — только расписание (когда наступил срок). PAUSED/REPLIED/COMPLETED/STOPPED не шлём.
      nextSendAt: { lte: now, not: null },
      campaign: { status: 'ACTIVE' },
      status: { in: ['PENDING', 'ACTIVE'] },
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
}
