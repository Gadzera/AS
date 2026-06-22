-- M21-2 адверс-ревью #3: AutomationGrant.workflowId → Workflow с ON DELETE CASCADE (нет orphan-грантов).
-- На случай уже накопленных orphan'ов чистим их перед добавлением FK.
DELETE FROM "crm_automation_grants" g WHERE NOT EXISTS (SELECT 1 FROM "crm_workflows" w WHERE w."id" = g."workflowId");

ALTER TABLE "crm_automation_grants" ADD CONSTRAINT "crm_automation_grants_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
