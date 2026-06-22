-- M11-2: отдельный жизненный цикл enrollment'а (CampaignLead.status) вместо переиспользования LeadStatus.
-- Терминальный COMPLETED (прошёл все шаги без ответа) ≠ CONVERTED. Worker решает по status; nextSendAt = расписание.

-- 1. Новый enum статусов enrollment'а.
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REPLIED', 'COMPLETED', 'STOPPED');

-- 2. Новые поля.
ALTER TABLE "CampaignLead" ADD COLUMN "stopReason" TEXT;
ALTER TABLE "CampaignLead" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "CampaignLead" ADD COLUMN "completedAt" TIMESTAMP(3);

-- 3. Бэкфилл stopReason из старого LeadStatus (до смены типа колонки, пока ещё доступен текст).
UPDATE "CampaignLead" SET "stopReason" = "status"::text WHERE "status"::text IN ('LOST', 'UNSUBSCRIBED');

-- 4. Смена типа колонки status: LeadStatus → EnrollmentStatus с маппингом значений.
--    NEW→PENDING, CONTACTED/HOT→ACTIVE, REPLIED→REPLIED, CONVERTED→COMPLETED (легаси завершения),
--    LOST/UNSUBSCRIBED→STOPPED (причина сохранена в stopReason выше).
ALTER TABLE "CampaignLead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CampaignLead" ALTER COLUMN "status" TYPE "EnrollmentStatus" USING (
  CASE "status"::text
    WHEN 'NEW' THEN 'PENDING'
    WHEN 'CONTACTED' THEN 'ACTIVE'
    WHEN 'HOT' THEN 'ACTIVE'
    WHEN 'REPLIED' THEN 'REPLIED'
    WHEN 'CONVERTED' THEN 'COMPLETED'
    WHEN 'LOST' THEN 'STOPPED'
    WHEN 'UNSUBSCRIBED' THEN 'STOPPED'
    ELSE 'ACTIVE'
  END::"EnrollmentStatus"
);
ALTER TABLE "CampaignLead" ALTER COLUMN "status" SET DEFAULT 'PENDING';
