-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELED');

-- CreateTable
CREATE TABLE "crm_meetings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" "MeetingStatus" NOT NULL DEFAULT 'REQUESTED',
    "outcome" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_meetings_orgId_idx" ON "crm_meetings"("orgId");

-- CreateIndex
CREATE INDEX "crm_meetings_leadId_idx" ON "crm_meetings"("leadId");

-- CreateIndex
CREATE INDEX "crm_meetings_status_idx" ON "crm_meetings"("status");
