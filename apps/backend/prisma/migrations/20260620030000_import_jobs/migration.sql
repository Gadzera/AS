-- M20-1: Import / Migration — трекаемая import-JOB (S330–S338) + журнал created/updated (основа rollback).

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'MAPPING_REQUIRED', 'READY', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELED');
CREATE TYPE "ImportTargetType" AS ENUM ('OBJECT', 'LIST');

-- CreateTable
CREATE TABLE "crm_import_jobs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "targetType" "ImportTargetType" NOT NULL DEFAULT 'OBJECT',
    "objectId" TEXT,
    "listId" TEXT,
    "fileName" TEXT NOT NULL,
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "headers" JSONB NOT NULL,
    "sampleRows" JSONB NOT NULL,
    "rawRows" JSONB NOT NULL,
    "mapping" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "rowResults" JSONB,
    "fileHash" TEXT,
    "clientRequestId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "crm_import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_import_jobs_orgId_clientRequestId_key" ON "crm_import_jobs"("orgId", "clientRequestId");
CREATE INDEX "crm_import_jobs_orgId_idx" ON "crm_import_jobs"("orgId");
CREATE INDEX "crm_import_jobs_objectId_idx" ON "crm_import_jobs"("objectId");

-- CreateTable
CREATE TABLE "crm_import_created_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_import_created_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_import_created_records_importJobId_idx" ON "crm_import_created_records"("importJobId");
CREATE INDEX "crm_import_created_records_recordId_idx" ON "crm_import_created_records"("recordId");

-- CreateTable
CREATE TABLE "crm_import_updated_values" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "hadPreviousValue" BOOLEAN NOT NULL DEFAULT false,
    "previousValue" JSONB,
    "importedValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_import_updated_values_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_import_updated_values_importJobId_idx" ON "crm_import_updated_values"("importJobId");
