-- M23-2: Workspace General (logo/domain) + workspace theme default (S373/S374).
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "companyDomain" TEXT;
ALTER TABLE "Organization" ADD COLUMN "themeDefault" TEXT;
