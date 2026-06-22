-- DSH-2/MEDIUM-2: жёсткая гарантия "ровно один источник" на уровне БД.
-- Раньше инвариант (reportId XOR inlineConfig) держался ТОЛЬКО в коде (zod .refine).
-- CHECK делает строки both-null / both-set структурно невозможными (defense-in-depth).
ALTER TABLE "crm_dashboard_widgets"
  ADD CONSTRAINT "dashboard_widget_one_source"
  CHECK (("reportId" IS NULL) <> ("inlineConfig" IS NULL));
