-- M23-1: UserSession (per-device) + 2FA (TOTP) + theme pref (S380/S374).

-- AlterTable: User — 2FA + theme
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorPendingSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "themePref" TEXT;

-- CreateTable: UserSession
CREATE TABLE "crm_user_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "crm_user_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_user_sessions_jti_key" ON "crm_user_sessions"("jti");
CREATE INDEX "crm_user_sessions_userId_revokedAt_idx" ON "crm_user_sessions"("userId", "revokedAt");
ALTER TABLE "crm_user_sessions" ADD CONSTRAINT "crm_user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: UserRecoveryCode
CREATE TABLE "crm_user_recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_user_recovery_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_user_recovery_codes_userId_idx" ON "crm_user_recovery_codes"("userId");
ALTER TABLE "crm_user_recovery_codes" ADD CONSTRAINT "crm_user_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
