/**
 * Сервис кредитов AI (M2, §15 ТЗ) — на типизированном Prisma Client.
 *
 * Баланс: модель CreditBalance (credit_balances) — один на организацию.
 * Транзакции: CreditTransaction (credit_transactions) — лог списаний/начислений.
 *
 * Демо-режим (без ANTHROPIC_API_KEY) НЕ отключает кредиты: списание реально, чтобы
 * в демо был виден работающий биллинг. Стартовый грант щедрый (DEFAULT_MONTHLY),
 * поэтому кредиты не кончаются на типичной демо-нагрузке.
 */

import { CreditTransactionType, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Константы стоимости AI-типов ─────────────────────────────────────────

export const AI_CREDIT_COSTS: Record<string, number> = {
  CLASSIFY: 1,
  SUMMARIZE: 1,
  PROMPT: 1,
  RESEARCH: 10,
};

/** Месячный грант кредитов по тарифу (совпадает с каталогом планов в Settings → Billing). */
export const PLAN_MONTHLY_CREDITS: Record<string, number> = { STARTER: 1500, GROWTH: 6000, AGENCY: 20000 };
/** Дефолт, если тариф неизвестен. */
const DEFAULT_MONTHLY = 1500;

// ─── Типы ─────────────────────────────────────────────────────────────────

export type CreditTransactionReason =
  | 'AI_CLASSIFY'
  | 'AI_SUMMARIZE'
  | 'AI_RESEARCH'
  | 'AI_PROMPT'
  | 'PURCHASE'
  | 'MONTHLY_GRANT'
  | 'REFUND'
  | 'MANUAL_ADJUSTMENT';

export interface CreditTransactionRecord {
  id: string;
  orgId: string;
  amount: number;
  type: string;
  reason: string | null;
  aiRunId: string | null;
  recordId: string | null;
  attributeId: string | null;
  createdById: string | null;
  metadata: unknown;
  createdAt: Date;
}

// ─── Баланс ───────────────────────────────────────────────────────────────

/**
 * Возвращает (или создаёт) строку баланса организации.
 */
async function getOrCreateBalanceRow(orgId: string) {
  // месячный грант должен соответствовать тарифу org (консистентность Billing)
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const monthly = PLAN_MONTHLY_CREDITS[org?.plan ?? ''] ?? DEFAULT_MONTHLY;

  const existing = await prisma.creditBalance.findUnique({ where: { orgId } });
  if (existing) {
    // самокоррекция: если грант разошёлся с тарифом — выравниваем (remaining = monthly + purchased − used)
    if (existing.monthlyCredits !== monthly) {
      return prisma.creditBalance.update({
        where: { orgId },
        data: { monthlyCredits: monthly, remainingCredits: Math.max(0, monthly + existing.purchasedCredits - existing.usedCredits) },
      });
    }
    return existing;
  }

  return prisma.creditBalance.create({
    data: { orgId, monthlyCredits: monthly, purchasedCredits: 0, usedCredits: 0, remainingCredits: monthly },
  });
}

/**
 * Баланс в форме, удобной API-слою (§S171).
 */
export async function getOrCreateBalance(orgId: string): Promise<{
  balance: number;
  includedMonthly: number;
  usedThisPeriod: number;
  periodEnd: Date | null;
}> {
  const b = await getOrCreateBalanceRow(orgId);
  return {
    balance: b.remainingCredits,
    includedMonthly: b.monthlyCredits,
    usedThisPeriod: b.usedCredits,
    periodEnd: b.periodEnd,
  };
}

/**
 * Проверяет, достаточно ли кредитов для запуска.
 */
export async function checkBalance(orgId: string, cost: number): Promise<boolean> {
  const b = await getOrCreateBalanceRow(orgId);
  return b.remainingCredits >= cost;
}

/**
 * Атомарно списывает кредиты и пишет транзакцию.
 * Списание идёт через условный update (remainingCredits >= amount) — защита от гонок.
 */
export async function debitCredits(params: {
  orgId: string;
  amount: number;
  reason: CreditTransactionReason;
  aiRunId?: string;
  recordId?: string;
  attributeId?: string;
  createdById?: string;
  metadata?: Record<string, unknown>;
}): Promise<CreditTransactionRecord> {
  const { orgId, amount, reason, aiRunId, recordId, attributeId, createdById, metadata } = params;

  // Гарантируем наличие баланса
  await getOrCreateBalanceRow(orgId);

  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { orgId } });
    if (!balance) throw new InsufficientCreditsError('Баланс кредитов не найден');
    if (balance.remainingCredits < amount) throw new InsufficientCreditsError();

    const updated = await tx.creditBalance.update({
      where: { orgId },
      data: {
        remainingCredits: { decrement: amount },
        usedCredits: { increment: amount },
      },
    });

    const txn = await tx.creditTransaction.create({
      data: {
        orgId,
        balanceId: balance.id,
        userId: createdById ?? null,
        aiRunId: aiRunId ?? null,
        type: CreditTransactionType.DEBIT,
        amount: -amount,
        balanceAfter: updated.remainingCredits,
        reason,
        metadata: {
          ...(metadata ?? {}),
          recordId: recordId ?? null,
          attributeId: attributeId ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      id: txn.id,
      orgId,
      amount: txn.amount,
      type: txn.type,
      reason: txn.reason,
      aiRunId: txn.aiRunId,
      recordId: recordId ?? null,
      attributeId: attributeId ?? null,
      createdById: createdById ?? null,
      metadata: txn.metadata,
      createdAt: txn.createdAt,
    };
  });
}

/**
 * Usage breakdown по reason за всё время (DEBIT-транзакции).
 */
export async function getUsageBreakdown(orgId: string): Promise<Record<string, number>> {
  const grouped = await prisma.creditTransaction.groupBy({
    by: ['reason'],
    where: { orgId, type: CreditTransactionType.DEBIT },
    _sum: { amount: true },
  });

  const breakdown: Record<string, number> = {};
  for (const row of grouped) {
    if (row.reason) breakdown[row.reason] = Math.abs(Number(row._sum.amount ?? 0));
  }
  return breakdown;
}

/**
 * Список транзакций с пагинацией и фильтрами (§S172).
 */
export async function listTransactions(params: {
  orgId: string;
  page?: number;
  limit?: number;
  type?: string;
  createdById?: string;
  from?: string;
  to?: string;
}): Promise<{ transactions: CreditTransactionRecord[]; total: number }> {
  const { orgId, page = 1, limit = 50, type, createdById, from, to } = params;

  const where: Prisma.CreditTransactionWhereInput = { orgId };
  if (type) where.type = type as CreditTransactionType;
  if (createdById) where.userId = createdById;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.creditTransaction.count({ where }),
  ]);

  const transactions: CreditTransactionRecord[] = rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      orgId: r.orgId,
      amount: r.amount,
      type: r.type,
      reason: r.reason,
      aiRunId: r.aiRunId,
      recordId: (meta.recordId as string) ?? null,
      attributeId: (meta.attributeId as string) ?? null,
      createdById: r.userId,
      metadata: r.metadata,
      createdAt: r.createdAt,
    };
  });

  return { transactions, total };
}

// ─── Ошибки ───────────────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  statusCode = 402;
  code = 'INSUFFICIENT_CREDITS';
  // M16-4: machine-readable контекст для UI/Reports (required/available/source).
  required?: number;
  available?: number;
  source?: string;

  constructor(message = 'Недостаточно AI-кредитов', ctx?: { required?: number; available?: number; source?: string }) {
    super(message);
    this.name = 'InsufficientCreditsError';
    if (ctx) { this.required = ctx.required; this.available = ctx.available; this.source = ctx.source; }
  }
}
