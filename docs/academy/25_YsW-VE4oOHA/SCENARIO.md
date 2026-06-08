# Реверс-инжиниринг — Видео 25: «Workflows — AI Research agent» (3:24)

Тема: блок Research Agent. Для ТЗ — §12 Workflows (AI) + §15 (research, 10 кредитов).

## Механика (из звука)
- **Research Agent** блок: выбрать запись + ввести набор вопросов → AI скрейпит запись И интернет → возвращает ответы. Результат → заполнить атрибуты / триаж лидов / follow-up задачи / в downstream-систему.
- Пример: trigger record created (workspace) → **Research Agent** (associated company, вопросы: «сколько подняли от VC за 5 лет», «бизнес-модель») → **Classify text** (ответы агента + определение ICP → ICP/agency/investor/other) → **Update record** (company type) → **Filter** ICP only → **Round robin** → **Create deal** → **Slack** алерт sales.

## Требования для ТЗ
- Research Agent блок: запись + вопросы → ответы (демо: детерминированный бриф; с ключом — веб-ресёрч). 10 кредитов.
- Цепочка research → classify → update → filter → create/notify.

## Сценарии (acceptance)
1. Workspace created → research agent (funding, business model) → classify ICP → update company type → if ICP → round robin → create deal → Slack.
