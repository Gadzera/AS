-- M19-1: Call Intelligence — insight-шаблоны (S313–S315) + транскрипт звонка (S316/S322 demo).

-- Call += транскрипт
ALTER TABLE "crm_calls" ADD COLUMN "transcript" TEXT;
ALTER TABLE "crm_calls" ADD COLUMN "transcriptSource" TEXT;
ALTER TABLE "crm_calls" ADD COLUMN "recordingProvider" TEXT;

-- CreditSource += CALL_INSIGHT
ALTER TYPE "CreditSource" ADD VALUE IF NOT EXISTS 'CALL_INSIGHT';

-- CreateEnum
CREATE TYPE "InsightTemplateScope" AS ENUM ('PERSONAL', 'WORKSPACE');
CREATE TYPE "InsightOutputFormat" AS ENUM ('TEXT', 'BULLETS');

-- CreateTable
CREATE TABLE "crm_insight_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "InsightTemplateScope" NOT NULL DEFAULT 'PERSONAL',
    "ownerId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_insight_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_insight_templates_orgId_idx" ON "crm_insight_templates"("orgId");
CREATE INDEX "crm_insight_templates_ownerId_idx" ON "crm_insight_templates"("ownerId");

-- CreateTable
CREATE TABLE "crm_insight_template_sections" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "outputFormat" "InsightOutputFormat" NOT NULL DEFAULT 'TEXT',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "crm_insight_template_sections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_insight_template_sections_templateId_idx" ON "crm_insight_template_sections"("templateId");
ALTER TABLE "crm_insight_template_sections" ADD CONSTRAINT "crm_insight_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "crm_insight_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "crm_call_insight_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "transcriptHash" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "creditsCharged" INTEGER NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_call_insight_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_call_insight_runs_orgId_idempotencyKey_key" ON "crm_call_insight_runs"("orgId", "idempotencyKey");
CREATE INDEX "crm_call_insight_runs_callId_idx" ON "crm_call_insight_runs"("callId");
