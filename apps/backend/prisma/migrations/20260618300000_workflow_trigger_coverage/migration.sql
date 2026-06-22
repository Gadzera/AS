-- M17-2: trigger coverage — канонические CRM-триггеры + record/object scope на прогоне.

-- 1) Канонические значения WorkflowTrigger (аддитивно; не используются в DML этой миграции)
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'RECORD_COMMAND';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'RECORD_CREATED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'RECORD_UPDATED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'ATTRIBUTE_UPDATED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'LIST_ENTRY_COMMAND';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'RECORD_ADDED_TO_LIST';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'LIST_ENTRY_UPDATED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'TASK_CREATED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'MANUAL_RUN';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'RECURRING_SCHEDULE';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'WEBHOOK_RECEIVED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'TYPEFORM_SUBMISSION';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'OUTREACH_EVENT';

-- 2) record/object scope на WorkflowRun (записи — не лиды)
ALTER TABLE "crm_workflow_runs" ADD COLUMN "recordId" TEXT;
ALTER TABLE "crm_workflow_runs" ADD COLUMN "objectId" TEXT;
CREATE INDEX "crm_workflow_runs_recordId_idx" ON "crm_workflow_runs"("recordId");
