import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';

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
import { createNotification, updateOnboardingStep } from '../services/onboarding';
import { getOptimalSendTime } from '../utils/sendTime';
import { config } from '../config';

function isPublicUrl(urlStr: string): boolean {
  try {
    const { hostname, protocol } = new URL(urlStr);
    if (!['http:', 'https:'].includes(protocol)) return false;
    if (['localhost', '::1'].includes(hostname)) return false;
    if (/^127\./.test(hostname)) return false;
    if (/^10\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}



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

  // Optimistic lock: atomically claim this step to prevent double-send when
  // multiple worker instances pick up the same job simultaneously.
  // We set nextSendAt 30 min into the future so the scheduler won't re-queue it.
  const claimed = await prisma.campaignLead.updateMany({
    where: {
      id: campaignLeadId,
      currentStep: cl.currentStep,
      status: { notIn: ['LOST', 'UNSUBSCRIBED', 'CONVERTED'] },
    },
    data: { nextSendAt: new Date(Date.now() + 30 * 60_000) },
  });
  if (claimed.count === 0) {
    console.log(`[Worker] ${campaignLeadId}: already claimed by another worker, skipping`);
    return;
  }

  const { sequences } = cl.campaign;
  if (sequences.length === 0 || cl.currentStep >= sequences.length) return;

  // Skip bounced leads immediately
  if (cl.lead.bounced) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    return;
  }

  // Block known-invalid emails immediately (catches re-enrolled leads)
  if (cl.lead.email && ['INVALID', 'DISPOSABLE', 'NO_MX'].includes(cl.lead.emailValid)) {
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { status: 'LOST', nextSendAt: null } });
    console.log(`[Worker] Skipping ${cl.lead.email}: email marked ${cl.lead.emailValid}`);
    return;
  }

  // Validate email before first send (only once, for UNKNOWN status)
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
      body = `Hi ${lead.firstName},\n\nI came across ${lead.company ?? 'your company'} and wanted to reach out.\n\nWould you be open to a quick 15-minute call?\n\nBest,`;
      subject = subject || `Quick question, ${lead.firstName}`;
    } else {
      try {
        const websiteContent = lead.website && isPublicUrl(lead.website) ? await scrapeWebsite(lead.website) : null;

        // Load previous messages for conversation context on follow-up steps
        const previousMessages = cl.currentStep > 0
          ? await prisma.message.findMany({
              where: { leadId: lead.id, direction: 'OUTBOUND', sentAt: { not: null } },
              orderBy: { sentAt: 'asc' },
              select: { subject: true, body: true, createdAt: true },
              take: cl.currentStep,
            }).then(msgs => msgs.map((m, i) => ({ stepNumber: i + 1, subject: m.subject ?? '', body: m.body })))
          : [];

        const generated = await generateOutreach(
          { firstName: lead.firstName, lastName: lead.lastName, email: lead.email,
            title: lead.title, company: lead.company, companySize: lead.companySize,
            industry: lead.industry, country: lead.country, city: lead.city,
            website: lead.website, linkedinUrl: lead.linkedinUrl },
          { name: cl.campaign.name, channel: step.channel, targetIndustry: cl.campaign.targetIndustry },
          { websiteContent: websiteContent ?? undefined, previousMessages: previousMessages.length > 0 ? previousMessages : undefined }
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

  // Generate message ID upfront so tracking pixel URL can be embedded before DB write
  const messageId = randomUUID();

  let smtpMessageId: string | undefined;
  let smtpAccountId: string | undefined;

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
    const pixelUrl = `${config.backend.url}/api/track/open/${messageId}`;
    const htmlBody = buildHtmlEmail(body, pixelUrl, unsubUrl, messageId, config.backend.url, personalizedImageUrl);

    if (smtpAccount) {
      const result = await sendViaAccount(smtpAccount, {
        to: lead.email!,
        subject,
        body: htmlBody,
        unsubscribeUrl: unsubUrl,
      });
      smtpMessageId = result.messageId;
      smtpAccountId = smtpAccount.id;
    } else {
      // Fallback to global SMTP config
      const transporter = nodemailer.createTransport({
        host: config.smtp.host, port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
      const info = await transporter.sendMail({
        from: config.smtp.from, to: lead.email!, subject, html: htmlBody,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'Precedence': 'bulk',
          'X-Mailer': 'SDRPlatform/1.0',
        },
      });
      smtpMessageId = info.messageId;
    }
  } else {
    await sendLinkedInMessage({ recipientProfileUrl: lead.linkedinUrl!, message: body });
  }

  // Create message record only after successful send to avoid orphaned records
  const message = await prisma.message.create({
    data: {
      id: messageId,
      leadId: lead.id,
      direction: 'OUTBOUND',
      channel: step.channel,
      subject,
      body,
      aiGenerated,
      abVariant: abVariant ?? null,
      sentAt: now,
      ...(smtpMessageId ? { smtpMessageId } : {}),
      ...(smtpAccountId ? { smtpAccountId } : {}),
    },
  });

  // Update lead status
  if (lead.status === 'NEW' || lead.status === 'CONTACTED') {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });
  }

  // CRM sync (non-blocking)
  upsertHubSpotContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, status: lead.status, orgId: lead.orgId }).catch(() => null);
  upsertPipedriveContact({ email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, title: lead.title, orgId: lead.orgId }).catch(() => null);

  // Fire webhooks (non-blocking)
  fireWebhooks(lead.orgId, {
    event: 'sent',
    timestamp: now.toISOString(),
    lead: { id: lead.id, email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, status: 'CONTACTED' },
    campaign: { id: cl.campaignId, name: cl.campaign.name },
    message: { id: message.id, subject },
  }).catch(() => null);

  // Onboarding: mark first send
  updateOnboardingStep(lead.orgId, 'firstSent').catch(() => null);

  // Advance sequence
  const nextStep = cl.currentStep + 1;
  if (nextStep < sequences.length) {
    // Respect configured delay, then pick optimal send hour in lead's local timezone
    const minSendAt = new Date(now.getTime() + sequences[nextStep].delayDays * 86_400_000);
    const nextSendAt = getOptimalSendTime(lead.country, minSendAt);
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

    // Check if ALL campaign leads are in terminal states — mark campaign COMPLETED
    const activeCount = await prisma.campaignLead.count({
      where: {
        campaignId: cl.campaignId,
        status: { notIn: ['CONVERTED', 'LOST', 'UNSUBSCRIBED', 'REPLIED'] },
      },
    });
    if (activeCount === 0) {
      await prisma.campaign.update({ where: { id: cl.campaignId }, data: { status: 'COMPLETED' } });
      createNotification(lead.orgId, {
        type: 'CAMPAIGN_COMPLETED',
        title: 'Кампания завершена',
        body: `Кампания «${cl.campaign.name}» прошла все шаги для всех лидов.`,
        link: `/campaigns/${cl.campaignId}`,
      }).catch(() => null);
      console.log(`[Worker] Campaign ${cl.campaign.name} completed`);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
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
    ? `<div style="margin:16px 0"><img src="${escapeHtml(personalizedImageUrl)}" alt="" style="max-width:100%;border-radius:8px"></div>`
    : '';

  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
${imageBlock}${bodyHtml}
<br><br>
<div style="border-top:1px solid #eee;padding-top:12px;margin-top:12px">
  <a href="${escapeHtml(unsubUrl)}" style="font-size:11px;color:#999;text-decoration:none">Unsubscribe</a>
</div>
<img src="${escapeHtml(pixelUrl)}" width="1" height="1" style="display:none" alt="">
</div>`;
}
