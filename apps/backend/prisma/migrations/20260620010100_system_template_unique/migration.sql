-- M19-1 адверс-ревью M1: гонка ensureSystemTemplates могла создать дубли системных шаблонов.
-- Партиальный unique-индекс по (orgId, name) ТОЛЬКО для системных — create станет P2002-safe,
-- не задевая пользовательские шаблоны с одинаковыми именами.
CREATE UNIQUE INDEX "crm_insight_templates_system_name_key"
  ON "crm_insight_templates" ("orgId", "name")
  WHERE "isSystem" = true;
