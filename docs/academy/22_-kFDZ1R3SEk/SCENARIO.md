# Реверс-инжиниринг — Видео 22: «Workflows — HTTP and JSON blocks» (4:16)

Тема: утилитарные блоки HTTP/JSON. Для ТЗ — §12 Workflows (Integration/Utility).

## Механика (из звука)
- **HTTP request** (=webhook) — отправка данных во внешние тулы. Методы: **POST / DELETE / GET / HEAD / PATCH / PUT**. Поля: URL (из внешнего тула), headers (auth Bearer), body (с переменными). Пример: record updated (workspace priority) → POST в Intercom (workspace ID + priority).
- **Parse JSON** — входящий JSON → набор переменных. Вход: raw JSON string (webhook payload). Для каждого поля: **path** (напр. name) + **output type** (string / number / boolean / array) + **alias** (читаемое имя). Пример: webhook от booking-софта → parse JSON (name, email…) → create/update person (match по email) → create deal (Contacted, т.к. встреча забукана) + notes.

## Требования для ТЗ
- HTTP-блок: метод (6), URL, headers (auth), body с переменными.
- Parse JSON-блок: raw JSON → поля (path + type string/number/boolean/array + alias) → переменные.
- Связка webhook receive trigger → parse JSON → create/update records.

## Сценарии (acceptance)
1. Workspace priority changed → HTTP POST в Intercom с workspace ID + priority.
2. Booking webhook → parse JSON (name/email) → create person (match email) + create deal (Contacted).
