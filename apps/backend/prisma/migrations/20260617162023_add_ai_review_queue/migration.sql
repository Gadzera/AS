-- CreateEnum
CREATE TYPE "AiReviewStatus" AS ENUM ('APPROVED', 'REJECTED', 'EDITED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'AI_VALUE_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_VALUE_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'AI_VALUE_EDITED';

-- CreateTable
CREATE TABLE "crm_value_reviews" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "status" "AiReviewStatus" NOT NULL,
    "confidence" INTEGER,
    "note" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_value_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_value_reviews_orgId_idx" ON "crm_value_reviews"("orgId");

-- CreateIndex
CREATE INDEX "crm_value_reviews_attributeId_idx" ON "crm_value_reviews"("attributeId");

-- CreateIndex
CREATE INDEX "crm_value_reviews_status_idx" ON "crm_value_reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_value_reviews_recordId_attributeId_key" ON "crm_value_reviews"("recordId", "attributeId");
