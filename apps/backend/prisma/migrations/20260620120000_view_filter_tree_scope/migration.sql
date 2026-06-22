-- M24-1: AND/OR filter tree + view scope (personal/shared)

-- enum видимости представления
CREATE TYPE "ViewScope" AS ENUM ('PERSONAL', 'SHARED');

-- scope: новые строки по умолчанию PERSONAL; существующие виды переводим в SHARED,
-- чтобы НЕ схлопнуть текущую org-wide видимость (back-compat).
ALTER TABLE "crm_views" ADD COLUMN "scope" "ViewScope" NOT NULL DEFAULT 'PERSONAL';
UPDATE "crm_views" SET "scope" = 'SHARED';

-- канонический AND/OR filter tree (NULL → читаем legacy ViewFilter[] как плоский AND)
ALTER TABLE "crm_views" ADD COLUMN "filterTree" JSONB;
