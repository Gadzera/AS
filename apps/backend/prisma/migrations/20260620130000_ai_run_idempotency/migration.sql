-- M25-1: идемпотентность AI-run (auto-rerun M25-2) + bulk-run (clientRequestId).
-- NULL-ключи не конфликтуют (Postgres трактует NULL как distinct в unique-индексе) → legacy-строки целы.

ALTER TABLE "ai_runs" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "ai_runs_orgId_idempotencyKey_key" ON "ai_runs"("orgId", "idempotencyKey");

ALTER TABLE "ai_bulk_runs" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "ai_bulk_runs_orgId_clientRequestId_key" ON "ai_bulk_runs"("orgId", "clientRequestId");
