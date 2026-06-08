import nodemailer from 'nodemailer';

import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function isSmtpConfigured(): boolean {
  return config.smtp.user.trim().length > 0 && config.smtp.pass.trim().length > 0;
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  html?: boolean;
}

/**
 * Отправляет email через настроенный SMTP.
 * Если SMTP_USER или SMTP_PASS не заданы, включает demo-режим без реальной отправки.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
  if (!isSmtpConfigured()) {
    const messageId = 'demo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    console.log('[email:demo] -> ' + options.to + ' | ' + options.subject);

    return { messageId };
  }

  const t = getTransporter();

  const mailOptions: nodemailer.SendMailOptions = {
    from: options.from ?? config.smtp.from,
    to: options.to,
    subject: options.subject,
    replyTo: options.replyTo,
  };

  if (options.html) {
    mailOptions.html = options.body;
  } else {
    mailOptions.text = options.body;
  }

  const info = await t.sendMail(mailOptions);
  return { messageId: info.messageId };
}

/**
 * Проверяет SMTP-соединение.
 * В demo-режиме без SMTP_USER или SMTP_PASS возвращает true.
 */
export async function verifySmtpConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) {
    return true;
  }

  try {
    const t = getTransporter();
    await t.verify();
    return true;
  } catch {
    return false;
  }
}

/**
 * Создает transporter с кастомными SMTP-настройками для org-specific ключей.
 */
export function createCustomTransporter(smtpConfig: {
  host: string;
  port: number;
  user: string;
  pass: string;
}): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
}