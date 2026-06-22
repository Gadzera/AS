/**
 * Технический audit log для access-sensitive действий (наблюдаемость прод-готовности).
 * Запись «кто/что/когда» — никогда не роняет основной запрос (ошибки глотаются).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditEntry {
  orgId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  summary: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: entry.orgId,
        actorId: entry.actorId ?? null,
        actorName: entry.actorName ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        summary: entry.summary,
      },
    });
  } catch {
    // аудит не должен ломать бизнес-операцию
  }
}
