/**
 * M11-9: переупорядочивание шагов последовательности с ПОЛИТИКОЙ безопасной миграции активных
 * enrollment'ов. Единый источник логики (route + тесты зовут это).
 *
 * Политика (нота GPT): reorder НЕ ломает уже активных enrolled лидов молча. currentStep каждого
 * активного enrollment'а мигрируется по ИДЕНТИЧНОСТИ шага — «следующий шаг» лида остаётся тем же
 * логическим шагом после перестановки. Новые enrollments естественно используют новый порядок.
 * Возвращает migratedEnrollments (прозрачность изменения).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReorderResult {
  ok: boolean;
  error?: string;
  reordered?: number;
  activeEnrollments?: number;
  migratedEnrollments?: number;
}

export async function reorderSequenceSteps(campaignId: string, orderedIds: string[]): Promise<ReorderResult> {
  const steps = await prisma.sequence.findMany({ where: { campaignId }, orderBy: { stepNumber: 'asc' }, select: { id: true } });
  const oldOrder = steps.map((s) => s.id);

  // order validation: orderedIds — перестановка существующих шагов (тот же набор, без дублей, та же длина).
  const validPermutation = orderedIds.length === oldOrder.length
    && new Set(orderedIds).size === orderedIds.length
    && orderedIds.every((id) => oldOrder.includes(id));
  if (!validPermutation) return { ok: false, error: 'orderedIds must be a permutation of the existing step ids' };

  // Снимок «следующего шага» (по идентичности) каждого активного enrollment ДО перестановки.
  const active = await prisma.campaignLead.findMany({
    where: { campaignId, status: { in: ['PENDING', 'ACTIVE', 'PAUSED'] } },
    select: { id: true, currentStep: true },
  });
  const pendingStepId = new Map<string, string | null>();
  for (const e of active) pendingStepId.set(e.id, e.currentStep < oldOrder.length ? oldOrder[e.currentStep] : null);

  let migrated = 0;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.sequence.update({ where: { id: orderedIds[i] }, data: { stepNumber: i + 1 } });
    }
    for (const e of active) {
      const pid = pendingStepId.get(e.id) ?? null;
      if (pid == null) continue; // лид уже прошёл все шаги — структуру не навязываем.
      const newIdx = orderedIds.indexOf(pid);
      if (newIdx !== e.currentStep) { await tx.campaignLead.update({ where: { id: e.id }, data: { currentStep: newIdx } }); migrated++; }
    }
  });

  return { ok: true, reordered: orderedIds.length, activeEnrollments: active.length, migratedEnrollments: migrated };
}
