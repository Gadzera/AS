/**
 * M12-3: выбор и ротация почтовых ящиков отправки.
 * Берём только рабочие ящики (CONNECTED/WARMING), считаем per-mailbox дневную ёмкость (warmup-aware),
 * выбираем наименее загруженный (ротация распределяет нагрузку, а не всегда первый). Если все исчерпаны —
 * сообщаем ALL_AT_CAPACITY; если рабочих ящиков нет — NO_MAILBOX.
 */
import { PrismaClient } from '@prisma/client';
import { warmupLimit } from '../lib/warmup';

const prisma = new PrismaClient();

export interface SelectedMailbox {
  id: string;
  address: string;
  fromName: string | null;
  provider: string;
  remaining: number;
  effectiveLimit: number;
}

export type MailboxSelectReason = 'OK' | 'NO_MAILBOX' | 'ALL_AT_CAPACITY';

/**
 * Дневной лимит конкретного ящика с учётом прогрева. CONNECTED (прогрет) — полный dailyLimit;
 * WARMING — ramp по warmupDay (тот же tiering, что lib/warmup, но по «возрасту» ящика), потолок dailyLimit.
 */
export function mailboxDailyLimit(mb: { status: string; dailyLimit: number; warmupDay: number }): number {
  if (mb.status === 'CONNECTED') return mb.dailyLimit;
  return warmupLimit(mb.warmupDay, mb.dailyLimit); // WARMING → прогревочный потолок
}

/** Выбрать ящик под отправку: рабочий + под ёмкостью + наименее загруженный. */
export async function selectSendableMailbox(orgId: string): Promise<{ mailbox: SelectedMailbox | null; reason: MailboxSelectReason }> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const mailboxes = await prisma.mailbox.findMany({
    where: { orgId, archivedAt: null, status: { in: ['CONNECTED', 'WARMING'] } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  if (mailboxes.length === 0) return { mailbox: null, reason: 'NO_MAILBOX' };

  const candidates: { mb: (typeof mailboxes)[number]; remaining: number; limit: number }[] = [];
  for (const mb of mailboxes) {
    const sentToday = await prisma.message.count({
      where: { mailboxId: mb.id, direction: 'OUTBOUND', status: 'SENT', sentAt: { gte: todayStart } },
    });
    const limit = mailboxDailyLimit(mb);
    const remaining = limit - sentToday;
    if (remaining > 0) candidates.push({ mb, remaining, limit });
  }
  if (candidates.length === 0) return { mailbox: null, reason: 'ALL_AT_CAPACITY' };

  // Ротация: наименее загруженный (макс. остаток ёмкости). Tiebreak: default → раньше созданный.
  candidates.sort((a, b) =>
    b.remaining - a.remaining ||
    (b.mb.isDefault ? 1 : 0) - (a.mb.isDefault ? 1 : 0) ||
    a.mb.createdAt.getTime() - b.mb.createdAt.getTime()
  );
  const c = candidates[0];
  return {
    mailbox: { id: c.mb.id, address: c.mb.address, fromName: c.mb.fromName, provider: c.mb.provider, remaining: c.remaining, effectiveLimit: c.limit },
    reason: 'OK',
  };
}

/**
 * M14-4: ящик для ОТПРАВКИ ОТВЕТА. По правилу — тот же ящик, с которого ушло исходное исходящее (тред
 * остаётся в одном ящике), ЕСЛИ он ещё рабочий (CONNECTED/WARMING, не архив) и под дневной ёмкостью.
 * Иначе — безопасный fallback на общий выбор (selectSendableMailbox). Если рабочих ящиков нет — NO_MAILBOX.
 */
export async function resolveReplyMailbox(orgId: string, preferredMailboxId: string | null): Promise<{ mailbox: SelectedMailbox | null; reason: MailboxSelectReason; usedPreferred: boolean }> {
  if (preferredMailboxId) {
    const mb = await prisma.mailbox.findFirst({ where: { id: preferredMailboxId, orgId, archivedAt: null, status: { in: ['CONNECTED', 'WARMING'] } } });
    if (mb) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const sentToday = await prisma.message.count({ where: { mailboxId: mb.id, direction: 'OUTBOUND', status: 'SENT', sentAt: { gte: todayStart } } });
      const limit = mailboxDailyLimit(mb);
      const remaining = limit - sentToday;
      if (remaining > 0) {
        return { mailbox: { id: mb.id, address: mb.address, fromName: mb.fromName, provider: mb.provider, remaining, effectiveLimit: limit }, reason: 'OK', usedPreferred: true };
      }
    }
  }
  // Исходный ящик недоступен/исчерпан/неизвестен — безопасный fallback на общий выбор.
  const sel = await selectSendableMailbox(orgId);
  return { ...sel, usedPreferred: false };
}
