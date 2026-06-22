import { PrismaClient } from '@prisma/client';
import { generateOutreach } from '../services/claude';
import { sendEmail } from '../services/email';
import { sendLinkedInMessage } from '../services/unipile';
import { scrapeWebsite } from '../utils/scraper';
import { applySpintax } from '../utils/spintax';
import { recordSendSkip } from '../services/sendSkip';
import { runWorkflows } from '../services/workflows';
import { selectSendableMailbox, type SelectedMailbox } from '../services/mailbox';
import { handleSendFailure } from '../services/sendError';
import { clampToSendWindow, isWithinSendWindow, type SendWindow } from '../lib/sendWindow';
import { effectiveCampaignAgeDays, warmupLimit as computeWarmupLimit } from '../lib/warmup';
import { config } from '../config';

// M11-6: окно отправки организации → SendWindow (общий тип для clamp/enforcement).
function orgSendWindow(org: { sendWindowStart: string; sendWindowEnd: string; sendDays: string; timezone: string }): SendWindow {
  return {
    start: org.sendWindowStart,
    end: org.sendWindowEnd,
    days: org.sendDays.split(',').map((d) => Number(d.trim())).filter((n) => n >= 1 && n <= 7),
    timeZone: org.timezone,
  };
}

const prisma = new PrismaClient();

export async function processCampaignLead(campaignLeadId: string): Promise<void> {
  const cl = await prisma.campaignLead.findUnique({
    where: { id: campaignLeadId },
    include: {
      lead: true,
      campaign: {
        include: {
          sequences: { orderBy: { stepNumber: 'asc' } },
          // M11-6: окно отправки берём из настроек организации (та же модель, что в resume).
          org: { select: { sendWindowStart: true, sendWindowEnd: true, sendDays: true, timezone: true } },
        },
      },
    },
  });

  if (!cl) {
    console.warn(`[Worker] CampaignLead ${campaignLeadId} not found`);
    return;
  }

  if (cl.campaign.status !== 'ACTIVE') return;

  // M11-2: воркер решает по status enrollment'а. Терминальные/паузные статусы не отправляем.
  if (['PAUSED', 'REPLIED', 'COMPLETED', 'STOPPED'].includes(cl.status)) return;

  const { sequences } = cl.campaign;
  if (sequences.length === 0 || cl.currentStep >= sequences.length) return;

  // M11-6: окно отправки организации (рабочие дни + интервал в орг-таймзоне). Тот же clampToSendWindow,
  // что и при resume (M11-3/4) — единый расчёт, без второго варианта.
  const win = orgSendWindow(cl.campaign.org);

  // Daily limit with automatic warm-up protection (prevents domain ban)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // M11-4/M11-9: единый warm-up (lib/warmup). Возраст ИСКЛЮЧАЕТ простой (pausedDaysAccum) — пауза не
  // «прогревает» домен. Тот же расчёт использует обзор последовательности (без расхождений UI↔воркер).
  const campaignAgeDays = effectiveCampaignAgeDays(cl.campaign.createdAt, cl.campaign.pausedDaysAccum ?? 0);
  const effectiveLimit = computeWarmupLimit(campaignAgeDays, cl.campaign.dailyLimit);

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
    // Перенос на завтра тоже клампим в окно (если завтра выходной — уедет на ближайший рабочий день).
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { nextSendAt: clampToSendWindow(tomorrow, win) },
    });
    await recordSendSkip({ orgId: cl.campaign.orgId, campaignId: cl.campaignId, leadId: cl.leadId, reason: 'DAILY_LIMIT', detail: `Daily limit ${effectiveLimit} reached for “${cl.campaign.name}” — rescheduled to tomorrow` });
    console.log(`[Worker] Daily limit hit for campaign ${cl.campaignId}, rescheduled to tomorrow`);
    return;
  }

  // M11-6: enforcement окна отправки. Если СЕЙЧАС вне окна (ночь/выходной по орг-TZ) — НЕ шлём:
  // переносим nextSendAt на ближайший слот окна и выходим. Никаких Message/credit/внешних вызовов.
  const nowGate = new Date();
  if (!isWithinSendWindow(nowGate, win)) {
    const next = clampToSendWindow(nowGate, win);
    await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { nextSendAt: next } });
    await recordSendSkip({ orgId: cl.campaign.orgId, campaignId: cl.campaignId, leadId: cl.leadId, reason: 'OUTSIDE_WINDOW', detail: `Outside send window for “${cl.campaign.name}” — rescheduled to ${next.toISOString()}` });
    console.log(`[Worker] Outside send window for campaign ${cl.campaignId}, rescheduled to ${next.toISOString()}`);
    return;
  }

  const step = sequences[cl.currentStep];
  const { lead } = cl;

  // M12-3: выбор/ротация рабочего ящика для EMAIL. Только CONNECTED/WARMING; per-mailbox warmup-aware
  // ёмкость; наименее загруженный (ротация распределяет нагрузку). Исчерпание → SendSkip, БЕЗ Message.
  let selectedMailbox: SelectedMailbox | null = null;
  if (step.channel === 'EMAIL') {
    const sel = await selectSendableMailbox(cl.campaign.orgId);
    if (sel.reason === 'NO_MAILBOX') {
      const retry = new Date(); retry.setHours(retry.getHours() + 1);
      await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { nextSendAt: retry } });
      await recordSendSkip({ orgId: cl.campaign.orgId, campaignId: cl.campaignId, leadId: lead.id, reason: 'NO_MAILBOX', detail: 'No connected sending mailbox — lead held, retrying in 1h' });
      console.log(`[Worker] No sendable mailbox for org ${cl.campaign.orgId}; holding lead ${lead.id}, retry in 1h`);
      return;
    }
    if (sel.reason === 'ALL_AT_CAPACITY') {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
      await prisma.campaignLead.update({ where: { id: campaignLeadId }, data: { nextSendAt: clampToSendWindow(tomorrow, win) } });
      await recordSendSkip({ orgId: cl.campaign.orgId, campaignId: cl.campaignId, leadId: lead.id, reason: 'DAILY_LIMIT', detail: 'All sending mailboxes hit their daily capacity — rescheduled to tomorrow' });
      console.log(`[Worker] All mailboxes at capacity for org ${cl.campaign.orgId}; holding lead ${lead.id} to tomorrow`);
      return;
    }
    selectedMailbox = sel.mailbox;
  }

  if (step.channel === 'EMAIL' && !lead.email) {
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'STOPPED', stopReason: 'NO_EMAIL', nextSendAt: null },
    });
    await recordSendSkip({ orgId: cl.campaign.orgId, campaignId: cl.campaignId, leadId: lead.id, reason: 'NO_EMAIL', detail: `${lead.firstName} ${lead.lastName} has no email — dropped from the email step` });
    return;
  }

  if (step.channel === 'LINKEDIN' && !lead.linkedinUrl) {
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: 'STOPPED', stopReason: 'NO_LINKEDIN', nextSendAt: null },
    });
    await recordSendSkip({ orgId: cl.campaign.orgId, campaignId: cl.campaignId, leadId: lead.id, reason: 'NO_LINKEDIN', detail: `${lead.firstName} ${lead.lastName} has no LinkedIn — dropped from the LinkedIn step` });
    return;
  }

  // Generate message with Claude if no manual body written
  let subject = step.subject ?? '';
  let body = step.body ?? '';
  let aiGenerated = false;

  if (!body || body.trim() === '' || body === 'AI_GENERATE') {
    // Scrape lead's website for personalization context
    const websiteContent = lead.website ? await scrapeWebsite(lead.website) : null;

    const generated = await generateOutreach(
      {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        title: lead.title,
        company: lead.company,
        companySize: lead.companySize,
        industry: lead.industry,
        country: lead.country,
        city: lead.city,
        website: lead.website,
        linkedinUrl: lead.linkedinUrl,
      },
      {
        name: cl.campaign.name,
        channel: step.channel,
        targetIndustry: cl.campaign.targetIndustry,
      },
      { websiteContent: websiteContent ?? undefined }
    );
    subject = generated.subject;
    body = generated.body;
    aiGenerated = true;
  }

  // Apply spintax variations for deliverability
  subject = applySpintax(subject);
  body = applySpintax(body);

  const now = new Date();
  const processedIndex = cl.currentStep; // индекс шага, который шлём сейчас
  const wfOrgId = cl.campaign.orgId; // захват для замыкания (TS не проносит narrowing cl в nested fn)
  const ctxCampaignId = cl.campaignId;

  // M11/M12: пост-отправочное продвижение enrollment'а. ИДЕМПОТЕНТНО: двигает шаг только если лид всё
  // ещё на этом индексе и не терминальный (повторный вызов после SENT ничего не перескакивает).
  async function finalizeAfterSend(): Promise<void> {
    if (lead.status === 'NEW' || lead.status === 'CONTACTED') {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } }).catch(() => undefined);
    }
    const nextStepIndex = processedIndex + 1;
    if (nextStepIndex < sequences.length) {
      const nextStep = sequences[nextStepIndex];
      const nextSendAt = clampToSendWindow(new Date(now.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000), win);
      await prisma.campaignLead.updateMany({
        where: { id: campaignLeadId, currentStep: processedIndex, status: { notIn: ['COMPLETED', 'STOPPED', 'PAUSED', 'REPLIED'] } },
        data: { currentStep: nextStepIndex, nextSendAt, status: 'ACTIVE' },
      });
    } else {
      // M11-2: прошёл все шаги без ответа = COMPLETED (НЕ CONVERTED). Guard по currentStep+status →
      // SEQUENCE_COMPLETED (M11-5) запускается РОВНО один раз (не на дубль-джобе).
      const adv = await prisma.campaignLead.updateMany({
        where: { id: campaignLeadId, currentStep: processedIndex, status: { notIn: ['COMPLETED', 'STOPPED'] } },
        data: { status: 'COMPLETED', completedAt: now, nextSendAt: null },
      });
      if (adv.count === 1) {
        // M17-2: стабильный ключ seqdone:<campaignLeadId> — завершение enrollment запускает правило ровно раз.
        try { await runWorkflows({ orgId: wfOrgId, trigger: 'SEQUENCE_COMPLETED', leadId: lead.id, campaignId: ctxCampaignId, idempotencyKey: `seqdone:${campaignLeadId}` }); }
        catch (e) { console.warn(`[Worker] SEQUENCE_COMPLETED workflows failed for lead ${lead.id}:`, e); }
      }
    }
  }

  // M12-1: find-or-create черновик сообщения АТОМАРНО по составному unique (campaignLeadId, sequenceId).
  // На ретрае/гонке вторая попытка ловит P2002 и находит ту же строку — дубля Message не будет.
  const idempotencyKey = `${cl.id}:${step.id}`;
  let message: { id: string; attemptCount: number } | null;
  try {
    message = await prisma.message.create({
      data: {
        leadId: lead.id, campaignId: cl.campaignId, campaignLeadId: cl.id, sequenceId: step.id, idempotencyKey,
        mailboxId: selectedMailbox?.id ?? null, // M12-3: с какого ящика уходит (provider identity)
        direction: 'OUTBOUND', channel: step.channel, subject, body, aiGenerated, status: 'QUEUED',
      },
      select: { id: true, attemptCount: true },
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      message = await prisma.message.findFirst({ where: { campaignLeadId: cl.id, sequenceId: step.id }, select: { id: true, attemptCount: true } });
    } else { throw e; }
  }
  if (!message) { console.warn(`[Worker] could not resolve message row for lead ${lead.id} step ${step.id}`); return; }

  // M12-2/M12-4: claim — АТОМАРНО забираем право отправки (только QUEUED/FAILED, НЕ permanentFailure →
  // SENDING + sendingAt). Победитель один. Permanent-сбой не переотправляется (claim его исключает).
  const claim = await prisma.message.updateMany({ where: { id: message.id, status: { in: ['QUEUED', 'FAILED'] }, permanentFailure: false }, data: { status: 'SENDING', sendingAt: new Date() } });
  if (claim.count === 0) {
    // Не наш ход: параллельный воркер шлёт (SENDING), уже SENT (дубль-джоб), либо permanent (терминально).
    // Зависший SENDING восстанавливается sweep'ом recoverStaleSending. На SENT — идемпотентно довести шаг.
    const fresh = await prisma.message.findUnique({ where: { id: message.id }, select: { status: true } });
    if (fresh?.status === 'SENT') await finalizeAfterSend();
    return;
  }

  // Внешняя отправка строго ПОСЛЕ SENDING и ДО SENT (provider/demo boundary).
  try {
    let providerMessageId: string;
    if (step.channel === 'EMAIL') {
      const trackingPixel = `<img src="${config.backend.url}/api/track/open/${message.id}" width="1" height="1" style="display:none" alt="" />`;
      const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>${trackingPixel}`;
      // M12-3: отправляем С ВЫБРАННОГО ящика (его from-identity).
      const from = selectedMailbox ? (selectedMailbox.fromName ? `${selectedMailbox.fromName} <${selectedMailbox.address}>` : selectedMailbox.address) : undefined;
      providerMessageId = (await sendEmail({ to: lead.email!, subject, body: htmlBody, from, html: true })).messageId;
    } else {
      providerMessageId = (await sendLinkedInMessage({ recipientProfileUrl: lead.linkedinUrl!, message: body })).id;
    }
    // Успех: SENT + provider-id + sentAt, error очищаем (важно для пути после ретрая).
    await prisma.message.update({ where: { id: message.id }, data: { status: 'SENT', providerMessageId, sentAt: new Date(), error: null } });
    await finalizeAfterSend();
    console.log(`[Worker] Lead ${lead.id} (${lead.firstName} ${lead.lastName}): step ${processedIndex + 1}/${sequences.length} sent (msg ${providerMessageId}).`);
  } catch (e) {
    // M12-4: безопасная обработка сбоя в ТОЙ ЖЕ строке (без дубля). transient → backoff и переотправка
    // по расписанию; permanent / исчерпан retry → терминально (лид удержан, причина в send-feed, raw —
    // только в Message.error). НЕ бросаем: ретрай управляется на уровне лида, без двойной очереди.
    const res = await handleSendFailure({ messageId: message.id, campaignLeadId, orgId: wfOrgId, campaignId: ctxCampaignId, leadId: lead.id, error: e, priorAttempt: message.attemptCount });
    console.warn(`[Worker] send ${res.permanent ? 'permanently failed' : 'failed (will retry)'} for lead ${lead.id} step ${step.stepNumber} (attempt ${res.attempt}):`, e instanceof Error ? e.message : e);
  }
}
