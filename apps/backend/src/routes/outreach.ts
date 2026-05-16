import { prisma } from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { generateOutreach, classifyReply, generateAutoReply } from '../services/generator';
import { sendEmail } from '../services/email';

const router = Router();


router.use(authenticate, requireOrg);

const generateSchema = z.object({
  leadId: z.string().optional(),
  campaignId: z.string().optional(),
  language: z.enum(['en', 'ru', 'de']).default('en'),
  tone: z.enum(['professional', 'casual', 'friendly']).default('professional'),
  senderName: z.string().max(100).optional(),
  senderTitle: z.string().max(100).optional(),
  senderCompany: z.string().max(100).optional(),
  valueProposition: z.string().max(1000).optional(),
  saveAsMessage: z.boolean().default(false),
});

const classifySchema = z.object({
  messageBody: z.string().min(1).max(10000),
  leadId: z.string().optional(),
  messageId: z.string().optional(),
});

// POST /api/outreach/generate
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = generateSchema.parse(req.body);

    // Fetch lead (optional — if not provided, try to get a sample from the campaign)
    let lead = data.leadId
      ? await prisma.lead.findFirst({ where: { id: data.leadId, orgId } })
      : null;

    if (!lead && data.campaignId) {
      const cl = await prisma.campaignLead.findFirst({
        where: { campaign: { id: data.campaignId, orgId } },
        include: { lead: true },
      });
      lead = cl?.lead ?? null;
    }

    if (!lead && data.leadId) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Use generic placeholder when no lead is available
    const leadContext = lead ?? {
      firstName: 'Alex', lastName: 'Smith', email: null, title: null,
      company: 'Your Target Company', companySize: null, industry: null,
      country: null, city: null, website: null, linkedinUrl: null,
    };

    // Fetch campaign if provided
    let campaign: { name: string; channel: string; targetIndustry: string | null } = {
      name: 'General Outreach',
      channel: 'EMAIL',
      targetIndustry: null,
    };

    if (data.campaignId) {
      const dbCampaign = await prisma.campaign.findFirst({
        where: { id: data.campaignId, orgId },
      });
      if (dbCampaign) {
        campaign = {
          name: dbCampaign.name,
          channel: dbCampaign.channel,
          targetIndustry: dbCampaign.targetIndustry,
        };
      }
    }

    const result = await generateOutreach(leadContext, campaign, {
      language: data.language,
      tone: data.tone,
      senderName: data.senderName,
      senderTitle: data.senderTitle,
      senderCompany: data.senderCompany,
      valueProposition: data.valueProposition,
    });

    // Optionally save as draft message
    if (data.saveAsMessage && !lead) {
      res.status(400).json({ error: 'saveAsMessage requires a valid leadId' });
      return;
    }
    if (data.saveAsMessage && lead) {
      const message = await prisma.message.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND',
          channel: campaign.channel as 'EMAIL' | 'LINKEDIN',
          subject: result.subject,
          body: result.body,
          aiGenerated: true,
        },
      });
      res.json({ ...result, messageId: message.id });
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/outreach/classify
router.post('/classify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = classifySchema.parse(req.body);

    const classification = await classifyReply(data.messageBody);

    // Update message if messageId provided
    if (data.messageId) {
      const message = await prisma.message.findUnique({
        where: { id: data.messageId },
        include: { lead: true },
      });

      if (message && message.lead.orgId === orgId) {
        await prisma.message.update({
          where: { id: data.messageId },
          data: {
            replyClass: classification,
            repliedAt: new Date(),
          },
        });

        // Update lead status based on classification
        const statusMap: Record<string, string> = {
          INTERESTED: 'HOT',
          NOT_INTERESTED: 'LOST',
          FOLLOW_UP: 'REPLIED',
          UNSUBSCRIBE: 'UNSUBSCRIBED',
        };

        await prisma.lead.update({
          where: { id: message.leadId },
          data: { status: statusMap[classification] as 'HOT' | 'LOST' | 'REPLIED' | 'UNSUBSCRIBED' },
        });
      }
    }

    // Optionally update lead directly if leadId provided
    if (data.leadId && !data.messageId) {
      const lead = await prisma.lead.findFirst({ where: { id: data.leadId, orgId } });
      if (lead) {
        const statusMap: Record<string, string> = {
          INTERESTED: 'HOT',
          NOT_INTERESTED: 'LOST',
          FOLLOW_UP: 'REPLIED',
          UNSUBSCRIBE: 'UNSUBSCRIBED',
        };

        // Save inbound message
        await prisma.message.create({
          data: {
            leadId: data.leadId,
            direction: 'INBOUND',
            channel: 'EMAIL',
            body: data.messageBody,
            replyClass: classification,
            repliedAt: new Date(),
          },
        });

        await prisma.lead.update({
          where: { id: data.leadId },
          data: { status: statusMap[classification] as 'HOT' | 'LOST' | 'REPLIED' | 'UNSUBSCRIBED' },
        });
      }
    }

    res.json({ classification });
  } catch (err) {
    next(err);
  }
});

const autoReplySchema = z.object({
  messageId: z.string().min(1),
  replyText: z.string().min(1),
  senderName: z.string().optional(),
  senderTitle: z.string().optional(),
  calendlyUrl: z.string().url().optional(),
  language: z.enum(['en', 'ru', 'de']).default('en'),
  send: z.boolean().default(false),
});

// POST /api/outreach/auto-reply
// Generate (and optionally send) a reply to an INTERESTED lead
router.post('/auto-reply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = autoReplySchema.parse(req.body);

    const original = await prisma.message.findUnique({
      where: { id: data.messageId },
      include: { lead: true },
    });

    if (!original || original.lead.orgId !== orgId) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const reply = await generateAutoReply({
      leadFirstName: original.lead.firstName,
      originalMessage: original.body,
      replyFromLead: data.replyText,
      senderName: data.senderName,
      senderTitle: data.senderTitle,
      calendlyUrl: data.calendlyUrl,
      language: data.language,
    });

    if (data.send && original.lead.email) {
      await sendEmail({ to: original.lead.email, subject: reply.subject, body: reply.body });

      await prisma.message.create({
        data: {
          leadId: original.lead.id,
          direction: 'OUTBOUND',
          channel: 'EMAIL',
          subject: reply.subject,
          body: reply.body,
          aiGenerated: true,
          sentAt: new Date(),
        },
      });
    }

    res.json(reply);
  } catch (err) {
    next(err);
  }
});

export default router;
