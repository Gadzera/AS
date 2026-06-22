-- CreateEnum
CREATE TYPE "SendSkipReason" AS ENUM ('NO_MAILBOX', 'DAILY_LIMIT', 'NO_EMAIL', 'NO_LINKEDIN', 'CAMPAIGN_INACTIVE');

-- CreateTable
CREATE TABLE "send_skips" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "campaignId" TEXT,
    "leadId" TEXT,
    "reason" "SendSkipReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "send_skips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "send_skips_orgId_createdAt_idx" ON "send_skips"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "send_skips_orgId_reason_idx" ON "send_skips"("orgId", "reason");
