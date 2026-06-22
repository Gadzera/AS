-- M16-1: единый ledger — source(enum) + generic idempotency + links.
CREATE TYPE "CreditSource" AS ENUM ('AI_ATTRIBUTE','BULK_RUN','AUTO_RESPONSE','RESEARCH','ENRICHMENT','STRIPE','GRANT','PURCHASE','ADJUSTMENT','MANUAL');

ALTER TABLE "credit_transactions" ADD COLUMN "source" "CreditSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "credit_transactions" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "credit_transactions" ADD COLUMN "bulkRunId" TEXT;
ALTER TABLE "credit_transactions" ADD COLUMN "replyDraftId" TEXT;

-- backfill source из типа/aiRunId
UPDATE "credit_transactions" SET "source"='AI_ATTRIBUTE' WHERE "aiRunId" IS NOT NULL;
UPDATE "credit_transactions" SET "source"='GRANT'      WHERE "type"='GRANT'    AND "aiRunId" IS NULL;
UPDATE "credit_transactions" SET "source"='PURCHASE'   WHERE "type"='PURCHASE' AND "aiRunId" IS NULL;
UPDATE "credit_transactions" SET "source"='ADJUSTMENT' WHERE "type" IN ('RESET','ADJUSTMENT','REFUND') AND "aiRunId" IS NULL;

-- защитим существующие aiRun-списания generic-ключом (idempotencyKey уникален; aiRunId уникален → ключ уникален)
UPDATE "credit_transactions" SET "idempotencyKey"='ai-run:'||"aiRunId" WHERE "aiRunId" IS NOT NULL AND "idempotencyKey" IS NULL;

CREATE UNIQUE INDEX "credit_transactions_idempotencyKey_key" ON "credit_transactions"("idempotencyKey");
CREATE INDEX "credit_transactions_source_idx" ON "credit_transactions"("source");
CREATE INDEX "credit_transactions_orgId_createdAt_idx" ON "credit_transactions"("orgId","createdAt");
