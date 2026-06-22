-- M18-2: Dashboards + историч. типы (Historical / Time-in-stage / Stage-change).
-- Dashboard/DashboardWidget (грид виджетов), ReportSnapshot (historical, configHash + идемпотентность),
-- StageTransition (журнал переходов status/stage для time-in-stage/stage-change).

-- CreateTable
CREATE TABLE "crm_dashboards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "crm_dashboards_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_dashboards_orgId_idx" ON "crm_dashboards"("orgId");

-- CreateTable
CREATE TABLE "crm_dashboard_widgets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 6,
    "h" INTEGER NOT NULL DEFAULT 4,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_dashboard_widgets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_dashboard_widgets_orgId_idx" ON "crm_dashboard_widgets"("orgId");
CREATE INDEX "crm_dashboard_widgets_dashboardId_idx" ON "crm_dashboard_widgets"("dashboardId");
ALTER TABLE "crm_dashboard_widgets" ADD CONSTRAINT "crm_dashboard_widgets_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "crm_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "crm_report_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "segmentKey" TEXT NOT NULL DEFAULT '',
    "bucketLabel" TEXT NOT NULL,
    "metricValue" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_report_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_report_snapshots_dedup_key" ON "crm_report_snapshots"("reportId", "configHash", "snapshotAt", "bucketKey", "segmentKey");
CREATE INDEX "crm_report_snapshots_reportId_snapshotAt_idx" ON "crm_report_snapshots"("reportId", "snapshotAt");

-- CreateTable
CREATE TABLE "crm_stage_transitions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_stage_transitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_stage_transitions_orgId_idx" ON "crm_stage_transitions"("orgId");
CREATE INDEX "crm_stage_transitions_attributeId_changedAt_idx" ON "crm_stage_transitions"("attributeId", "changedAt");
CREATE INDEX "crm_stage_transitions_recordId_attributeId_changedAt_idx" ON "crm_stage_transitions"("recordId", "attributeId", "changedAt");
