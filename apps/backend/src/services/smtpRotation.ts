import nodemailer from 'nodemailer';
import { PrismaClient, SmtpAccount } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

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
    auth:   { user: account.user, pass: account.pass },
  });
}

export async function sendViaAccount(
  account: SmtpAccount,
  opts: { to: string; subject: string; body: string }
): Promise<{ messageId: string }> {
  const transporter = buildTransporter(account);
  const from = account.fromName
    ? `"${account.fromName}" <${account.fromEmail}>`
    : account.fromEmail;

  const info = await transporter.sendMail({
    from,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.body,
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
