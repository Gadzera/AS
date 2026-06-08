# Реверс-инжиниринг — Видео 17: «Workflows — How to trigger a workflow» (4:49)

Тема: все типы триггеров. Для ТЗ — §12 Workflows (Trigger).

## Полный список триггеров (из звука)
**Record и List triggers** (по 3 одинаковых):
- **Command** (record / list entry command) — ручной запуск воркфлоу на конкретной записи/entry.
- **Created** — при создании новой записи объекта / добавлении записи в список.
- **Updated** — при изменении записи объекта / entry списка.

**Attribute updated** — как record updated, но срабатывает И при первом создании записи. Можно указать конкретный атрибут.

**Task created** — при создании задачи.

**Utility triggers:**
- **Manual run** — для отладки/тестов; кнопка «Trigger manual workflow» в редакторе → run page.
- **Recurring schedule** — расписание (частота + время суток).
- **Webhook receive** — даёт URL, на который внешний тул шлёт webhook/HTTP POST (запуск процессов извне).

**Integration triggers (нативные):**
- **Outreach** — contact добавлен в sequence / изменилось состояние sequence.
- **Typeform** — получен новый ответ формы (inbound-лиды).

## Примеры
- Record command на companies → create deal (variables: company name=deal name, stage=qualification, owner=триггернувший юзер, associated company). Кнопка «Run workflow» на view и record-странице.
- Record updated на deals (атрибут stage) + filter (new value = Won) → поздравление команды.

## Требования для ТЗ
- Триггеры: record/list (command/created/updated), attribute updated (fires on create), task created, utility (manual/schedule/webhook), integration (Outreach/Typeform).
- Updated-триггер возвращает before/after значения атрибута как переменные.
- Кнопка Run workflow на view/record (для command-триггера).

## Сценарии (acceptance)
1. Record command на companies → Run workflow на компании → создаётся связанный deal.
2. Record updated (deal stage) + filter new=Won → действие.
3. Webhook receive → внешний POST запускает воркфлоу.
