-- DSH-1: идемпотентность создания дашбордов и виджетов (clientRequestId)

ALTER TABLE "crm_dashboards" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "crm_dashboards_orgId_clientRequestId_key" ON "crm_dashboards"("orgId", "clientRequestId");

ALTER TABLE "crm_dashboard_widgets" ADD COLUMN "clientRequestId" TEXT;
CREATE UNIQUE INDEX "crm_dashboard_widgets_dashboardId_clientRequestId_key" ON "crm_dashboard_widgets"("dashboardId", "clientRequestId");
