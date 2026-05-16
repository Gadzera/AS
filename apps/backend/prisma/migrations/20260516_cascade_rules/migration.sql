-- Add explicit CASCADE / SET NULL / RESTRICT rules to all FK constraints

-- User → Organization SET NULL (user can exist without org)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_orgId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lead → Organization CASCADE
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_orgId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Campaign → Organization CASCADE
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_orgId_fkey";
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Campaign → User RESTRICT (can't delete user with campaigns)
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_userId_fkey";
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sequence → Campaign CASCADE
ALTER TABLE "Sequence" DROP CONSTRAINT IF EXISTS "Sequence_campaignId_fkey";
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CampaignLead → Campaign CASCADE
ALTER TABLE "CampaignLead" DROP CONSTRAINT IF EXISTS "CampaignLead_campaignId_fkey";
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CampaignLead → Lead CASCADE
ALTER TABLE "CampaignLead" DROP CONSTRAINT IF EXISTS "CampaignLead_leadId_fkey";
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Message → Lead CASCADE
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_leadId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SmtpAccount → Organization CASCADE
ALTER TABLE "SmtpAccount" DROP CONSTRAINT IF EXISTS "SmtpAccount_orgId_fkey";
ALTER TABLE "SmtpAccount" ADD CONSTRAINT "SmtpAccount_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ApiKey → Organization CASCADE
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_orgId_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Webhook → Organization CASCADE
ALTER TABLE "Webhook" DROP CONSTRAINT IF EXISTS "Webhook_orgId_fkey";
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Template → Organization CASCADE
ALTER TABLE "Template" DROP CONSTRAINT IF EXISTS "Template_orgId_fkey";
ALTER TABLE "Template" ADD CONSTRAINT "Template_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification → Organization CASCADE
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_orgId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AutopilotConfig → Organization CASCADE
ALTER TABLE "AutopilotConfig" DROP CONSTRAINT IF EXISTS "AutopilotConfig_orgId_fkey";
ALTER TABLE "AutopilotConfig" ADD CONSTRAINT "AutopilotConfig_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tag → Organization CASCADE
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_orgId_fkey";
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LeadTag → Lead CASCADE
ALTER TABLE "LeadTag" DROP CONSTRAINT IF EXISTS "LeadTag_leadId_fkey";
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LeadTag → Tag CASCADE
ALTER TABLE "LeadTag" DROP CONSTRAINT IF EXISTS "LeadTag_tagId_fkey";
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
