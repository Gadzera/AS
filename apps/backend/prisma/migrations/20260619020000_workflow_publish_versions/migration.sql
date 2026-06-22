-- M17-5: draft/published lifecycle + immutable version snapshots.

-- 1) Workflow draft/published поля
ALTER TABLE "crm_workflows" ADD COLUMN "publishedVersion" INTEGER;
ALTER TABLE "crm_workflows" ADD COLUMN "draftUpdatedAt" TIMESTAMP(3);

-- 2) Run → версия, по которой исполнен (immutable audit)
ALTER TABLE "crm_workflow_runs" ADD COLUMN "workflowVersion" INTEGER;

-- 3) WorkflowVersion (snapshot опубликованной версии)
CREATE TABLE "crm_workflow_versions" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "trigger" "WorkflowTrigger" NOT NULL,
  "conditionClass" "ReplyClass",
  "actions" TEXT[],
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_workflow_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_workflow_versions_workflowId_version_key" ON "crm_workflow_versions"("workflowId", "version");
CREATE INDEX "crm_workflow_versions_orgId_idx" ON "crm_workflow_versions"("orgId");
CREATE INDEX "crm_workflow_versions_workflowId_idx" ON "crm_workflow_versions"("workflowId");
ALTER TABLE "crm_workflow_versions" ADD CONSTRAINT "crm_workflow_versions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) BACKFILL: все существующие workflows → published v1 (live automation не должна остановиться)
INSERT INTO "crm_workflow_versions" ("id", "orgId", "workflowId", "version", "trigger", "conditionClass", "actions", "publishedAt")
SELECT 'wfv1-' || "id", "orgId", "id", 1, "trigger", "conditionClass", "actions", CURRENT_TIMESTAMP FROM "crm_workflows";
UPDATE "crm_workflows" SET "publishedVersion" = 1, "draftUpdatedAt" = "updatedAt";
