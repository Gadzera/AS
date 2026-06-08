# Реверс-инжиниринг — Видео 23: «Workflows — Integration blocks» (4:37)

Тема: интеграционные блоки. Для ТЗ — §12 Workflows (Integration).

## Механика (из звука)
- Нативные интеграции: **Typeform, Slack, Outreach, Mixmax, Mailchimp** (+ generic HTTP из видео 22).
- **Email-sequence блоки:** add to Mixmax / Outreach / Mailchimp sequence (admin настраивает connection в settings; выбрать connection + sequence + variables email/name).
- **Update list entry** (вне loop) — обновить stage + дату.
- **Slack message** — workspace + channel + сообщение с переменными; Slack-форматирование (`*bold*`, `_italic_`).
- **Slack actions** — кнопки в Slack-сообщении; воркфлоу **ставится на паузу** после отправки, пока кто-то не нажмёт кнопку → запускает дальнейшие действия. Пример triage-лида: кнопки «triage to Zev / to me / disqualified / in pipeline» → по нажатию обновляется owner+stage (Contacted/Unqualified/Duplicate).
- Integration **триггеры**: Outreach (contact added to sequence / state change), Typeform (form response).

## Требования для ТЗ
- Integration-блоки: add to sequence (Outreach/Mixmax/Mailchimp), Slack message (+форматирование), **Slack actions** (кнопки → пауза воркфлоу → ветвление по выбору).
- Admin-настройка connection в settings.

## Сценарии (acceptance)
1. List entry command → loop users → add to Mixmax sequence → update list entry stage → delay 10d → if still offered → Slack alert.
2. New lead deal → Slack actions (4 кнопки) → воркфлоу ждёт → по кнопке обновляет owner+stage.
