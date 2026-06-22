# AISDR — MASTER-ПЛАН ПРИЁМКИ (полный сервис, КАЖДЫЙ сценарий и элемент согласован с GPT)

> Цель: довести сервис до состояния, где работает КАЖДАЯ кнопка/поле/таб/модалка/фильтр с реальной
> логикой (живой backend) и поэлементной приёмкой у GPT. Объём — НЕ 11 экранов, а **весь каталог
> S001–S403 (≈270 сценариев, 21 модуль)** + наша AI-SDR-надстройка (Cockpit/Pipeline/Replies/Meetings/
> Research/Playbooks/Learning). Письма и внешние интеграции (SMTP, calendar, реальные провайдеры) —
> ПОЗЖЕ; сейчас демо-режим, остальная логика реальная. Гринд непрерывный, без докладов «кусками».
>
> Истина: [MASTER_TZ.md](./MASTER_TZ.md) · [DETAILED_SPEC.md](./DETAILED_SPEC.md) ·
> [SCENARIOS_CATALOG.md](./SCENARIOS_CATALOG.md) (полный список Sxxx) · [ACADEMY_SPEC.md](./ACADEMY_SPEC.md).

## 0. НЕРУШИМЫЙ РЕГЛАМЕНТ
- **ЗАКОН A — реальные скриншоты на КАЖДОЕ изменение** (картинка-файл в чат через `ask.mjs --image`,
  не имя; проверять `images:N>0`; после правки — пере-снять и переслать; скрин доказывает работу).
- **ЗАКОН B — одно согласование = ОДИН чат GPT** (без новых чатов; `--new-chat` не давать, `--block`
  не менять; проверять `rotated:false`).
- **Поэлементно:** на каждый экран/сценарий — реестр элементов → сценарий+endpoint → реализация →
  доказательный скрин → блок в чат → цикл правок до явного «принимаю». Мёртвый элемент = брак.
- **GPT — контролирующий орган по ВСЕМ сценариям.** GPT держит мастер-чек-лист S001–S403, знает что
  принято / что прислано / что ещё НЕ прислано, задаёт порядок, ревьюит каждый скрин. Этот файл —
  хребет, синхронизируется с GPT.
- **DoD сценария/экрана:** элементы работают вживую; показаны GPT реальным скрином; GPT сказал
  «принимаю»; backend tsc=0; frontend tsc=0.
- Инструмент: мост `chatgpt-bridge/ask.mjs` (:9224). Скрины — `_shot_*.mjs` (:9225), взаимодействие
  ИЗНУТРИ страницы (`page.evaluate` + нативный `el.click()`/сеттеры). Логин demo@aisdr.dev/demo1234.
  Frontend :3010, backend :3001.

## 1. МАТРИЦА ПОКРЫТИЯ — все 21 модуль / S001–S403 (статус приёмки GPT)
Легенда: ☐ не начат · 🟡 частично (есть код/движок, не принят) · ✅ принято GPT · ⏸ отложено (внешние сервисы).

| М | Модуль | Сценарии | Наша поверхность (экран) | Кол-во | Статус |
|---|--------|----------|--------------------------|:---:|:---:|
| 1 | Objects | S001–S007 | Settings → Data model | 7 | ✅ |
| 2 | Attributes (16 типов) | S010–S034 | Data model · Add field modal | 23 | ✅ |
| 3 | Relationships | S040–S049 | Data model · Relationship field | 10 | ✅ (reverse-side на target — долг) |
| 4 | Records | S060–S067 | Data Hub, Record drawer | 8 | ✅ |
| 5 | Views (filter/sort/columns/board/save) | S080–S092 | Data Hub controls | 13 | 🟡 |
| 6 | Lists | S100–S109 | Lists (/lists — ПОСТРОЕНО: route+экран) | 10 | ✅ (MVP; pipeline/dynamic — долг) |
| 7 | Record page + табы | S120–S137 | Record drawer (Activity ✅; Emails/Calls/Notes/Tasks — в их модулях) | 18 | 🟡 (карточка ПРИНЯТА MVP, доп.табы позже) |
| 8 | Email-инструмент | S140–S149 | Outreach / Compose / Templates / Tasks / Outbox | 10 | 🟡⏸ (отправка позже) |
| 9 | AI-атрибуты (Classify/Summarize/Research/Prompt) | S160–S173 | Object editor AI, Data Hub run, кредиты | 14 | 🟡 |
| 10 | Ask AISDR (AI-ассистент) | S180–S190 | Agent Cockpit / ассистент | 11 | ☐ |
| 11 | Sequences | S200–S224 | Outreach Studio / Sequence editor | 25 | 🟡 |
| 12 | Workflows: триггеры + логика | S230–S247 | Workflow builder (ПОСТРОИТЬ) | 18 | ☐ |
| 13 | Workflows: действия/AI/интеграции/runs | S255–S276 | Workflow builder | 22 | ☐ |
| 14 | Reports & Dashboards (5 типов) | S285–S297 | Reports (ПОСТРОИТЬ) | 13 | ☐ |
| 15 | Call Intelligence | S310–S322 | Meetings / Calls page | 13 | ☐ |
| 16 | Import / Migration | S330–S338 | Data Hub Import | 9 | 🟡 |
| 17 | Permissions / RBAC | S345–S356 | Settings / Permissions | 12 | ☐ |
| 18 | Apps & Integrations | S362–S367 | Settings / Apps / Developers | 6 | ☐⏸ |
| 19 | Settings / Workspace / Billing | S372–S381 | Settings (Personal/Workspace/Plans/Billing/Security) | 10 | ☐ |
| 20 | Email sync & enrichment | S386–S392 | (внешние) | 7 | ⏸ позже |
| 21 | Notifications / collaboration / демо / onboarding | S396–S403 | Topbar / Onboarding / seed | 8 | ☐ |
|   | **ИТОГО** | **S001–S403** | | **≈270** | |

> Детали каждого Sxxx — в [SCENARIOS_CATALOG.md](./SCENARIOS_CATALOG.md) и [DETAILED_SPEC.md](./DETAILED_SPEC.md).

## 2. НАША AI-SDR-НАДСТРОЙКА (экраны навигации — поверх модулей выше)
Эти экраны — «лицо» продукта (не структура Attio). Каждый принимается поэлементно.
| Экран | Маршрут | Опирается на модули | Статус |
|-------|---------|---------------------|:---:|
| Auth: Register / Login / Forgot+Reset | /register /login /forgot-password /reset-password | — | ✅ ПРИНЯТО A1–A3 |
| Onboarding-визард | (S403) | 1,21 | ☐ |
| **Agent Cockpit** | /dashboard | 10,21, дайджест | ✅ ПРИНЯТО (AC1–AC6, production-ready) |
| **Data Hub** | /data | 4,5,9,16 | ✅ ПРИНЯТО (WIN-DATAHUB) |
| **Pipeline Radar** | /pipeline | 5,14, agent_stage | ✅ ПРИНЯТО (PR1–PR2, переписан на agent_stage) |
| **Outreach Studio** + кампании | /outreach /campaigns | 8,11 | ✅ ПРИНЯТО (OS1–OS3, легаси-мок вырезан) |
| **Replies** | /replies | 8,11,21 | ✅ ПРИНЯТО (RE1–RE3, редизайн легаси) |
| **Meetings** | /meetings | 15 | ✅ ПРИНЯТО (ME1–ME3, построен с нуля: модель+роут) |
| **Research Lab** | /research | 9,10 | ✅ ПРИНЯТО (RS1–RS2, живой DeepSeek-research) |
| **Playbooks** | /playbooks | 11,12 | ✅ ПРИНЯТО (PB1 полностью: baseline+spine+rail switching+Regenerate, 2026-06-17) |
| **Learning** | /learning | 14, обучение на исходах | ✅ ПРИНЯТО (LE1 полностью: baseline+grounded insights+Mark-reviewed persist+Review-in-playbook nav, 2026-06-17) |
| **Ask AISDR** | /ask | 10 | ✅ ПРИНЯТО (AK1–AK3: baseline UI+grounded answer+citations+action path/confirm/observable task+audit, 2026-06-17) |
| **Workflow builder** | /workflows | 12,13 | ✅ ПРИНЯТО (WF1–WF4: list+run history, конструктор trigger/condition/actions+persist, dry-run observable, enable/disable+reload, 2026-06-17) |
| **Call Intelligence** | /calls | 15 | ✅ ПРИНЯТО (CL1–CL4: list+detail+AI summary+insights intent/objections/risk, create-task, outcome→lead/meeting/workflow side-effects, 2026-06-17) |
| **Reports & Dashboards** | /reports | 14 | ✅ ПРИНЯТО (RD1–RD3: 5 типов отчётов, строгая воронка, drilldown→лиды, campaign-фильтр, saved reports save/load/delete, CSV, метрик-консистентность, 2026-06-17) |
| **Settings / RBAC / Billing** | /settings | 17,18,19 | ✅ ПРИНЯТО (Account/Workspace-persist/Billing+credits+ledger+demo-gate/Mailboxes-capacity-sync/RBAC end-to-end+403+session-revoke/Integrations honest-stub, 2026-06-17) |
| **Notifications / Onboarding** | /notifications | 21 | 🔨 СТРОИТСЯ (next по приоритету GPT: handoff-очередь filters/statuses/actions/empty/onboarding) |
| **Settings** (+Objects, редактор) | /settings /settings/objects | 1,2,17,18,19 | 🟡 |
| Сквозные: Sidebar/Topbar/Command palette/Record drawer/модалки | глобально | 7,21 | ☐ |

## 3. ПОРЯДОК (определяет GPT как контролёр; базовая логика — фундамент → надстройка → путь пользователя)
Фундамент (M1 Objects → M2 Attributes → M5 Views → M4 Records → M7 Record page) → AI (M9) →
Lists (M6) → Sequences (M11) → Workflows (M12–13) → Reports (M14) → Call Intelligence (M15) →
Import (M16) → Settings/RBAC/Billing (M17–19) → Notifications/Onboarding (M21). Параллельно — наши
экраны навигации поверх готовых модулей. Каждый экран/сценарий — до явного «принимаю» GPT.

## 4. DATA HUB (/data) — текущий статус
**Принято GPT (реальные скрины, по одному + полное описание):** F1; G1/G2/G3 (Push: модалка/тост/
результат); H1/H2/H3 (Campaign: модалка/тост/наблюдаемый enroll в кампании); C1/C2/C3/C4 (Filter/Sort/
Columns); D1/D2/D3 (Views); E1/E2 (Segment: модалка + сегмент во вкладке Segments). → покрывает части
S066, S083–S088, S088-segments.
**Построено/исправлено по ходу:** copy сегмент-модалки; «Total records»→«Records in view»; backend
nulls-last сортировка; object-aware лейблы (All people/Person вместо All companies/Company); тост стадии
«Meeting set»; карточка Recipients на экране кампании; ДОСТРОЕН листинг вкладки Segments (был пустой).
**Import (B1/B2/B3) — ПРИНЯТО:** маппинг+дедуп+предпросмотр; сводка created 2/updated 1/skipped 0;
импортированная Northwind Robotics видна в таблице. → S330–S332, S338.
**🏆 DATA HUB — ФИНАЛЬНО ПРИНЯТО GPT (WIN-DATAHUB)** — все группы (Baseline, F, C1–C4, D1–D3, G1–G3,
H1–H3, E1–E2, B1–B3). На этот раз по-настоящему (каждый элемент — реальный скрин + полное описание).
**Минорные долги (в память, не блокеры):** disabled-кнопка сегмента приглушить сильнее; confirm на
удаление сегмента; склонение «1 фильтр · 0 сортировок»; легаси-дизайн экрана кампании → редизайн на S4.

## 5. ЖУРНАЛ ПРИЁМКИ (сверху-вниз)
- 2026-06-17 — **🏆 REPORTS & DASHBOARDS (/reports) — ПРИНЯТ ПОЛНОСТЬЮ GPT (RD1–RD3).** Расширение принятой базы
  (тренды/период/CSV) до S285–S297: 5 ТИПОВ ОТЧЁТОВ (табы Overview/Funnel/Sequences/Replies/Automation — каждый
  свой состав секций), CAMPAIGN-ФИЛЬТР (пересчёт KPI/funnel/sequence на лиды кампании, availableCampaigns),
  DRILLDOWN (клик по стадии воронки → реальные лиды из /analytics/drill, counts совпадают с воронкой),
  SAVED REPORTS (модель SavedReport + миграция + save/load/delete, backend-persist через reload). По ходу
  закрыты 3 дефекта консистентности от GPT: (1) строгая воронка — убран «Positive», стадии = кумулятивные
  «reached-at-least» union-множества (монотонно, >100% невозможно); (2) sequence Replied = distinct-лиды с
  входящим (== funnel/KPI), Reply rate = replies/sent; (3) KPI Meeting rate = meetingsReached/repliedReached
  (== переход воронки). Converted единый = Lead.status CONVERTED во всех местах. backend/frontend tsc=0.
  Приоритет дальше (по GPT): Settings/RBAC/Billing → Notifications/Onboarding.
- 2026-06-17 — **🏆 CALL INTELLIGENCE (/calls) — ПРИНЯТ ПОЛНОСТЬЮ GPT (CL1–CL4).** AI-инсайты (intent/objections/
  risk/next step, миграция call_ai_insights), live summarize+persist, create-task, outcome→lead/meeting/workflow
  каскад. backend/frontend tsc=0.
- 2026-06-17 — **🏆 ASK AISDR (/ask) — ПРИНЯТ ПОЛНОСТЬЮ GPT (AK1–AK3). ПОСТРОЕН С НУЛЯ.** Grounded-ассистент:
  backend services/ask.ts (gatherContext из реальных агрегатов org + DeepSeek с правилом «answer STRICTLY from
  context, NEVER invent» + demo-fallback) + роут /api/ask (POST + /starters) + страница /ask (чат) + пункт
  навигации «Ask AISDR» (кнопка-герой сайдбара → /ask). AK1 baseline (контекст-строка 13 leads/8 replies/…,
  empty-state, контекст-зависимые starters, safety-дисклеймер), AK2 grounded answer + citations (DevTools 100%
  /Jonah score 83, кликабельные источники→/leads/:id), AK3 action-path (предложение→Confirm & create task→
  POST /api/notifications, реальная задача, наблюдаема в Notifications «just now» + аудит-след «Proposed by Ask
  AISDR · confirmed by you», привязка к leadId). Endpoint /api/ask НЕ мутирует — human-in-the-loop. Minor GPT
  закрыты: disabled send-кнопка, small-sample caution, segment citation href, audit trail. Долги (non-blocker):
  per-question «not enough data» negative-state, усиленный confirm-copy для risky actions. backend/frontend tsc=0.
  Приоритет дальше: Workflow builder → Call Intelligence → Reports.
- 2026-06-17 — **🏆 LEARNING (/learning) — ПРИНЯТ ПОЛНОСТЬЮ GPT (LE1).** LE1 baseline (proof-strip из 6 живых
  метрик overview/replies; карточки Learning Insight из реальных агрегатов — type/scope/confidence/impact,
  «what the agent learned», evidence, counter-evidence, recommended) → визуально принят. Доказательства:
  (1) «Mark reviewed» РЕАЛЬНО ПЕРСИСТИТ — добавлена таблица insight_acks + ack привязан к стабильному ключу
  sha1(type|scope), POST /api/insights/ack, переживает reload (LLM пере-сформулировал title — отметка
  сохранилась); (2) «Review in playbook» переносит контекст (focus+title) → /playbooks, баннер «From Learning»
  + авто-преселект релевантного плейбука (DevTools-инсайт → Enterprise Decision Makers). Minor GPT закрыты:
  бейдж «AI · grounded by outcomes» (провайдер в tooltip), CTA «Open»→«Review in playbook», малая выборка →
  «Needs more data». backend/frontend tsc=0. Приоритет дальше: Ask AISDR → Workflow builder → Call Intel → Reports.
- 2026-06-17 — **🏆 PLAYBOOKS (/playbooks) — ПРИНЯТ ПОЛНОСТЬЮ GPT (PB1).** Возобновил приёмку после
  восстановления моста. PB1 baseline (рейл кампаний-плейбуков, brief-плитки, Strategy spine из 8 секций,
  agent-authored из реальных агрегатов) → визуально принят; затем 2 функциональных доказательства: rail
  switching (Re-engagement→Enterprise Decision Makers, header+8-секц. spine перегенерированы, подтверждён
  сетевой GET /playbooks/:id/strategy) и Regenerate (зум на кнопку: спиннер+disabled, ровно 1 реальный
  strategy-request). По minor GPT: бейдж движка → «AI · grounded by campaign data» (провайдер в tooltip).
  frontend tsc=0. Приоритет GPT дальше: Learning → Ask AISDR → Workflow builder → Call Intelligence →
  Reports & Dashboards.
- 2026-06-15 — **🟡 PLAYBOOKS (/playbooks) — ПОСТРОЕН, ждёт вердикта GPT.** Редизайн: вырезан мок (правый рейл
  suggestions, perf-strip, attention-рейл, мёртвые табы Console/Library/Performance/Versions, кнопки New
  playbook/Review AI suggestions). Чистая реальная версия: кампании-плейбуки + brief + Strategy spine из 8
  секций (живой /api/playbooks/:id/strategy, generateStrategy из реальных агрегатов кампании) + Regenerate.
  PB1-скрин отправлен GPT, но мост вернул блок «Unusual activity detected» (OpenAI rate-limit автоматизации) —
  вердикт НЕ получен. Повторить приёмку PB1 после восстановления моста (подождать / открыть вкладку ChatGPT
  вручную). frontend tsc=0. Дальше по порядку: Learning.
- 2026-06-15 — **🏆 RESEARCH LAB (/research) — ПРИНЯТ GPT (MVP). РЕДИЗАЙН** на живой research-движок (компании +
  AI Research-поле). RS1 baseline (KPI researched/queue/evidence-conf, Research queue без ai_research, Dossiers
  с ICP/conf/сигналы/evidence-dossier, статус DeepSeek/кредиты), RS2 run research (Vela Health → runAiForRecord
  → DeepSeek заполнил ai_research → ушла в досье с раскрытым provenance, 18→17/1→2, conf 95%→77%, кредиты
  985→975, тост). Влияет на Data Hub (поле) и Pipeline (ICP). Долги: async research-runs со статусом, batch,
  source-citations, markdown-рендер досье (сейчас raw ###/**). Следующее по порядку GPT: Playbooks → Learning.
- 2026-06-15 — **🏆 MEETINGS (/meetings) — ПРИНЯТ GPT (MVP). ПОСТРОЕН С НУЛЯ** (модель Meeting + enum
  MeetingStatus + миграция + роут /api/meetings CRUD + переписана страница). Календарь-СИНХРОНИЗАЦИЯ честно
  отложена (внешняя), ручной booking/outcome реальны. ME1 baseline (KPI, Meeting-ready из INTERESTED-ответов
  без дублей, Schedule & outcomes из БД, lifecycle-действия, дисклеймер), ME2 book (hot→Scheduled, 2→1/1→2,
  чистый слот +2д 15:00, антидубль, тост), ME3 outcome (Mark done→пикер→COMPLETED, Scheduled↓/Completed↑,
  outcome-бейдж, lead.status→CONVERTED при Qualified — pipeline-эффект). Долги: Google/Calendly sync, time-
  picker/reschedule, prep-brief, No-show→nurture, AE-assignment. Следующее по порядку GPT: Research Lab →
  Playbooks → Learning.
- 2026-06-15 — **🏆 REPLIES INBOX (/replies) — ПРИНЯТ GPT (MVP). РЕДИЗАЙН ЛЕГАСИ** (вырезаны мок-диалоги
  Anna/Marcus/Tomás/Priya, фейковые SLA/risk/draft, мёртвые Edit reply/Book meeting/Assign human/Stop
  sequence). ПЕРЕПИСАН на живые /outreach/replies + реальные действия (как Cockpit), handledAt-aware. RE1
  baseline (3 колонки, intent-папки с реальными счётчиками, Needs human=Interested+Objection+Not now, живой
  список, AI decision panel с editable DeepSeek-черновиком), RE2 record reply (Generate&record→OUTBOUND+
  handledAt→ушёл, 7→6/4→3/8→7, тост), RE3 suppress/reclassify (set-class→класс+lead.status UNSUBSCRIBED→ушёл,
  6→5/2→1/7→6, тост). Фикс: Needs human включает Objection. Долги: реальный Book meeting/Assign human, полный
  thread, фильтр по кампании. Следующее по порядку GPT: Meetings → Research Lab → Playbooks → Learning.
- 2026-06-15 — **🏆 OUTREACH STUDIO (/campaigns, M11) — ПРИНЯТ GPT (MVP). РЕДИЗАЙН ЛЕГАСИ** (вырезан весь мок:
  optimization-рейл experiments/recommendations/draft-queue/risk/learning, strategy-хардкод, step-proof-фейк,
  мёртвые кнопки Publish/Review drafts/Edit targeting/Add step). OS1 baseline (живой rail кампаний, brief из
  реальных полей, KPI-роллап, AI-sequence, recipients/enrollment, disabled Run по статусу), OS2 реальная
  AI-генерация sequence (Regenerate→DeepSeek→новые шаги+персист+тост «deepseek»), OS3 жизненный цикл (Start
  Draft→Running, Active/Enrolled↑, Run agent now батч: processed/sends, recipients→CONTACTED, Messages↑,
  Pause-тогл). Фикс: Run agent now disabled+серый для не-ACTIVE; KPI replied→Messages (CampaignStats не имеет
  replied). Долги: manual step add/edit, draft-approval в Studio, A/B, реальная SMTP. Следующее по порядку GPT:
  Replies (инбокс на уровень Cockpit: живые /outreach/replies, реальные действия approve/reclassify/archive).
- 2026-06-15 — **🏆 PIPELINE RADAR (/pipeline, agent_stage) — ПРИНЯТ GPT (MVP). ПЕРЕПИСАН** с эвристики
  (стадия из last_agent_action/enrichment + хардкод-счётчики + мёртвые кнопки) на РЕАЛЬНОЕ поле agent_stage.
  PR1 baseline (доска/таблица по agent_stage, 7 воронных + 4 терминальных лейна, реальные счётчики+pulse,
  карточки с ICP/last action/stage-дропдауном), PR2 реальный перевод (дропдаун→bulkStageRecords→карточка
  переезжает, Sourced 6→5/Engaging 3→4, тост, agent_stage в БД — общий с Data Hub). Фикс: listRecords limit
  100 (200 падал). Долги: compact/sticky лейны, drag-and-drop, фильтры мотиона, heat/SLA на событиях, audit
  event на смену stage. Следующее по порядку GPT: Outreach Studio + кампании (sequence steps/enrollment/
  drafts-approvals/pause-resume), затем Replies.
- 2026-06-15 — **🏆 LISTS (S100–S109) — ПРИНЯТ GPT (MVP). ПОСТРОЕН С НУЛЯ** (был только в схеме). Новый
  backend-роут /api/lists (CRUD списков + entries add/remove, дедуп listId+recordId, soft-archive,
  serializeRecord для значений), экран /lists (master-detail), пункт сайдбара (Foundation). LS1 baseline,
  LS2/LS2b Add records (пикер/поиск/мультивыбор/дедуп «in list»/персист 4→6+тост), LS3 создание (модалка→
  навигация→empty-state), LS4 удаление записи (6→5, членство снято, CRM-запись цела). Долги: list-fields,
  PIPELINE/kanban, bulk-add из Data Hub, DYNAMIC-списки. Следующее по порядку GPT: Pipeline Radar (agent_stage).
- 2026-06-15 — **🏆 RECORD CARD (карточка записи, S120–S137) — ПРИНЯТА GPT (MVP).** RP1–RP3 по одному скрину:
  RP1 карточка компании (agent status, AI-атрибуты с provenance/Dossier, Run/Re-run реального AI-прогона,
  поля), RP2 карточка сделки (type-aware рендер ВСЕХ типов: currency $50k, select-чип, relationship→Lumen
  Analytics, user→Demo User + activity timeline), RP3 inline-edit (Value 50k→75k → Save → персист после refetch
  + новое событие в activity). ДОПОЛНЕН RecordDrawer: показ всех 16 типов (был только текстовый editable),
  type-aware display/editor (select dropdown, boolean, currency, relationship/user read-only), CURRENCY-объект.
  Долги (non-blocker): RU→EN activity labels, relationship/user edit через picker, табы Emails/Calls/Notes/Tasks
  в их модулях. Следующее по порядку GPT: Lists (S100–S109) → Pipeline Radar.
- 2026-06-15 — **🏆 SETTINGS → DATA MODEL (Objects/Attributes/Relationships, S001–S049) — ПРИНЯТ ПОЛНОСТЬЮ
  GPT (MVP-фундамент).** DM1–DM6 по одному скрину + полное описание: DM1 baseline (master-detail, active-only
  счётчики), DM2 модалка Add field (16 типов, Select-опции, Relationship, AI-режимы, валидация key/duplicate,
  видимый выбранный тип), DM3 создание поля (19→20, персист), DM4 кастомный объект (+авто-primary Name,
  +Data Hub object-switcher), DM5 Relationship→Companies (target явный, count↑), DM6a удаление поля (счётчики↓,
  primary/system защита, soft-archive), DM6b RBAC (MEMBER read-only + backend 403). ПОСТРОЕН экран
  /settings/objects (заменил легаси светлый список; [objectKey]→редирект); backend: filtered _count (active),
  авто-primary Name при создании объекта, Data Hub показывает все объекты (был slice(0,4)); фронт: canManage
  RBAC-гейт. Долг (non-blocker): reverse-side связи на target-объекте. Следующее по порядку GPT: Record page
  (карточка записи) → Lists → Pipeline Radar.
- 2026-06-15 — **🏆 AGENT COCKPIT (/dashboard) — ПРИНЯТ ПОЛНОСТЬЮ GPT (production-ready MVP).** AC1–AC6 по
  одному скрину + полное описание: AC1 baseline (org-scoped KPI, event-feed, empty-states), AC2 очередь
  решений (3 типа, AI suggests/Why, confidence), AC3 модалка ответа (реальный DeepSeek-черновик, demo-
  доставка, «Approve & record»), AC4 результат отправки (6→5, карточка ушла, feed-событие, OUTBOUND записан),
  AC5 пикер переклассификации (4 класса), AC6 результат reclassify (5→4, лид LOST, feed-событие). Построено
  по ходу: ПЕРЕПИСАН экран с mock на реальный React-state; backend POST /outreach/replies/:id/set-class и
  /respond; **новая модель Message.handledAt** (миграция) — оттриажированные ответы уходят из очереди;
  pushAction→Live Feed; промпт generateAutoReply форсит final-ready (без плейсхолдеров). Все кнопки рабочие
  (→/replies, /leads/:id, /meetings, /learning, композер). Мёртвых элементов нет. Дальше по порядку GPT:
  Settings → Objects/Attributes/Relationships (S001–S049) — реальные CRUD/metadata, не витрина.
- 2026-06-15 — **🏆 DATA HUB — ФИНАЛЬНО ПРИНЯТО GPT (WIN-DATAHUB).** Все группы доказаны по одному
  скрину + полное описание (ЗАКОН C): F, C1–C4, D1–D3, G1–G3, H1–H3, E1–E2, B1–B3. Построено по ходу:
  Recipients-карточка кампании, листинг Segments, object-aware лейблы, nulls-last сортировка, реальный
  Import-flow. Долги (не блокеры): i18n RU/EN, object-specific copy, confirm на удаление сегмента,
  склонения, легаси-экран кампании→S4. Следующее по порядку GPT: Agent Cockpit → Objects/Attributes.
- 2026-06-15 — **A3 Forgot/Reset — ПРИНЯТО GPT; AUTH-КЛАСТЕР A1–A3 ЗАКРЫТ.** Построен РЕАЛЬНЫЙ flow:
  POST /auth/forgot-password + /auth/reset-password (JWT-токен сброса 30м, без новой таблицы), страница
  /reset-password, demo-ссылка вместо письма (⏸). Доказано: старый пароль→401, новый→200, вход новым→
  /dashboard. Минорный долг: i18n RU/EN, negative-states reset, demo-блок прятать в prod. Следующее по
  порядку GPT: добить Data Hub (G3-final/H2-H3/E1-E2/B1-B3) → Settings: Objects/Attributes/Relationships.
- 2026-06-15 — **A2 Login — ПРИНЯТО GPT** (форма, invalid-credentials баннер, happy-path, demo-вход).
  По пути найден+исправлен РЕАЛЬНЫЙ баг: axios-интерсептор на любой 401 дёргал logout()→редирект и
  стирал баннер ошибки входа → теперь logout только при истечении сессии. Footer Terms/Privacy → ссылки.
  Сейчас: A3 Forgot password.
- 2026-06-15 — **A1 Register — ПРИНЯТО GPT** (форма, поля, дубликат-ошибка, happy-path редирект,
  Google-stub ⏸, Terms+Privacy реальные страницы созданы).
- 2026-06-15 — Data Hub: добавлен Push G2 (тост, принят); фикс тоста на «Meeting set». Долг Data Hub:
  G3-final, H2/H3, E1/E2, B1–B3.
- 2026-06-15 — Хребет расширен до полного объёма S001–S403; передан GPT как контролёру.
- 2026-06-15 — Data Hub: F/G1/H1/C1–C4/D1–D3 приняты; найдено+исправлено 3 дефекта.
