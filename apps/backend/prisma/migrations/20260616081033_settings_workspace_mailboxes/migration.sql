-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('SMTP', 'GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('CONNECTED', 'WARMING', 'PAUSED', 'ERROR');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dailySendLimit" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "sendDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
ADD COLUMN     "sendWindowEnd" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "sendWindowStart" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin';

-- CreateTable
CREATE TABLE "crm_mailboxes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "fromName" TEXT,
    "provider" "MailboxProvider" NOT NULL DEFAULT 'SMTP',
    "status" "MailboxStatus" NOT NULL DEFAULT 'WARMING',
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "warmupDay" INTEGER NOT NULL DEFAULT 1,
    "healthPct" INTEGER NOT NULL DEFAULT 60,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_mailboxes_orgId_idx" ON "crm_mailboxes"("orgId");

-- AddForeignKey
ALTER TABLE "crm_mailboxes" ADD CONSTRAINT "crm_mailboxes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
