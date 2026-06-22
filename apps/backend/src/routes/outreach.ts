import { Router, Request, Response, NextFunction } from 'express';

import { z } from 'zod';

import { PrismaClient, ActivityType } from '@prisma/client';

import { authenticate, requireOrg } from '../middleware/auth';

import { generateOutreach, classifyReply, generateAutoReply } from '../services/claude';
import { ingestInboundReply } from '../services/replyAttribution';
import { generateOrRegenerateDraft, editDraft, suppressDraft } from '../services/replyDraft';
import { sendApprovedReply } from '../services/replySend';
import { scheduleMeetingFromReply } from '../services/meetingSchedule';
import { getOrBuildHandoff, assignHandoff, markHandoffViewed, handOffToHuman } from '../services/handoff';

import { sendEmail } from '../services/email';

import { processCampaignLead } from '../worker/processor';

import { runWorkflows, fireLeadUnsubscribed } from '../services/workflows';



const router = Router();

const prisma = new PrismaClient();



router.use(authenticate, requireOrg);



const generateSchema = z.object({

  leadId: z.string().min(1),

  campaignId: z.string().optional(),

  language: z.enum(['en', 'ru', 'de']).default('en'),

  tone: z.enum(['professional', 'casual', 'friendly']).default('professional'),

  senderName: z.string().optional(),

  senderTitle: z.string().optional(),

  senderCompany: z.string().optional(),

  valueProposition: z.string().optional(),

  saveAsMessage: z.boolean().default(false),

});



const classifySchema = z.object({

  messageBody: z.string().min(1),

  leadId: z.string().optional(),

  messageId: z.string().optional(),

});



const runNowSchema = z.object({

  campaignId: z.string().min(1),

  max: z.coerce.number().int().positive().max(100).default(25),

});



// M11-2: «несендабельные» enrollment-статусы (EnrollmentStatus). notIn(...) ⇒ остаются PENDING/ACTIVE.
const terminalCampaignLeadStatuses = ['PAUSED', 'REPLIED', 'COMPLETED', 'STOPPED'] as const;



// POST /api/outreach/run-now

// Ручной синхронный запуск отправки для проверки и сценария "отправить сейчас".

router.post('/run-now', async (req: Request, res: Response, next: NextFunction) => {

  try {

    const orgId = req.user!.orgId!;

    const data = runNowSchema.parse(req.body);



    const campaign = await prisma.campaign.findFirst({

      where: { id: data.campaignId, orgId },

      select: { id: true },

    });



    if (!campaign) {

      res.status(404).json({ error: 'Campaign not found' });

      return;

    }



    const now = new Date();



    const campaignLeads = await prisma.campaignLead.findMany({

      where: {

        campaignId: campaign.id,

        campaign: { orgId, status: 'ACTIVE' },

        status: { notIn: [...terminalCampaignLeadStatuses] },

        OR: [

          { nextSendAt: { lte: now } },

          // Для ручного запуска разрешаем форсировать отправку допустимых статусов.

          { status: { notIn: [...terminalCampaignLeadStatuses] } },

        ],

      },

      select: {

        id: true,

        leadId: true,

      },

      orderBy: [

        { nextSendAt: 'asc' },

        { createdAt: 'asc' },

      ],

      take: data.max,

    });



    let processed = 0;

    let sent = 0;

    const errors: Array<{ id: string; error: string }> = [];



    for (const campaignLead of campaignLeads) {

      try {

        const sentBefore = await prisma.message.count({

          where: {

            leadId: campaignLead.leadId,

            direction: 'OUTBOUND',

            sentAt: { not: null },

          },

        });



        await processCampaignLead(campaignLead.id);



        const sentAfter = await prisma.message.count({

          where: {

            leadId: campaignLead.leadId,

            direction: 'OUTBOUND',

            sentAt: { not: null },

          },

        });



        sent += Math.max(0, sentAfter - sentBefore);

      } catch (err: unknown) {

        const error = err instanceof Error ? err.message : String(err);

        errors.push({ id: campaignLead.id, error });

      } finally {

        processed++;

      }

    }



    res.json({ processed, sent, errors });

  } catch (err) {

    next(err);

  }

});



// POST /api/outreach/generate

router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {

  try {

    const orgId = req.user!.orgId!;

    const data = generateSchema.parse(req.body);



    // Fetch lead

    const lead = await prisma.lead.findFirst({

      where: { id: data.leadId, orgId },

    });



    if (!lead) {

      res.status(404).json({ error: 'Lead not found' });

      return;

    }



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



    const result = await generateOutreach(lead, campaign, {

      language: data.language,

      tone: data.tone,

      senderName: data.senderName,

      senderTitle: data.senderTitle,

      senderCompany: data.senderCompany,

      valueProposition: data.valueProposition,

    });



    // Optionally save as draft message

    if (data.saveAsMessage) {

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



// GET /api/outreach/replies — входящие ответы (inbox) с лидом и классификацией
router.get('/replies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const filter = typeof req.query.class === 'string' ? req.query.class : undefined;

    const messages = await prisma.message.findMany({
      where: {
        direction: 'INBOUND',
        lead: { orgId },
        ...(filter ? { replyClass: filter as 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE' } : {}),
      },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, company: true, title: true, email: true, status: true, score: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // M14-2: атрибутированное outbound (тред, на который пришёл ответ) — для каждого inbound.
    const outboundIds = [...new Set(messages.map((m) => m.replyToMessageId).filter(Boolean) as string[])];
    const outbounds = outboundIds.length
      ? await prisma.message.findMany({ where: { id: { in: outboundIds } }, select: { id: true, subject: true, body: true, sentAt: true, campaignId: true } })
      : [];
    const outboundById = new Map(outbounds.map((o) => [o.id, o]));
    // имена кампаний (Message не имеет relation campaign — резолвим отдельно).
    const campIds = [...new Set(messages.map((m) => m.campaignId).filter(Boolean) as string[])];
    const camps = campIds.length ? await prisma.campaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } }) : [];
    const campName = new Map(camps.map((c) => [c.id, c.name]));

    // M14-5: origin авто-ответа на каждый inbound (последний ReplyDraft). Лейбл считает BACKEND (без client recompute).
    const inboundIds = messages.map((m) => m.id);
    const drafts = inboundIds.length
      ? await prisma.replyDraft.findMany({ where: { inboundMessageId: { in: inboundIds } }, orderBy: { createdAt: 'desc' }, select: { inboundMessageId: true, origin: true, status: true, riskLevel: true, canAutopilot: true } })
      : [];
    const draftByInbound = new Map<string, (typeof drafts)[number]>();
    for (const d of drafts) if (!draftByInbound.has(d.inboundMessageId)) draftByInbound.set(d.inboundMessageId, d); // первый = самый свежий
    const originLabel = (d?: { origin: string; status: string }): string | null => {
      if (!d) return null;
      if (d.status === 'SENT') return d.origin === 'AUTOPILOT' ? 'Auto-sent' : 'Replied';
      if (d.status === 'SUPPRESSED') return 'Suppressed';
      if (d.origin === 'AUTOPILOT') return 'Auto-send failed'; // автопилот пытался, но не отправил (no_mailbox/fail)
      if (d.origin === 'HANDOFF') return 'Handoff';
      return 'Needs approval'; // DRAFT/MANUAL
    };

    // M14-2: обогащаем каждый ответ — intent (replyClass) + confidence + source + attribution + linked outbound.
    const replies = messages.map((m) => {
      const ob = m.replyToMessageId ? outboundById.get(m.replyToMessageId) : undefined;
      return {
        ...m,
        intent: m.replyClass,
        intentConfidence: m.intentConfidence,
        intentSource: m.intentSource,
        attribution: { campaignId: m.campaignId, campaignName: m.campaignId ? campName.get(m.campaignId) ?? null : null, attributionMode: m.attributionMode, replyToMessageId: m.replyToMessageId },
        repliedToOutbound: ob ? { id: ob.id, subject: ob.subject, snippet: (ob.body || '').replace(/<[^>]+>/g, ' ').slice(0, 120), sentAt: ob.sentAt } : null,
        // M14-5: origin авто-ответа (backend-computed) — UI показывает бейдж без пересчёта.
        autoResponse: (() => { const d = draftByInbound.get(m.id); return d ? { origin: d.origin, draftStatus: d.status, riskLevel: d.riskLevel, label: originLabel(d) } : null; })(),
      };
    });

    // сводка по классам для табов
    const grouped = await prisma.message.groupBy({
      by: ['replyClass'],
      where: { direction: 'INBOUND', lead: { orgId } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) if (g.replyClass) counts[g.replyClass] = g._count._all;

    res.json({ replies, counts, total: replies.length });
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



const setClassSchema = z.object({
  class: z.enum(['INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'UNSUBSCRIBE']),
});

const leadStatusByClass: Record<string, 'HOT' | 'LOST' | 'REPLIED' | 'UNSUBSCRIBED'> = {
  INTERESTED: 'HOT',
  NOT_INTERESTED: 'LOST',
  FOLLOW_UP: 'REPLIED',
  UNSUBSCRIBE: 'UNSUBSCRIBED',
};

// POST /api/outreach/inbound — приём входящего ответа (M13-3). Атрибуция к КОНКРЕТНОМУ outbound по
// заголовкам треда (In-Reply-To/References/thread-id → providerMessageId), fallback на lastOutbound
// помечается явно. Создаёт INBOUND с привязкой + REPLIED MessageEvent + классификация + REPLY_RECEIVED.
const inboundSchema = z.object({
  leadId: z.string().optional(),
  fromEmail: z.string().email().optional(),
  body: z.string().min(1),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  threadId: z.string().optional(),
  providerMessageId: z.string().optional(),
});
router.post('/inbound', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = inboundSchema.parse(req.body);
    if (!data.leadId && !data.fromEmail) { res.status(400).json({ error: 'leadId or fromEmail required' }); return; }
    const result = await ingestInboundReply({ orgId, ...data });
    if (!result.ok) { res.status(404).json({ error: 'Lead not found', reason: result.reason }); return; }
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/outreach/replies/:id/set-class
// Ручная переклассификация входящего ответа человеком (human-in-the-loop override).
// Без LLM: оператор явно ставит класс, статус лида синхронизируется.
router.post('/replies/:id/set-class', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { class: cls } = setClassSchema.parse(req.body);

    const message = await prisma.message.findUnique({
      where: { id: req.params.id },
      include: { lead: true },
    });

    if (!message || message.lead.orgId !== orgId || message.direction !== 'INBOUND') {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }

    const now = new Date();
    const fromClass = message.replyClass;
    const classChanged = fromClass !== cls;
    // M14-1: ручная переклассификация = HUMAN override (intentSource=HUMAN, confidence=1.0). Исторический
    // REPLIED MessageEvent (auto-snapshot) НЕ трогаем. INTERESTED → снова в очередь (handledAt=null).
    await prisma.message.update({
      where: { id: message.id },
      data: { replyClass: cls, repliedAt: now, handledAt: cls === 'INTERESTED' ? null : now, intentSource: 'HUMAN', intentConfidence: 1.0 },
    });

    // M14-1: аудит смены intent человеком (from→to, source=HUMAN, кто). Виден как событие.
    if (classChanged) {
      await prisma.activity.create({
        data: {
          orgId, actorId: req.user!.userId, type: ActivityType.REPLY_INTENT_CHANGED,
          title: `Reply intent changed · ${fromClass ?? '—'} → ${cls}`,
          body: `${message.lead.firstName} ${message.lead.lastName}: reply re-classified ${fromClass ?? '—'} → ${cls} (human override)`,
          payload: { leadId: message.leadId, messageId: message.id, from: fromClass, to: cls, source: 'HUMAN' },
        },
      });
    }

    await prisma.lead.update({
      where: { id: message.leadId },
      data: { status: leadStatusByClass[cls] },
    });

    // M13-3: к какой кампании относится ответ — берём ТОЧНУЮ атрибуцию, сохранённую при ingestion
    // (message.campaignId по заголовкам треда). Если её нет (легаси/ручной ввод) — degraded fallback
    // на последнее исходящее касание лида.
    let replyCampaignId = message.campaignId;
    if (!replyCampaignId) {
      const lastOutbound = await prisma.message.findFirst({
        where: { leadId: message.leadId, direction: 'OUTBOUND', campaignId: { not: null } },
        orderBy: { sentAt: 'desc' },
        select: { campaignId: true },
      });
      replyCampaignId = lastOutbound?.campaignId ?? null;
    }

    // Автоматизация: правила Workflow на событие «получен ответ». Идемпотентность — запускаем ТОЛЬКО
    // при фактической смене класса. M17-2: стабильный ключ reply:<message.id> (раньше пути не было eventId →
    // ключ плодил строки); message.id уникален на inbound-ответ.
    const wf = classChanged
      ? await runWorkflows({ orgId, trigger: 'REPLY_RECEIVED', leadId: message.leadId, campaignId: replyCampaignId, replyClass: cls, idempotencyKey: `reply:${message.id}` })
      : { matched: 0 };
    // M17-2: оживлённый LEAD_UNSUBSCRIBED при ручной переклассификации в UNSUBSCRIBE (genuine opt-out).
    if (classChanged && cls === 'UNSUBSCRIBE') await fireLeadUnsubscribed(orgId, message.leadId, { campaignId: replyCampaignId });

    res.json({ ok: true, class: cls, leadStatus: leadStatusByClass[cls], handled: cls !== 'INTERESTED', workflowsTriggered: wf.matched });
  } catch (err) {
    next(err);
  }
});

const respondSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1),
});

// POST /api/outreach/replies/:id/respond
// Записать ответ агента на входящее. В demo-режиме (без SMTP) sendEmail — no-op,
// но исходящее сообщение фиксируется в БД и видно в диалоге. Реальная доставка — позже.
router.post('/replies/:id/respond', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = respondSchema.parse(req.body);

    const inbound = await prisma.message.findUnique({
      where: { id: req.params.id },
      include: { lead: true },
    });

    if (!inbound || inbound.lead.orgId !== orgId) {
      res.status(404).json({ error: 'Reply not found' });
      return;
    }

    let delivered = false;
    if (inbound.lead.email) {
      await sendEmail({
        to: inbound.lead.email,
        subject: data.subject ?? 'Re: your message',
        body: data.body,
      });
      delivered = true;
    }

    const now = new Date();
    const message = await prisma.message.create({
      data: {
        leadId: inbound.leadId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        subject: data.subject ?? null,
        body: data.body,
        aiGenerated: true,
        sentAt: now,
      },
    });

    // Входящее, на которое ответили, считается оттриажированным → уходит из очереди решений.
    await prisma.message.update({
      where: { id: inbound.id },
      data: { handledAt: now, repliedAt: inbound.repliedAt ?? now },
    });

    res.json({ ok: true, messageId: message.id, delivered });
  } catch (err) {
    next(err);
  }
});

// ───────────────────────── M14-3: AI reply draft + approval gate ─────────────────────────
const editDraftSchema = z.object({ body: z.string().min(1) });

// Сериализация черновика для UI (включая backend risk flags/level/canAutopilot и before/after).
async function serializeDraft(orgId: string, inboundMessageId: string) {
  const d = await prisma.replyDraft.findFirst({
    where: { orgId, inboundMessageId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, subject: true, body: true, originalBody: true, riskFlags: true, riskLevel: true,
      canAutopilot: true, generatedBy: true, editedById: true, approvedById: true, approvedAt: true, sentMessageId: true,
      sentAt: true, createdAt: true, updatedAt: true,
    },
  });
  return d;
}

// POST /api/outreach/replies/:id/draft — сгенерировать/перегенерировать AI-черновик ответа.
// Один активный DRAFT на reply: повторный вызов обновляет существующий (без orphan-черновиков).
router.post('/replies/:id/draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const r = await generateOrRegenerateDraft(orgId, req.params.id);
    if (!r.ok) { res.status(r.reason === 'reply_not_found' ? 404 : 400).json({ error: r.reason }); return; }
    res.json({ ok: true, draft: await serializeDraft(orgId, req.params.id) });
  } catch (err) { next(err); }
});

// GET /api/outreach/replies/:id/draft — текущий черновик ответа (если есть).
router.get('/replies/:id/draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    res.json({ ok: true, draft: await serializeDraft(orgId, req.params.id) });
  } catch (err) { next(err); }
});

// POST /api/outreach/drafts/:draftId/edit — ручная правка (снимок before/after в originalBody).
router.post('/drafts/:draftId/edit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { body } = editDraftSchema.parse(req.body);
    const r = await editDraft(orgId, req.params.draftId, body, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'draft_not_found' ? 404 : 409).json({ error: r.reason }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/outreach/drafts/:draftId/approve-send — approve+send как ОДНО controlled action.
// M14-4: thread-safe + идемпотентно через M12-lifecycle (sendApprovedReply). Сбой/нет-ящика НЕ помечают
// draft/inbound отправленными; повторный вызов безопасен (один OUTBOUND, один provider-send).
router.post('/drafts/:draftId/approve-send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const r = await sendApprovedReply(orgId, req.params.draftId, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'draft_not_found' ? 404 : 409).json({ ok: false, error: r.reason, messageId: r.messageId, status: r.status }); return; }
    res.json({ ok: true, messageId: r.messageId, status: r.status ?? 'SENT', mailboxId: r.mailboxId, alreadySent: r.reason === 'already_sent' });
  } catch (err) { next(err); }
});

// POST /api/outreach/drafts/:draftId/suppress — снять черновик / передать человеку (без отправки).
router.post('/drafts/:draftId/suppress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const r = await suppressDraft(orgId, req.params.draftId, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'draft_not_found' ? 404 : 409).json({ error: r.reason }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// M15-2: POST /api/outreach/replies/:id/schedule-meeting — встреча из заинтересованного ответа (с атрибуцией, идемпотентно).
const scheduleMeetingSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMin: z.coerce.number().int().min(5).max(480).optional(),
  title: z.string().min(1).max(160).optional(),
});
router.post('/replies/:id/schedule-meeting', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = scheduleMeetingSchema.parse(req.body);
    const r = await scheduleMeetingFromReply({ orgId, replyMessageId: req.params.id, scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null, durationMin: data.durationMin, title: data.title, createdById: req.user!.userId });
    if (!r.ok) { res.status(r.reason === 'reply_not_found' ? 404 : 400).json({ error: r.reason }); return; }
    res.status(r.duplicate ? 200 : 201).json({ ok: true, meetingId: r.meetingId, duplicate: !!r.duplicate, workflowsTriggered: r.workflowsTriggered ?? 0 });
  } catch (err) { next(err); }
});

// ───────────────────────── M15-3: Handoff package ─────────────────────────
// Сериализация пакета для UI: поля + назначенный (имя) + список AE org для пикера + кампания.
async function serializeHandoff(orgId: string, handoffId: string) {
  const hp = await prisma.handoffPackage.findFirst({ where: { id: handoffId, orgId } });
  if (!hp) return null;
  const [assignee, members, campaign, meeting, lead] = await Promise.all([
    hp.assigneeId ? prisma.user.findFirst({ where: { id: hp.assigneeId, orgId }, select: { id: true, name: true, email: true } }) : Promise.resolve(null),
    prisma.user.findMany({ where: { orgId, isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    hp.campaignId ? prisma.campaign.findUnique({ where: { id: hp.campaignId }, select: { name: true } }) : Promise.resolve(null),
    hp.meetingId ? prisma.meeting.findUnique({ where: { id: hp.meetingId }, select: { id: true, scheduledAt: true, status: true, title: true } }) : Promise.resolve(null),
    prisma.lead.findUnique({ where: { id: hp.leadId }, select: { id: true, firstName: true, lastName: true, company: true, title: true, score: true } }),
  ]);
  return { ...hp, assignee, campaignName: campaign?.name ?? null, meeting, assignableUsers: members, lead };
}

async function resolveReplyId(orgId: string, q: { replyMessageId?: string; meetingId?: string; leadId?: string }): Promise<string | null> {
  if (q.replyMessageId) return q.replyMessageId;
  if (q.meetingId) { const m = await prisma.meeting.findFirst({ where: { id: q.meetingId, orgId }, select: { replyMessageId: true } }); return m?.replyMessageId ?? null; }
  if (q.leadId) { const inb = await prisma.message.findFirst({ where: { leadId: q.leadId, direction: 'INBOUND', lead: { orgId } }, orderBy: { createdAt: 'desc' }, select: { id: true } }); return inb?.id ?? null; }
  return null;
}

// GET /api/outreach/handoff?replyMessageId=|meetingId=|leadId= — собрать/получить пакет (доступ из Replies/Meetings/Lead360).
router.get('/handoff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const replyId = await resolveReplyId(orgId, { replyMessageId: req.query.replyMessageId as string, meetingId: req.query.meetingId as string, leadId: req.query.leadId as string });
    if (!replyId) { res.status(404).json({ error: 'no_reply' }); return; }
    const r = await getOrBuildHandoff(orgId, replyId, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'reply_not_found' ? 404 : 400).json({ error: r.reason }); return; }
    await markHandoffViewed(orgId, r.handoffId!, req.user!.userId);
    res.json({ ok: true, handoff: await serializeHandoff(orgId, r.handoffId!), built: r.created ? 'created' : r.updated ? 'updated' : 'cached' });
  } catch (err) { next(err); }
});

// POST /api/outreach/handoff/:id/assign { assigneeId|null } — назначить реального AE / снять назначение.
router.post('/handoff/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const assigneeId = (req.body?.assigneeId ?? null) as string | null;
    const r = await assignHandoff(orgId, req.params.id, assigneeId, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'handoff_not_found' ? 404 : 400).json({ error: r.reason }); return; }
    res.json({ ok: true, handoff: await serializeHandoff(orgId, req.params.id) });
  } catch (err) { next(err); }
});

// POST /api/outreach/handoff/:id/hand-off — явная передача человеку (статус + deduped нотификация).
router.post('/handoff/:id/hand-off', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const r = await handOffToHuman(orgId, req.params.id, req.user!.userId);
    if (!r.ok) { res.status(r.reason === 'handoff_not_found' ? 404 : 400).json({ error: r.reason }); return; }
    res.json({ ok: true, handoff: await serializeHandoff(orgId, req.params.id) });
  } catch (err) { next(err); }
});

export default router;