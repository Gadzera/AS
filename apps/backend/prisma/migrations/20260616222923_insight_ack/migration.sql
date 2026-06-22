-- CreateTable
CREATE TABLE "insight_acks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "insightKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insight_acks_orgId_idx" ON "insight_acks"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "insight_acks_orgId_insightKey_key" ON "insight_acks"("orgId", "insightKey");
