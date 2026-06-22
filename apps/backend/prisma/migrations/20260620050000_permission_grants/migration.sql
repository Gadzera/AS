-- M21-1: Permissions / RBAC core (S345/S346/S348/S349/S355).

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('NONE', 'READ', 'READ_WRITE', 'FULL');
CREATE TYPE "PermissionScope" AS ENUM ('WORKSPACE', 'TEAM', 'INDIVIDUAL');
CREATE TYPE "EntityKind" AS ENUM ('OBJECT', 'LIST', 'DASHBOARD', 'WORKFLOW', 'SEQUENCE');

-- CreateTable
CREATE TABLE "crm_permission_grants" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "entityKind" "EntityKind" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_permission_grants_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "crm_permission_grants_orgId_scope_subjectKey_entityKind_entit_key" ON "crm_permission_grants"("orgId", "scope", "subjectKey", "entityKind", "entityKey");
CREATE INDEX "crm_permission_grants_orgId_entityKind_entityKey_idx" ON "crm_permission_grants"("orgId", "entityKind", "entityKey");
CREATE INDEX "crm_permission_grants_orgId_subjectKey_idx" ON "crm_permission_grants"("orgId", "subjectKey");
