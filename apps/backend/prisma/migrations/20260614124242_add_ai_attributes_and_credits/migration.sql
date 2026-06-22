-- CreateEnum
CREATE TYPE "AttributeAiType" AS ENUM ('CLASSIFY', 'SUMMARIZE', 'RESEARCH', 'PROMPT');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('GRANT', 'PURCHASE', 'DEBIT', 'REFUND', 'RESET', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "crm_attributes" ADD COLUMN     "aiConfig" JSONB,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiGuidance" TEXT,
ADD COLUMN     "aiPrompt" TEXT,
ADD COLUMN     "aiType" "AttributeAiType";

-- CreateTable
CREATE TABLE "credit_balances" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 100,
    "purchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "remainingCredits" INTEGER NOT NULL DEFAULT 100,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "userId" TEXT,
    "aiRunId" TEXT,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "valueId" TEXT,
    "bulkRunId" TEXT,
    "requestedById" TEXT,
    "aiType" "AttributeAiType" NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "creditsCost" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "outputText" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_bulk_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "viewId" TEXT,
    "requestedById" TEXT,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "creditsReserved" INTEGER NOT NULL DEFAULT 0,
    "creditsSpent" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB,
    "recordIds" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_bulk_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_balances_orgId_key" ON "credit_balances"("orgId");

-- CreateIndex
CREATE INDEX "credit_balances_orgId_idx" ON "credit_balances"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_aiRunId_key" ON "credit_transactions"("aiRunId");

-- CreateIndex
CREATE INDEX "credit_transactions_orgId_idx" ON "credit_transactions"("orgId");

-- CreateIndex
CREATE INDEX "credit_transactions_balanceId_idx" ON "credit_transactions"("balanceId");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_idx" ON "credit_transactions"("userId");

-- CreateIndex
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions"("type");

-- CreateIndex
CREATE INDEX "credit_transactions_createdAt_idx" ON "credit_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "ai_runs_orgId_idx" ON "ai_runs"("orgId");

-- CreateIndex
CREATE INDEX "ai_runs_attributeId_idx" ON "ai_runs"("attributeId");

-- CreateIndex
CREATE INDEX "ai_runs_recordId_idx" ON "ai_runs"("recordId");

-- CreateIndex
CREATE INDEX "ai_runs_bulkRunId_idx" ON "ai_runs"("bulkRunId");

-- CreateIndex
CREATE INDEX "ai_runs_requestedById_idx" ON "ai_runs"("requestedById");

-- CreateIndex
CREATE INDEX "ai_runs_status_idx" ON "ai_runs"("status");

-- CreateIndex
CREATE INDEX "ai_runs_createdAt_idx" ON "ai_runs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_bulk_runs_orgId_idx" ON "ai_bulk_runs"("orgId");

-- CreateIndex
CREATE INDEX "ai_bulk_runs_attributeId_idx" ON "ai_bulk_runs"("attributeId");

-- CreateIndex
CREATE INDEX "ai_bulk_runs_viewId_idx" ON "ai_bulk_runs"("viewId");

-- CreateIndex
CREATE INDEX "ai_bulk_runs_requestedById_idx" ON "ai_bulk_runs"("requestedById");

-- CreateIndex
CREATE INDEX "ai_bulk_runs_status_idx" ON "ai_bulk_runs"("status");

-- CreateIndex
CREATE INDEX "ai_bulk_runs_createdAt_idx" ON "ai_bulk_runs"("createdAt");

-- AddForeignKey
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "credit_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "crm_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "crm_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_bulkRunId_fkey" FOREIGN KEY ("bulkRunId") REFERENCES "ai_bulk_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_bulk_runs" ADD CONSTRAINT "ai_bulk_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_bulk_runs" ADD CONSTRAINT "ai_bulk_runs_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "crm_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_bulk_runs" ADD CONSTRAINT "ai_bulk_runs_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "crm_views"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_bulk_runs" ADD CONSTRAINT "ai_bulk_runs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
