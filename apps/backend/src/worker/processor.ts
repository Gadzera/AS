import { PrismaClient } from '@prisma/client';
import { generateOutreach } from '../services/claude';
import { sendEmail } from '../services/email';
import { sendLinkedInMessage } from '../services/unipile';
import { scrapeWebsite } from '../utils/scraper';
import { applySpintax } from '../utils/spintax';
import { generateUnsubscribeToken, getUnsubscribeUrl } from '../utils/unsubscribe';
import { config } from '../config';

const prisma = new PrismaClient();

export async function processCampaignLead(campaignLeadId: string): Promise<void> {
  const cl = await prisma.campaignLead.findUnique({
    where: { id: campaignLeadId },
    include: {
      lead: true,
      campaign: {
        include: { sequences: { orderBy: { stepNumber: 'asc' } } },
      },
    },
  });

  if (!cl) return;
  if (cl.campaign.status !== 'ACTIVE') return;
  if (['LOST', 'UNSUBSCRIBED', 'CONVERTED'].includes(cl.status)) return;

  const { sequences } = cl.campaign;
  if (sequences.length === 0 || cl.currentStep >= sequences.length) return;

  // Skip bounced leads
  if (cl.lead.bounced) {
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'LOST', nextSendAt: null },
    });
    return;
  }

  // Daily warm-up limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const campaignAgeDays = Math.floor(
    (Date.now() - new Date(cl.campaign.createdAt).getTime()) / 86_400_000
  );
  const warmupLimit =
    campaignAgeDays < 3  ? 20  :
    campaignAgeDays < 7  ? 50  :
    campaignAgeDays < 14 ? 100 :
    cl.campaign.dailyLimit;
  const effectiveLimit = Math.min(warmupLimit, cl.campaign.dailyLimit);

  const sentToday = await prisma.message.count({
    where: {
      sentAt: { gte: todayStart },
      direction: 'OUTBOUND',
      lead: { campaignLeads: { some: { campaignId: cl.campaignId } } },
    },
  });

  if (sentToday >= effectiveLimit) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { nextSendAt: tomorrow },
    });
    return;
  }

  const step = sequences[cl.currentStep];
  const { lead } = cl;

  if (step.channel === 'EMAIL' && !lead.email) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    return;
  }
  if (step.channel === 'LINKEDIN' && !lead.linkedinUrl) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    return;
  }

  // Generate text
  let subject = step.subject ?? '';
  let body = step.body ?? '';
  let aiGenerated = false;

  if (!body || body.trim() === '' || body === 'AI_GENERATE') {
    const websiteContent = lead.website ? await scrapeWebsite(lead.website) : null;
    const generated = await generateOutreach(
      {
        firstName: lead.firstName, lastName: lead.lastName,
        email: lead.email, title: lead.title, company: lead.company,
        companySize: lead.companySize, industry: lead.industry,
        country: lead.country, city: lead.city,
        website: lead.website, linkedinUrl: lead.linkedinUrl,
      },
      { name: cl.campaign.name, channel: step.channel, targetIndustry: cl.campaign.targetIndustry },
      { websiteContent: websiteContent ?? undefined }
    );
    subject = generated.subject;
    body = generated.body;
    aiGenerated = true;
  }

  subject = applySpintax(subject);
  body    = applySpintax(body);

  const now = new Date();

  // Ensure unsubscribe token exists for this lead
  if (!lead.unsubscribeToken) {
    const token = generateUnsubscribeToken();
    await prisma.lead.update({ where: { id: lead.id }, data: { unsubscribeToken: token } });
    lead.unsubscribeToken = token;
  }

  // Create message record FIRST so we have an ID for the tracking pixel
  const message = await prisma.message.create({
    data: {
      leadId: lead.id,
      direction: 'OUTBOUND',
      channel: step.channel,
      subject,
      body,
      aiGenerated,
      // sentAt set after successful send
    },
  });

  try {
    if (step.channel === 'EMAIL') {
      const unsubUrl   = getUnsubscribeUrl(lead.unsubscribeToken!);
      const pixelUrl   = `${config.backend.url}/api/track/open/${message.id}`;
      const htmlBody   = buildHtmlEmail(body, pixelUrl, unsubUrl);

      const { messageId: smtpMsgId } = await sendEmail({
        to: lead.email!,
        subject,
        body: htmlBody,
        html: true,
      });

      await prisma.message.update({
        where: { id: message.id },
        data: { sentAt: now, smtpMessageId: smtpMsgId },
      });
    } else {
      await sendLinkedInMessage({ recipientProfileUrl: lead.linkedinUrl!, message: body });
      await prisma.message.update({ where: { id: message.id }, data: { sentAt: now } });
    }
  } catch (err) {
    // Delete unsent message record on failure
    await prisma.message.delete({ where: { id: message.id } }).catch(() => null);
    throw err;
  }

  // Update lead status
  if (lead.status === 'NEW' || lead.status === 'CONTACTED') {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });
  }

  // Advance sequence
  const nextStepIndex = cl.currentStep + 1;
  if (nextStepIndex < sequences.length) {
    const nextStep   = sequences[nextStepIndex];
    const nextSendAt = new Date(now.getTime() + nextStep.delayDays * 86_400_000);
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { currentStep: nextStepIndex, nextSendAt, status: 'CONTACTED' },
    });
    console.log(`[Worker] ${lead.firstName} ${lead.lastName}: step ${cl.currentStep + 1}/${sequences.length} sent`);
  } else {
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'CONVERTED', nextSendAt: null },
    });
    console.log(`[Worker] ${lead.firstName} ${lead.lastName}: sequence complete`);
  }
}

function buildHtmlEmail(text: string, pixelUrl: string, unsubUrl: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
${escaped}
<br><br>
<div style="border-top:1px solid #eee;padding-top:12px;margin-top:12px">
  <a href="${unsubUrl}" style="font-size:11px;color:#999;text-decoration:none">
    Unsubscribe
  </a>
</div>
<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">
</div>`;
}
