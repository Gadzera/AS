-- M13-1: лог событий по сообщению (MessageEvent) — атрибуция Message → CampaignLead → Campaign.
CREATE TYPE "MessageEventType" AS ENUM ('DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED');

CREATE TABLE "MessageEvent" (
  "id"              TEXT NOT NULL,
  "messageId"       TEXT NOT NULL,
  "type"            "MessageEventType" NOT NULL,
  "dedupeKey"       TEXT NOT NULL,
  "providerEventId" TEXT,
  "occurredAt"      TIMESTAMP(3) NOT NULL,
  "meta"            JSONB,
  "leadId"          TEXT,
  "campaignLeadId"  TEXT,
  "campaignId"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageEvent_messageId_type_dedupeKey_key" ON "MessageEvent" ("messageId", "type", "dedupeKey");
CREATE INDEX "MessageEvent_messageId_idx" ON "MessageEvent" ("messageId");
CREATE INDEX "MessageEvent_type_occurredAt_idx" ON "MessageEvent" ("type", "occurredAt");
CREATE INDEX "MessageEvent_campaignId_type_idx" ON "MessageEvent" ("campaignId", "type");

ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
