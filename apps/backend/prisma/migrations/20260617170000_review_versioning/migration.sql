-- AlterTable: версионирование решения ревью (aiRunId + valueFingerprint), M9.3
ALTER TABLE "crm_value_reviews" ADD COLUMN "aiRunId" TEXT,
ADD COLUMN "valueFingerprint" TEXT;

-- DropIndex: убираем unique [recordId, attributeId]
DROP INDEX "crm_value_reviews_recordId_attributeId_key";

-- CreateIndex: unique по версии значения [recordId, attributeId, valueFingerprint]
CREATE UNIQUE INDEX "crm_value_reviews_recordId_attributeId_valueFingerprint_key" ON "crm_value_reviews"("recordId", "attributeId", "valueFingerprint");
