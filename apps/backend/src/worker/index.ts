import { Worker } from 'bullmq';
import { redis, outreachQueue } from './queue';
import { processCampaignLead } from './processor';
import { enqueueDueSends } from './scheduler';

console.log('[Worker] Starting AI SDR outreach worker...');

const worker = new Worker(
  'outreach',
  async (job) => {
    const { campaignLeadId } = job.data as { campaignLeadId: string };
    await processCampaignLead(campaignLeadId);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

async function runScheduler(): Promise<void> {
  try {
    await enqueueDueSends();
  } catch (err) {
    console.error('[Scheduler] Error:', (err as Error).message);
  }
}

// Run immediately on start, then every 60 seconds
runScheduler();
const schedulerInterval = setInterval(runScheduler, 60_000);

async function shutdown(): Promise<void> {
  console.log('[Worker] Shutting down...');
  clearInterval(schedulerInterval);
  await worker.close();
  await outreachQueue.close();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
