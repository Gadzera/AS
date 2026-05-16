import { prisma } from '../lib/prisma';

import nodemailer from 'nodemailer';
import { config } from '../config';
import { outreachQueue } from '../worker/queue';
import { broadcastToOrg } from '../utils/sse';



const ONBOARDING_EMAILS = [
  {
    delayMs: 0,
    subject: 'Добро пожаловать — с чего начать',
    body: (name: string, orgName: string) => `
<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
<h2 style="color:#6366f1">Привет, ${name}!</h2>
<p>Рады видеть <strong>${orgName}</strong> в сервисе. За 15 минут вы можете запустить первую кампанию и получить первые ответы от потенциальных клиентов.</p>
<p><strong>3 шага для старта:</strong></p>
<ol>
  <li><strong>Подключите SMTP</strong> — Настройки &rarr; Sending &rarr; Add SMTP Account</li>
  <li><strong>Загрузите лидов</strong> — через CSV или поиск по Apollo</li>
  <li><strong>Запустите кампанию</strong> — создайте последовательность и нажмите Start</li>
</ol>
<p>Нужна помощь? Просто ответьте на это письмо.</p>
</div>`,
  },
  {
    delayMs: 3 * 24 * 60 * 60 * 1000,
    subject: 'Как дела? Подсказка по первой кампании',
    body: (name: string) => `
<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
<p>${name}, как прогресс?</p>
<p>Если ещё не запустили — вот самый быстрый способ:</p>
<p>Возьмите любые 20 контактов из вашей базы, загрузите в систему и напишите простое письмо с одним вопросом. Ответы придут уже в первые 48 часов.</p>
<p><strong>Средние результаты наших пользователей:</strong><br>
Open rate: 45&ndash;60%<br>
Reply rate: 8&ndash;15%<br>
Hot leads: 2&ndash;5% от отправленных</p>
<p>Удачи!</p>
</div>`,
  },
  {
    delayMs: 7 * 24 * 60 * 60 * 1000,
    subject: 'Увеличьте лимит до 2,000 лидов',
    body: (name: string) => `
<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px">
<p>${name},</p>
<p>На бесплатном плане у вас 500 лидов. Если хотите масштабировать — Growth план даёт 2,000 лидов, неограниченные кампании и A/B тесты.</p>
<p>Первые 7 дней Growth — бесплатно. Попробуйте без риска.</p>
</div>`,
  },
];

function getTransport() {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export async function triggerOnboarding(userId: string, orgId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { org: true } });
  if (!user?.org || !user.email) return;

  await prisma.onboardingProgress.upsert({
    where: { orgId },
    update: {},
    create: { orgId },
  });

  // Welcome notification
  const welcomeNotif = await prisma.notification.create({
    data: {
      orgId,
      type: 'ONBOARDING',
      title: 'Добро пожаловать!',
      body: 'Начните с подключения SMTP и загрузки первых лидов.',
      link: '/settings',
    },
  });
  broadcastToOrg(orgId, 'notification', welcomeNotif);

  if (!config.smtp.user) return;

  const { name, org } = user;

  for (const email of ONBOARDING_EMAILS) {
    await outreachQueue.add(
      'onboarding-email',
      { to: user.email!, subject: email.subject, html: email.body(name, org!.name), from: config.smtp.from },
      { delay: email.delayMs, removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    ).catch(() => null);
  }
}

export async function sendScheduledEmail(data: { to: string; subject: string; html: string; from?: string }): Promise<void> {
  if (!config.smtp.user) return;
  const transport = getTransport();
  await transport.sendMail({ from: data.from ?? config.smtp.from, to: data.to, subject: data.subject, html: data.html });
}

export async function updateOnboardingStep(
  orgId: string,
  step: 'smtpAdded' | 'firstLeadAdded' | 'firstCampaign' | 'firstSent' | 'firstReply'
): Promise<void> {
  const progress = await prisma.onboardingProgress.upsert({
    where: { orgId },
    update: { [step]: true },
    create: { orgId, [step]: true },
  });

  const allDone = progress.smtpAdded && progress.firstLeadAdded &&
    progress.firstCampaign && progress.firstSent && progress.firstReply;

  if (allDone && !progress.completedAt) {
    await prisma.onboardingProgress.update({
      where: { orgId },
      data: { completedAt: new Date() },
    });
    const completionNotif = await prisma.notification.create({
      data: {
        orgId,
        type: 'ONBOARDING',
        title: 'Онбординг завершён',
        body: 'Вы прошли все шаги. Система работает в полную силу.',
        link: '/dashboard',
      },
    });
    broadcastToOrg(orgId, 'notification', completionNotif);
  }
}

export async function createNotification(
  orgId: string,
  data: { type: any; title: string; body: string; link?: string }
): Promise<void> {
  const notif = await prisma.notification.create({ data: { orgId, ...data } });
  broadcastToOrg(orgId, 'notification', notif);
}
