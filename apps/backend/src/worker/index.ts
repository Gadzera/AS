import { Worker } from 'bullmq';
import { redis, outreachQueue } from './queue';
import { processCampaignLead } from './processor';
import { enqueueDueSends } from './scheduler';
import { recoverStaleSending } from '../services/sendError';
import { recoverStuckWorkflowRuns, resumeDueWorkflowRuns } from '../services/workflows';
import { snapshotHistoricalReports } from '../services/reportBuilder';
import { runDigestSweep } from '../services/notificationDigest';

// M22-2: digest-свип запускаем не чаще раза в час (внутри ещё per-user gap 20ч — идемпотентно)
let lastDigestSweep = 0;

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
    // M12-4: сначала восстановить зависшие SENDING (краш процесса) → FAILED (retryable), затем enqueue.
    await recoverStaleSending();
    // M17-1: восстановить зависшие в RUNNING WorkflowRun (краш во время прогона) → resume.
    await recoverStuckWorkflowRuns();
    // M17-3: возобновить WAITING-прогоны DELAY/DELAY_UNTIL, у которых наступил resumeAt (claim-safe CAS).
    await resumeDueWorkflowRuns();
    await enqueueDueSends();
    // M18-2: дневной снапшот historical-отчётов (идемпотентно — гейт «уже снято сегодня» внутри).
    await snapshotHistoricalReports();
    // M22-2: email-дайджест непрочитанного per-user (часовой гейт + per-user gap 20ч; honest-skip без SMTP).
    if (Date.now() - lastDigestSweep > 3_600_000) { lastDigestSweep = Date.now(); await runDigestSweep(); }
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
