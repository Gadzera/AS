-- M27-2: soft-delete полей заметок + версия назначения задач
ALTER TABLE "crm_notes" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "crm_notes" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "crm_notes" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "crm_tasks" ADD COLUMN "assignmentVersion" INTEGER NOT NULL DEFAULT 0;
