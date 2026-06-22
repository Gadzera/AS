-- M13-4: workflow-триггеры от событий + идемпотентность по source-event.
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'OPENED';
ALTER TYPE "WorkflowTrigger" ADD VALUE IF NOT EXISTS 'BOUNCED';

ALTER TABLE "crm_workflow_runs" ADD COLUMN "eventId" TEXT;
-- один MessageEvent-источник запускает одно правило ровно раз (NULL для ручных/не-event — допускается много).
CREATE UNIQUE INDEX "crm_workflow_runs_workflowId_eventId_key" ON "crm_workflow_runs" ("workflowId", "eventId");
