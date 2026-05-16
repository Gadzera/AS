import { prisma } from '../lib/prisma';
import { generateAutoReply } from './generator';
import { sendEmail } from './email';
import { getNextSmtpAccount, sendViaAccount } from './smtpRotation';
import { fireWebhooks } from './webhooks';
import { createNotification } from './onboarding';
import { config } from '../config';
import { randomUUID } from 'crypto';

// Вызывается когда IMAP классифицировал ответ как INTERESTED
export async function handleInterestedReply(params: {
  leadId: string;
  orgId: string;
  originalMessageBody: string;
  replyText: string;
}): Promise<void> {
  const { leadId, orgId, originalMessageBody, replyText } = params;

  const autopilot = await prisma.autopilotConfig.findUnique({ where: { orgId } });
  if (!autopilot || !autopilot.enabled || !autopilot.autoReplyEnabled) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.email) return;

  try {
    const reply = await generateAutoReply({
      leadFirstName: lead.firstName,
      originalMessage: originalMessageBody,
      replyFromLead: replyText,
      senderName:  autopilot.senderName  ?? undefined,
      senderTitle: autopilot.senderTitle ?? undefined,
      calendlyUrl: autopilot.calendlyUrl ?? undefined,
      language: autopilot.language ?? 'en',
    });

    const smtpAccount = await getNextSmtpAccount(orgId);

    if (smtpAccount) {
      await sendViaAccount(smtpAccount, {
        to: lead.email,
        subject: reply.subject,
        body: reply.body,
      });
    } else if (config.smtp.user) {
      await sendEmail({ to: lead.email, subject: reply.subject, body: reply.body });
    } else {
      return; // нет SMTP — пропустить
    }

    await prisma.message.create({
      data: {
        id: randomUUID(),
        leadId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        subject: reply.subject,
        body: reply.body,
        aiGenerated: true,
        sentAt: new Date(),
      },
    });

    await prisma.autopilotConfig.update({
      where: { orgId },
      data: { totalInterested: { increment: 1 } },
    });

    // Уведомление
    await createNotification(orgId, {
      type: 'HOT_LEAD',
      title: 'Горячий лид — автоответ отправлен',
      body: `${lead.firstName} ${lead.lastName} из ${lead.company ?? 'неизвестной компании'} ответил INTERESTED. Автопилот отправил follow-up.`,
      link: `/leads/${leadId}`,
    }).catch(() => null);

    // Webhook
    fireWebhooks(orgId, {
      event: 'interested',
      timestamp: new Date().toISOString(),
      lead: { id: lead.id, email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, status: 'HOT' },
    }).catch(() => null);
  } catch (err) {
    console.error('[Autopilot] Failed to send interested auto-reply:', (err as Error).message);
  }
}

// Вызывается когда ответ FOLLOW_UP — ставим follow-up в очередь
export async function handleFollowUpReply(params: {
  leadId: string;
  orgId: string;
  originalMessageBody: string;
  replyText: string;
}): Promise<void> {
  const { leadId, orgId, originalMessageBody, replyText } = params;

  const autopilot = await prisma.autopilotConfig.findUnique({ where: { orgId } });
  if (!autopilot || !autopilot.enabled) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.email) return;

  // Ставим отложенный follow-up через outreachQueue
  try {
    const { outreachQueue } = await import('../worker/queue');
    const delayMs = autopilot.followUpDelayDays * 86_400_000;

    // Генерируем follow-up заранее и сохраняем как запланированное сообщение
    const reply = await generateAutoReply({
      leadFirstName: lead.firstName,
      originalMessage: originalMessageBody,
      replyFromLead: replyText,
      senderName:  autopilot.senderName  ?? undefined,
      senderTitle: autopilot.senderTitle ?? undefined,
      calendlyUrl: autopilot.calendlyUrl ?? undefined,
      language: autopilot.language ?? 'en',
    });

    const messageId = randomUUID();
    await prisma.message.create({
      data: {
        id: messageId,
        leadId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        subject: reply.subject,
        body: reply.body,
        aiGenerated: true,
        // sentAt не заполнен — черновик/запланировано
      },
    });

    // Добавляем job с задержкой
    await outreachQueue.add(
      'autopilot-followup',
      { messageId, leadId, orgId },
      { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
    );

    console.log(`[Autopilot] Follow-up scheduled for ${lead.email} in ${autopilot.followUpDelayDays} days`);
  } catch (err) {
    console.error('[Autopilot] Failed to schedule follow-up:', (err as Error).message);
  }
}

// Обновить счётчик totalReplied
export async function incrementReplied(orgId: string): Promise<void> {
  await prisma.autopilotConfig.updateMany({
    where: { orgId, enabled: true },
    data: { totalReplied: { increment: 1 } },
  }).catch(() => null);
}

export async function incrementContacted(orgId: string): Promise<void> {
  await prisma.autopilotConfig.updateMany({
    where: { orgId, enabled: true },
    data: { totalContacted: { increment: 1 } },
  }).catch(() => null);
}
