# Реверс-инжиниринг — Видео 16: «How to create sequences» (4:47)

Тема: создание/настройка sequence. Для ТЗ — §11 Sequences. (Транскрипт разобран; детали в ACADEMY_SPEC §3.)

## Создание (из звука)
- Раздел **Automations → Sequences** → **New Sequence** → title (напр. «ICP Inbound Leads»).
- **Settings:**
  - **Sending window** — часы отправки; вне окна письмо в очередь на начало следующего окна.
  - **Лимиты:** 12 писем/час/ящик, пауза 5 мин, 200/день/ящик.
  - Business days only / включить выходные.
  - **Unsubscribe-ссылка** — свой текст + превью.
  - Subsequent emails: тот же тред / новый.
  - Включить Attio-подпись (из mailbox settings).
  - **Exit criteria:** reply received / meeting booked.
  - Доступ (share): по умолчанию весь workspace; можно ограничить.
  - **Delegated sending** — коллега энроллит, письмо из твоего ящика (invite as sender + enable delegated).
- **Email steps:**
  - 1-е письмо — в очередь сразу при enroll (или через N дней wait).
  - **Variables** — персонализация атрибутами person-записи (имя, компания). Шаблон или с нуля.
  - **Add step to sequence** — доп. письма + дни ожидания. Follow-up уходит тем, кто не ответил/не забукал встречу.
  - **Publish sequence** → черновик становится живым.

## Требования для ТЗ
- Модель Sequence (settings: window, limits, businessDays, unsubscribeText, threadMode, signature, exitCriteria, sharing, delegated) + SequenceStep (order, waitDays, subject, body с variables) + Enrollment (recipient, sender, status, currentStep).
- Воркер отправки с лимитами + exit criteria + авто-follow-up.
- Редактор: settings + шаги + variables + шаблоны + publish.

## Сценарии (acceptance)
1. New Sequence → settings (window 9-18, exit=reply/meeting, delegated on) → step1 (template, var name) → add step2 (wait 3d, follow-up) → publish.
2. Получатель отвечает → exit; не отвечает 3 дня → follow-up.
