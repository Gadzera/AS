-- Add click tracking to Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "clicks"    INTEGER NOT NULL DEFAULT 0;

-- Add Bannerbear template to Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "bannerbearTemplateId" TEXT;
