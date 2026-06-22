-- M19-2: after-call артефакты (chapters/speaker-stats) + привязка к записям + favorites (S317–S319).

-- Call += finalize-поля
ALTER TABLE "crm_calls" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "crm_calls" ADD COLUMN "artifactTranscriptHash" TEXT;
ALTER TABLE "crm_calls" ADD COLUMN "speakerLabeled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "crm_calls" ADD COLUMN "callInfo" JSONB;

-- ActivityType += CALL_RECORDED (для timeline записи)
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CALL_RECORDED';

-- CreateTable
CREATE TABLE "crm_call_chapters" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startSec" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "crm_call_chapters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_call_chapters_callId_idx" ON "crm_call_chapters"("callId");

-- CreateTable
CREATE TABLE "crm_call_speaker_stats" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "talkSec" INTEGER NOT NULL DEFAULT 0,
    "turns" INTEGER NOT NULL DEFAULT 0,
    "sharePct" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "crm_call_speaker_stats_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_call_speaker_stats_callId_idx" ON "crm_call_speaker_stats"("callId");

-- CreateTable
CREATE TABLE "crm_call_participants" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "recordId" TEXT,
    CONSTRAINT "crm_call_participants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_call_participants_callId_idx" ON "crm_call_participants"("callId");

-- CreateTable
CREATE TABLE "crm_call_associated_records" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "associationType" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_call_associated_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_call_associated_records_callId_objectKey_recordId_key" ON "crm_call_associated_records"("callId", "objectKey", "recordId");
CREATE INDEX "crm_call_associated_records_recordId_idx" ON "crm_call_associated_records"("recordId");
CREATE INDEX "crm_call_associated_records_callId_idx" ON "crm_call_associated_records"("callId");

-- CreateTable
CREATE TABLE "crm_call_favorites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_call_favorites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_call_favorites_callId_userId_key" ON "crm_call_favorites"("callId", "userId");
CREATE INDEX "crm_call_favorites_userId_idx" ON "crm_call_favorites"("userId");
