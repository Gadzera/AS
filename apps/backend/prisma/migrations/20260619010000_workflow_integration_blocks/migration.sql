-- M17-4: AI / HTTP / Integration blocks + encrypted secret store.

-- 1) Новый ledger-source: кредит потрачен AI-блоком workflow (видно отдельно в Billing/Usage)
ALTER TYPE "CreditSource" ADD VALUE IF NOT EXISTS 'WORKFLOW_AI';

-- 2) Новые типы действий (AI / HTTP / transform / sequence / notification)
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'AI_CLASSIFY';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'AI_SUMMARIZE';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'AI_PROMPT';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'AI_RESEARCH';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'HTTP_REQUEST';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'TRANSFORM';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'ENROLL_SEQUENCE';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'UNENROLL_SEQUENCE';
ALTER TYPE "WorkflowActionType" ADD VALUE IF NOT EXISTS 'SEND_NOTIFICATION';

-- 3) Зашифрованный secret store (org-scoped; value наружу не отдаётся)
CREATE TABLE "crm_workflow_secrets" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "valueEncrypted" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_workflow_secrets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_workflow_secrets_orgId_key_key" ON "crm_workflow_secrets"("orgId", "key");
CREATE INDEX "crm_workflow_secrets_orgId_idx" ON "crm_workflow_secrets"("orgId");
