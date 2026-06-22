-- CreateEnum
CREATE TYPE "WorkflowTrigger" AS ENUM ('REPLY_RECEIVED', 'MEETING_BOOKED', 'SEQUENCE_COMPLETED', 'LEAD_UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "crm_workflows" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "WorkflowTrigger" NOT NULL,
    "conditionClass" "ReplyClass",
    "actions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workflow_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "leadId" TEXT,
    "trigger" "WorkflowTrigger" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_workflows_orgId_idx" ON "crm_workflows"("orgId");

-- CreateIndex
CREATE INDEX "crm_workflow_runs_orgId_idx" ON "crm_workflow_runs"("orgId");

-- CreateIndex
CREATE INDEX "crm_workflow_runs_workflowId_idx" ON "crm_workflow_runs"("workflowId");

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
