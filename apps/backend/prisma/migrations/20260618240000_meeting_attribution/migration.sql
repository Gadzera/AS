-- M15-1: атрибуция встречи к источнику (reply/message/campaign/draft) + DB-level idempotency.
ALTER TABLE "crm_meetings" ADD COLUMN "campaignId"      TEXT;
ALTER TABLE "crm_meetings" ADD COLUMN "campaignLeadId"  TEXT;
ALTER TABLE "crm_meetings" ADD COLUMN "sourceMessageId" TEXT;
ALTER TABLE "crm_meetings" ADD COLUMN "replyMessageId"  TEXT;
ALTER TABLE "crm_meetings" ADD COLUMN "replyDraftId"    TEXT;
ALTER TABLE "crm_meetings" ADD COLUMN "attributionMode" TEXT;
ALTER TABLE "crm_meetings" ADD COLUMN "idempotencyKey"  TEXT;

-- один Meeting на конкретный reply (NULL допускает много manual-встреч).
CREATE UNIQUE INDEX "crm_meetings_idempotencyKey_key" ON "crm_meetings"("idempotencyKey");
CREATE INDEX "crm_meetings_campaignId_idx" ON "crm_meetings"("campaignId");
CREATE INDEX "crm_meetings_replyMessageId_idx" ON "crm_meetings"("replyMessageId");
