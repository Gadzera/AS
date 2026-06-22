/**
 * Email-дайджест уведомлений (M22-2, S399). Строится ИЗ NotificationRecipient PER-USER (правка GPT).
 * Access re-check: record-уведомления, к которым пользователь ПОТЕРЯЛ READ после создания, → generic fallback
 * (без имени записи), не утекаем. Без SMTP → honest SKIPPED_NO_SMTP (НЕ fake success). Лог NotificationDigest.
 */
import { PrismaClient, DigestStatus } from '@prisma/client';
import { resolveAccess, meets } from './permissions';
import { isSmtpConfigured, sendEmail } from './email';

const prisma = new PrismaClient();

export type DigestItem = { id: string; type: string; title: string; body: string | null; createdAt: Date; redacted: boolean };
export type DigestPreview = { items: DigestItem[]; count: number; redactedCount: number; smtpConfigured: boolean; periodStart: Date; periodEnd: Date };

// собрать непрочитанные уведомления пользователя + access-фильтр record-ссылок
export async function buildUserDigest(orgId: string, userId: string, sinceHours = 24): Promise<DigestPreview> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - sinceHours * 3600_000);
  const recips = await prisma.notificationRecipient.findMany({
    where: { orgId, userId, readAt: null, createdAt: { gte: periodStart } },
    include: { notification: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  // роль пользователя (для resolveAccess)
  const user = await prisma.user.findFirst({ where: { id: userId, orgId }, select: { role: true } });
  // objectId записей для access-recheck (record-уведомления)
  const recordIds = [...new Set(recips.map((r) => r.notification.entityType === 'record' ? r.notification.entityId : null).filter(Boolean) as string[])];
  const records = recordIds.length ? await prisma.record.findMany({ where: { id: { in: recordIds }, orgId }, select: { id: true, objectId: true } }) : [];
  const objByRec = new Map(records.map((r) => [r.id, r.objectId]));

  const items: DigestItem[] = [];
  let redactedCount = 0;
  for (const r of recips) {
    const n = r.notification;
    let redacted = false;
    if (n.entityType === 'record' && n.entityId) {
      // адверс-ревью #2: fail-closed — нет user / нет объекта / нет READ СЕЙЧАС → generic fallback (не светим имя записи)
      const objectId = objByRec.get(n.entityId);
      const ok = !!user && !!objectId && meets(await resolveAccess(orgId, { userId, role: user.role }, 'OBJECT', objectId), 'READ');
      if (!ok) redacted = true;
    }
    items.push({
      id: n.id, type: n.type,
      title: redacted ? `${n.type === 'MENTION' ? 'You were mentioned' : n.type === 'REPLY' ? 'New reply' : 'Notification'} on a record you no longer have access to` : n.title,
      body: redacted ? null : n.body,
      createdAt: r.createdAt, redacted,
    });
    if (redacted) redactedCount++;
  }
  return { items, count: items.length, redactedCount, smtpConfigured: isSmtpConfigured(), periodStart, periodEnd };
}

// отправить (или honest-skip) дайджест пользователю + записать лог. email берём актуальный.
export async function sendUserDigest(orgId: string, userId: string, sinceHours = 24): Promise<{ status: DigestStatus; count: number; redactedCount: number; messageId: string | null }> {
  const digest = await buildUserDigest(orgId, userId, sinceHours);
  const user = await prisma.user.findFirst({ where: { id: userId, orgId, isActive: true }, select: { email: true, name: true } });

  let status: DigestStatus;
  let messageId: string | null = null;

  if (digest.count === 0) {
    status = 'EMPTY';
  } else if (!digest.smtpConfigured) {
    status = 'SKIPPED_NO_SMTP'; // honest: без SMTP НЕ делаем вид, что отправили
  } else if (!user) {
    status = 'EMPTY';
  } else {
    const lines = digest.items.map((i) => `• [${i.type}] ${i.title}${i.body ? ` — ${i.body}` : ''}`).join('\n');
    const r = await sendEmail({ to: user.email, subject: `${digest.count} new notification${digest.count === 1 ? '' : 's'} · AISDR digest`, body: `Hi ${user.name},\n\nYou have ${digest.count} unread notification(s):\n\n${lines}\n\nOpen AISDR to view them.` });
    messageId = r.messageId; status = 'SENT';
  }

  await prisma.notificationDigest.create({ data: { orgId, userId, periodStart: digest.periodStart, periodEnd: digest.periodEnd, notificationCount: digest.count, status, messageId } });
  return { status, count: digest.count, redactedCount: digest.redactedCount, messageId };
}

// last digest per user (для идемпотентности воркера — не слать чаще раза в период)
export async function lastDigestAt(orgId: string, userId: string): Promise<Date | null> {
  const d = await prisma.notificationDigest.findFirst({ where: { orgId, userId, status: { in: ['SENT', 'SKIPPED_NO_SMTP'] } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  return d?.createdAt ?? null;
}

// Воркер-свип: дайджест всем активным пользователям с непрочитанным, кого не дайджестили за minGapHours.
export async function runDigestSweep(minGapHours = 20): Promise<{ processed: number; sent: number; skipped: number }> {
  const now = Date.now();
  // пользователи с непрочитанным
  const recips = await prisma.notificationRecipient.findMany({ where: { readAt: null }, select: { orgId: true, userId: true }, distinct: ['orgId', 'userId'] });
  let processed = 0, sent = 0, skipped = 0;
  for (const r of recips) {
    const last = await lastDigestAt(r.orgId, r.userId);
    if (last && now - last.getTime() < minGapHours * 3600_000) continue; // идемпотентность периода
    const res = await sendUserDigest(r.orgId, r.userId).catch(() => null);
    processed++;
    if (res?.status === 'SENT') sent++; else if (res?.status === 'SKIPPED_NO_SMTP') skipped++;
  }
  return { processed, sent, skipped };
}
