-- M22-2: email digest (per-user) + onboarding-completed flag (S399/S403).

-- CreateEnum (DROP IF EXISTS — повторный прогон после частичного сбоя; таблица его ещё не использует)
DROP TYPE IF EXISTS "DigestStatus";
CREATE TYPE "DigestStatus" AS ENUM ('SENT', 'SKIPPED_NO_SMTP', 'EMPTY');

-- AlterTable: онбординг-флаг (таблица модели Organization без @@map → "Organization")
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable: NotificationDigest
CREATE TABLE IF NOT EXISTS "crm_notification_digests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "status" "DigestStatus" NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_notification_digests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_notification_digests_orgId_userId_createdAt_idx" ON "crm_notification_digests"("orgId", "userId", "createdAt");
