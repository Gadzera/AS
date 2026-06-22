-- M14-3: AI-черновик ответа + approval-gate с backend-derived risk flags.
CREATE TYPE "ReplyDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'SUPPRESSED');
CREATE TYPE "ReplyRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "ReplyDraft" (
  "id"               TEXT NOT NULL,
  "orgId"            TEXT NOT NULL,
  "inboundMessageId" TEXT NOT NULL,
  "leadId"           TEXT NOT NULL,
  "campaignId"       TEXT,
  "subject"          TEXT,
  "body"             TEXT NOT NULL,
  "originalBody"     TEXT,
  "status"           "ReplyDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "riskFlags"        TEXT[],
  "riskLevel"        "ReplyRiskLevel" NOT NULL DEFAULT 'LOW',
  "canAutopilot"     BOOLEAN NOT NULL DEFAULT false,
  "generatedBy"      TEXT NOT NULL,
  "editedById"       TEXT,
  "approvedById"     TEXT,
  "approvedAt"       TIMESTAMP(3),
  "sentMessageId"    TEXT,
  "sentAt"           TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReplyDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReplyDraft_orgId_idx" ON "ReplyDraft" ("orgId");
CREATE INDEX "ReplyDraft_inboundMessageId_idx" ON "ReplyDraft" ("inboundMessageId");
CREATE INDEX "ReplyDraft_status_idx" ON "ReplyDraft" ("status");

ALTER TABLE "ReplyDraft" ADD CONSTRAINT "ReplyDraft_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplyDraft" ADD CONSTRAINT "ReplyDraft_inboundMessageId_fkey" FOREIGN KEY ("inboundMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
