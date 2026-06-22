-- M21-2: Teams + Automation grants + Expert groups (S347/S350/S351/S352/S353/S356).

-- CreateTable: Team
CREATE TABLE "crm_teams" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_teams_orgId_name_key" ON "crm_teams"("orgId", "name");
CREATE INDEX "crm_teams_orgId_idx" ON "crm_teams"("orgId");

-- CreateTable: TeamMember
CREATE TABLE "crm_team_members" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_team_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_team_members_teamId_userId_key" ON "crm_team_members"("teamId", "userId");
CREATE INDEX "crm_team_members_orgId_idx" ON "crm_team_members"("orgId");
CREATE INDEX "crm_team_members_userId_idx" ON "crm_team_members"("userId");
ALTER TABLE "crm_team_members" ADD CONSTRAINT "crm_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "crm_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AutomationGrant
CREATE TABLE "crm_automation_grants" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "entityKind" "EntityKind" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_automation_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_automation_grants_orgId_workflowId_entityKind_entityKey_key" ON "crm_automation_grants"("orgId", "workflowId", "entityKind", "entityKey");
CREATE INDEX "crm_automation_grants_orgId_workflowId_idx" ON "crm_automation_grants"("orgId", "workflowId");
