-- M9.8: снимки значения в решении ревью (valueBefore/valueAfter) для полного provenance/audit.
ALTER TABLE "crm_value_reviews" ADD COLUMN "valueBefore" TEXT,
ADD COLUMN "valueAfter" TEXT;
