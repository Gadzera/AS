-- M18-1: Report Builder core (модуль 14 Reports & Dashboards, S285–S297).
-- Конфигурируемый отчёт над CRM-объектами/списками. Типы HISTORICAL/TIME_IN_STAGE/STAGE_CHANGE
-- в enum заведены сразу (модель готова), но в M18-1 не сохраняются как configured (оживают в M18-2).

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('INSIGHT', 'FUNNEL', 'HISTORICAL', 'TIME_IN_STAGE', 'STAGE_CHANGE');

-- CreateEnum
CREATE TYPE "ReportSourceType" AS ENUM ('OBJECT', 'LIST');

-- CreateEnum
CREATE TYPE "ReportVisualization" AS ENUM ('BAR', 'LINE', 'TABLE', 'FUNNEL');

-- CreateTable
CREATE TABLE "crm_reports" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'INSIGHT',
    "sourceType" "ReportSourceType" NOT NULL,
    "sourceObjectId" TEXT,
    "sourceListId" TEXT,
    "metric" JSONB NOT NULL,
    "groupByAttributeId" TEXT,
    "segmentByAttributeId" TEXT,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "visualization" "ReportVisualization" NOT NULL DEFAULT 'BAR',
    "config" JSONB,
    "clientRequestId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_reports_orgId_clientRequestId_key" ON "crm_reports"("orgId", "clientRequestId");

-- CreateIndex
CREATE INDEX "crm_reports_orgId_idx" ON "crm_reports"("orgId");

-- CreateIndex
CREATE INDEX "crm_reports_sourceObjectId_idx" ON "crm_reports"("sourceObjectId");

-- CreateIndex
CREATE INDEX "crm_reports_sourceListId_idx" ON "crm_reports"("sourceListId");
