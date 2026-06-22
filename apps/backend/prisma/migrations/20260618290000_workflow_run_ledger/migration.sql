-- M17-1: Workflow run ledger + idempotency.
-- WorkflowRun стал run-ledger'ом (status/timing/attempts/per-step audit); добавлены WorkflowRunStep
-- и WorkflowActionIdempotency. Универсальный дедуп: NON-NULL idempotencyKey + @@unique([workflowId,idempotencyKey]).

-- 1) Enums
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');
CREATE TYPE "WorkflowActionType" AS ENUM ('NOTIFY_HUMAN', 'PAUSE_SEQUENCE', 'SET_LEAD_HOT', 'MARK_CONVERTED', 'SUPPRESS_CONTACT', 'MOVE_TO_REPLIED');

-- 2) ALTER crm_workflow_runs — новые колонки run-ledger'а
ALTER TABLE "crm_workflow_runs"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "error" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dedupeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "campaignId" TEXT,
  ADD COLUMN "attributionMode" TEXT,
  ADD COLUMN "batchId" TEXT;

-- 2a) Backfill: старые строки — это завершённые прогоны (status=SUCCEEDED), idempotencyKey=legacy:<runId>
UPDATE "crm_workflow_runs" SET "status" = 'SUCCEEDED' WHERE "status" = 'PENDING';
UPDATE "crm_workflow_runs" SET "idempotencyKey" = 'legacy:' || "id" WHERE "idempotencyKey" IS NULL;

-- 2b) Теперь idempotencyKey — NOT NULL
ALTER TABLE "crm_workflow_runs" ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- 3) crm_workflow_run_steps — per-step аудит
CREATE TABLE "crm_workflow_run_steps" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
  "resultSummary" TEXT,
  "error" TEXT,
  "input" JSONB,
  "output" JSONB,
  "idempotencyKey" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_workflow_run_steps_pkey" PRIMARY KEY ("id")
);

-- 4) crm_workflow_action_idempotency — дедуп побочных эффектов
CREATE TABLE "crm_workflow_action_idempotency" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "runId" TEXT,
  "stepId" TEXT,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_workflow_action_idempotency_pkey" PRIMARY KEY ("id")
);

-- 5) Индексы и уники
CREATE UNIQUE INDEX "crm_workflow_runs_workflowId_idempotencyKey_key" ON "crm_workflow_runs"("workflowId", "idempotencyKey");
CREATE INDEX "crm_workflow_runs_orgId_status_idx" ON "crm_workflow_runs"("orgId", "status");
CREATE INDEX "crm_workflow_runs_status_idx" ON "crm_workflow_runs"("status");
CREATE INDEX "crm_workflow_runs_leadId_idx" ON "crm_workflow_runs"("leadId");
CREATE INDEX "crm_workflow_runs_workflowId_createdAt_idx" ON "crm_workflow_runs"("workflowId", "createdAt");

CREATE UNIQUE INDEX "crm_workflow_run_steps_runId_order_key" ON "crm_workflow_run_steps"("runId", "order");
CREATE INDEX "crm_workflow_run_steps_runId_idx" ON "crm_workflow_run_steps"("runId");
CREATE INDEX "crm_workflow_run_steps_orgId_idx" ON "crm_workflow_run_steps"("orgId");

CREATE UNIQUE INDEX "crm_workflow_action_idempotency_orgId_key_key" ON "crm_workflow_action_idempotency"("orgId", "key");
CREATE INDEX "crm_workflow_action_idempotency_orgId_idx" ON "crm_workflow_action_idempotency"("orgId");

-- 6) FK
ALTER TABLE "crm_workflow_run_steps" ADD CONSTRAINT "crm_workflow_run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "crm_workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
