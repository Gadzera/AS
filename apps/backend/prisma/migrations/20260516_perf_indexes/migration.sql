CREATE INDEX CONCURRENTLY IF NOT EXISTS "Lead_orgId_email_idx" ON "Lead"("orgId", "email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CampaignLead_campaignId_status_idx" ON "CampaignLead"("campaignId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CampaignLead_campaignId_abVariant_idx" ON "CampaignLead"("campaignId", "abVariant");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_leadId_direction_sentAt_idx" ON "Message"("leadId", "direction", "sentAt");
