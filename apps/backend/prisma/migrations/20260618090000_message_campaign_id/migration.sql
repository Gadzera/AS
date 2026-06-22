-- M11-1: привязка исходящего сообщения к кампании (scope стопов + резолв ответа→кампания).
ALTER TABLE "Message" ADD COLUMN "campaignId" TEXT;
CREATE INDEX "Message_leadId_direction_sentAt_idx" ON "Message"("leadId", "direction", "sentAt");
CREATE INDEX "Message_campaignId_idx" ON "Message"("campaignId");
