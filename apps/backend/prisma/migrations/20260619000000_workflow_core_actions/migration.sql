-- M17-3: Core action blocks.
-- DELAY/DELAY_UNTIL через scheduler (resumeAt + статус WAITING, НЕ setTimeout) + расширенный
-- типизированный каталог действий (Workflow.actions остаётся String[]; валидация на run-start).

-- 1) Новые статусы прогона/шага: WAITING (приостановлен на задержке до resumeAt)
ALTER TYPE "WorkflowRunStatus" ADD VALUE IF NOT EXISTS 'WAITING';
ALTER TYPE "WorkflowStepStatus" ADD VALUE IF NOT EXISTS 'WAITING';

-- 2) Новые типы действий (typed catalog; реальные Data Hub / логика / задержки / назначение)
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'CREATE_RECORD';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'UPDATE_RECORD';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'FIND_RECORDS';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'ARCHIVE_RECORD';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'ADD_TO_LIST';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'REMOVE_FROM_LIST';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'UPDATE_LIST_ENTRY';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'FILTER';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'IF';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'SWITCH';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'DELAY';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'DELAY_UNTIL';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'ROUND_ROBIN';

-- 3) DELAY: когда scheduler возобновит WAITING-прогон (pickup, не setTimeout)
ALTER TABLE "crm_workflow_runs" ADD COLUMN "resumeAt" TIMESTAMP(3);
CREATE INDEX "crm_workflow_runs_status_resumeAt_idx" ON "crm_workflow_runs"("status", "resumeAt");
