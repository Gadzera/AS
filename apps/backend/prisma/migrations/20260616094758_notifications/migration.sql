-- CreateEnum
CREATE TYPE "NotificationSource" AS ENUM ('WORKFLOW', 'REPLY', 'MEETING', 'CALL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('NEW', 'READ', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "crm_notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "source" "NotificationSource" NOT NULL DEFAULT 'SYSTEM',
    "status" "NotificationStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "leadId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "crm_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_notifications_orgId_status_idx" ON "crm_notifications"("orgId", "status");

-- CreateIndex
CREATE INDEX "crm_notifications_dedupeKey_idx" ON "crm_notifications"("dedupeKey");
