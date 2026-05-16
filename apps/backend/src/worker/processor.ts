import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { generateOutreach } from '../services/generator';
import { sendLinkedInMessage } from '../services/unipile';
import { getNextSmtpAccount, sendViaAccount } from '../services/smtpRotation';
import { fireWebhooks } from '../services/webhooks';
import { generatePersonalizedImage } from '../services/bannerbear';
import { getPersonalizationUrl } from '../services/imagePersonalization';
import { upsertHubSpotContact } from '../services/hubspot';
import { upsertPipedriveContact } from '../services/pipedrive';
import { scrapeWebsite } from '../utils/scraper';
import { applySpintax } from '../utils/spintax';
import { validateEmail } from '../utils/emailValidation';
import { generateUnsubscribeToken, getUnsubscribeUrl } from '../utils/unsubscribe';
import { substituteVariables } from '../utils/variables';
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

  // Skip bounced leads immediately
  if (cl.lead.bounced) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    return;
  }

  // Validate email before first send (only once)
  if (cl.currentStep === 0 && cl.lead.email && cl.lead.emailValid === 'UNKNOWN') {
    const result = await validateEmail(cl.lead.email);
    const validity = result.reason === 'valid' ? 'VALID'
      : result.reason === 'disposable'     ? 'DISPOSABLE'
      : result.reason === 'no_mx'          ? 'NO_MX'
      : 'INVALID';

    await prisma.lead.update({ where: { id: cl.lead.id }, data: { emailValid: validity } });

    if (!result.valid) {
      await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
      console.log(`[Worker] Skipping ${cl.lead.email}: invalid (${result.reason})`);
      return;
    }
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

  const sentToday = await prisma.message.count({
    where: {
      sentAt: { gte: todayStart },
      direction: 'OUTBOUND',
      lead: { campaignLeads: { some: { campaignId: cl.campaignId } } },
    },
  });

  if (sentToday >= Math.min(warmupLimit, cl.campaign.dailyLimit)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { nextSendAt: tomorrow } });
    return;
  }

  const step  = sequences[cl.currentStep];
  const { lead } = cl;

  if (step.channel === 'EMAIL' && !lead.email) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    return;
  }
  if (step.channel === 'LINKEDIN' && !lead.linkedinUrl) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    return;
  }

  // A/B variant assignment (sticky per lead)
  let abVariant = cl.abVariant;
  if (!abVariant && cl.campaign.abTestEnabled) {
    abVariant = Math.random() < 0.5 ? 'A' : 'B';
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { abVariant } });
  }

  // Pick subject/body based on variant, apply spintax + variable substitution
  const useB = abVariant === 'B' && step.bodyB;
  let subject    = substituteVariables(applySpintax(useB && step.subjectB ? step.subjectB : (step.subject ?? '')), lead);
  let body       = substituteVariables(applySpintax(useB && step.bodyB    ? step.bodyB    : step.body),    lead);
  let aiGenerated = false;

  if (!body || body === 'AI_GENERATE') {
    if (!config.ai.apiKey) {
      // No API key — use a sensible fallback instead of crashing
      body = `Hi ${lead.firstName},\n\nI came across ${lead.company ?? 'your company'} and wanted to reach out.\n\nWould you be open to a quick 15-minute call?\n\nBest,`;
      subject = subject || `Quick question, ${lead.firstName}`;
    } else {
      try {
        const websiteContent = lead.website ? await scrapeWebsite(lead.website) : null;
        const generated = await generateOutreach(
          { firstName: lead.firstName, lastName: lead.lastName, email: lead.email,
            title: lead.title, company: lead.company, companySize: lead.companySize,
            industry: lead.industry, country: lead.country, city: lead.city,
            website: lead.website, linkedinUrl: lead.linkedinUrl },
          { name: cl.campaign.name, channel: step.channel, targetIndustry: cl.campaign.targetIndustry },
          { websiteContent: websiteContent ?? undefined }
        );
        subject = generated.subject;
        body    = generated.body;
        aiGenerated = true;
      } catch (aiErr) {
        console.error('[Worker] AI generation failed, using fallback:', (aiErr as Error).message);
        body = `Hi ${lead.firstName},\n\nI wanted to reach out about ${lead.company ?? 'your work'}.\n\nWould love to connect — are you available for a quick call?\n\nBest,`;
        subject = subject || `Quick question for ${lead.firstName}`;
      }
    }
  }

  // Ensure unsubscribe token
  if (!lead.unsubscribeToken) {
    const token = generateUnsubscribeToken();
    await prisma.lead.update({ where: { id: lead.id }, data: { unsubscribeToken: token } });
    lead.unsubscribeToken = token;
  }

  const now = new Date();

  // Create message record FIRST (need ID for tracking pixel)
  const message = await prisma.message.create({
    data: {
      leadId: lead.id,
      direction: 'OUTBOUND',
      channel: step.channel,
      subject,
      body,
      aiGenerated,
      abVariant: abVariant ?? null,
    },
  });

  try {
    if (step.channel === 'EMAIL') {
      // Inbox rotation: try org accounts, fall back to global SMTP
      const smtpAccount = await getNextSmtpAccount(lead.orgId);

      // Personalized image: self-hosted first (free), Bannerbear as fallback if configured
      let personalizedImageUrl: string | null = null;
      if (cl.campaign.bannerbearTemplateId) {
        // Try Bannerbear (external paid service) if template ID is set
        personalizedImageUrl = await generatePersonalizedImage(lead, cl.campaign.bannerbearTemplateId).catch(() => null);
      }
      if (!personalizedImageUrl) {
        // Always embed self-hosted personalized image (free, no limit)
        personalizedImageUrl = getPersonalizationUrl(config.backend.url, {
          firstName: lead.firstName,
          company:   lead.company ?? '',
          title:     lead.title   ?? undefined,
          template:  '1',
        });
      }

      const unsubUrl = getUnsubscribeUrl(lead.unsubscribeToken!);
      const pixelUrl = `${config.backend.url}/api/track/open/${message.id}`;
      const htmlBody = buildHtmlEmail(body, pixelUrl, unsubUrl, message.id, config.backend.url, personalizedImageUrl);

      let smtpMessageId: string;

      if (smtpAccount) {
        const result = await sendViaAccount(smtpAccount, { to: lead.email!, subject, body: htmlBody });
        smtpMessageId = result.messageId;
        await prisma.message.update({
          where: { id: message.id },
          data: { sentAt: now, smtpMessageId, smtpAccountId: smtpAccount.id },
        });
      } else {
        // Fallback to global SMTP config
        const transporter = nodemailer.createTransport({
          host: config.smtp.host, port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: { user: config.smtp.user, pass: config.smtp.pass },
        });
        const info = await transporter.sendMail({
          from: config.smtp.from, to: lead.email!, subject, html: htmlBody,
        });
        smtpMessageId = info.messageId;
        await prisma.message.update({
          where: { id: message.id },
          data: { sentAt: now, smtpMessageId },
        });
      }
    } else {
      await sendLinkedInMessage({ recipientProfileUrl: lead.linkedinUrl!, message: body });
      await prisma.message.update({ where: { id: message.id }, data: { sentAt: now } });
    }
  } catch (err) {
    await prisma.message.delete({ where: { id: message.id } }).catch(() => null);
    throw err;
  }

  // Update lead status
  if (lead.status === 'NEW' || lead.status === 'CONTACTED') {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });
  }

  // CRM sync (non-blocking)
  upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: lead.status }).catch(() => null);
  upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title }).catch(() => null);

  // Fire webhooks (non-blocking)
  fireWebhooks(lead.orgId, {
    event: 'open', // initial send tracked separately via pixel
    timestamp: now.toISOString(),
    lead: { id: lead.id, email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, status: 'CONTACTED' },
    campaign: { id: cl.campaignId, name: cl.campaign.name },
    message: { id: message.id, subject },
  }).catch(() => null);

  // Advance sequence
  const nextStep = cl.currentStep + 1;
  if (nextStep < sequences.length) {
    const nextSendAt = new Date(now.getTime() + sequences[nextStep].delayDays * 86_400_000);
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { currentStep: nextStep, nextSendAt, status: 'CONTACTED' },
    });
    console.log(`[Worker] ${lead.firstName} ${lead.lastName}: step ${cl.currentStep + 1}/${sequences.length} sent`);
  } else {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'CONVERTED', nextSendAt: null } });
    fireWebhooks(lead.orgId, {
      event: 'converted',
      timestamp: now.toISOString(),
      lead: { id: lead.id, email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, status: 'CONVERTED' },
      campaign: { id: cl.campaignId, name: cl.campaign.name },
    }).catch(() => null);
    console.log(`[Worker] ${lead.firstName} ${lead.lastName}: sequence complete`);
  }
}

function buildHtmlEmail(
  text: string,
  pixelUrl: string,
  unsubUrl: string,
  messageId: string,
  backendUrl: string,
  personalizedImageUrl?: string | null,
): string {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;

  // Split text into URL/non-URL segments, escape non-URL parts, wrap URLs in tracked links
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    // Escape and convert preceding plain text
    const plain = text.slice(lastIndex, match.index)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    parts.push(plain);

    // Wrap URL in click-tracking redirect
    const url     = match[0];
    const encoded = Buffer.from(url).toString('base64url');
    const trackUrl = `${backendUrl}/api/track/click/${messageId}/${encoded}`;
    parts.push(`<a href="${trackUrl}" style="color:#6366f1;text-decoration:underline">${url}</a>`);

    lastIndex = match.index + match[0].length;
  }

  const tail = text.slice(lastIndex)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  parts.push(tail);

  const bodyHtml = parts.join('');
  const imageBlock = personalizedImageUrl
    ? `<div style="margin:16px 0"><img src="${personalizedImageUrl}" alt="" style="max-width:100%;border-radius:8px"></div>`
    : '';

  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
${imageBlock}${bodyHtml}
<br><br>
<div style="border-top:1px solid #eee;padding-top:12px;margin-top:12px">
  <a href="${unsubUrl}" style="font-size:11px;color:#999;text-decoration:none">Unsubscribe</a>
</div>
<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">
</div>`;
}
