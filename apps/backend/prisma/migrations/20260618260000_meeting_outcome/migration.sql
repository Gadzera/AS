-- M15-4: типизированный исход встречи.
CREATE TYPE "MeetingOutcome" AS ENUM ('SHOWED', 'NO_SHOW', 'QUALIFIED', 'NOT_QUALIFIED', 'CANCELED');

ALTER TABLE "crm_meetings" ADD COLUMN "outcomeType" "MeetingOutcome";

-- Бэкфилл из легаси free-string outcome (где распознаётся).
UPDATE "crm_meetings" SET "outcomeType" = 'QUALIFIED'     WHERE "outcomeType" IS NULL AND lower("outcome") LIKE '%qualif%' AND lower("outcome") NOT LIKE '%not%' AND lower("outcome") NOT LIKE '%dis%';
UPDATE "crm_meetings" SET "outcomeType" = 'NOT_QUALIFIED' WHERE "outcomeType" IS NULL AND (lower("outcome") LIKE '%not a fit%' OR lower("outcome") LIKE '%not qualif%' OR lower("outcome") LIKE '%disqualif%');
UPDATE "crm_meetings" SET "outcomeType" = 'NO_SHOW'       WHERE "outcomeType" IS NULL AND (lower("outcome") LIKE '%no-show%' OR lower("outcome") LIKE '%no show%' OR lower("outcome") LIKE '%noshow%');
UPDATE "crm_meetings" SET "outcomeType" = 'CANCELED'      WHERE "outcomeType" IS NULL AND lower("outcome") LIKE '%cancel%';
UPDATE "crm_meetings" SET "outcomeType" = 'SHOWED'        WHERE "outcomeType" IS NULL AND (lower("outcome") LIKE '%show%' OR lower("outcome") LIKE '%attend%' OR lower("outcome") LIKE '%complet%') AND lower("outcome") NOT LIKE '%no%';
