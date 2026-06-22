/**
 * M16-5: usage/audit из ЕДИНОГО источника — CreditTransaction (не клиентские счётчики). Один helper для Billing UI и
 * Reports → одинаковые totals. spend = только реальные DEBIT (blocked attempts не пишут ledger → в spend не входят).
 * Период — текущий billing-период (balance.periodStart). Breakdown по модулям (source), bulk-срез, grants, adjustments.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UsageReport {
  periodStart: string | null;
  totalSpent: number;
  granted: number;
  byModule: Record<string, number>; // spend (DEBIT abs) по source: AI_ATTRIBUTE/RESEARCH/ENRICHMENT/AUTO_RESPONSE/...
  bulkSpend: number; // срез: spend, прошедший через bulk-прогоны (bulkRunId != null) — НЕ добавляется к total отдельно
  adjustments: { count: number; entries: { before: unknown; after: unknown; reason: string | null; at: string }[] };
}

export async function getUsage(orgId: string): Promise<UsageReport> {
  const bal = await prisma.creditBalance.findUnique({ where: { orgId }, select: { periodStart: true } });
  const periodStart = bal?.periodStart ?? new Date(0);
  const [debits, grantAgg, bulkAgg, adjRows] = await Promise.all([
    prisma.creditTransaction.groupBy({ by: ['source'], where: { orgId, type: 'DEBIT', createdAt: { gte: periodStart } }, _sum: { amount: true } }),
    prisma.creditTransaction.aggregate({ where: { orgId, type: { in: ['GRANT', 'RESET', 'PURCHASE'] }, createdAt: { gte: periodStart } }, _sum: { amount: true } }),
    prisma.creditTransaction.aggregate({ where: { orgId, type: 'DEBIT', bulkRunId: { not: null }, createdAt: { gte: periodStart } }, _sum: { amount: true } }),
    prisma.creditTransaction.findMany({ where: { orgId, type: 'ADJUSTMENT' }, orderBy: { createdAt: 'desc' }, take: 10, select: { metadata: true, createdAt: true, reason: true } }),
  ]);
  const byModule: Record<string, number> = {};
  let totalSpent = 0;
  for (const d of debits) { const abs = -(d._sum.amount ?? 0); byModule[d.source] = abs; totalSpent += abs; }
  return {
    periodStart: bal?.periodStart?.toISOString() ?? null,
    totalSpent,
    granted: grantAgg._sum.amount ?? 0,
    byModule,
    bulkSpend: -(bulkAgg._sum.amount ?? 0),
    adjustments: { count: adjRows.length, entries: adjRows.map((a) => ({ before: (a.metadata as any)?.before ?? null, after: (a.metadata as any)?.after ?? null, reason: a.reason, at: a.createdAt.toISOString() })) },
  };
}
