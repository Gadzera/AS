/**
 * Уведомления (M22-1). Notification = СОБЫТИЕ; NotificationRecipient = адресаты + per-user read-state (правка GPT).
 * Персональные (mention/reply) → recipientUserIds. Broadcast (legacy reply/meeting/call/workflow) → все активные члены org.
 * Идемпотентность: dedupeKey не плодит дубль активного уведомления; повтор «оживляет» (recipients → unread снова).
 */

import { Prisma, PrismaClient, NotificationSource, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

export interface NotifyInput {
  orgId: string;
  source: NotificationSource;
  type?: NotificationType; // default SYSTEM
  title: string;
  body?: string;
  leadId?: string | null;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
  /** Персональные адресаты. Если не задано → broadcast всем активным членам org. */
  recipientUserIds?: string[];
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    let notificationId: string | null = null;
    let reactivated = false;

    // дедуп по dedupeKey (любой статус — @@unique[orgId,dedupeKey] гарантирует одну строку на ключ).
    const reactivate = async (id: string) => { await prisma.notification.update({ where: { id }, data: { status: 'NEW', updatedAt: new Date() } }); notificationId = id; reactivated = true; };
    if (input.dedupeKey) {
      const existing = await prisma.notification.findFirst({ where: { orgId: input.orgId, dedupeKey: input.dedupeKey }, select: { id: true } });
      if (existing) await reactivate(existing.id);
    }

    if (!notificationId) {
      try {
        const created = await prisma.notification.create({
          data: {
            orgId: input.orgId,
            source: input.source,
            type: input.type ?? 'SYSTEM',
            title: input.title,
            body: input.body ?? null,
            leadId: input.leadId ?? null,
            entityType: input.entityType ?? null,
            entityId: input.entityId ?? null,
            dedupeKey: input.dedupeKey ?? null,
          },
          select: { id: true },
        });
        notificationId = created.id;
      } catch (e) {
        // P2002: конкурентный notify() создал строку с тем же ключом между find и create → реактивируем её.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && input.dedupeKey) {
          const ex = await prisma.notification.findFirst({ where: { orgId: input.orgId, dedupeKey: input.dedupeKey }, select: { id: true } });
          if (ex) await reactivate(ex.id);
        }
        if (!notificationId) throw e;
      }
    }

    // адресаты: заданные персонально, иначе все активные члены org (broadcast)
    let userIds = input.recipientUserIds;
    if (!userIds) {
      const members = await prisma.user.findMany({ where: { orgId: input.orgId, isActive: true }, select: { id: true } });
      userIds = members.map((m) => m.id);
    }
    userIds = [...new Set(userIds.filter(Boolean))];
    if (userIds.length) {
      await prisma.notificationRecipient.createMany({ data: userIds.map((uid) => ({ orgId: input.orgId, notificationId: notificationId!, userId: uid })), skipDuplicates: true });
      // повтор события (dedupe) → снова непрочитано для адресатов
      if (reactivated) await prisma.notificationRecipient.updateMany({ where: { notificationId, userId: { in: userIds } }, data: { readAt: null } });
    }
  } catch {
    // уведомления не должны ломать бизнес-операцию
  }
}
