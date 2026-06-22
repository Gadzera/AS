-- M15-3: пакет передачи человеку/AE (persisted), один на reply.
CREATE TYPE "HandoffStatus" AS ENUM ('OPEN', 'ASSIGNED', 'HANDED_OFF');

CREATE TABLE "HandoffPackage" (
  "id"                  TEXT NOT NULL,
  "orgId"               TEXT NOT NULL,
  "replyMessageId"      TEXT NOT NULL,
  "leadId"              TEXT NOT NULL,
  "campaignId"          TEXT,
  "sourceMessageId"     TEXT,
  "replyDraftId"        TEXT,
  "meetingId"           TEXT,
  "intent"              "ReplyClass",
  "intentConfidence"    DOUBLE PRECISION,
  "attributionMode"     TEXT,
  "riskFlags"           TEXT[],
  "riskLevel"           "ReplyRiskLevel",
  "summary"             TEXT NOT NULL,
  "recommendedNextStep" TEXT NOT NULL,
  "threadSnapshot"      JSONB NOT NULL,
  "status"              "HandoffStatus" NOT NULL DEFAULT 'OPEN',
  "assigneeId"          TEXT,
  "createdById"         TEXT,
  "viewedAt"            TIMESTAMP(3),
  "handedOffAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HandoffPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HandoffPackage_replyMessageId_key" ON "HandoffPackage"("replyMessageId");
CREATE INDEX "HandoffPackage_orgId_idx" ON "HandoffPackage"("orgId");
CREATE INDEX "HandoffPackage_leadId_idx" ON "HandoffPackage"("leadId");
CREATE INDEX "HandoffPackage_status_idx" ON "HandoffPackage"("status");
CREATE INDEX "HandoffPackage_assigneeId_idx" ON "HandoffPackage"("assigneeId");

ALTER TABLE "HandoffPackage" ADD CONSTRAINT "HandoffPackage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
