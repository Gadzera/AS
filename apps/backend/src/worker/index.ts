import { Worker } from 'bullmq';
import { redis, outreachQueue } from './queue';
import { processCampaignLead } from './processor';
import { enqueueDueSends, runAutopilotDiscovery } from './scheduler';
import { pollInbox } from '../services/imap';
import { sendScheduledEmail } from '../services/onboarding';
import { prisma } from '../lib/prisma';

console.log('[Worker] Starting AI SDR outreach worker...');

const worker = new Worker(
  'outreach',
  async (job) => {
    if (job.name === 'onboarding-email') {
      await sendScheduledEmail(job.data as { to: string; subject: string; html: string; from?: string });
      return;
    }

    if (job.name === 'autopilot-followup') {
      const { messageId, leadId, orgId } = job.data as { messageId: string; leadId: string; orgId: string };

      // Получить сохранённый черновик сообщения
      const msg = await prisma.message.findUnique({ where: { id: messageId }, include: { lead: true } });
      if (!msg || !msg.lead.email) return;

      // Отправить
      const { getNextSmtpAccount, sendViaAccount } = await import('../services/smtpRotation');
      const { sendEmail } = await import('../services/email');
      const { config } = await import('../config');

      const smtpAccount = await getNextSmtpAccount(orgId);
      if (smtpAccount) {
        await sendViaAccount(smtpAccount, { to: msg.lead.email, subject: msg.subject ?? '', body: msg.body });
      } else {
        await sendEmail({ to: msg.lead.email, subject: msg.subject ?? '', body: msg.body });
      }

      await prisma.message.update({ where: { id: messageId }, data: { sentAt: new Date() } });
      console.log(`[Autopilot] Follow-up sent to ${msg.lead.email}`);
      return;
    }

    if (job.name === 'autopilot-discover') {
      const { orgId } = job.data as { orgId: string };
      const { prisma: db } = await import('../lib/prisma');
      const { prospectFromWeb, importProspectsToOrg } = await import('../services/webProspector');

      const cfg = await db.autopilotConfig.findUnique({ where: { orgId } });
      if (!cfg || !cfg.enabled) return;

      if (cfg.discoverySource === 'web' || cfg.discoverySource === 'both') {
        const prospects = await prospectFromWeb({
          keywords: cfg.targetKeywords,
          industry: cfg.targetIndustry,
          country:  cfg.targetCountry,
          titles:   cfg.targetTitles,
          limit:    cfg.dailyDiscoveryLimit,
        });

        const { imported } = await importProspectsToOrg({
          orgId,
          campaignId: cfg.targetCampaignId,
          prospects,
        });

        console.log(`[Autopilot] Discovered and imported ${imported} leads for org ${orgId}`);
      }
      return;
    }

    const { campaignLeadId } = job.data as { campaignLeadId: string };
    await processCampaignLead(campaignLeadId);
  },
  { connection: redis, concurrency: 5 }
);

worker.on('completed', (job) => console.log(`[Worker] Job ${job.id} completed`));
worker.on('failed', async (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  if (job && job.name !== 'onboarding-email' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const { campaignLeadId } = job.data as { campaignLeadId?: string };
    if (campaignLeadId) {
      await prisma.campaignLead.update({
        where: { id: campaignLeadId },
        data: { status: 'LOST', nextSendAt: null },
      }).catch(() => null);
    }
  }
});
worker.on('error', (err) => console.error('[Worker] Error:', err.message));

async function runScheduler(): Promise<void> {
  try { await enqueueDueSends(); }
  catch (err) { console.error('[Scheduler]', (err as Error).message); }
}

async function runImapPoll(): Promise<void> {
  try { await pollInbox(); }
  catch (err) { console.error('[IMAP]', (err as Error).message); }
}

async function runAutopilot(): Promise<void> {
  try { await runAutopilotDiscovery(); }
  catch (err) { console.error('[Autopilot]', (err as Error).message); }
}

// Start immediately, then on intervals
runScheduler();
runImapPoll();
runAutopilot();

const schedulerInterval  = setInterval(runScheduler,  60_000);
const imapInterval       = setInterval(runImapPoll,   5 * 60_000);  // каждые 5 мин
const autopilotInterval  = setInterval(runAutopilot,  10 * 60_000); // каждые 10 мин

async function shutdown(): Promise<void> {
  console.log('[Worker] Shutting down...');
  clearInterval(schedulerInterval);
  clearInterval(imapInterval);
  clearInterval(autopilotInterval);
  await worker.close();
  await outreachQueue.close();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
