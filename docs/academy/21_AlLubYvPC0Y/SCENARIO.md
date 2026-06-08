# Реверс-инжиниринг — Видео 21: «Workflows — bulk actions (Loop & Find)» (3:22)

Тема: массовые действия через Loop + Find. Для ТЗ — §12 Workflows.

## Механика (из звука)
- **Loop** — действие над несколькими записями. Вход **iterable** (набор записей, напр. people, связанные с компанией = team). Опц. **limit**. Блоки ВНУТРИ loop выполняются по разу на каждую запись (current record = переменная).
  - Пример: record command (company) → loop по team → внутри add record to list (current person → marketing list).
- **Find records** — найти записи по критериям. **Лимит 100**. Пример: schedule (Mon midday) → find deals где next due task between today..+1week → loop → slack по каждому.
- Без loop после find действие выполнится только на ПЕРВОЙ найденной записи.

## Требования для ТЗ
- Loop-блок (iterable: записи/relationship, limit, вложенные блоки per-record, current-переменная).
- Find records (критерии, limit 100).
- Комбо find→loop для bulk.

## Сценарии (acceptance)
1. Company command → loop team → add each person to marketing list.
2. Schedule → find deals (task due ≤1w) → loop → slack per deal.
