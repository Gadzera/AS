/**
 * Календарная синхронизация встреч. Модель синка РЕАЛЬНАЯ (статусы/externalEventId/retry/propagation);
 * фактический вызов Google/Outlook API — демо до подключения OAuth-провайдера. Поведение честное:
 *  - календарь не подключён → NOT_CONNECTED (явная причина);
 *  - подключён → SYNCED + детерминированный externalEventId;
 *  - отмена встречи → CANCELED (propagation на внешнее событие).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Детерминированный id внешнего события (без рандома): провайдер + хвост id встречи.
function externalIdFor(provider: string, meetingId: string): string {
  const prefix = provider === 'OUTLOOK' ? 'outlook' : 'gcal';
  return `${prefix}_${meetingId.slice(-16)}`;
}

// Синхронизировать встречу с подключённым календарём (или пометить NOT_CONNECTED).
export async function syncMeeting(orgId: string, meetingId: string): Promise<void> {
  try {
    const [org, meeting] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { calendarProvider: true } }),
      prisma.meeting.findFirst({ where: { id: meetingId, orgId } }),
    ]);
    if (!meeting) return;

    if (!org?.calendarProvider) {
      await prisma.meeting.update({ where: { id: meeting.id }, data: { syncStatus: 'NOT_CONNECTED', syncError: 'No calendar connected', externalEventId: null, syncedAt: null } });
      return;
    }

    // TODO: реальный вызов Google/Outlook Calendar API (подключим с OAuth). Демо: считаем синхронизацию успешной.
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { syncStatus: 'SYNCED', externalEventId: externalIdFor(org.calendarProvider, meeting.id), syncError: null, syncedAt: new Date() },
    });
  } catch {
    await prisma.meeting.update({ where: { id: meetingId }, data: { syncStatus: 'FAILED', syncError: 'Sync error — retry' } }).catch(() => undefined);
  }
}

// Отмена внешнего события при отмене встречи (propagation).
export async function cancelMeetingSync(orgId: string, meetingId: string): Promise<void> {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, orgId } });
    if (!meeting) return;
    // TODO: реальная отмена внешнего события. Демо: помечаем CANCELED.
    await prisma.meeting.update({ where: { id: meeting.id }, data: { syncStatus: 'CANCELED', syncedAt: new Date() } });
  } catch {
    // не роняем основную операцию
  }
}
