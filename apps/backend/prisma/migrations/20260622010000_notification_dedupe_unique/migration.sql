-- M27-2 (адверс CRIT): дедуп уведомлений на уровне БД. Сначала вычищаем существующие дубли непустых ключей.
DELETE FROM "crm_notifications" a
USING "crm_notifications" b
WHERE a."dedupeKey" IS NOT NULL
  AND a."orgId" = b."orgId" AND a."dedupeKey" = b."dedupeKey"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));
-- Уникальность (orgId, dedupeKey). NULL dedupeKey не конфликтует (broadcast).
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_orgId_dedupeKey_key" UNIQUE ("orgId", "dedupeKey");
