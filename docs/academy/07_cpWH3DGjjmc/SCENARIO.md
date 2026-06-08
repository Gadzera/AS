# Реверс-инжиниринг — Видео 07: «Introduction to Reports» (3:23)

Тема: 5 типов отчётов и когда их применять. Для ТЗ — §14 Reports & Dashboards.

## Экран (по кадру)
**f_00060 — New report, выбор типа:**
- «What do you want to report on? Select the type of report you want to build».
- **Create your own:** **Insight** («Report on the current state of your business»), **Historical values** («See how your data has changed over time»).
- **Pipeline reports:** **Funnel** («Track progress and conversion through your pipelines»), **Time in stage** («Track how much time is spent in your pipelines»), **Stage changed** («See how many records move to specific stages»).
- Центр: «Input needed to display chart — Select a data source». Внизу Helpful resources → Documentation.
- Отчёты группируются в **dashboards**.

## 5 типов отчётов (из звука)
1. **Insight** — самый гибкий, текущее состояние данных. Выбираешь **group by** + **segment by**; любой атрибут на X (включая date-атрибуты). Примеры: deals по stage × owner; сколько сделок добавлено в воронку понедельно (created date как timestamp group-by + cadence weekly).
2. **Historical** — серия исторических снимков: как менялся состав воронки во времени (число сделок в каждом stage на конец каждой недели;总 число клиентов на конец недели). Даты на X — это снимки на конец периода, НЕ date-атрибут.
3. **Funnel** (pipeline, только для **status**-атрибутов) — конверсия/отвал по статусам до целевого end-stage (conversion rate, loss rate).
4. **Time in stage** (pipeline) — min/max/average время, проводимое записями в каждом stage.
5. **Stage change** (pipeline) — число ИЛИ value записей, перешедших в стадии; переключение метрики **count records ↔ deal value** (напр. revenue, помеченный как Won).

## Требования для ТЗ
- Билдер отчёта: выбор типа (5), выбор data source (объект/список), измерения (group by/segment by/X-axis), метрика (count/value).
- Визуализации: line/bar/funnel/pie/map (из §G research).
- **Dashboards** — группировка отчётов; права на уровне дашборда (видео 01).
- Pipeline-отчёты работают по status-атрибутам.

## Сценарии (acceptance)
1. New report → Insight → data source Deals → group by stage, segment by owner → bar-chart.
2. Insight → X=created date, cadence weekly → сделок в воронку по неделям.
3. Funnel по deal stage → конверсия по стадиям. Stage change → переключить count↔deal value.
