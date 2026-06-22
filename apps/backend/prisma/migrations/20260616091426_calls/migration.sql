-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NO_ANSWER', 'VOICEMAIL', 'CANCELED');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'VOICEMAIL', 'NOT_INTERESTED', 'CALLBACK', 'MEETING_BOOKED', 'WRONG_NUMBER');

-- CreateTable
CREATE TABLE "crm_calls" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "status" "CallStatus" NOT NULL DEFAULT 'SCHEDULED',
    "outcome" "CallOutcome",
    "scheduledAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "summary" TEXT,
    "nextStep" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_calls_orgId_idx" ON "crm_calls"("orgId");

-- CreateIndex
CREATE INDEX "crm_calls_leadId_idx" ON "crm_calls"("leadId");

-- CreateIndex
CREATE INDEX "crm_calls_status_idx" ON "crm_calls"("status");
