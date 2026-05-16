import { Worker } from 'bullmq';
import { redis, outreachQueue } from './queue';
import { processCampaignLead } from './processor';
import { enqueueDueSends } from './scheduler';
import { pollInbox } from '../services/imap';

console.log('[Worker] Starting AI SDR outreach worker...');

const worker = new Worker(
  'outreach',
  async (job) => {
    const { campaignLeadId } = job.data as { campaignLeadId: string };
    await processCampaignLead(campaignLeadId);
  },
  { connection: redis, concurrency: 5 }
);

worker.on('completed', (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed: ${err.message}`));
worker.on('error', (err) => console.error('[Worker] Error:', err.message));

async function runScheduler(): Promise<void> {
  try { await enqueueDueSends(); }
  catch (err) { console.error('[Scheduler]', (err as Error).message); }
}

async function runImapPoll(): Promise<void> {
  try { await pollInbox(); }
  catch (err) { console.error('[IMAP]', (err as Error).message); }
}

// Start immediately, then on intervals
runScheduler();
runImapPoll();

const schedulerInterval = setInterval(runScheduler, 60_000);
const imapInterval      = setInterval(runImapPoll, 5 * 60_000); // every 5 min

async function shutdown(): Promise<void> {
  console.log('[Worker] Shutting down...');
  clearInterval(schedulerInterval);
  clearInterval(imapInterval);
  await worker.close();
  await outreachQueue.close();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
