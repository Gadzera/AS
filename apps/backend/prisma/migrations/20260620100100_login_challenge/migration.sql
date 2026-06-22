-- M23-1 адверс-ревью #2: одноразовый challenge 2-step логина (anti-replay).
CREATE TABLE "crm_login_challenges" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_login_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_login_challenges_jti_key" ON "crm_login_challenges"("jti");
CREATE INDEX "crm_login_challenges_userId_idx" ON "crm_login_challenges"("userId");
