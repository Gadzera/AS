import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

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
 * Send an email via configured SMTP
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
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
 * Verify SMTP connection
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const t = getTransporter();
    await t.verify();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a transporter with custom SMTP settings (for org-specific keys)
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
