# План постройки AISDR — строго по ТЗ (на паузе, ждёт старта)

> Источник истины: [MASTER_TZ.md](./MASTER_TZ.md) (21 раздел) + [DETAILED_SPEC.md](./DETAILED_SPEC.md)
> (270 сценариев S001–S403, поэкранно). Строим **досконально, скрупулёзно**, не «как получится».
> Текущему коду не доверяем (много что не работает) — каждый модуль сверяем с ТЗ и доводим до спеки.

## Принцип работы (регламент)
- **GPT (мост, порт 9224, проект AISDR) — контролирующий орган.** GPT проектирует/пишет код по
  разделу спеки и ревьюит/одобряет результат. Источники ТЗ уже в «Источниках» проекта ChatGPT.
- **Claude** применяет код к файлам, гоняет миграции/typecheck, делает seed, снимает скриншот,
  прогоняет acceptance-сценарии Sxxx, оркеструет. Баги GPT сам не правит — возвращает GPT.
- **Цикл одного модуля:** GPT план+код → Claude применяет → `prisma migrate` + `tsc=0` (backend и
  frontend) → seed/demo-данные → скриншот экрана (сверка со storyboard) → прогон всех Sxxx модуля →
  GPT ревью/одобрение → коммит → следующий модуль. Один модуль = один чат-блок моста.
- **Definition of Done (на модуль):** backend tsc=0; frontend tsc=0; миграция применена; demo-режим
  работает без внешних ключей; экран совпадает с эталоном; все Sxxx модуля проходят; GPT одобрил.

## Фаза 0 — Аудит фундамента и окружение (перед постройкой)
1. Поднять окружение: Docker (postgres/redis), backend, frontend; **сверить порты** с
   `docker-compose.yml` (в реестре `PORTS_REGISTRY.md` — 18000/13000; в старой памяти — 3099/3010;
   уточнить по факту), demo-вход.
2. Прогнать текущий smoke; зафиксировать что реально работает / что «через жопу».
3. **GPT-аудит:** GPT сверяет текущий код (модели, роуты objects/records/views, CRM-фронт) с
   MASTER_TZ §2–6 и DETAILED_SPEC S001–S092 → список расхождений и план доведения фундамента.
4. Решить судьбу legacy (Lead/Campaign/CampaignLead/Message): оставить как миграционный слой, новый
   функционал строить только на flexible-модели (Object/Attribute/Record/Value).

## Порядок модулей (roadmap, скорректирован под «фундамент сначала»)
| # | Модуль | Раздел ТЗ | Сценарии | Зависит от |
|---|--------|-----------|----------|------------|
| M0 | **Фундамент**: Objects, Attributes, Records, Values, Views — аудит + доведение до ТЗ | §3–6 | S001–S092 | — |
| M1 | **UI создания** Object/Attribute (модалки) — закрыть metadata-UX | §3,4 | S001, S006–S007, S010–S034 | M0 |
| M2 | **AI-атрибуты** (Classify/Summarize/Research/Prompt) + кредиты | §4,15 | S040–S049, S160–S173 | M1 |
| M3 | **Lists** (сайдбар, list page, table/board, list-атрибуты, add-to-list) | §7 | S100–S109, S335–S338 | M0 |
| M4 | **Record page** табы (activity/emails/calls/notes/tasks/files/comments/@mention) | §8 | S120–S137 | M0 |
| M5 | **Email & Calendar sync** + productivity (composer, шаблоны, outbox) | §10 | S140–S149, S386–S392 | M4 |
| M6 | **Sequences** (редактор, шаги, enroll, tracking, unsubscribe, warm-up) | §11 | S200–S224 | M5 |
| M7 | **Workflows** (builder, триггеры, логика, действия, интеграции, runs) | §12 | S230–S247, S255–S276 | M3,M6 |
| M8 | **Reports & Dashboards** (5 типов, виджеты, drill-in) | §14 | S285–S297 | M0 |
| M9 | **Call Intelligence** (recorder, transcript, summary, calls page) | §13 | S310–S322 | M4 |
| M10 | **Import/Migration** (CSV import, маппинг, дедуп, legacy Lead→People/Companies) | §3,16 | S330–S334, S402–S403 | M0 |
| M11 | **Settings/RBAC/Apps/Developers/Billing/Security** | §16 | S345–S356, S362–S381 | M0 |
| M12 | **Notifications / Home / Навигация / Command palette** | §17 | S190, S372, S396–S401 | M0 |
| M13 | **Тестирование** (unit/integration/e2e/smoke по всем Sxxx) + CI | §20 | все | всё |

## Инструменты постройки (уже готовы)
- Мост: `chatgpt-bridge/ask.mjs` (порт 9224); сброс heavy-вкладки `_cdp_reset_tab.mjs`.
- Поток сохранения ответов GPT: `ask.mjs … | Out-File last_answer.json` → парс.
- Загрузка источников в проект ChatGPT: `chatgpt-bridge/upload_sources.mjs` (16 файлов уже залиты).

## Открытые вопросы (решить на старте Фазы 0)
- Порты окружения (18000/13000 vs 3099/3010) — взять из `docker-compose.yml`.
- Глубина переделки фундамента: точечно править или переписать модуль начисто по ТЗ — решит GPT-аудит.
- Формат применения кода от GPT: целые файлы (перезапись) vs патчи — по умолчанию целые файлы.

---
_Статус: ПЛАН СФОРМИРОВАН, на паузе. Старт постройки — по команде пользователя._
