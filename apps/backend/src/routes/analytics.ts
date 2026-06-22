import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireOrg } from '../middleware/auth';
import { mailboxDailyLimit } from '../services/mailbox'; // M12-5: единый warmup-aware per-mailbox лимит (как воркер)

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

// GET /api/analytics/stats
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      totalLeads,
      activeCampaigns,
      hotLeads,
      emailsSentThisWeek,
      emailsReplied,
      emailsOpened,
      recentMessages,
      leadsByStatus,
      last7DaysSent,
      last7DaysReplies,
    ] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.campaign.count({ where: { orgId, status: 'ACTIVE' } }),
      prisma.lead.findMany({
        where: { orgId, status: 'HOT' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.message.count({
        where: { lead: { orgId }, direction: 'OUTBOUND', sentAt: { gte: oneWeekAgo } },
      }),
      prisma.message.count({
        where: { lead: { orgId }, direction: 'INBOUND', createdAt: { gte: oneWeekAgo } },
      }),
      prisma.message.count({
        where: { lead: { orgId }, direction: 'OUTBOUND', openedAt: { not: null }, sentAt: { gte: oneWeekAgo } },
      }),
      prisma.message.findMany({
        where: { lead: { orgId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { lead: { select: { firstName: true, lastName: true, company: true } } },
      }),
      prisma.lead.groupBy({ by: ['status'], where: { orgId }, _count: true }),
      // Outbound per day for last 7 days
      prisma.message.findMany({
        where: { lead: { orgId }, direction: 'OUTBOUND', sentAt: { gte: oneWeekAgo } },
        select: { sentAt: true },
      }),
      prisma.message.findMany({
        where: { lead: { orgId }, direction: 'INBOUND', createdAt: { gte: oneWeekAgo } },
        select: { createdAt: true },
      }),
    ]);

    const replyRate = emailsSentThisWeek > 0
      ? Math.round((emailsReplied / emailsSentThisWeek) * 100) : 0;
    const openRate = emailsSentThisWeek > 0
      ? Math.round((emailsOpened / emailsSentThisWeek) * 100) : 0;

    // Build daily chart data for last 7 days
    const dailyMap: Record<string, { sent: number; replies: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      dailyMap[d.toISOString().slice(0, 10)] = { sent: 0, replies: 0 };
    }
    last7DaysSent.forEach((m) => {
      if (!m.sentAt) return;
      const key = new Date(m.sentAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].sent++;
    });
    last7DaysReplies.forEach((m) => {
      const key = new Date(m.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].replies++;
    });
    const dailyChart = Object.entries(dailyMap).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      sent: v.sent,
      replies: v.replies,
    }));

    res.json({
      totalLeads,
      activeCampaigns,
      emailsSentThisWeek,
      replyRate,
      openRate,
      hotLeads,
      dailyChart,
      recentActivity: recentMessages.map((m) => ({
        id: m.id,
        leadName: `${m.lead.firstName} ${m.lead.lastName}`,
        company: m.lead.company,
        direction: m.direction,
        channel: m.channel,
        subject: m.subject,
        replyClass: m.replyClass,
        createdAt: m.createdAt,
      })),
      leadsByStatus: leadsByStatus.reduce<Record<string, number>>((acc, g) => {
        acc[g.status] = g._count;
        return acc;
      }, {}),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/reports — сводный отчёт по всему outbound-движку (Reports-модуль).
// Воронка, эффективность, replies, meetings, impact последовательностей и workflow, capacity.
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    // ФИЛЬТР по кампании: переоблучаем lead/message/meeting-метрики на лиды этой кампании.
    const campaignId = typeof req.query.campaign === 'string' && req.query.campaign ? req.query.campaign : null;
    let scopedLeadIds: string[] | null = null;
    if (campaignId) {
      const cls = await prisma.campaignLead.findMany({ where: { campaignId, campaign: { orgId } }, select: { leadId: true } });
      scopedLeadIds = cls.map((c) => c.leadId);
    }
    // where-хелперы: при фильтре сужаем по множеству лидов кампании
    const leadWhere = scopedLeadIds ? { orgId, id: { in: scopedLeadIds } } : { orgId };
    const msgLeadWhere = scopedLeadIds ? { orgId, id: { in: scopedLeadIds } } : { orgId };
    const meetingLeadScope = scopedLeadIds ? { leadId: { in: scopedLeadIds } } : { leadId: { not: null } };

    const [
      totalLeads, leadsByStatus, totalSent, totalOpened, totalReplies, sentToday,
      repliesByClass, meetingsByStatus, meetingsWithLead, workflows, workflowRuns, campaigns, mailboxes,
      contactedLeadIds, repliedLeadIds,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.groupBy({ by: ['status'], where: leadWhere, _count: true }),
      // M12-5: «отправлено» считаем из Message.status=SENT (send-events), не из старой логики.
      prisma.message.count({ where: { lead: msgLeadWhere, direction: 'OUTBOUND', status: 'SENT' } }),
      // M13-2/M13-5: open/reply считаем по MessageEvent (source-of-truth, идемпотентный — дубли не завышают).
      prisma.messageEvent.count({ where: { type: 'OPENED', message: { lead: msgLeadWhere, direction: 'OUTBOUND' } } }),
      prisma.messageEvent.count({ where: { type: 'REPLIED', message: { lead: msgLeadWhere } } }),
      prisma.message.count({ where: { lead: msgLeadWhere, direction: 'OUTBOUND', status: 'SENT', sentAt: { gte: todayStart } } }),
      prisma.message.groupBy({ by: ['replyClass'], where: { lead: msgLeadWhere, direction: 'INBOUND', replyClass: { not: null } }, _count: true }),
      prisma.meeting.groupBy({ by: ['status'], where: { orgId, archivedAt: null, ...(scopedLeadIds ? { leadId: { in: scopedLeadIds } } : {}) }, _count: { _all: true } }),
      prisma.meeting.count({ where: { orgId, archivedAt: null, ...meetingLeadScope } }),
      prisma.workflow.findMany({ where: { orgId }, select: { trigger: true, runCount: true, isActive: true } }),
      prisma.workflowRun.groupBy({ by: ['trigger'], where: { orgId }, _count: { _all: true } }),
      prisma.campaign.findMany({ where: { orgId, ...(campaignId ? { id: campaignId } : {}) }, select: { id: true, name: true, status: true, channel: true, dailyLimit: true, createdAt: true } }),
      prisma.mailbox.findMany({ where: { orgId, archivedAt: null }, select: { id: true, address: true, status: true, dailyLimit: true, warmupDay: true, healthPct: true } }),
      prisma.message.findMany({ where: { lead: msgLeadWhere, direction: 'OUTBOUND' }, select: { leadId: true }, distinct: ['leadId'] }),
      // M13-5: «ответившие лиды» — distinct по MessageEvent REPLIED (атрибутированные ответы), не по INBOUND.
      prisma.messageEvent.findMany({ where: { type: 'REPLIED', message: { lead: msgLeadWhere } }, select: { leadId: true }, distinct: ['leadId'] }),
    ]);

    // M13-5: bounce из MessageEvent BOUNCED + качество атрибуции ответов (exact header vs fallback).
    const [totalBounced, repliesFallback] = await Promise.all([
      prisma.messageEvent.count({ where: { type: 'BOUNCED', message: { lead: msgLeadWhere } } }),
      prisma.messageEvent.count({ where: { type: 'REPLIED', message: { lead: msgLeadWhere }, meta: { path: ['attributionMode'], equals: 'fallback_last_outbound' } } }),
    ]);
    const repliesExact = Math.max(0, totalReplies - repliesFallback);

    // M14-5: метрики авто-ответа из ReplyDraft (origin × status) — auto-sent / human-approved / handoff / suppressed / failed.
    const [orgAuto, draftGroups] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { autoResponseEnabled: true, autoResponseMinConfidence: true } }),
      prisma.replyDraft.groupBy({ by: ['origin', 'status'], where: { orgId, ...(scopedLeadIds ? { leadId: { in: scopedLeadIds } } : {}) }, _count: { _all: true } }),
    ]);
    const autoResp = { autoSent: 0, humanApproved: 0, handoff: 0, suppressed: 0, failedAutoSend: 0, needsApproval: 0 };
    for (const g of draftGroups) {
      const c = g._count._all;
      if (g.status === 'SENT') { if (g.origin === 'AUTOPILOT') autoResp.autoSent += c; else autoResp.humanApproved += c; }
      else if (g.status === 'SUPPRESSED') autoResp.suppressed += c;
      else if (g.origin === 'AUTOPILOT') autoResp.failedAutoSend += c; // автопилот пытался, но не отправил (no_mailbox/fail)
      else if (g.origin === 'HANDOFF') autoResp.handoff += c; // передано человеку, ждёт approval
      else autoResp.needsApproval += c; // MANUAL DRAFT
    }

    // M15-4/M15-5: исходы встреч (типизированные) + split по источнику — всё из linked Meeting (не эвристики).
    const meetingScope = { orgId, archivedAt: null, ...(scopedLeadIds ? { leadId: { in: scopedLeadIds } } : {}) } as const;
    const [outcomeGroups, sourceGroups] = await Promise.all([
      prisma.meeting.groupBy({ by: ['outcomeType'], where: meetingScope, _count: { _all: true } }),
      prisma.meeting.groupBy({ by: ['source'], where: meetingScope, _count: { _all: true } }),
    ]);
    const meetingOutcomes = { scheduled: 0, showed: 0, no_show: 0, qualified: 0, not_qualified: 0, canceled: 0 };
    for (const g of outcomeGroups) {
      const c = g._count._all;
      if (g.outcomeType === 'SHOWED') meetingOutcomes.showed += c;
      else if (g.outcomeType === 'NO_SHOW') meetingOutcomes.no_show += c;
      else if (g.outcomeType === 'QUALIFIED') meetingOutcomes.qualified += c;
      else if (g.outcomeType === 'NOT_QUALIFIED') meetingOutcomes.not_qualified += c;
      else if (g.outcomeType === 'CANCELED') meetingOutcomes.canceled += c;
      else meetingOutcomes.scheduled += c; // без исхода = запланирована
    }
    // M15-5: source split — reply-attributed / manual / call (НЕ смешиваем в handoff-конверсии).
    const meetingsBySource = { reply: 0, manual: 0, call: 0 };
    for (const g of sourceGroups) {
      const c = g._count._all;
      if (g.source === 'reply') meetingsBySource.reply += c;
      else if (g.source === 'call') meetingsBySource.call += c;
      else meetingsBySource.manual += c; // manual / null
    }

    // M15-5: handoff funnel + handoff→meeting conversion (через linked HandoffPackage.meetingId, не эвристики).
    const hpScope = { orgId, ...(scopedLeadIds ? { leadId: { in: scopedLeadIds } } : {}) } as const;
    const [hpTotal, hpAssigned, hpHandedOff, hpWithMeeting, hpQualified] = await Promise.all([
      prisma.handoffPackage.count({ where: hpScope }),
      prisma.handoffPackage.count({ where: { ...hpScope, assigneeId: { not: null } } }),
      prisma.handoffPackage.count({ where: { ...hpScope, status: 'HANDED_OFF' } }),
      prisma.handoffPackage.count({ where: { ...hpScope, meetingId: { not: null } } }),
      // qualified = пакеты, чья связанная встреча квалифицирована (linked Meeting.outcomeType=QUALIFIED).
      prisma.handoffPackage.findMany({ where: { ...hpScope, meetingId: { not: null } }, select: { meetingId: true } })
        .then(async (rows) => {
          const ids = rows.map((r) => r.meetingId!).filter(Boolean);
          if (!ids.length) return 0;
          return prisma.meeting.count({ where: { id: { in: ids }, outcomeType: 'QUALIFIED' } });
        }),
    ]);
    const handoff = {
      open: hpTotal - hpHandedOff, assigned: hpAssigned, handed_off: hpHandedOff, meeting_scheduled: hpWithMeeting, qualified: hpQualified, total: hpTotal,
      handoffToMeetingRate: hpTotal > 0 ? Math.round((hpWithMeeting / hpTotal) * 100) : 0,
    };

    const statusMap = leadsByStatus.reduce<Record<string, number>>((a, g) => { a[g.status] = g._count; return a; }, {});

    // СТРОГАЯ воронка (variant A): каждая стадия — лиды, дошедшие «как минимум» до неё, поэтому
    // каждое следующее множество ⊆ предыдущего по построению (union убывающего набора признаков).
    // Converted == Lead.status=CONVERTED (консистентно с KPI и Sequence impact).
    const [meetingLeadRows, convertedLeadRows] = await Promise.all([
      prisma.meeting.findMany({ where: { orgId, archivedAt: null, leadId: scopedLeadIds ? { in: scopedLeadIds } : { not: null } }, select: { leadId: true }, distinct: ['leadId'] }),
      prisma.lead.findMany({ where: { ...leadWhere, status: 'CONVERTED' }, select: { id: true } }),
    ]);
    const outboundSet = new Set(contactedLeadIds.map((r) => r.leadId).filter(Boolean) as string[]);
    const inboundSet = new Set(repliedLeadIds.map((r) => r.leadId).filter(Boolean) as string[]);
    const meetingSet = new Set(meetingLeadRows.map((m) => m.leadId).filter(Boolean) as string[]);
    const convertedSet = new Set(convertedLeadRows.map((l) => l.id));
    const union = (...sets: Set<string>[]) => { const s = new Set<string>(); for (const x of sets) for (const v of x) s.add(v); return s.size; };
    const contacted = union(outboundSet, inboundSet, meetingSet, convertedSet); // дошёл ≥ Contacted
    const replied = union(inboundSet, meetingSet, convertedSet); // дошёл ≥ Replied
    const meetingsReached = union(meetingSet, convertedSet); // дошёл ≥ Meetings
    const converted = convertedSet.size; // терминальная стадия

    const funnel = [
      { stage: 'Leads', value: totalLeads },
      { stage: 'Contacted', value: contacted },
      { stage: 'Replied', value: replied },
      { stage: 'Meetings', value: meetingsReached },
      { stage: 'Converted', value: converted },
    ];

    // Impact последовательностей (по кампаниям)
    const sequenceImpact = await Promise.all(campaigns.map(async (c) => {
      const [enrolled, sent, repliedLeads, replyMsgs, conv, completed] = await Promise.all([
        prisma.campaignLead.count({ where: { campaignId: c.id } }),
        prisma.message.count({ where: { lead: { campaignLeads: { some: { campaignId: c.id } } }, direction: 'OUTBOUND', status: 'SENT' } }),
        // M13-5: «Replied» — distinct лиды по MessageEvent REPLIED, атрибутированным к ЭТОЙ кампании (campaignId события).
        prisma.messageEvent.findMany({ where: { type: 'REPLIED', campaignId: c.id }, select: { leadId: true }, distinct: ['leadId'] }).then((r) => r.length),
        // M13-5: REPLIED-события этой кампании — числитель Reply rate (знаменатель sent, как в KPI).
        prisma.messageEvent.count({ where: { type: 'REPLIED', campaignId: c.id } }),
        // «Converted» — ЕДИНОЕ определение со всем отчётом: бизнес-конверсия = Lead.status CONVERTED.
        prisma.campaignLead.count({ where: { campaignId: c.id, lead: { status: 'CONVERTED' } } }),
        // «Completed» — лиды, прошедшие всю последовательность без ответа (M11-2: EnrollmentStatus COMPLETED,
        // ставит воркер). Это НЕ конверсия — у «Converted» выше своё определение (Lead.status CONVERTED).
        prisma.campaignLead.count({ where: { campaignId: c.id, status: 'COMPLETED' } }),
      ]);
      // M15-5: метрики встреч кампании — campaignId берём ИЗ Meeting (linked attribution), НЕ из lastOutbound.
      const [campMeetings, campQualified] = await Promise.all([
        prisma.meeting.count({ where: { campaignId: c.id, archivedAt: null } }),
        prisma.meeting.count({ where: { campaignId: c.id, archivedAt: null, outcomeType: 'QUALIFIED' } }),
      ]);
      // Reply rate = входящие / отправленные (как KPI Reply rate), а не /enrolled.
      return { id: c.id, name: c.name, status: c.status, channel: c.channel, enrolled, sent, replied: repliedLeads, converted: conv, completed, replyRate: sent > 0 ? Math.round((replyMsgs / sent) * 100) : 0, meetings: campMeetings, qualifiedMeetings: campQualified };
    }));

    // Impact workflow
    const wfRunsByTrigger = workflowRuns.reduce<Record<string, number>>((a, g) => { a[g.trigger] = g._count._all; return a; }, {});
    const workflowImpact = {
      totalRuns: workflows.reduce((s, w) => s + w.runCount, 0),
      activeRules: workflows.filter((w) => w.isActive).length,
      totalRules: workflows.length,
      byTrigger: wfRunsByTrigger,
    };

    // Meetings
    const mtgMap = meetingsByStatus.reduce<Record<string, number>>((a, g) => { a[g.status] = g._count._all; return a; }, {});
    const meetingsTotal = Object.values(mtgMap).reduce((s, n) => s + n, 0);
    const meetingsCompleted = mtgMap.COMPLETED ?? 0;

    // M12-5: Capacity на УРОВНЕ ЯЩИКОВ. Per-mailbox warmup-aware лимит (та же mailboxDailyLimit, что воркер) +
    // фактически отправлено сегодня с ЭТОГО ящика (Message.status=SENT, mailboxId) — совпадает с данными M12-3.
    const sendableMailboxes = mailboxes.filter((m) => m.status === 'CONNECTED' || m.status === 'WARMING');
    const [sentTodayByMailbox, retriesScheduled, failedTerminal] = await Promise.all([
      prisma.message.groupBy({ by: ['mailboxId'], where: { lead: { orgId }, direction: 'OUTBOUND', status: 'SENT', sentAt: { gte: todayStart }, mailboxId: { not: null } }, _count: { _all: true } }),
      // temporary retry scheduled (ждёт backoff) — НЕ терминал (нота GPT): status=FAILED, не permanent.
      prisma.message.count({ where: { lead: { orgId }, direction: 'OUTBOUND', status: 'FAILED', permanentFailure: false } }),
      // terminal failed (permanent / исчерпан retry) — реально требует внимания.
      prisma.message.count({ where: { lead: { orgId }, direction: 'OUTBOUND', status: 'FAILED', permanentFailure: true } }),
    ]);
    const usedByMb = new Map<string, number>(sentTodayByMailbox.map((g) => [g.mailboxId as string, g._count._all]));
    const perMailbox = sendableMailboxes.map((m) => {
      const effectiveLimit = mailboxDailyLimit(m);
      const usedToday = usedByMb.get(m.id) ?? 0;
      return { id: m.id, address: m.address, status: m.status, warmupDay: m.warmupDay, healthPct: m.healthPct, effectiveLimit, usedToday, remaining: Math.max(0, effectiveLimit - usedToday) };
    });
    const dailyCapacity = perMailbox.reduce((s, m) => s + m.effectiveLimit, 0);
    const usedTodayMailbox = perMailbox.reduce((s, m) => s + m.usedToday, 0);

    // полный список кампаний для фильтра (вне зависимости от текущего фильтра)
    const allCampaigns = await prisma.campaign.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { createdAt: 'desc' } });

    res.json({
      filters: { campaign: campaignId, scopedLeads: scopedLeadIds ? scopedLeadIds.length : null },
      availableCampaigns: allCampaigns,
      efficiency: {
        totalSent, totalOpened, totalReplies, totalBounced, sentToday,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
        replyRate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0,
        bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0, // M13-5: из MessageEvent BOUNCED
        // Meeting rate = переход воронки Replied → Meetings (единое определение с funnel), а не meeting-rows/replied.
        meetingRate: replied > 0 ? Math.round((meetingsReached / replied) * 100) : 0,
        conversionRate: contacted > 0 ? Math.round((converted / contacted) * 100) : 0,
      },
      // M13-5 (нота GPT): качество атрибуции ответов — точная (по заголовкам треда) vs degraded fallback.
      replyAttribution: { total: totalReplies, exact: repliesExact, fallbackAttributed: repliesFallback },
      // M14-5: авто-ответ — auto-sent / human-approved / handoff / suppressed / failed (из ReplyDraft, не клиентский пересчёт).
      autoResponse: { enabled: !!orgAuto?.autoResponseEnabled, minConfidence: orgAuto?.autoResponseMinConfidence ?? 0.8, ...autoResp },
      funnel,
      repliesByClass: repliesByClass.reduce<Record<string, number>>((a, g) => { if (g.replyClass) a[g.replyClass] = g._count; return a; }, {}),
      meetings: { byStatus: mtgMap, total: meetingsTotal, completed: meetingsCompleted, showRate: meetingsTotal > 0 ? Math.round((meetingsCompleted / meetingsTotal) * 100) : 0, outcomes: meetingOutcomes, bySource: meetingsBySource },
      // M15-5: handoff conversion chain — open → assigned → handed_off → meeting_scheduled → qualified (из linked HandoffPackage/Meeting).
      handoff,
      sequenceImpact,
      workflowImpact,
      capacity: {
        dailyCapacity, usedToday: usedTodayMailbox, remaining: Math.max(0, dailyCapacity - usedTodayMailbox),
        mailboxes: sendableMailboxes.length, totalMailboxes: mailboxes.length,
        perMailbox, // M12-5: разбивка по ящикам (warmup-aware лимит + used/remaining)
        retriesScheduled, failedTerminal, // M12-4/5: temporary retry (ждёт) vs terminal failed (внимание)
      },
      leadsByStatus: statusMap,
      demoNote: 'Email and LinkedIn delivery run in demo mode until external providers are connected; all metrics are computed from real records.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/trends?days=30 — дневная динамика outbound за период (тренды).
// Реальные счётчики из БД по дням: отправлено / ответы / встречи. Период 7/30/90 дней.
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const allowed = [7, 30, 90];
    const days = allowed.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));

    const [sent, replies, meetings] = await Promise.all([
      prisma.message.findMany({ where: { lead: { orgId }, direction: 'OUTBOUND', sentAt: { gte: start } }, select: { sentAt: true } }),
      prisma.message.findMany({ where: { lead: { orgId }, direction: 'INBOUND', createdAt: { gte: start } }, select: { createdAt: true } }),
      prisma.meeting.findMany({ where: { orgId, archivedAt: null, createdAt: { gte: start } }, select: { createdAt: true } }),
    ]);

    // Дневные корзины за весь период (нулевые дни тоже присутствуют).
    const bucket: Record<string, { sent: number; replies: number; meetings: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      bucket[d.toISOString().slice(0, 10)] = { sent: 0, replies: 0, meetings: 0 };
    }
    const put = (date: Date | null, key: 'sent' | 'replies' | 'meetings') => {
      if (!date) return;
      const k = new Date(date).toISOString().slice(0, 10);
      if (bucket[k]) bucket[k][key]++;
    };
    sent.forEach((m) => put(m.sentAt, 'sent'));
    replies.forEach((m) => put(m.createdAt, 'replies'));
    meetings.forEach((m) => put(m.createdAt, 'meetings'));

    const series = Object.entries(bucket).map(([date, v]) => ({ date: date.slice(5), iso: date, ...v }));
    const totals = series.reduce((a, s) => ({ sent: a.sent + s.sent, replies: a.replies + s.replies, meetings: a.meetings + s.meetings }), { sent: 0, replies: 0, meetings: 0 });
    res.json({ days, series, totals });
  } catch (err) { next(err); }
});

// GET /api/analytics/skips?days=7 — лента пропущенных отправок воркера: почему агент не отправил.
// Разбивка по причинам + последние события + сколько лидов СЕЙЧАС удержано (для actionable-баннера).
router.get('/skips', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const allowed = [1, 7, 30];
    const days = allowed.includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));

    const [byReason, recentRaw, total, heldLeadIds, sendableMailboxes] = await Promise.all([
      prisma.sendSkip.groupBy({ by: ['reason'], where: { orgId, createdAt: { gte: start } }, _count: { _all: true } }),
      prisma.sendSkip.findMany({ where: { orgId, createdAt: { gte: start } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.sendSkip.count({ where: { orgId, createdAt: { gte: start } } }),
      // Свежие (24ч) NO_MAILBOX-скипы — кандидаты на «удержано», уникальные лиды.
      prisma.sendSkip.findMany({ where: { orgId, reason: 'NO_MAILBOX', createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }, select: { leadId: true }, distinct: ['leadId'] }),
      // Сколько ящиков СЕЙЧАС реально могут слать.
      prisma.mailbox.count({ where: { orgId, archivedAt: null, status: { in: ['CONNECTED', 'WARMING'] } } }),
    ]);

    const reasons: Record<string, number> = {};
    for (const g of byReason) reasons[g.reason] = g._count._all;
    // «Удержано прямо сейчас» показываем ТОЛЬКО если сейчас нет рабочего ящика — иначе эти лиды
    // на ближайшем ретрае уйдут, и баннер не должен противоречить Sending capacity (mailboxes N/N).
    const heldNow = sendableMailboxes === 0 ? heldLeadIds.length : 0;

    // Имена лидов/кампаний для последних событий.
    const leadIds = [...new Set(recentRaw.map((s) => s.leadId).filter(Boolean) as string[])];
    const campaignIds = [...new Set(recentRaw.map((s) => s.campaignId).filter(Boolean) as string[])];
    const [leads, campaigns] = await Promise.all([
      leadIds.length ? prisma.lead.findMany({ where: { id: { in: leadIds }, orgId }, select: { id: true, firstName: true, lastName: true } }) : [],
      campaignIds.length ? prisma.campaign.findMany({ where: { id: { in: campaignIds }, orgId }, select: { id: true, name: true } }) : [],
    ]);
    const leadMap = new Map(leads.map((l) => [l.id, `${l.firstName} ${l.lastName}`.trim()]));
    const campMap = new Map(campaigns.map((c) => [c.id, c.name]));

    const recent = recentRaw.map((s) => ({
      id: s.id, reason: s.reason, detail: s.detail,
      leadName: s.leadId ? leadMap.get(s.leadId) ?? null : null,
      campaignName: s.campaignId ? campMap.get(s.campaignId) ?? null : null,
      at: s.createdAt.toISOString(),
    }));

    res.json({ days, total, reasons, recent, heldNow });
  } catch (err) { next(err); }
});

// GET /api/analytics/campaign/:id
router.get('/campaign/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const [totalEnrolled, byStatus, totalSent, totalOpened] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId: campaign.id } }),
      prisma.campaignLead.groupBy({ by: ['status'], where: { campaignId: campaign.id }, _count: true }),
      prisma.message.count({
        where: { lead: { campaignLeads: { some: { campaignId: campaign.id } } }, direction: 'OUTBOUND', sentAt: { not: null } },
      }),
      prisma.message.count({
        where: { lead: { campaignLeads: { some: { campaignId: campaign.id } } }, direction: 'OUTBOUND', openedAt: { not: null } },
      }),
    ]);

    const statusCounts = byStatus.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {});

    res.json({
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status, channel: campaign.channel, createdAt: campaign.createdAt },
      totalEnrolled,
      statusBreakdown: statusCounts,
      totalMessages: totalSent,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      replyRate: totalEnrolled > 0
        ? Math.round(((statusCounts.REPLIED ?? 0) + (statusCounts.HOT ?? 0)) / totalEnrolled * 100)
        : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/drill?stage=<funnelStage>&campaign=<id> — drilldown: реальные лиды за метрикой воронки.
router.get('/drill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const stage = typeof req.query.stage === 'string' ? req.query.stage : '';
    const campaignId = typeof req.query.campaign === 'string' && req.query.campaign ? req.query.campaign : null;

    let scopedLeadIds: string[] | null = null;
    if (campaignId) {
      const cls = await prisma.campaignLead.findMany({ where: { campaignId, campaign: { orgId } }, select: { leadId: true } });
      scopedLeadIds = cls.map((c) => c.leadId);
    }
    const base = scopedLeadIds ? { orgId, id: { in: scopedLeadIds } } : { orgId };

    // Lead↔Meeting не имеет relation-поля (Meeting.leadId — скаляр), поэтому стадии считаем
    // через явные множества leadId (кумулятивно «дошёл как минимум до» — как в строгой воронке).
    const STAGES = ['Leads', 'Contacted', 'Replied', 'Meetings', 'Converted'];
    if (!STAGES.includes(stage)) { res.status(400).json({ error: 'Unknown stage' }); return; }

    let where: Record<string, unknown> = base;
    if (stage !== 'Leads') {
      const [outbound, inbound, meetingRows, convertedRows] = await Promise.all([
        prisma.message.findMany({ where: { lead: base as never, direction: 'OUTBOUND' }, select: { leadId: true }, distinct: ['leadId'] }),
        prisma.message.findMany({ where: { lead: base as never, direction: 'INBOUND' }, select: { leadId: true }, distinct: ['leadId'] }),
        prisma.meeting.findMany({ where: { orgId, archivedAt: null, leadId: scopedLeadIds ? { in: scopedLeadIds } : { not: null } }, select: { leadId: true }, distinct: ['leadId'] }),
        prisma.lead.findMany({ where: { ...base, status: 'CONVERTED' }, select: { id: true } }),
      ]);
      const outSet = new Set(outbound.map((r) => r.leadId).filter(Boolean) as string[]);
      const inSet = new Set(inbound.map((r) => r.leadId).filter(Boolean) as string[]);
      const mSet = new Set(meetingRows.map((r) => r.leadId).filter(Boolean) as string[]);
      const cSet = new Set(convertedRows.map((r) => r.id));
      const union = (...sets: Set<string>[]) => { const s = new Set<string>(); for (const x of sets) for (const v of x) s.add(v); return s; };
      const stageSet = stage === 'Contacted' ? union(outSet, inSet, mSet, cSet)
        : stage === 'Replied' ? union(inSet, mSet, cSet)
          : stage === 'Meetings' ? union(mSet, cSet)
            : cSet; // Converted
      where = { orgId, id: { in: [...stageSet] } };
    }

    const leads = await prisma.lead.findMany({
      where: where as never,
      select: { id: true, firstName: true, lastName: true, company: true, title: true, status: true, score: true },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
    res.json({
      stage,
      total: leads.length,
      leads: leads.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`.trim(), company: l.company, title: l.title, status: l.status, score: l.score, href: `/leads/${l.id}` })),
    });
  } catch (err) { next(err); }
});

// Saved reports — именованные конфигурации отчёта (тип + фильтры).
router.get('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const reports = await prisma.savedReport.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } });
    res.json({ reports });
  } catch (err) { next(err); }
});

router.post('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const reportType = typeof req.body?.reportType === 'string' ? req.body.reportType : 'overview';
    const filters = req.body?.filters ?? {};
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const report = await prisma.savedReport.create({ data: { orgId, name: name.slice(0, 80), reportType, filters, createdById: req.user!.userId } });
    res.status(201).json({ report });
  } catch (err) { next(err); }
});

router.delete('/saved/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existing = await prisma.savedReport.findFirst({ where: { id: req.params.id, orgId }, select: { id: true } });
    if (!existing) { res.status(404).json({ error: 'Saved report not found' }); return; }
    await prisma.savedReport.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
