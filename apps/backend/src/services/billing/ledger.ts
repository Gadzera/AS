/**
 * M16-1: единый hardened credit-ledger. Все денежные движения идут ОДНИМ путём с записью CreditTransaction.
 * debitCredits — RACE-SAFE + ИДЕМПОТЕНТНЫЙ (idempotencyKey ОБЯЗАТЕЛЕН для product-debits; 5 параллельных с одним
 * ключом → одна ledger-строка, баланс списан РАЗ). negative balance невозможен (условный update remaining>=amount).
 * grant/purchase/refund/resetMonthly — тоже через ledger, идемпотентно по ключу. reconcileBalance — PERIOD-AWARE
 * (used = Σ DEBIT − REFUND за ТЕКУЩИЙ период; расхождение → ADJUSTMENT с {before,after,reason}).
 */
import { CreditTransactionType, CreditSource, Prisma, PrismaClient } from '@prisma/client';
import { InsufficientCreditsError, PLAN_MONTHLY_CREDITS } from '../ai/credits';

const prisma = new PrismaClient();
const DEFAULT_MONTHLY = 1500;

export interface LedgerResult { ok: boolean; duplicate: boolean; balanceAfter: number; transactionId?: string }

/** Гарантирует строку баланса (с месячным грантом по тарифу). */
async function ensureBalance(orgId: string) {
  const existing = await prisma.creditBalance.findUnique({ where: { orgId } });
  if (existing) return existing;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const monthly = PLAN_MONTHLY_CREDITS[org?.plan ?? ''] ?? DEFAULT_MONTHLY;
  return prisma.creditBalance.create({ data: { orgId, monthlyCredits: monthly, purchasedCredits: 0, usedCredits: 0, remainingCredits: monthly } });
}

/**
 * M16-4: единый GUARD платных операций — вызывается ДО LLM/provider/network work. Недостаточно → бросает
 * InsufficientCreditsError {code:'INSUFFICIENT_CREDITS', required, available, source} → 402 (без AiRun/ledger/работы).
 * Атомарная гарантия «no negative» — на самом списании (debitCredits, conditional update); guard — ранний отсев.
 */
export async function assertCredits(orgId: string, required: number, source: CreditSource): Promise<void> {
  if (required <= 0) return;
  const bal = await ensureBalance(orgId);
  if (bal.remainingCredits < required) {
    throw new InsufficientCreditsError('Недостаточно AI-кредитов', { required, available: bal.remainingCredits, source });
  }
}

export interface DebitParams {
  orgId: string; amount: number; source: CreditSource; idempotencyKey: string;
  reason?: string; userId?: string | null; aiRunId?: string | null; bulkRunId?: string | null; replyDraftId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Списание: race-safe + идемпотентное. idempotencyKey ОБЯЗАТЕЛЕН. */
export async function debitCredits(p: DebitParams): Promise<LedgerResult> {
  if (!p.idempotencyKey) throw new Error('debitCredits: idempotencyKey is required for paid debits');
  if (p.amount <= 0) throw new Error('debitCredits: amount must be positive');
  await ensureBalance(p.orgId);

  // быстрый путь — уже списано по этому ключу.
  const pre = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, balanceAfter: true } });
  if (pre) return { ok: true, duplicate: true, balanceAfter: pre.balanceAfter, transactionId: pre.id };

  try {
    return await prisma.$transaction(async (tx) => {
      const bal = await tx.creditBalance.findUnique({ where: { orgId: p.orgId } });
      if (!bal) throw new InsufficientCreditsError('Баланс кредитов не найден');
      // 1. CLAIM по idempotencyKey: ledger-строку создаём ПЕРВОЙ (unique-index сериализует параллельные).
      const row = await tx.creditTransaction.create({
        data: {
          orgId: p.orgId, balanceId: bal.id, userId: p.userId ?? null, aiRunId: p.aiRunId ?? null, bulkRunId: p.bulkRunId ?? null, replyDraftId: p.replyDraftId ?? null,
          source: p.source, idempotencyKey: p.idempotencyKey, type: CreditTransactionType.DEBIT, amount: -p.amount, balanceAfter: 0,
          reason: p.reason ?? null, metadata: (p.metadata ?? {}) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      // 2. атомарное условное списание (remaining>=amount → ровно один эффект; иначе rollback всей tx).
      const upd = await tx.creditBalance.updateMany({ where: { orgId: p.orgId, remainingCredits: { gte: p.amount } }, data: { remainingCredits: { decrement: p.amount }, usedCredits: { increment: p.amount } } });
      if (upd.count === 0) throw new InsufficientCreditsError();
      const fresh = await tx.creditBalance.findUnique({ where: { orgId: p.orgId }, select: { remainingCredits: true } });
      await tx.creditTransaction.update({ where: { id: row.id }, data: { balanceAfter: fresh!.remainingCredits } });
      return { ok: true, duplicate: false, balanceAfter: fresh!.remainingCredits, transactionId: row.id };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      // гонка по idempotencyKey: победитель уже списал → дубль без эффекта.
      const ex = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, balanceAfter: true } });
      if (ex) return { ok: true, duplicate: true, balanceAfter: ex.balanceAfter, transactionId: ex.id };
    }
    throw e;
  }
}

interface CreditParams { orgId: string; amount: number; source: CreditSource; idempotencyKey: string; reason?: string; userId?: string | null; metadata?: Record<string, unknown> }

/** Начисление (admin grant / refund) — идемпотентно. kind: GRANT|REFUND|PURCHASE. */
async function creditUp(p: CreditParams, type: CreditTransactionType, bucket: 'remaining' | 'purchased' | 'refund'): Promise<LedgerResult> {
  if (!p.idempotencyKey) throw new Error('credit: idempotencyKey is required');
  await ensureBalance(p.orgId);
  const pre = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, balanceAfter: true } });
  if (pre) return { ok: true, duplicate: true, balanceAfter: pre.balanceAfter, transactionId: pre.id };
  try {
    return await prisma.$transaction(async (tx) => {
      const bal = await tx.creditBalance.findUnique({ where: { orgId: p.orgId } });
      if (!bal) throw new Error('balance not found');
      const row = await tx.creditTransaction.create({ data: { orgId: p.orgId, balanceId: bal.id, userId: p.userId ?? null, source: p.source, idempotencyKey: p.idempotencyKey, type, amount: p.amount, balanceAfter: 0, reason: p.reason ?? null, metadata: (p.metadata ?? {}) as Prisma.InputJsonValue }, select: { id: true } });
      const data: Prisma.CreditBalanceUpdateInput = bucket === 'purchased'
        ? { purchasedCredits: { increment: p.amount }, remainingCredits: { increment: p.amount } }
        : bucket === 'refund'
          ? { usedCredits: { decrement: p.amount }, remainingCredits: { increment: p.amount } }
          : { remainingCredits: { increment: p.amount } };
      await tx.creditBalance.update({ where: { orgId: p.orgId }, data });
      const fresh = await tx.creditBalance.findUnique({ where: { orgId: p.orgId }, select: { remainingCredits: true } });
      await tx.creditTransaction.update({ where: { id: row.id }, data: { balanceAfter: fresh!.remainingCredits } });
      return { ok: true, duplicate: false, balanceAfter: fresh!.remainingCredits, transactionId: row.id };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      const ex = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, balanceAfter: true } });
      if (ex) return { ok: true, duplicate: true, balanceAfter: ex.balanceAfter, transactionId: ex.id };
    }
    throw e;
  }
}

export const grantCredits = (p: CreditParams) => creditUp(p, CreditTransactionType.GRANT, 'remaining');
export const purchaseCredits = (p: CreditParams) => creditUp(p, CreditTransactionType.PURCHASE, 'purchased');
export const refundCredits = (p: CreditParams) => creditUp(p, CreditTransactionType.REFUND, 'refund');

/**
 * M16-2 RESET: monthlyCredits=planCredits; usedCredits=0; purchasedCredits сохраняется;
 * remaining=monthly+purchased; period из Stripe. Идемпотентно по ключу (один invoice = один reset).
 */
export async function resetMonthly(p: { orgId: string; planCredits: number; periodStart?: Date; periodEnd?: Date | null; idempotencyKey: string; reason?: string }): Promise<LedgerResult> {
  if (!p.idempotencyKey) throw new Error('resetMonthly: idempotencyKey is required');
  await ensureBalance(p.orgId);
  const pre = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, balanceAfter: true } });
  if (pre) return { ok: true, duplicate: true, balanceAfter: pre.balanceAfter, transactionId: pre.id };
  try {
    return await prisma.$transaction(async (tx) => {
      const bal = await tx.creditBalance.findUnique({ where: { orgId: p.orgId } });
      if (!bal) throw new Error('balance not found');
      const remaining = p.planCredits + bal.purchasedCredits;
      const row = await tx.creditTransaction.create({ data: { orgId: p.orgId, balanceId: bal.id, source: CreditSource.STRIPE, idempotencyKey: p.idempotencyKey, type: CreditTransactionType.RESET, amount: p.planCredits, balanceAfter: remaining, reason: p.reason ?? 'monthly reset', metadata: { planCredits: p.planCredits, purchasedKept: bal.purchasedCredits } as Prisma.InputJsonValue }, select: { id: true } });
      await tx.creditBalance.update({ where: { orgId: p.orgId }, data: { monthlyCredits: p.planCredits, usedCredits: 0, remainingCredits: remaining, ...(p.periodStart ? { periodStart: p.periodStart } : {}), ...(p.periodEnd !== undefined ? { periodEnd: p.periodEnd } : {}) } });
      return { ok: true, duplicate: false, balanceAfter: remaining, transactionId: row.id };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      const ex = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, balanceAfter: true } });
      if (ex) return { ok: true, duplicate: true, balanceAfter: ex.balanceAfter, transactionId: ex.id };
    }
    throw e;
  }
}

/**
 * PERIOD-AWARE reconcile: usedThisPeriod = Σ|DEBIT| − Σ REFUND за период (createdAt ≥ periodStart);
 * remaining = monthly + purchased − used. Расхождение → ADJUSTMENT-транзакция {before, after, reason}.
 */
export async function reconcileBalance(orgId: string): Promise<{ ok: boolean; adjusted: boolean; before?: { used: number; remaining: number }; after?: { used: number; remaining: number } }> {
  const bal = await ensureBalance(orgId);
  const periodStart = bal.periodStart ?? new Date(0);
  const [debitAgg, refundAgg] = await Promise.all([
    prisma.creditTransaction.aggregate({ where: { orgId, type: CreditTransactionType.DEBIT, createdAt: { gte: periodStart } }, _sum: { amount: true } }),
    prisma.creditTransaction.aggregate({ where: { orgId, type: CreditTransactionType.REFUND, createdAt: { gte: periodStart } }, _sum: { amount: true } }),
  ]);
  const debitsAbs = -(debitAgg._sum.amount ?? 0); // amount у DEBIT отрицательный
  const refundsAbs = refundAgg._sum.amount ?? 0;
  const expectedUsed = Math.max(0, debitsAbs - refundsAbs);
  const expectedRemaining = Math.max(0, bal.monthlyCredits + bal.purchasedCredits - expectedUsed);

  if (bal.usedCredits === expectedUsed && bal.remainingCredits === expectedRemaining) return { ok: true, adjusted: false };

  const before = { used: bal.usedCredits, remaining: bal.remainingCredits };
  const after = { used: expectedUsed, remaining: expectedRemaining };
  await prisma.$transaction([
    prisma.creditBalance.update({ where: { orgId }, data: { usedCredits: expectedUsed, remainingCredits: expectedRemaining } }),
    prisma.creditTransaction.create({ data: { orgId, balanceId: bal.id, source: CreditSource.ADJUSTMENT, type: CreditTransactionType.ADJUSTMENT, amount: expectedRemaining - before.remaining, balanceAfter: expectedRemaining, reason: 'reconcile', metadata: { before, after, reason: 'period-aware reconcile' } as Prisma.InputJsonValue } }),
  ]);
  return { ok: true, adjusted: true, before, after };
}
