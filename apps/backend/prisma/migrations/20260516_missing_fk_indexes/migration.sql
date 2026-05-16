-- Missing FK indexes identified in schema audit

CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_orgId_idx" ON "User"("orgId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Campaign_userId_idx" ON "Campaign"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_smtpAccountId_idx" ON "Message"("smtpAccountId");

-- Sequence stepNumber uniqueness per campaign (was just an index, now unique)
DROP INDEX IF EXISTS "Sequence_campaignId_stepNumber_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Sequence_campaignId_stepNumber_key" ON "Sequence"("campaignId", "stepNumber");
