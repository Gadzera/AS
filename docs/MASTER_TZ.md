# МАСТЕР-ТЗ — AISDR (клон Attio + AI-SDR слой)

> Единое сводное техническое задание. Собрано из: разбора demo-видео (114 storyboard-состояний +
> озвучка), 28 видео Attio Academy (транскрипты + 14 708 кадров 2/сек), официальных страниц Attio.
> Источники-доки: [NARRATION.md](./NARRATION.md), [ACADEMY_SPEC.md](./ACADEMY_SPEC.md),
> [ACADEMY_TRANSCRIPTS.md](./ACADEMY_TRANSCRIPTS.md), [STORYBOARD_FULL.md](./STORYBOARD_FULL.md),
> [FUNCTIONAL_INVENTORY.md](./FUNCTIONAL_INVENTORY.md), [RESEARCH_ATTIO_ACADEMY.md](./RESEARCH_ATTIO_ACADEMY.md).
>
> Статусы: ✅ готово · 🟡 частично · ⬜ не начато. Каждый модуль = раздел с моделью данных, UI,
> сценариями и **acceptance-критериями** (по ним строим через GPT-мост и проверяем).

## Оглавление
1. Видение и принципы
2. Глоссарий и общая модель данных
3. Объекты (Objects)
4. Атрибуты (Attributes) + AI-атрибуты
5. Записи (Records)
6. Views (виды)
7. Lists (списки)
8. Record page (карточка записи)
9. Enrichment + Communication Intelligence
10. Email & Calendar sync
11. Sequences (цепочки писем)
12. Workflows (автоматизации)
13. Call Intelligence (звонки)
14. Reports & Dashboards
15. AI-слой (AI-SDR) и кредиты
16. Settings (workspace, members, billing, integrations, developers)
17. Навигация / IA (сайдбар, топбар)
18. Технический стек и архитектура
19. Дорожная карта (блоки + приоритеты)

---

## 1. Видение и принципы
**Продукт:** гибкий B2B-CRM уровня Attio + слой AI-SDR (авто-аутрич, скоринг, исследование лидов).
**3 столпа (из озвучки demo):** (1) быстрый старт, (2) адаптивность под бизнес-модель, (3) AI «в фундаменте», а не сбоку.
**Ключевая идея:** открытая модель данных — пользователь сам создаёт объекты/атрибуты/связи/списки/виды без кода.
**Демо-режим:** платформа работает без внешних API-ключей (демо-данные, демо-отправка писем, демо-AI).

## 2. Глоссарий и общая модель данных
- **Org / Workspace** — арендатор (tenant). Все данные изолированы по `orgId`.
- **Object** — тип сущности (Companies, People, Deals, Users, Workspaces + кастомные). Имеет `key`, `name`, набор атрибутов, primaryAttribute.
- **Attribute** — поле объекта; имеет тип (см. §4), опции (для select), настройки AI.
- **Record** — запись объекта. Хранит значения (Value) по атрибутам, `searchText`, аудит (createdBy/updatedBy/archivedAt).
- **Value** — значение атрибута у записи (типизировано: text/number/date/select/relationship…).
- **RelationshipDefinition** — связь между двумя объектами (кардинальность 1-1 / 1-many / many-many).
- **View** — сохранённое представление объекта/списка (фильтры, сортировки, колонки, тип table/board).
- **List** — подмножество записей под процесс; имеет собственные list-атрибуты и entries.
- **Activity** — событие на записи (created/updated/archived, email, call, note, comment).
- **Email / Note / Task / Call** — сущности коммуникаций, привязанные к записям.

Текущая Prisma-схема: **25 моделей**, миграция `add_flexible_crm_phase1` применена. Полное соответствие — §18.

## 3. Объекты (Objects)
**Стандартные (5):** Companies, People, Deals, **Workspaces**, **Users** (последние два — продуктовые данные SaaS).
**Кастомные:** пользователь создаёт любой объект (Invoices, Partnership, Buyer/Seller, Transaction…) с атрибутами и связями.

**API:** `GET /api/objects`, `GET /api/objects/:idOrKey`, `POST /api/objects`, `GET/POST /api/objects/:id/attributes`. ✅
**Bootstrap:** `POST /api/crm/bootstrap` создаёт companies/people/deals + дефолтные атрибуты и views + стадии Deal. ✅
**UI:** сайдбар RECORDS показывает объекты; страница объекта `/(crm)/crm/[objectKey]`. ✅
**Acceptance:**
- [x] Companies/People/Deals создаются bootstrap-ом, открываются в table.
- [ ] UI «Create object» (имя, ключ, иконка, тип записи) — модалка. ⬜
- [ ] Workspaces/Users как стандартные объекты. ⬜

## 4. Атрибуты (Attributes)
**Базовые типы:** Text, Long text, Number, Checkbox, Date, Timestamp, Rating, Status, Select, Multi-select, Currency, Record (link), User, Relationship, Location, Phone, Email, URL.
**Модалка Create attribute** (storyboard кадры 9–12): Attribute Type dropdown, Name, Description (optional), Set as title field, для Select — Options, AI autofill.

### 4.1 AI-атрибуты — 4 типа (Academy 13) 🔥
| Тип | Вход | Выход | Кредитов |
|---|---|---|---|
| Classify record | вся запись | Select / Multi-select (теги) | 1 |
| Summarize record | запись (+опц. промпт) | Text | 1 |
| Research agent | вопрос + данные записи (веб-ресёрч) | Text | 10 |
| Prompt completion | промпт + заданные переменные | Number / Text / Currency | 1 |

- Создаются как обычные атрибуты; AI-тип зависит от базового типа.
- Запуск: иконка в ячейке table / карточке kanban / клик по заголовку (все строки) / на record-странице.
- Значения используются как обычные: в фильтрах, отчётах, триггерах workflow.

**Acceptance:**
- [ ] CRUD атрибутов всех базовых типов + валидация значений по типу (часть есть в `values.ts`). 🟡
- [ ] Модалка Create attribute в UI. ⬜
- [ ] 4 AI-типа: модель + воркер расчёта (демо-AI) + кнопки запуска + списание кредитов. ⬜

## 5. Записи (Records)
**API:** `GET /api/records?objectKey=&page=&limit=&search=`, `POST`, `GET/PATCH/DELETE /:id` (soft-delete archivedAt). ✅
Поиск по primaryAttribute (text-типы) или `searchText`. Активность пишется на create/update/archive. ✅
**Acceptance:**
- [x] CRUD записей, пагинация, поиск, сериализация значений.
- [ ] Bulk-операции (выбор строк → массовое действие). ⬜

## 6. Views (виды)
**Типы:** Table, Board (Kanban по select-атрибуту, напр. stage). ✅ оба есть.
**Функции:** фильтры по атрибутам, сортировки, выбор/порядок/ширина колонок, сохранение как именованный View внутри объекта/списка.
**UI:** переключатель Table|Board ✅; чипы «Sorted by…», «Filter» (storyboard кадры 5–8).
**Acceptance (Блок 1.5 — в работе):**
- [x] Table с типизированными колонками; Board с drag-drop смены стадии.
- [ ] View API: сохранение фильтров/сортировок/колонок. 🟡
- [ ] UI-панель фильтров (advanced: AND/OR, группировка), выбор колонок, сортировка. ⬜
- [ ] Несколько сохранённых views на объект + дропдаун выбора. ⬜

## 7. Lists (списки) — Блок 1.9 ⬜
**Суть:** подмножество записей под процесс (Inbound Leads, Recruiting, Customer Success, Fundraising). Создаётся с нуля или из шаблона.
**List-атрибуты:** живут только в контексте списка (напр. RSVP, dietary), не засоряют родительский объект.
**Entries:** запись добавляется в список (одна запись — во многих списках). Стадии внутри списка.
**Import в список** (Academy 11): маппинг колонок.
**Acceptance:**
- [ ] Модель List + ListEntry + list-level Attribute/Value.
- [ ] Сайдбар LISTS → страница списка (table/board как у объекта).
- [ ] Создание списка (с нуля/шаблон), добавление записей, list-атрибуты.

## 8. Record page (карточка записи)
**Структура (Academy 05 + demo):**
- **Highlights** сверху + правая панель Details (настраиваемый набор полей, inline-редактирование). ✅ каркас.
- **Табы:** Activity (история), **Emails** (общий тред, контроль доступа), **Calls** (записи+саммари), **Notes** (подготовка/итоги), **Tasks/To-dos**, **Files**, табы по relationship-атрибутам.
- **Comments + @mention** → алерт в web/mobile + опц. email.
**Acceptance:**
- [x] Хлебные крошки, табы, редактируемые Details (911 строк страницы).
- [ ] Реальные табы Emails/Calls/Notes/Tasks/Files с данными. 🟡/⬜
- [ ] Comments + @mention + уведомления. ⬜
- [ ] Настройка highlights (какие поля показывать). ⬜

## 9. Enrichment + Communication Intelligence
**Enrichment-поля** (авто, из внешних источников — у нас демо): LinkedIn, Employee range, Job title, Location, Revenue/ARR, фандрайзинг.
**Communication intelligence** (из почты/календаря): **Connection strength, Last interaction, Next calendar interaction**, mutual contacts.
**Acceptance:**
- [ ] Системные атрибуты enrichment + демо-наполнение. 🟡
- [ ] Communication-атрибуты считаются из активности/писем. ⬜

## 10. Email & Calendar sync
При подключении Gmail/Outlook + календаря записи People/Company **создаются автоматически** из переписки/встреч. Контроль доступа к письмам пер-юзер.
**Acceptance:**
- [ ] Демо-импорт почты → авто-создание People/Company. 🟡 (есть CSV-импорт)
- [ ] Реальный IMAP/Gmail коннектор. ⬜ (позже)

## 11. Sequences (цепочки писем) — Блок 1.10 ⬜
Раздел **Automations → Sequences**. New Sequence → title (напр. «ICP Inbound Leads»).
**Settings (Academy 14–16):**
- Sending window (часы); вне окна → очередь на начало след. окна.
- **Лимиты:** 12 писем/час/ящик, пауза 5 мин, 200/день/ящик. Business days / выходные.
- Unsubscribe-ссылка (текст+превью). Subsequent emails: тот же тред / новый. Attio-подпись.
- **Exit criteria:** reply received / meeting booked.
- Доступ (share), **delegated sending** (коллега энроллит, письмо из твоего ящика).
**Шаги:** 1-е письмо сразу/через N дней; variables (имя, компания…); шаблон/с нуля; add step (+дни ожидания) для follow-up тем, кто не ответил; Publish.
**Acceptance:**
- [ ] Модель Sequence + SequenceStep + Enrollment + статусы.
- [ ] UI создания (settings + шаги + variables + шаблоны).
- [ ] Воркер отправки с лимитами + exit criteria + авто-follow-up (демо-SMTP).

## 12. Workflows (автоматизации) — Блок Workflows ⬜
**Холст (блоки+связи) + редактор справа.** 4 категории (Academy 17–26):
- **Trigger:** record updated/created, list created/updated, record command (ручной), task created, utility/integration (Typeform…).
- **Logic:** Filter, If/else (2 пути), Switch (N путей), Advanced filters (AND/OR + группировка).
- **Action:** add record to list, create/update/find record (и для списков), task actions, AI-блоки (Classify/Summarize/Research/Prompt), **Formula** (мат-операции), **Adjust time** (сдвиг → due date).
- **Integration:** Slack, HTTP/JSON (Intercom…), Webhooks, Typeform, Mailchimp, Mixmax, Outreach.
**Переменные** из любого предыдущего блока. **Runs**-лог (реалтайм+ретро). Библиотека шаблонов.
**Эталонный пример:** MRR updated → Formula(ΔMRR) → Filter(≠0) → Switch(рост/падение/отмена) → действия (Slack+HTTP / task+adjust time / classify churn).
**Acceptance:**
- [ ] Модель Workflow + Block(typed) + Edge + Run/RunStep.
- [ ] Конструктор UI (canvas + редактор блока) на @dnd-kit.
- [ ] Исполнитель (BullMQ-воркер) с переменными между блоками + runs-лог.

## 13. Call Intelligence (звонки) ⬜
Рекордер joins Zoom/Meet/Teams (у нас демо: загрузка транскрипта). **Insight templates** — секции с промптами (text/bullets), переключение шаблонов. Live-транскрипт, summary, chapters, speaker stats. Calls page (фильтр по участникам/записям, favorites). Playback: pinned / picture-in-picture.
**Acceptance:**
- [ ] Модель Call + transcript + InsightTemplate + результат.
- [ ] Демо: загрузка транскрипта → AI-саммари по шаблону → привязка к record.
- [ ] Calls page + вкладка Calls на карточке.

## 14. Reports & Dashboards ⬜
**5 типов отчётов** (Academy 07–09): pivot-style + исторический анализ движения по воронке.
**Визуализации:** line, bar, funnel, pie, map. **Дашборды:** комбинация виджетов, drill-down, группировка.
**Метрики:** pipeline, ARR, CAC, lead source, inbound lead volume, sign-ups, churn, рост базы.
**Acceptance:**
- [ ] Модель Report + Dashboard + Widget.
- [ ] Конструктор отчёта (источник=объект/список, измерения, агрегаты, визуализация).
- [ ] Дашборд-страница (recharts уже в проекте).

## 15. AI-слой (AI-SDR) и кредиты
**AI-возможности:** Classify / Summarize / Research agent / Prompt completion (§4.1); AI autofill; AI Research agent в workflow; Ask Attio (ассистент по данным).
**Кредиты:** Research = 10, остальные = 1/запуск. Планы включают месячный пакет + докупка. Экран Billing → расход кредитов (разбивка по типам/времени).
**Демо-AI:** при отсутствии ключа — детерминированные демо-ответы (классы, саммари-заглушки), чтобы UI работал.
**Acceptance:**
- [ ] Сервис AI с провайдером (Anthropic SDK) + демо-фолбэк.
- [ ] Учёт кредитов (списание, баланс, история).

## 16. Settings ⬜
- **Workspace:** имя, логотип, домен.
- **Members & permissions (Academy 01):** роли, уровни доступа, приглашения.
- **Billing & credits:** план, расход кредитов, докупка.
- **Apps & Integrations (Academy 06):** Slack, Gmail/Outlook, Typeform, Mailchimp, Intercom, Segment, Webhooks.
- **Developers:** API-ключи, **MCP-сервер** (read/write), вебхуки.
**Acceptance:**
- [ ] Страницы settings/* с реальными данными.
- [ ] Роли/права (RBAC) на уровне org.

## 17. Навигация / IA
**Сайдбар (storyboard кадр 5):** workspace-свитчер, Quick actions, Notifications, Tasks, Notes, Emails, Calls, Reports, Automations, **Favorites**, **Records** (объекты), **Lists**. ✅ есть.
**Топбар:** заголовок объекта, view-дропдаун, View settings, чипы Sort/Filter, Import/Export, **+ New …**, аккаунт. ✅ частично.
**Acceptance:** [x] сайдбар Attio-like; [ ] Quick actions, Notifications, глобальный поиск ⬜.

## 18. Технический стек и архитектура
**Monorepo:** apps/backend (Express+TS, Prisma/Postgres, BullMQ/ioredis/Redis, JWT, nodemailer, zod, @anthropic-ai/sdk), apps/frontend (Next.js 14 App Router, React 18, Tailwind 3, framer-motion, lucide-react, recharts, @dnd-kit, axios).
**Prisma-модели (25):** Org, User, Object, Attribute, AttributeOption, Record, Value, RelationshipDefinition, View, ViewColumn, List, Activity, Email, Note, Task, Campaign, CampaignLead, Lead(legacy)… + миграция flexible CRM.
**Воркер:** BullMQ polling каждые 60с (аутрич). Будет расширен на Sequences + Workflows + AI-расчёты.
**Демо-режим:** seed-данные, демо-SMTP, демо-AI.

## 19. Дорожная карта (приоритет сверху вниз)
| # | Блок | Статус | Зависит от |
|---|------|--------|-----------|
| 1.5 | Views: фильтры/сортировки/колонки + saved views | 🟡 в работе | — |
| AI | AI-атрибуты (4 типа) + кредиты + демо-AI | ⬜ | §4.1 |
| 1.9 | Lists + list-атрибуты | ⬜ | §7 |
| 1.10 | Sequences + email-шаблоны + воркер | ⬜ | §11 |
| WF | Workflows (конструктор + исполнитель) | ⬜ | §12, AI |
| RP | Record page табы (Email/Calls/Notes/Tasks/comments) | 🟡 | §8 |
| OBJ | UI Create object / Create attribute | ⬜ | §3,4 |
| CALL | Call Intelligence (демо) | ⬜ | §13 |
| REP | Reports & Dashboards | ⬜ | §14 |
| SET | Settings (members/billing/integrations/developers) | ⬜ | §16 |
| 1.11 | Миграция legacy Lead → People/Companies | ⬜ | §3 |

**Принцип работы:** GPT-мост пишет код по разделу ТЗ → Claude проверяет (tsc, скриншот, сценарий) → правки по кругу до зелёного → следующий раздел.
