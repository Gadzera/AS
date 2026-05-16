CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_orgId_service_key" ON "ApiKey"("orgId", "service");
