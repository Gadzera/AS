-- M20-2: Import rollback + list import (S335–S337).

-- ImportJob += rollback-поля
ALTER TABLE "crm_import_jobs" ADD COLUMN "rolledBackAt" TIMESTAMP(3);
ALTER TABLE "crm_import_jobs" ADD COLUMN "rollbackStats" JSONB;

-- CreateTable: журнал созданных list-entry
CREATE TABLE "crm_import_created_list_entries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "listEntryId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_import_created_list_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_import_created_list_entries_importJobId_idx" ON "crm_import_created_list_entries"("importJobId");
