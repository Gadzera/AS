-- DSH-2: inline immutable reportConfig-виджеты. reportId становится nullable (inline-виджет без отчёта),
-- добавляется inlineConfig (снимок конфигурации). Ровно один из (reportId, inlineConfig) задан — проверяется в коде.

ALTER TABLE "crm_dashboard_widgets" ALTER COLUMN "reportId" DROP NOT NULL;
ALTER TABLE "crm_dashboard_widgets" ADD COLUMN "inlineConfig" JSONB;
