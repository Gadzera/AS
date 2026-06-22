-- M29-1: provenance значения crm_values (защита ручных данных от AI-перезаписи) + bulk skippedCount + статус run.

-- 1) Новый enum происхождения значения.
CREATE TYPE "ValueSource" AS ENUM ('MANUAL', 'AI', 'IMPORT', 'SYSTEM');

-- 2) Новый статус AI-run: значение не записано из-за защиты ручного значения.
ALTER TYPE "AiRunStatus" ADD VALUE IF NOT EXISTS 'SKIPPED_MANUAL_VALUE';

-- 3) Колонки provenance на crm_values. Дефолт MANUAL — существующие значения по умолчанию считаем ручными/авторитетными.
ALTER TABLE "crm_values"
  ADD COLUMN "source" "ValueSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "lastAiRunId" TEXT;

-- 4) Счётчик пропущенных (manual-protected) строк в bulk-run.
ALTER TABLE "ai_bulk_runs"
  ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0;

-- 5) Backfill: значения, которые реально записал успешный AI-run (по AiRun.valueId), помечаем source=AI
--    и lastAiRunId = последний успешный run для этого значения. Остальные остаются MANUAL.
UPDATE "crm_values" v
SET "source" = 'AI', "lastAiRunId" = r."id"
FROM (
  SELECT DISTINCT ON (ar."valueId") ar."valueId" AS value_id, ar."id" AS id
  FROM "ai_runs" ar
  WHERE ar."status" = 'SUCCEEDED' AND ar."valueId" IS NOT NULL
  ORDER BY ar."valueId", ar."completedAt" DESC NULLS LAST
) r
WHERE v."id" = r.value_id;

-- 6) Индекс для значка/фильтра по происхождению (необязательно, но дёшево).
CREATE INDEX "crm_values_attributeId_source_idx" ON "crm_values" ("attributeId", "source");
