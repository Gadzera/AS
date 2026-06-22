-- AlterTable
ALTER TABLE "crm_calls" ADD COLUMN     "aiIntent" TEXT,
ADD COLUMN     "aiObjections" TEXT[],
ADD COLUMN     "aiRisk" TEXT;
