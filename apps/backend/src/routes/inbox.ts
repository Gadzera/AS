import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { getNextSmtpAccount, sendViaAccount } from '../services/smtpRotation';
import { getUnsubscribeUrl } from '../utils/unsubscribe';
import { generatePersonalizedImageLocal, getPersonalizationUrl } from '../services/imagePersonalization';
import { substituteVariables } from '../utils/variables';
import { config } from '../config';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate, requireOrg);

// GET /api/inbox — conversation list (leads with at least 1 message, sorted by last activity)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId  = req.user!.orgId!;
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 25);
    const filter = (req.query.filter as string) || 'all'; // all | replied | hot | unread

    const statusFilter =
      filter === 'replied' ? { in: ['REPLIED', 'HOT'] } :
      filter === 'hot'     ? 'HOT' :
      undefined;

    const where: Record<string, unknown> = {
      orgId,
      messages: { some: {} },
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, direction: true, subject: true, body: true, createdAt: true, replyClass: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    const conversations = leads.map(l => ({
      leadId:      l.id,
      firstName:   l.firstName,
      lastName:    l.lastName,
      company:     l.company,
      email:       l.email,
      status:      l.status,
      messageCount: l._count.messages,
      lastMessage: l.messages[0] ?? null,
      updatedAt:   l.updatedAt,
    }));

    res.json({ conversations, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/inbox/:leadId — full thread for a lead
router.get('/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const lead  = await prisma.lead.findFirst({
      where: { id: req.params.leadId, orgId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        campaignLeads: {
          include: { campaign: { select: { id: true, name: true, status: true } } },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(lead);
  } catch (err) { next(err); }
});

// POST /api/inbox/:leadId/reply — send a manual reply to a lead
router.post('/:leadId/reply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { subject, body } = z.object({
      subject: z.string().min(1),
      body:    z.string().min(1),
    }).parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, orgId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    if (!lead.email) { res.status(400).json({ error: 'Lead has no email address' }); return; }

    const finalSubject = substituteVariables(subject, lead);
    const finalBody    = substituteVariables(body, lead);

    // Create message record first (for tracking pixel)
    const message = await prisma.message.create({
      data: {
        leadId:    lead.id,
        direction: 'OUTBOUND',
        channel:   'EMAIL',
        subject:   finalSubject,
        body:      finalBody,
        aiGenerated: false,
      },
    });

    try {
      const smtpAccount = await getNextSmtpAccount(orgId);
      const pixelUrl    = `${config.backend.url}/api/track/open/${message.id}`;
      const unsubUrl    = lead.unsubscribeToken ? getUnsubscribeUrl(lead.unsubscribeToken) : '#';
      const imageUrl    = getPersonalizationUrl(config.backend.url, { firstName: lead.firstName, company: lead.company ?? '' });

      const htmlBody = buildReplyHtml(finalBody, pixelUrl, unsubUrl, message.id, config.backend.url, imageUrl);

      let smtpMessageId: string;
      if (smtpAccount) {
        const r = await sendViaAccount(smtpAccount, { to: lead.email, subject: finalSubject, body: htmlBody });
        smtpMessageId = r.messageId;
        await prisma.message.update({ where: { id: message.id }, data: { sentAt: new Date(), smtpMessageId, smtpAccountId: smtpAccount.id } });
      } else {
        const t = nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465, auth: { user: config.smtp.user, pass: config.smtp.pass } });
        const info = await t.sendMail({ from: config.smtp.from, to: lead.email, subject: finalSubject, html: htmlBody });
        smtpMessageId = info.messageId;
        await prisma.message.update({ where: { id: message.id }, data: { sentAt: new Date(), smtpMessageId } });
      }

      res.json({ id: message.id, sentAt: new Date() });
    } catch (err) {
      await prisma.message.delete({ where: { id: message.id } }).catch(() => null);
      throw err;
    }
  } catch (err) { next(err); }
});

// PATCH /api/inbox/:leadId/status — quick status update from inbox
router.patch('/:leadId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId  = req.user!.orgId!;
    const { status } = z.object({
      status: z.enum(['NEW', 'CONTACTED', 'REPLIED', 'HOT', 'CONVERTED', 'LOST', 'UNSUBSCRIBED']),
    }).parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, orgId } });
    if (!lead) { res.status(404).json({ error: 'Not found' }); return; }

    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status } });
    res.json(updated);
  } catch (err) { next(err); }
});

function buildReplyHtml(body: string, pixelUrl: string, unsubUrl: string, messageId: string, backendUrl: string, imageUrl: string): string {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = urlRegex.exec(body)) !== null) {
    const plain = body.slice(last, m.index).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    parts.push(plain);
    const encoded = Buffer.from(m[0]).toString('base64url');
    parts.push(`<a href="${backendUrl}/api/track/click/${messageId}/${encoded}" style="color:#6366f1">${m[0]}</a>`);
    last = m.index + m[0].length;
  }
  parts.push(body.slice(last).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));

  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
<div style="margin:0 0 16px"><img src="${imageUrl}" alt="" style="max-width:100%;border-radius:8px"></div>
${parts.join('')}
<br><br>
<div style="border-top:1px solid #eee;padding-top:12px;margin-top:12px">
  <a href="${unsubUrl}" style="font-size:11px;color:#999;text-decoration:none">Unsubscribe</a>
</div>
<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">
</div>`;
}

export default router;
