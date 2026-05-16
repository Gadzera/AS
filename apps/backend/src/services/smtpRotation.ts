import { prisma } from '../lib/prisma';
import nodemailer from 'nodemailer';
import { SmtpAccount } from '@prisma/client';
import { config } from '../config';
import { decrypt } from '../utils/encryption';



// Round-robin counter per org
const orgCounters = new Map<string, number>();

export async function getNextSmtpAccount(orgId: string): Promise<SmtpAccount | null> {
  const accounts = await prisma.smtpAccount.findMany({
    where: { orgId, active: true },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) return null;

  const idx = orgCounters.get(orgId) ?? 0;
  const account = accounts[idx % accounts.length];
  orgCounters.set(orgId, idx + 1);
  return account;
}

export function buildTransporter(account: SmtpAccount): nodemailer.Transporter {
  return nodemailer.createTransport({
    host:   account.host,
    port:   account.port,
    secure: account.port === 465,
    auth:   { user: account.user, pass: decrypt(account.pass) },
  });
}

export async function sendViaAccount(
  account: SmtpAccount,
  opts: { to: string; subject: string; body: string; inReplyTo?: string; references?: string }
): Promise<{ messageId: string }> {
  const transporter = buildTransporter(account);
  const safeName = account.fromName?.replace(/[\r\n"]/g, '') ?? '';
  const from = safeName
    ? `"${safeName}" <${account.fromEmail}>`
    : account.fromEmail;

  const info = await transporter.sendMail({
    from,
    to:         opts.to,
    subject:    opts.subject,
    html:       opts.body,
    // Thread headers — critical for Gmail/Outlook threading
    ...(opts.inReplyTo && { inReplyTo: opts.inReplyTo }),
    ...(opts.references && { references: opts.references }),
  });

  return { messageId: info.messageId };
}

export async function verifySmtpAccount(account: SmtpAccount): Promise<boolean> {
  try {
    const t = buildTransporter(account);
    await t.verify();
    return true;
  } catch {
    return false;
  }
}

// Fallback to global SMTP if no accounts configured
export function getDefaultSmtpConfig() {
  return {
    host:      config.smtp.host,
    port:      config.smtp.port,
    user:      config.smtp.user,
    pass:      config.smtp.pass,
    fromEmail: config.smtp.from,
    fromName:  null as null,
  };
}
