# Реверс-инжиниринг — Видео 26: «Introduction to Workflows» (9:00)

Тема: общий обзор конструктора воркфлоу. Для ТЗ — §12 Workflows (база). (Транскрипт разобран; детали в ACADEMY_SPEC §2.)

## Структура (из звука)
- **Canvas** (слева) — блоки и путь между ними; **Editor** (справа) — настройка выбранного блока.
- **4 категории блоков:** Trigger, Logic, Action, Integration.
- Каждый воркфлоу начинается с **trigger** (когда запускать).

## Простой пример
Trigger **record updated** (deal stage) → **Filter** (new value = Won) → **Action** add record to list (associated company → Customer Success list, заполнить customer lifecycle stage/onboarding stage fixed) → **Integration** Slack (поздравление, переменные company name + contract value).
- **Runs**-вкладка: прохождение по блокам в реальном времени + ретроспективно.

## Продвинутый пример (PLG, Segment-данные)
Trigger MRR attribute updated (workspace) → **Formula** (new − old MRR) → **Filter** (≠0) → **Switch** на 3 пути:
- result > 0 (рост): Slack новый MRR + HTTP POST в Intercom.
- advanced filter (result < 0 AND workspace active = downgrade): **Create task** account-менеджеру + **Adjust time** (+2 дня = due date).
- workspace status cancelled: **Classify** AI причины отмены (free text → теги) → update workspace cancellation reason (анализ churn).
- **Advanced filters:** комбинации AND/OR + группировка.

## Переменные и шаблоны
- Переменные из любого предыдущего блока (отображаются в обратном порядке; видно «N блоков назад»).
- **Библиотека шаблонов** воркфлоу по индустриям.

## Требования для ТЗ
- Конструктор: canvas (@dnd-kit) + editor; блоки 4 категорий; переменные между блоками; runs-лог; шаблоны.
- Switch + advanced filters (AND/OR/группировка).

## Сценарии (acceptance)
1. record updated → filter → add to list → Slack; смотреть runs.
2. MRR updated → formula → filter → switch(3) → действия по веткам.
