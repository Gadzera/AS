# Реверс-инжиниринг — Видео 12: «Introducing Call Intelligence» (4:16)

Тема: запись и анализ звонков. Для ТЗ — §13 Call Intelligence. (Транскрипт разобран; детали — в ACADEMY_SPEC §4.)

## Механика (из звука)
- **Call Recorder** автоматически джойнит звонки в **Zoom / Google Meet / Microsoft Teams**, хранит внутри Attio. Транскрипты + AI-саммари + кастомные insight-шаблоны.
- **Настройка:** Account settings → **Call recording** — какие звонки авто-джойнить; ручное добавление рекордера из meeting details; загрузка логотипа рекордера. Авто-джойн после email-синка.
- **Insight templates:** AI суммирует ключевое из встреч. Создаёшь шаблон: слева секции + промпт на каждую (что извлечь/проанализировать/суммировать), вывод **text** или **bullet points**, неограниченно секций. Персональные и командные. Пример sales-шаблона: current tool, needed features, budget, timeline. Любой шаблон к любой записи; переключение шаблонов = разные ракурсы одного звонка.
- **Запуск:** авто-джойн ИЛИ Start Recording на встрече в Attio → allow из waiting room → remove в любой момент.
- **Live-транскрипт** в реальном времени во вкладке Calls; после звонка — финальные insights, **call summary, meeting chapters (на видео), meeting info, speaker stats**.
- **Привязка:** call history на company-записи и person-записи; в meeting details, на activity timeline, на **Calls page** (все звонки workspace; фильтр по участникам/связанным записям; favorites). AE фильтрует свои звонки, менеджер — звонки команды.
- **Playback-режимы:** **pinned mode** (видео+транскрипт+insights при навигации по Attio), **picture-in-picture** (видео поверх всех окон).

## Требования для ТЗ
- Модель Call (record, transcript, summary, chapters, speakerStats, participants, associatedRecords).
- **InsightTemplate** (секции с промптами, формат text/bullets) — персональные/командные; применение к любому звонку.
- Calls page + вкладка Calls на record-странице; фильтры/favorites.
- Настройки рекордера (авто-джойн, ручной, логотип).
- Демо: загрузка/вставка транскрипта → AI-саммари по шаблону → привязка к записи.
- Playback pinned / PiP.

## Сценарии (acceptance)
1. Settings → Call recording: вкл авто-джойн. Звонок → live-транскрипт → после: summary+chapters+speaker stats.
2. Создать insight-шаблон (секции: tool/features/budget/timeline) → применить к звонку → структурированный свод.
3. Calls page: фильтр «я участник»; на company-записи видна история звонков.
