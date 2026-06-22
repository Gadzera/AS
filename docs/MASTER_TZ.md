# МАСТЕР-ТЗ AISDR — Полное техническое задание (сборка с GPT)

> Исчерпывающее ТЗ: 21 раздел (0–21), 269 уникальных сценариев S001–S403, ~300 код-блоков
> (Prisma-модели, API, DTO). Собрано совместно с GPT через мост (проект AISDR, 16 файлов-знаний
> загружены в «Источники» ChatGPT). Каждый раздел: функциональность → Prisma-модель → API
> (метод/путь/тело/ответ/ошибки) → UI-компоненты → acceptance Sxxx → тех-решения.
> Доказательная база — в `docs/` (см. README). Прежний скелет-ТЗ сохранён как `MASTER_TZ_skeleton.md`.

---

МАСТЕР-ТЗ AISDR — Полное техническое задание
0. Подтверждение источников

Открыты и использованы источники из базы знаний: MASTER_TZ.md, SCENARIOS_CATALOG.md, ACADEMY_SCENARIOS_ALL.md, FUNCTIONAL_INVENTORY.md, STORYBOARD_FULL.md, README.md. База знаний указывает MASTER_TZ.md как главный документ, а остальные файлы — как доказательную базу по demo-видео, Academy, реестру экранов и архитектуре. 


 Текущий MASTER_TZ.md задаёт исходные 19 разделов и статусы ✅/🟡/⬜. 


 SCENARIOS_CATALOG.md содержит атомарные сценарии в формате Sxxx с ожидаемым результатом и статусом. 


 ACADEMY_SCENARIOS_ALL.md подтверждает покрытие 28 обучающих видео и их привязку к модулям ТЗ. 


Полное оглавление и карта покрытия сценариев
№	Раздел мастер-ТЗ	Покрываемые модули	Сценарии SCENARIOS_CATALOG	Статус
1	Видение и принципы	Продуктовая рамка, tenant-first, AI-first, demo-mode, Attio-like UX	Сквозные принципы для S001–S403; явно без отдельных S-сценариев	🟡
2	Глоссарий и общая модель данных	Org/Workspace, User, Object, Attribute, Record, Value, Relationship, View, List, Activity, Email, Task, Workflow, Sequence, Report	Сквозная модель для S001–S403	🟡
3	Объекты (Objects)	Standard/custom objects, object settings, bootstrap, record text, object import	S001–S007; также объектная часть S330–S334, S402–S403	🟡
4	Атрибуты (Attributes) + AI-атрибуты	Базовые типы, options, required/unique/system, relationship-атрибуты, 4 AI-типа	S010–S034, S040–S049, S160–S173	🟡
5	Записи (Records)	CRUD records, values, search, pagination, inline edit, bulk base	S060–S067	✅/🟡
6	Views (виды)	Table/Board, filters, sorting, columns, saved views, calculations	S080–S092	🟡
7	Lists (списки)	Lists, entries, list attributes, list kanban, list import, add-to-list bulk	S100–S109, S335–S338	⬜
8	Record page (карточка записи)	Highlights, details, tabs, activity, emails, calls, notes, tasks, files, comments	S120–S137	🟡
9	Enrichment + Communication Intelligence	Enrichment attributes, connection strength, interactions, mutual contacts	S388–S389; частично S386–S392	⬜
10	Email & Calendar sync + продуктивность	Mailbox/calendar sync, email composer, templates, notes/tasks, outbox	S140–S149, S386–S392	🟡
11	Sequences (цепочки писем)	Sequence editor, delivery settings, enroll, tracking, unsubscribe, OOO, warm-up	S200–S224	⬜/🟡 legacy
12	Workflows (автоматизации)	Builder, triggers, logic, actions, calculations, AI blocks, integrations, runs	S230–S247, S255–S276	⬜
13	Call Intelligence (звонки)	Recorder, transcript, insight templates, summary, calls page, playback	S310–S322	⬜
14	Reports & Dashboards	5 report types, insight/historical/funnel/time/stage, dashboards, drill-in	S285–S297	⬜/🟡 legacy
15	AI-слой (AI-SDR) и кредиты	Ask Attio, AI provider, demo-AI, credits, prompt library, research	S180–S190; кредитная часть S170–S173, S376–S378	⬜
16	Settings	Workspace, members, RBAC, apps, integrations, developers, billing, security	S345–S356, S362–S367, S372–S381	⬜
17	Навигация / IA	Sidebar, topbar, command palette, notifications, favorites, home	S190, S372, S398–S401; навигационные части всех модулей	🟡
18	Технический стек и архитектура	Monorepo, Express/Prisma, Next.js, BullMQ, Redis, zod, Anthropic, Stripe, errors	Архитектурная база для S001–S403	🟡
19	Дорожная карта	Блоки реализации, приоритеты, зависимости, статусы	Все S001–S403 в таблице roadmap	🟡
20	Тестирование	Unit/integration/e2e/manual acceptance, сценарное покрытие, build gates	Проверка всех S001–S403	⬜
21	Риски и решения	EAV, performance, migration, deliverability, AI-cost, RBAC, UI complexity	Риски всех S001–S403	🟡
1. Видение и принципы
1.1. Описание функциональности

Статус: 🟡 частично.

AISDR — это гибкая B2B CRM уровня Attio с AI-SDR слоем для сегментации, скоринга, исследования лидов, персонализированного outreach, sequences, workflows, звонков, задач и аналитики. Продукт строится вокруг трёх принципов: быстрый старт, адаптивность под бизнес-модель и AI как фундаментальный слой интерфейса, а не отдельный модуль. Эти принципы прямо зафиксированы в текущем MASTER_TZ.md: продукт — гибкий B2B-CRM + AI-SDR, ключевая идея — открытая модель данных, демо-режим работает без внешних ключей. 


Пользовательский опыт должен быть таким:

Пользователь регистрируется, создаётся workspace.

При первом входе запускается onboarding/bootstrap: появляются стандартные объекты Companies, People, Deals, Workspaces, Users.

Сайдбар сразу показывает Records, Lists, Automations, Reports, Tasks, Notes, Emails, Calls.

Пользователь открывает Companies или People и видит Attio-like таблицу с сохранённым view.

Пользователь может без кода добавлять атрибуты, создавать кастомные объекты, связывать записи и строить views.

AI доступен в данных: AI-атрибуты, AI Research, Ask Attio, workflow AI-блоки, call summaries.

Все внешние зависимости имеют demo fallback: demo-AI, demo-SMTP, demo-import, demo-enrichment.

Главный продуктовый критерий: разработчик должен строить не фиксированный Lead/Campaign продукт, а metadata-driven CRM, где UI и логика работают от Object/Attribute/View/List metadata. Текущая архитектура прямо задаёт переход от фиксированной Lead/Campaign модели к metadata-driven модели, где структура CRM описывается таблицами Object, Attribute, View, List, бизнес-данные лежат в Record + Value, связи — в RelationshipValue, а UI строится из metadata. 


1.2. Модель данных

Раздел задаёт сквозные требования ко всем моделям.

Обязательные принципы Prisma-моделей

Все tenant-scoped сущности должны иметь:

id String @id @default(cuid())

orgId String

связь org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt, если сущность редактируемая

archivedAt DateTime? или isArchived Boolean @default(false) для soft-delete

индексы по orgId, внешним ключам и полям поиска/сортировки

Базовые сущности

Organization — workspace/tenant.

User — пользователь, член workspace.

Object — метаданные сущности: Companies, People, Deals, Workspaces, Users, Invoices, кастомные объекты.

Attribute — описание поля объекта.

AttributeOption — опции select/status/multi-select.

Record — запись объекта.

Value — значение атрибута у записи.

RelationshipDefinition — описание связи между объектами.

RelationshipValue — конкретная связь между record-ами.

View, ViewColumn, ViewFilter, ViewSort — сохранённые представления.

List, ListEntry, будущие ListAttribute, ListEntryValue — процессные списки.

Activity, Email, Note, Task, Call, FileAttachment, Comment, Notification.

Sequence, SequenceStep, SequenceEnrollment, SequenceStepRun.

Workflow, WorkflowBlock, WorkflowEdge, WorkflowRun, WorkflowRunStep.

Report, Dashboard, DashboardWidget.

CreditBalance, CreditTransaction, BillingSubscription, IntegrationConnection.

Текущая база уже содержит 25 Prisma-моделей, включая гибкую CRM основу: Object, Attribute, AttributeOption, Record, Value, RelationshipDefinition, View, ViewColumn, List, Activity, Email, Note, Task, а также legacy Lead/Campaign/CampaignLead. 


1.3. API-эндпоинты

Раздел 1 не вводит самостоятельный bounded-context API, но задаёт системные endpoint-правила.

Общие требования ко всем API

Все endpoints:

начинаются с /api;

требуют JWT, кроме POST /api/auth/register, POST /api/auth/login, tracking pixel/unsubscribe public endpoints;

работают только в рамках orgId текущего пользователя;

валидируют вход через zod;

возвращают единый JSON-формат;

никогда не возвращают данные другого workspace;

используют soft-delete для бизнес-сущностей;

пишут Activity для пользовательских изменений данных;

для асинхронных операций создают job и возвращают jobId.

Единый формат успеха
JSON
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "pagination": null
  }
}
Единый формат ошибки
JSON
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные",
    "details": {},
    "requestId": "req_..."
  }
}
Общие коды ошибок

400 VALIDATION_ERROR

401 UNAUTHORIZED

403 FORBIDDEN

404 NOT_FOUND

409 CONFLICT

422 BUSINESS_RULE_VIOLATION

429 RATE_LIMITED

500 INTERNAL_ERROR

1.4. UI-компоненты

Сквозные UI-принципы:

светлая Attio-like тема;

плотные таблицы;

мелкая типографика;

тонкие серые границы;

быстрый доступ к действиям через сайдбар, топбар и command palette;

inline-edit там, где это безопасно;

optimistic updates с rollback при ошибке;

skeleton/loading states;

empty states с причиной: нет данных, фильтр пустой, нет доступа, нет интеграции;

demo-mode indicators там, где результат симулирован.

Сквозные компоненты

AppShell — общий layout dashboard.

Sidebar — Records, Lists, Favorites, Automations, Reports, Calls, Emails, Tasks, Notes.

Topbar — заголовок текущего контекста, view selector, search, account menu.

CommandPalette — Quick actions / Ctrl+K.

ToastProvider — success/error/progress.

ConfirmDialog — опасные действия: archive/delete/publish/send.

EmptyState — пустые состояния.

PermissionGate — скрывает/блокирует UI по RBAC.

DemoModeBadge — показывает, что AI/email/enrichment выполнены в demo-mode.

ErrorBoundary — fallback для frontend-ошибок.

1.5. Acceptance-критерии

В разделе 1 нет отдельных Sxxx, но он задаёт критерии для всей системы:

Все S001–S403 должны быть распределены по 21 разделу и реализованы через acceptance-критерии.

Каждый сценарий из SCENARIOS_CATALOG.md должен иметь статус и проверяемый путь в UI/API.

Все пользовательские данные изолированы по orgId.

Demo-mode должен позволять пройти ключевые сценарии без внешних ключей: AI, email, enrichment, seed workspace.

Нельзя строить новые продуктовые функции поверх legacy Lead/Campaign как первичной модели; legacy допускается только как миграционный слой.

UI должен строиться от metadata, а не от хардкода Companies/People/Deals, кроме bootstrap defaults.

Все изменения данных должны быть аудируемыми.

1.6. Технические решения
Metadata-driven core

Система строится по схеме:

Object → Attribute → Record → Value → View/List/Workflow/Report

Это позволяет:

добавлять кастомные объекты без миграций БД;

строить таблицы и карточки из metadata;

применять workflows/reports/sequences к любым объектам;

переносить legacy Leads в People/Companies/Deals.

Demo-first delivery

Все интеграции обязаны иметь fallback:

Anthropic отсутствует → demo-AI возвращает детерминированные результаты.

SMTP отсутствует → письмо создаётся как Email со статусом SIMULATED_SENT.

Enrichment API отсутствует → используются seed/demo firmographics.

Call recorder отсутствует → загрузка transcript вручную.

Gmail/Calendar отсутствуют → demo-sync создаёт People/Companies/Activities из seed.

Worker-first async

Все долгие операции идут через BullMQ:

importQueue

emailQueue

sequenceQueue

workflowQueue

enrichmentQueue

aiQueue

analyticsQueue

notificationQueue

Edge-cases

Пользователь без workspace → redirect на onboarding.

Workspace без CRM bootstrap → POST /api/crm/bootstrap или wizard.

Нет внешних ключей → demo-mode, не crash.

Нет прав → UI скрывает действие, API возвращает 403 FORBIDDEN.

Повторный bootstrap → идемпотентен, дубли не создаёт.

Повторный import/migration → идемпотентен через unique/mapping.

Любая операция с чужим orgId → 404 NOT_FOUND или 403 FORBIDDEN без раскрытия существования ресурса.

2. Глоссарий и общая модель данных
2.1. Описание функциональности

Статус: 🟡 частично.

Пользователь видит не фиксированную CRM, а систему сущностей:

workspace хранит все данные;

объекты описывают типы данных;

записи — конкретные строки;

атрибуты — поля;

значения — typed values;

views — способы смотреть записи;

lists — процессные подборки записей;

activities — история всего, что произошло;

automations, sequences, reports и AI работают поверх этой общей модели.

MASTER_TZ.md фиксирует глоссарий: Org/Workspace как tenant, Object как тип сущности, Attribute как поле, Record как запись, Value как значение, RelationshipDefinition как связь, View как сохранённое представление, List как процессное подмножество, Activity как событие, Email/Note/Task/Call как коммуникации. 


2.2. Модель данных
2.2.1. Organization / Workspace

Назначение: tenant и продуктовый workspace.

Поля:

id String @id @default(cuid())

name String

slug String? @unique

domain String?

logoUrl String?

plan Plan @default(STARTER)

stripeCustomerId String?

stripeSubId String?

aiCreditsBalance Int @default(0) — целевое поле

monthlyAiCredits Int @default(0) — целевое поле

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

Связи:

users User[]

objects Object[]

attributes Attribute[]

records Record[]

views View[]

lists List[]

activities Activity[]

emails Email[]

workflows Workflow[]

sequences Sequence[]

reports Report[]

dashboards Dashboard[]

Индексы:

@@index([plan])

@@index([stripeCustomerId])

2.2.2. User

Назначение: пользователь workspace и участник RBAC.

Поля:

id String @id @default(cuid())

email String @unique

passwordHash String

name String

role Role @default(MEMBER)

orgId String?

avatarUrl String?

timezone String @default("Europe/Vienna")

locale String @default("ru")

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

Индексы:

@@index([orgId])

@@index([role])

2.2.3. Object

Назначение: metadata типа сущности.

Поля:

id String @id @default(cuid())

orgId String

key String

singularName String

pluralName String

description String?

icon String?

color String?

isSystem Boolean @default(false)

isHidden Boolean @default(false)

primaryAttributeId String?

createdById String?

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

archivedAt DateTime?

Связи:

org Organization

primaryAttribute Attribute?

attributes Attribute[]

records Record[]

views View[]

lists List[]

sourceRelations RelationshipDefinition[]

targetRelations RelationshipDefinition[]

Индексы:

@@unique([orgId, key])

@@index([orgId])

@@index([primaryAttributeId])

2.2.4. Attribute

Назначение: metadata поля объекта.

Поля:

id String @id @default(cuid())

orgId String

objectId String

key String

name String

description String?

type AttributeType

isSystem Boolean @default(false)

isRequired Boolean @default(false)

isUnique Boolean @default(false)

isPrimary Boolean @default(false)

isArchived Boolean @default(false)

order Int @default(0)

config Json?

целевые AI-поля:

aiType AttributeAiType?

aiPrompt String?

aiGuidance String?

aiEnabled Boolean @default(false)

Индексы:

@@unique([objectId, key])

@@index([orgId])

@@index([objectId])

@@index([type])

2.2.5. AttributeOption

Назначение: опции select/status/multi-select.

Поля:

id String @id @default(cuid())

orgId String

attributeId String

value String

label String

color String?

order Int @default(0)

isArchived Boolean @default(false)

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

Индексы:

@@unique([attributeId, value])

@@index([orgId])

@@index([attributeId])

2.2.6. Record

Назначение: запись объекта.

Поля:

id String @id @default(cuid())

orgId String

objectId String

displayName String?

searchText String?

createdById String?

updatedById String?

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

archivedAt DateTime?

Связи:

values Value[]

activities Activity[]

emails Email[]

notes Note[]

tasks Task[]

listEntries ListEntry[]

Индексы:

@@index([orgId, objectId])

@@index([objectId, archivedAt])

@@index([displayName])

@@index([searchText])

@@index([createdAt])

@@index([updatedAt])

2.2.7. Value

Назначение: typed value EAV-модели.

Поля:

id String @id @default(cuid())

orgId String

recordId String

attributeId String

textValue String?

numberValue Float?

booleanValue Boolean?

dateValue DateTime?

jsonValue Json?

userValueId String?

currencyAmount Decimal?

currencyCode String?

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

Правило: для каждого Attribute.type заполняется только соответствующая typed-колонка.

Индексы:

@@unique([recordId, attributeId])

@@index([orgId])

@@index([attributeId, textValue])

@@index([attributeId, numberValue])

@@index([attributeId, dateValue])

@@index([attributeId, booleanValue])

@@index([userValueId])

2.2.8. RelationshipDefinition

Назначение: схема связи между объектами.

Поля:

id String @id @default(cuid())

orgId String

sourceObjectId String

sourceAttributeId String

targetObjectId String

reverseAttributeId String?

cardinality RelationshipCardinality

sourceLabel String

targetLabel String

isBidirectional Boolean @default(true)

createdAt DateTime @default(now())

updatedAt DateTime @updatedAt

archivedAt DateTime?

Индексы:

@@index([orgId])

@@index([sourceObjectId])

@@index([targetObjectId])

@@index([sourceAttributeId])

2.2.9. RelationshipValue

Назначение: конкретная связь record→record.

Поля:

id String @id @default(cuid())

orgId String

sourceRecordId String

sourceAttributeId String

targetRecordId String

targetObjectId String

createdAt DateTime @default(now())

Индексы:

@@index([orgId])

@@index([sourceRecordId])

@@index([targetRecordId])

@@index([sourceAttributeId])

@@unique([sourceRecordId, sourceAttributeId, targetRecordId])

2.2.10. View / ViewColumn / ViewFilter / ViewSort

Назначение: сохранённая конфигурация отображения.

Ключевые поля View:

id

orgId

objectId String?

listId String?

name String

type ViewType — TABLE | BOARD

groupByAttributeId String?

createdById String?

isDefault Boolean @default(false)

createdAt

updatedAt

archivedAt

View нельзя хранить только JSON: архитектура требует отдельные таблицы columns/filters/sorts, чтобы конфигурацию можно было валидировать и мигрировать. 


2.2.11. List / ListEntry

Назначение: процессное подмножество записей.

Ключевые поля List:

id

orgId

objectId

name

description

icon

color

createdById

createdAt

updatedAt

archivedAt

Ключевые поля ListEntry:

id

orgId

listId

recordId

stage String?

position Int

addedById

createdAt

updatedAt

archivedAt

2.2.12. Activity

Назначение: immutable timeline.

Поля:

id

orgId

recordId String?

actorId String?

type ActivityType

title String

body String?

metadata Json?

createdAt DateTime @default(now())

Индексы:

@@index([orgId, createdAt])

@@index([recordId, createdAt])

@@index([actorId, createdAt])

@@index([type])

2.3. API-эндпоинты

Раздел 2 задаёт общие metadata endpoints.

GET /api/meta/schema

Возвращает справочники типов.

Ответ:

JSON
{
  "data": {
    "attributeTypes": ["TEXT", "LONG_TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "RATING", "STATUS", "SELECT", "MULTI_SELECT", "CURRENCY", "EMAIL", "PHONE", "URL", "USER", "RECORD", "RELATIONSHIP", "LOCATION", "JSON"],
    "viewTypes": ["TABLE", "BOARD"],
    "relationshipCardinalities": ["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"],
    "accessLevels": ["NO_ACCESS", "READ", "READ_WRITE", "FULL"]
  }
}

Ошибки: 401, 500.

GET /api/meta/navigation

Возвращает дерево навигации по доступным объектам/спискам/автоматизациям.

Ответ:

JSON
{
  "data": {
    "workspace": { "id": "org_1", "name": "Basepoint" },
    "records": [{ "id": "obj_1", "key": "companies", "pluralName": "Companies", "icon": "building" }],
    "lists": [{ "id": "list_1", "name": "Inbound Leads" }],
    "automations": {
      "sequencesCount": 0,
      "workflowsCount": 0
    },
    "notifications": { "unreadCount": 0 },
    "tasks": { "openCount": 0 }
  }
}

Ошибки: 401, 403, 500.

GET /api/me

Ответ:

JSON
{
  "data": {
    "user": { "id": "usr_1", "email": "a@b.com", "name": "Admin", "role": "ADMIN" },
    "org": { "id": "org_1", "name": "Basepoint", "plan": "STARTER" },
    "permissions": {}
  }
}

Ошибки: 401, 404.

2.4. UI-компоненты

MetadataProvider — хранит attributeTypes/viewTypes/user/org.

NavigationProvider — грузит /api/meta/navigation.

ObjectIcon — рендерит system/custom icon.

AttributeTypeIcon — иконки типов атрибутов.

StatusBadge, SelectBadge, UserAvatar, RelationshipPill.

ActivityTimelineItem — универсальный элемент timeline.

TypedValueRenderer — отображение Value по Attribute.type.

TypedValueEditor — редактор Value по Attribute.type.

2.5. Acceptance-критерии

Раздел 2 поддерживает все S001–S403, но напрямую проверяется так:

Metadata доступна после логина.

Навигация строится из /api/meta/navigation.

Нельзя увидеть чужие объекты/списки/записи.

Все typed values сериализуются одинаково во всех API.

displayName строится из primary/record text attribute.

searchText обновляется при создании/редактировании значений.

Любой новый модуль использует общие DTO, а не собственные несовместимые структуры.

2.6. Технические решения
DTO Record Row
JSON
{
  "id": "rec_1",
  "objectKey": "companies",
  "displayName": "Cosme",
  "values": {
    "name": { "attributeId": "attr_name", "type": "TEXT", "value": "Cosme" },
    "employee_range": { "attributeId": "attr_emp", "type": "SELECT", "value": "51_250", "option": { "label": "51-250" } }
  },
  "createdAt": "2026-06-12T08:00:00.000Z",
  "updatedAt": "2026-06-12T08:00:00.000Z"
}
Value normalization

Backend обязан:

Получить Attribute.

Проверить type.

Очистить все typed columns.

Записать значение только в соответствующую колонку.

Пересчитать displayName и searchText, если меняется primary/searchable value.

Создать Activity.

EAV query strategy

MVP: Prisma relation filters для простых фильтров.

Сложные AND/OR: безопасный raw SQL builder.

Сортировка по одному атрибуту: join на Value.

Multi-sort по значениям: raw SQL.

Поиск: Record.searchText, позже Postgres full text.

Idempotency

Для bootstrap/import/migration:

использовать upsert по (orgId, key) для Object;

(objectId, key) для Attribute;

(attributeId, value) для AttributeOption;

LegacyMapping для legacy migration;

ImportJob + hash файла/строки для повторного запуска.

3. Объекты (Objects)
3.1. Описание функциональности

Статус: 🟡 частично.

Объект — тип данных в CRM. Пользователь работает с объектами как с разделами в сайдбаре Records: Companies, People, Deals, Workspaces, Users и кастомные объекты вроде Invoices.

Что видит пользователь

В левом сайдбаре есть секция Records.

В ней отображаются стандартные объекты:

Companies

People

Deals

Workspaces

Users

Также отображаются кастомные объекты:

Invoices

любые созданные пользователем объекты.

При клике на объект открывается object page:

заголовок объекта;

view dropdown;

View settings;

Filter;

Sort;

Import / Export;

+ New <Object>;

Table или Board view.

В Settings → Objects пользователь видит таблицу объектов:

Object

Type: Standard/Custom

Records count

menu ⋮

+ Create custom object.

FUNCTIONAL_INVENTORY.md фиксирует экран Settings → Objects: таблица содержит Companies, Deals, Invoices, People, Users, Workspaces, тип Standard/Custom, количество записей и кнопку + Create custom object. 


Standard Objects

Из Academy подтверждено 5 стандартных объектов: people, companies, deals, workspaces, users. ACADEMY_SCENARIOS_ALL.md указывает: стандартные объекты и кастомные объекты относятся к разделу Objects, а видео 03/04 покрывают custom objects, relationships и standard objects. 


Companies

Назначение: компании и аккаунты, с которыми работает GTM-команда.

Типовые атрибуты:

Name

Domains

Description

Categories

LinkedIn

Employee range

Estimated ARR

Funding raised

Primary location

Connection strength

Last interaction

Next calendar interaction

People

Назначение: контактные лица.

Типовые атрибуты:

Name

Email

Company

Job title

Phone

LinkedIn

Last interaction

Connection strength

Deals

Назначение: opportunity/pipeline.

Типовые атрибуты:

Deal name

Deal stage

Deal value

Deal owner

Associated company

Associated people

Deal type

Projected close date

ICP fit / AI priority

Workspaces

Назначение: customer product workspaces/accounts.

Типовые атрибуты:

Workspace name

Plan

ARR/MRR

Subscription status

Created at

Last active

Cancellation reason

Associated company

Billing admin

Users

Назначение: пользователи продукта внутри customer workspace.

Типовые атрибуты:

Name

Email

User type

Role

Workspace

Person

Last active

Created at

Custom Objects

Пользователь с правами Admin/Full access создаёт любой объект:

Settings → Objects → + Create custom object.

Указывает plural/singular name, key, icon, color, description.

Выбирает record text attribute или создаёт его.

Система создаёт object metadata, системные атрибуты и default view.

Объект появляется в сайдбаре Records.

Пример Invoices из источников:

Invoice Name — Text, Unique.

Company — Relationship → Companies.

Billing Admin — Relationship → People.

Workspace — Relationship → Workspaces.

Amount — Currency.

Status — Status.

Due Date — Date.

Academy-сценарий custom objects описывает Invoices, relationship-атрибуты, unique/required, record text и двустороннюю навигацию. 


3.2. Модель данных
Object
prisma
model Object {
  id                 String    @id @default(cuid())
  orgId              String
  org                Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  key                String
  singularName       String
  pluralName         String
  description        String?
  icon               String?
  color              String?
  isSystem           Boolean   @default(false)
  isHidden           Boolean   @default(false)

  primaryAttributeId String?
  primaryAttribute   Attribute? @relation("ObjectPrimaryAttribute", fields: [primaryAttributeId], references: [id], onDelete: SetNull)

  createdById        String?
  createdBy          User?     @relation("ObjectCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  attributes         Attribute[] @relation("ObjectAttributes")
  records            Record[]
  views              View[]
  lists              List[]

  sourceRelations    RelationshipDefinition[] @relation("RelationshipSourceObject")
  targetRelations    RelationshipDefinition[] @relation("RelationshipTargetObject")

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  archivedAt         DateTime?

  @@unique([orgId, key])
  @@index([orgId])
  @@index([primaryAttributeId])
  @@index([createdById])
  @@map("crm_objects")
}
ObjectCreateInput
TypeScript
type ObjectCreateInput = {
  key?: string;
  singularName: string;
  pluralName: string;
  description?: string;
  icon?: string;
  color?: string;
  primaryAttribute?: {
    key?: string;
    name: string;
    type: "TEXT";
  };
};
ObjectUpdateInput
TypeScript
type ObjectUpdateInput = {
  singularName?: string;
  pluralName?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  primaryAttributeId?: string | null;
  isHidden?: boolean;
};
Bootstrap object template
TypeScript
type BootstrapObjectTemplate = {
  key: "companies" | "people" | "deals" | "workspaces" | "users";
  singularName: string;
  pluralName: string;
  icon: string;
  isSystem: true;
  attributes: BootstrapAttributeTemplate[];
  defaultViews: BootstrapViewTemplate[];
};
Индексы и constraints

Object.orgId + key — уникальность объекта в workspace.

Object.primaryAttributeId — быстрый доступ к record text.

Object.archivedAt — фильтрация активных объектов.

Нельзя физически удалять object, если есть records; только archive.

Нельзя архивировать system object без force=true и admin override; в MVP system objects не удаляются.

Связанные модели

Attribute.objectId — поля объекта.

Record.objectId — записи объекта.

View.objectId — views объекта.

List.objectId — списки, основанные на объекте.

RelationshipDefinition.sourceObjectId/targetObjectId — связи.

3.3. API-эндпоинты

Все endpoints требуют JWT и org scope.

GET /api/objects

Список объектов workspace.

Query:

JSON
{
  "includeArchived": false,
  "includeHidden": false,
  "type": "all"
}

Ответ:

JSON
{
  "data": [
    {
      "id": "obj_1",
      "key": "companies",
      "singularName": "Company",
      "pluralName": "Companies",
      "description": null,
      "icon": "building",
      "color": "gray",
      "isSystem": true,
      "isHidden": false,
      "primaryAttributeId": "attr_name",
      "recordsCount": 804,
      "createdAt": "2026-06-12T08:00:00.000Z",
      "updatedAt": "2026-06-12T08:00:00.000Z"
    }
  ]
}

Ошибки:

401 UNAUTHORIZED

403 FORBIDDEN

500 INTERNAL_ERROR

GET /api/objects/:idOrKey

Получить object metadata.

Path:

idOrKey: obj_... или companies.

Query:

JSON
{
  "includeAttributes": true,
  "includeViews": true,
  "includeCounts": true
}

Ответ:

JSON
{
  "data": {
    "id": "obj_1",
    "key": "companies",
    "singularName": "Company",
    "pluralName": "Companies",
    "icon": "building",
    "isSystem": true,
    "primaryAttribute": {
      "id": "attr_name",
      "key": "name",
      "name": "Name",
      "type": "TEXT"
    },
    "attributes": [],
    "views": [],
    "counts": {
      "records": 804,
      "activeRecords": 804,
      "archivedRecords": 0
    }
  }
}

Ошибки:

401

403

404 NOT_FOUND

POST /api/objects

Создать кастомный объект.

Доступ:

ADMIN

или FULL на workspace objects settings.

Тело:

JSON
{
  "singularName": "Invoice",
  "pluralName": "Invoices",
  "key": "invoices",
  "description": "Customer invoices",
  "icon": "receipt",
  "color": "violet",
  "primaryAttribute": {
    "name": "Invoice Name",
    "key": "invoice_name"
  }
}

Ответ 201:

JSON
{
  "data": {
    "id": "obj_invoice",
    "key": "invoices",
    "singularName": "Invoice",
    "pluralName": "Invoices",
    "isSystem": false,
    "primaryAttributeId": "attr_invoice_name",
    "defaultViewId": "view_all_invoices"
  }
}

Ошибки:

400 VALIDATION_ERROR — пустое имя, неверный key.

403 FORBIDDEN — нет прав создавать объекты.

409 CONFLICT — object key уже занят.

422 BUSINESS_RULE_VIOLATION — primary attribute не text.

500.

PATCH /api/objects/:objectId

Обновить object metadata.

Тело:

JSON
{
  "singularName": "Invoice",
  "pluralName": "Invoices",
  "icon": "file-text",
  "color": "blue",
  "description": "Synced invoices",
  "primaryAttributeId": "attr_invoice_name",
  "isHidden": false
}

Ответ:

JSON
{
  "data": {
    "id": "obj_invoice",
    "updatedAt": "2026-06-12T08:05:00.000Z"
  }
}

Ошибки:

403 — нет Full access.

404 — объект не найден.

409 — конфликт key/name, если key редактируется.

422 — нельзя сменить primary на не-Text.

DELETE /api/objects/:objectId

Архивировать объект.

Query:

JSON
{
  "force": false
}

Ответ:

JSON
{
  "data": {
    "id": "obj_invoice",
    "archivedAt": "2026-06-12T08:10:00.000Z"
  }
}

Ошибки:

403 FORBIDDEN

404 NOT_FOUND

422 BUSINESS_RULE_VIOLATION — system object нельзя архивировать; объект используется в workflow/report/sequence/list без force.

POST /api/crm/bootstrap

Создать стандартные объекты и default metadata.

Тело:

JSON
{
  "includeDemoData": true,
  "force": false
}

Ответ:

JSON
{
  "data": {
    "created": {
      "objects": ["companies", "people", "deals", "workspaces", "users"],
      "attributes": 0,
      "views": 0,
      "records": 0
    },
    "skipped": {
      "objects": []
    }
  }
}

Ошибки:

401

403

409 — bootstrap уже выполнен и force=false, если реализация не idempotent.

Целевое поведение: повторный запуск не создаёт дубли.

Текущий MASTER_TZ.md уже фиксирует POST /api/crm/bootstrap как механизм создания companies/people/deals, default attributes/views и Deal stages, а object API — как частично готовый. 


GET /api/crm/bootstrap/status

Ответ:

JSON
{
  "data": {
    "isBootstrapped": true,
    "objects": {
      "companies": true,
      "people": true,
      "deals": true,
      "workspaces": true,
      "users": true
    }
  }
}
GET /api/settings/objects

Settings-specific список объектов.

Ответ:

JSON
{
  "data": [
    {
      "id": "obj_1",
      "name": "Companies",
      "type": "STANDARD",
      "recordsCount": 804,
      "attributesCount": 31,
      "archivedAt": null
    }
  ]
}
POST /api/imports/objects/:objectId

Создать import job для объекта.

Тело: multipart/form-data

file: CSV

source: CSV

mode: CREATE_OR_UPDATE | CREATE_ONLY | UPDATE_ONLY

Ответ:

JSON
{
  "data": {
    "importId": "imp_1",
    "status": "MAPPING_REQUIRED",
    "detectedColumns": ["Company", "Domain", "ARR"]
  }
}

Ошибки:

400

413 FILE_TOO_LARGE

422 INVALID_CSV

Импорт объектов детально будет в разделе 3 для S330–S334 и в разделе 7 для списков S335–S338.

3.4. UI-компоненты
RecordsSidebarSection

Поведение:

Загружает /api/objects.

Показывает активные не-hidden объекты.

System objects идут выше custom или в заданном order.

Active route подсвечивается.

Archived objects не показываются, кроме Settings.

ObjectPage

Route:

apps/frontend/src/app/(dashboard)/objects/[objectKey]/page.tsx

совместимость с текущим /crm/[objectKey], если он уже есть.

Поведение:

Загружает object metadata.

Загружает views.

Выбирает default/last active view.

Рендерит DataTable или BoardView.

Показывает toolbar: view selector, filters, sorts, import/export, + New.

SettingsObjectsPage

Route:

/settings/objects

Поведение:

Таблица объектов: name, type, records count, attributes count.

Поиск по имени/key.

Фильтр Standard/Custom/Archived.

+ Create custom object.

Row menu: Open, Settings, Rename, Change icon, Archive.

CreateObjectModal

Поля:

Singular name.

Plural name.

Key/slug auto-generated, editable.

Icon picker.

Color picker.

Description.

Record text / title field:

создать default Text attribute;

выбрать существующий Text attribute, если объект уже есть.

Buttons: Cancel, Create object.

Поведение:

Validates key uniqueness.

После создания:

создаёт default view;

открывает object page;

показывает toast.

ObjectSettingsTabs

Tabs:

Configuration

Permissions

Appearance

Attributes

Templates

Import history

Danger zone

S006 требует просмотр вкладок Configuration / Permissions / Appearance / Attributes / Templates. 


ObjectConfigurationPanel

Поля:

singular/plural name

key readonly или editable только до records?

description

primary/record text attribute

default view

hidden from sidebar

ObjectAppearancePanel

Поля:

icon

color

sidebar visibility

display density, если понадобится

ArchiveObjectDialog

Поведение:

Показывает count записей, views, lists, workflows, reports.

Для system objects: disabled.

Для custom objects: archive only.

3.5. Acceptance-критерии

Из SCENARIOS_CATALOG.md для Objects: S001–S007. 


S001 ⬜ Создать кастомный объект

Проверка:

Admin открывает Settings → Objects.

Нажимает + Create custom object.

Вводит:

singular: Invoice

plural: Invoices

icon: Receipt

record text: Invoice Name

Нажимает Create.

Объект появляется в таблице Settings → Objects как Custom.

Объект появляется в сайдбаре Records.

Открывается /objects/invoices.

Default view All Invoices пустой, но готов к добавлению записей.

API проверки:

POST /api/objects возвращает 201.

GET /api/objects содержит invoices.

GET /api/objects/invoices содержит primaryAttribute.

S002 ✅ Открыть стандартный объект Companies

Проверка:

Пользователь открывает Companies в сайдбаре.

Видит table view.

Колонки строятся из ViewColumn.

Records загружаются из /api/objects/:objectId/records.

Empty/loading/error состояния корректны.

S003 ⬜ Переименовать объект / сменить иконку

Проверка:

Admin открывает Settings → Objects → Invoices.

В Configuration меняет pluralName на Customer Invoices.

В Appearance меняет icon/color.

Сохраняет.

Сайдбар и object page обновляются.

key не меняется без явного отдельного действия.

S004 ⬜ Архивировать объект

Проверка:

Admin открывает custom object.

Нажимает Archive.

Подтверждает.

Объект исчезает из Records sidebar.

Direct URL показывает archived state или 404.

Settings → Objects → Show archived показывает объект.

System object Companies архивировать нельзя.

S005 ✅ Bootstrap 5 стандартных объектов

Проверка:

Новый workspace после регистрации запускает bootstrap.

Создаются Companies, People, Deals, Workspaces, Users.

Повторный bootstrap не создаёт дубли.

Для каждого объекта есть primary text attribute и default view.

Deals имеет status/select стадии.

S006 ⬜ Просмотр вкладок объекта в settings

Проверка:

Admin открывает Settings → Objects → Deals.

Видит вкладки:

Configuration

Permissions

Appearance

Attributes

Templates

Переключение вкладок не теряет unsaved changes без confirm.

S007 ⬜ Выбрать Record text атрибут

Проверка:

Admin создаёт Text attribute Invoice Name.

Открывает Configuration.

Выбирает Record text = Invoice Name.

Все invoice records отображаются по значению Invoice Name.

Если значение пустое, fallback: Record ID или Untitled Invoice.

S330–S334 объектная часть импорта

SCENARIOS_CATALOG.md относит import object к S330–S334: CSV import, маппинг колонок, дедуп по unique, relationship по unique-id, required validation. 


Проверка для Objects:

S330: Import CSV доступен из object toolbar.

S331: mapping CSV columns → object attributes.

S332: unique attribute domain dedupes companies.

S333: relationship import связывает deal→company по company domain.

S334: required validation блокирует строки без обязательных полей.

S402–S403

S402: legacy Lead/Campaign migration создаёт People/Companies/Sequences на новой Object model.

S403: onboarding wizard первого входа вызывает bootstrap 5 объектов.

3.6. Технические решения
Bootstrap алгоритм

Получить orgId.

Для каждого system object template:

upsert Object по (orgId, key);

upsert Attribute по (objectId, key);

upsert AttributeOption по (attributeId, value);

установить primaryAttributeId;

создать default View;

создать ViewColumn для базовых атрибутов.

Создать relationship definitions:

People → Companies;

Deals → Companies;

Deals → People;

Users → Workspaces;

Users → People;

Workspaces → Companies.

Если includeDemoData=true, создать seed records.

Вернуть created/skipped counts.

Edge-cases:

Object есть, но часть атрибутов отсутствует → дозаполнить.

primaryAttributeId null → восстановить.

default view отсутствует → создать.

options частично есть → дозаполнить.

key conflict с custom object → 409, если custom занял system key.

Key generation

Правило:

pluralName = "Invoices" → key = "invoices";

lower-case;

transliteration;

spaces to _ или - — выбрать единый стандарт, предпочтительно snake_case для keys;

удалить спецсимволы;

проверить (orgId, key);

при конфликте предложить invoices_2.

Archive object

Soft-delete:

Object.archivedAt = now()

не удалять records/attributes/views;

скрыть из navigation;

запретить создание новых records;

workflows/reports, завязанные на object, получают warning.

Record text recalculation

При смене primaryAttributeId:

Запустить background job objectDisplayNameRebuildQueue.

Для всех active records object:

найти value primary attribute;

записать Record.displayName.

Не блокировать UI на больших объектах.

Показывать progress в settings.

Object import

Алгоритм object import:

Upload CSV → ImportJob(status=MAPPING_REQUIRED).

Detect columns and sample rows.

User maps columns to attributes.

Validate:

required attributes;

unique attributes;

type parsing;

relationship target unique mapping.

Preview:

rows to create;

rows to update;

rows with warnings/errors.

Confirm → BullMQ importQueue.

Worker batch size 100–500.

Each row in transaction:

normalize values;

find existing record by unique attribute, if mapped;

create/update record;

create relationship values;

write import row result.

Import history shows progress and errors.

Permissions

Objects must integrate with RBAC:

Admin can create/manage all objects.

Member cannot create/edit objects by default.

Full access on object allows:

edit metadata;

attributes;

views;

permissions.

Read/write allows record data changes, not object structure.

Read only allows view only.

No access hides object from sidebar and API.

Минимальная реализация для зелёной сборки

Приоритет реализации:

Ensure bootstrap creates all 5 objects.

Implement /api/objects, /api/objects/:idOrKey.

Implement POST /api/objects.

Add Settings → Objects UI.

Add CreateObjectModal.

Add archive/rename/icon.

Add record text setting.

Add object import mapping.


---

# 4. Атрибуты (Attributes) + AI-атрибуты **Статус:** 🟡 частично. Backend-модель атрибутов и typed values заложена; UI create/edit attribute, relationship UI, полный набор типов, AI-атрибуты, кредиты и массовые AI-запуски требуют доведения до Attio-паритета. ## 4.1. Описание функциональности Атрибут — поле объекта или списка. Пользователь создаёт атрибуты без кода из таблицы, board view или Settings → Objects → Attributes. Атрибуты определяют, какие данные можно хранить у Record, как валидировать значения, как строить таблицы, фильтры, board-группировку, отчёты, workflows и AI-расчёты. В UI пользователь видит модалку **Create attribute**: заголовок, dropdown `Attribute Type`, поля `Name`, `Description (optional)`, опцию `Set as title field`, секцию `AI autofill`, кнопки `Cancel` и `Create attribute`. В storyboard зафиксирован dropdown типов с AI-вариантами `Classify record`, `Summarize record`, `Research agent`, базовыми типами `Text`, `Number`, `Checkbox`, `Date`, `Rating`, `Timestamp`, `Status`, `Multi-select`, `Currency`, `Record`, `User`, `Select`, `Relationship`, `Location`, `Phone Number`; для `Select` появляется секция `Options`, а для AI autofill — `Autofill type = Classify record` и поля инструкции. :contentReference[oaicite:0]{index=0} ### 4.1.1. Базовые типы атрибутов Поддерживаемые типы: | Тип UI | Prisma enum | Хранение в Value | Поведение | |---|---|---|---| | Text | `TEXT` | `textValue` | Короткая строка, primary/record text совместим | | Long text | `LONG_TEXT` | `textValue` | Многострочный текст | | Number | `NUMBER` | `numberValue` | Число, фильтры gt/lt | | Checkbox / Boolean | `BOOLEAN` | `booleanValue` | true/false | | Date | `DATE` | `dateValue` | День без времени в UI | | Timestamp / Datetime | `DATETIME` | `dateValue` | Дата+время | | Rating | `RATING` | `numberValue` | Целое 1–5 или 1–10 по config | | Status | `STATUS` | `textValue` или `jsonValue` | Select-like стадии, используется для Board | | Select | `SELECT` | `textValue` | Одно значение из `AttributeOption` | | Multi-select | `MULTI_SELECT` | `jsonValue` | Массив option values | | Currency | `CURRENCY` | `currencyAmount`, `currencyCode` | Сумма + валюта | | Email | `EMAIL` | `textValue` | email validation, mailto/action | | Phone | `PHONE` | `textValue` | phone normalization | | URL | `URL` | `textValue` | URL validation, external link | | Location | `LOCATION` | `jsonValue` | country/city/state/address/geo | | User | `USER` | `userValueId` | ссылка на User workspace | | Record link | `RECORD` | `jsonValue` или RelationshipValue | ссылка на Record без двусторонней схемы | | Relationship | `RELATIONSHIP` | `RelationshipValue` | двусторонняя typed-связь объектов | | JSON | `JSON` | `jsonValue` | системный/интеграционный payload | Сценарии S010–S034 требуют модалку create attribute, создание всех базовых типов, unique/required flags, reorder, archive, options и нередактируемые system attributes. :contentReference[oaicite:1]{index=1} ### 4.1.2. Options для Select / Multi-select / Status Для `SELECT`, `MULTI_SELECT`, `STATUS` атрибут имеет `AttributeOption[]`. Пользователь может: 1. Создать options прямо в модалке attribute. 2. Добавить option позже из settings или inline review import. 3. Задать label, value, цвет, порядок. 4. Архивировать option без потери старых значений. 5. Использовать options в фильтрах, board columns, reports, workflows. `STATUS` технически является select-like типом, но в UI имеет stage semantics: порядок стадий, цвет, канбан-колонки, optional won/lost flags. ### 4.1.3. Required / Unique / System **Required**: - запись нельзя создать или обновить, если required attribute пустой; - import должен помечать строки ошибкой; - inline edit не позволяет сохранить пустое значение; - backend проверяет required независимо от UI. **Unique**: - в рамках `objectId` значение attribute должно быть уникальным среди active records; - используется для дедупа import и sync; - для typed values уникальность проверяется сервисным запросом, а не только DB unique, потому что EAV хранит разные типы в одной таблице; - для Companies domain/website и People email unique особенно важны. **System**: - системные атрибуты создаются bootstrap-ом или backend-модулем; - пользователь не может менять `key`, `type`, `isRequired` критичных system attributes; - некоторые system attributes readonly: `Created at`, `Created by`, `Updated at`, `List Entries`, `Next due task`. ### 4.1.4. Relationship-атрибуты Relationship-атрибут связывает records разных объектов. В UI пользователь выбирает `Attribute Type = Relationship`, целевой объект, кардинальность, имена обеих сторон связи. Storyboard фиксирует relationship-модалку с выбором объекта, полями associated attribute names и вариантами кардинальности `One to many`, `One to one`, `Many to one`, `Many to many`; после создания появляется новая relationship-колонка в таблице. :contentReference[oaicite:2]{index=2} Поддерживаемые кардинальности: - `ONE_TO_ONE` - `ONE_TO_MANY` - `MANY_TO_ONE` - `MANY_TO_MANY` Примеры: - Company → Team → People: one company has many people. - Invoice → Company: many invoices belong to one company. - Invoice → Billing Admin → People: many invoices may point to one person. - Deal → Associated People: many-to-many. - User → Workspace: many users belong to one workspace. Пользователь должен иметь возможность: 1. Создать relationship attribute. 2. Указать target object. 3. Указать cardinality. 4. Задать имя прямой и обратной стороны. 5. Видеть связь с обеих сторон. 6. Подтягивать поле связанной записи в view column. 7. Drill-in: на company показать email team через relationship. Сценарии S040–S049 покрывают создание relationship attribute, четыре кардинальности, имена обеих сторон, двустороннюю навигацию, несколько relationships на объект, nested columns и drill-in. :contentReference[oaicite:3]{index=3} ### 4.1.5. AI-атрибуты AI-атрибут — обычный Attribute с AI-конфигурацией. Его значение сохраняется в `Value` и дальше используется как обычное поле: фильтры, reports, workflow triggers, table/board cells. Поддерживаемые 4 AI-типа: | AI-тип | Совместимые базовые типы | Вход | Выход | Кредиты | |---|---|---|---|---:| | `CLASSIFY_RECORD` | `SELECT`, `MULTI_SELECT`, `STATUS` | Вся record + guidance + options | option value(s) | 1 | | `SUMMARIZE_RECORD` | `TEXT`, `LONG_TEXT` | Вся record + guidance | text summary | 1 | | `RESEARCH_AGENT` | `TEXT`, `LONG_TEXT` | record context + question + web/demo research | researched text | 10 | | `PROMPT_COMPLETION` | `TEXT`, `LONG_TEXT`, `NUMBER`, `CURRENCY`, `SELECT` | prompt + selected variables | typed output | 1 | Academy spec фиксирует эти четыре AI-типа, их входы/выходы и стоимость: classify/summarize/prompt стоят 1 кредит, research agent — 10 кредитов; запуск возможен из table cell, kanban card, column header для всех строк view и record page; значения используются в отчётах и workflow filters/triggers. :contentReference[oaicite:4]{index=4} Сценарии S160–S173 требуют создание каждого AI-типа, совместимость типов, запуск из table/kanban/column header/record page, loading state, списание кредитов, billing history, demo-AI и использование результата в фильтрах/отчётах/триггерах. :contentReference[oaicite:5]{index=5} ### 4.1.6. AI-запуск Пользователь может запустить AI: 1. По одной ячейке table. 2. По одной карточке kanban. 3. По заголовку AI-колонки — пересчитать все rows в текущем view. 4. На record page. 5. Из workflow AI-block. 6. Через API. UI состояния: - idle: кнопка/иконка AI; - pending: `AI is thinking`; - success: значение сохранено в cell; - failed: error badge + retry; - no credits: prompt перейти в Billing; - demo mode: badge `Demo AI`. ### 4.1.7. Кредиты Кредитная модель: - `CLASSIFY_RECORD`: 1 - `SUMMARIZE_RECORD`: 1 - `PROMPT_COMPLETION`: 1 - `RESEARCH_AGENT`: 10 Перед постановкой job: 1. Проверить balance. 2. Зарезервировать или списать кредит. 3. Создать `CreditTransaction`. 4. При fail: - если ошибка системная/provider — refund; - если ошибка validation/no input — не списывать; - если результат получен и сохранён — списание финализировано. Billing history показывает тип, объект, атрибут, record/view, количество кредитов, пользователя, timestamp. ## 4.2. Prisma-модель Текущая схема уже содержит `Attribute`, `AttributeOption`, `RelationshipDefinition`, `RelationshipValue`, `Value` и индексы. Для полного AI-паритета требуются дополнительные enum/model или расширение `config Json`. Ниже — целевая схема. ```prisma enum AttributeType { TEXT LONG_TEXT NUMBER BOOLEAN DATE DATETIME RATING STATUS SELECT MULTI_SELECT CURRENCY EMAIL PHONE URL USER RECORD RELATIONSHIP LOCATION JSON } enum AttributeAiType { CLASSIFY_RECORD SUMMARIZE_RECORD RESEARCH_AGENT PROMPT_COMPLETION } enum RelationshipCardinality { ONE_TO_ONE ONE_TO_MANY MANY_TO_ONE MANY_TO_MANY } enum AiRunStatus { QUEUED RUNNING SUCCEEDED FAILED CANCELLED } enum CreditTransactionType { AI_CLASSIFY_RECORD AI_SUMMARIZE_RECORD AI_RESEARCH_AGENT AI_PROMPT_COMPLETION AI_REFUND MONTHLY_GRANT PURCHASE ADMIN_ADJUSTMENT } model Attribute { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) objectId String object Object @relation("ObjectAttributes", fields: [objectId], references: [id], onDelete: Cascade) key String name String description String? type AttributeType isSystem Boolean @default(false) isRequired Boolean @default(false) isUnique Boolean @default(false) isPrimary Boolean @default(false) isArchived Boolean @default(false) order Int @default(0) config Json? aiType AttributeAiType? aiEnabled Boolean @default(false) aiPrompt String? @db.Text aiGuidance String? @db.Text primaryForObjects Object[] @relation("ObjectPrimaryAttribute") options AttributeOption[] values Value[] sourceRelationshipDefinitions RelationshipDefinition[] @relation("RelationshipSourceAttribute") reverseRelationshipDefinitions RelationshipDefinition[] @relation("RelationshipReverseAttribute") relationshipValues RelationshipValue[] @relation("RelationshipSourceAttributeValue") viewColumns ViewColumn[] viewFilters ViewFilter[] viewSorts ViewSort[] groupedViews View[] @relation("ViewGroupByAttribute") aiRuns AiAttributeRun[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@unique([objectId, key]) @@index([orgId]) @@index([objectId]) @@index([type]) @@index([aiEnabled]) @@index([aiType]) @@map("crm_attributes") } model AttributeOption { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) attributeId String attribute Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade) value String label String color String? order Int @default(0) isArchived Boolean @default(false) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([attributeId, value]) @@index([orgId]) @@index([attributeId]) @@map("crm_attribute_options") } model RelationshipDefinition { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) sourceObjectId String sourceObject Object @relation("RelationshipSourceObject", fields: [sourceObjectId], references: [id], onDelete: Cascade) targetObjectId String targetObject Object @relation("RelationshipTargetObject", fields: [targetObjectId], references: [id], onDelete: Cascade) sourceAttributeId String sourceAttribute Attribute @relation("RelationshipSourceAttribute", fields: [sourceAttributeId], references: [id], onDelete: Cascade) reverseAttributeId String? reverseAttribute Attribute? @relation("RelationshipReverseAttribute", fields: [reverseAttributeId], references: [id], onDelete: SetNull) cardinality RelationshipCardinality sourceLabel String targetLabel String isBidirectional Boolean @default(true) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([sourceObjectId]) @@index([targetObjectId]) @@index([sourceAttributeId]) @@index([reverseAttributeId]) @@map("crm_relationship_definitions") } model RelationshipValue { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) sourceRecordId String sourceRecord Record @relation("RelationshipSourceRecord", fields: [sourceRecordId], references: [id], onDelete: Cascade) sourceAttributeId String sourceAttribute Attribute @relation("RelationshipSourceAttributeValue", fields: [sourceAttributeId], references: [id], onDelete: Cascade) targetRecordId String targetRecord Record @relation("RelationshipTargetRecord", fields: [targetRecordId], references: [id], onDelete: Cascade) targetObjectId String createdAt DateTime @default(now()) @@unique([sourceRecordId, sourceAttributeId, targetRecordId]) @@index([orgId]) @@index([sourceRecordId]) @@index([targetRecordId]) @@index([sourceAttributeId]) @@index([targetObjectId]) @@map("crm_relationship_values") } model AiAttributeRun { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) attributeId String attribute Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade) recordId String? record Record? @relation(fields: [recordId], references: [id], onDelete: Cascade) viewId String? view View? @relation(fields: [viewId], references: [id], onDelete: SetNull) requestedById String? requestedBy User? @relation(fields: [requestedById], references: [id], onDelete: SetNull) aiType AttributeAiType status AiRunStatus @default(QUEUED) input Json output Json? error String? creditsCharged Int @default(0) demoMode Boolean @default(false) startedAt DateTime? completedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([attributeId]) @@index([recordId]) @@index([viewId]) @@index([status]) @@map("crm_ai_attribute_runs") } model CreditTransaction { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) userId String? user User? @relation(fields: [userId], references: [id], onDelete: SetNull) type CreditTransactionType amount Int balanceAfter Int entityType String? entityId String? metadata Json? createdAt DateTime @default(now()) @@index([orgId, createdAt]) @@index([userId]) @@index([type]) @@map("crm_credit_transactions") } ``` ### `Attribute.config` по типам ```ts type AttributeConfig = | { type: "RATING"; max: 5 | 10 } | { type: "CURRENCY"; defaultCurrency: "USD" | "EUR" | "GBP"; allowedCurrencies?: string[] } | { type: "STATUS"; optionsSemantic?: { won?: string[]; lost?: string[] }; allowNoStage?: boolean } | { type: "LOCATION"; fields: Array<"country" | "state" | "city" | "address" | "postalCode" | "lat" | "lng"> } | { type: "USER"; allowMultiple?: boolean } | { type: "RECORD"; targetObjectId: string; allowMultiple?: boolean } | { type: "AI"; aiType: "CLASSIFY_RECORD" | "SUMMARIZE_RECORD" | "RESEARCH_AGENT" | "PROMPT_COMPLETION"; variableAttributeIds?: string[]; prompt?: string; guidance?: string; outputSchema?: unknown; }; ``` ## 4.3. API-эндпоинты ### GET `/api/objects/:objectId/attributes` Список атрибутов объекта. Ответ: ```json { "data": [ { "id": "attr_1", "objectId": "obj_companies", "key": "segment", "name": "Segment", "description": "Company segment", "type": "SELECT", "isSystem": false, "isRequired": false, "isUnique": false, "isPrimary": false, "isArchived": false, "order": 10, "config": null, "aiEnabled": true, "aiType": "CLASSIFY_RECORD", "options": [ { "id": "opt_1", "value": "prospect", "label": "Prospect", "color": "blue", "order": 0 } ] } ] } ``` Ошибки: `401`, `403`, `404`. ### POST `/api/objects/:objectId/attributes` Создать атрибут. Тело для Text: ```json { "key": "mrr", "name": "MRR", "description": "Monthly recurring revenue", "type": "CURRENCY", "isRequired": false, "isUnique": false, "isPrimary": false, "config": { "defaultCurrency": "USD" } } ``` Тело для Select: ```json { "name": "Segment", "type": "SELECT", "options": [ { "value": "prospect", "label": "Prospect", "color": "blue" }, { "value": "customer", "label": "Customer", "color": "green" } ] } ``` Тело для Relationship: ```json { "name": "Company", "type": "RELATIONSHIP", "relationship": { "targetObjectId": "obj_companies", "cardinality": "MANY_TO_ONE", "sourceLabel": "Company", "targetLabel": "People", "reverseAttributeName": "Team" } } ``` Тело для AI Classify: ```json { "name": "ICP", "type": "SELECT", "options": [ { "value": "icp", "label": "ICP", "color": "green" }, { "value": "not_icp", "label": "Not ICP", "color": "red" } ], "aiEnabled": true, "aiType": "CLASSIFY_RECORD", "aiGuidance": "Classify whether this company fits our ICP." } ``` Ответ `201`: ```json { "data": { "id": "attr_icp", "key": "icp", "name": "ICP", "type": "SELECT", "aiEnabled": true, "aiType": "CLASSIFY_RECORD", "options": [] } } ``` Ошибки: - `400 VALIDATION_ERROR` — неверный тип/config/options. - `403 FORBIDDEN` — нет Full access на object. - `404 NOT_FOUND` — object/targetObject не найден. - `409 CONFLICT` — key занят. - `422 BUSINESS_RULE_VIOLATION` — AI type несовместим с базовым типом; system object locked; relationship cardinality invalid. ### PATCH `/api/attributes/:attributeId` Обновить атрибут. Тело: ```json { "name": "ICP Fit", "description": "AI score for ICP matching", "isRequired": false, "isUnique": false, "order": 12, "config": { "defaultCurrency": "USD" }, "aiGuidance": "Use industry, size, funding and country." } ``` Ответ: ```json { "data": { "id": "attr_icp", "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: `400`, `403`, `404`, `409`, `422`. ### DELETE `/api/attributes/:attributeId` Архивировать атрибут. Ответ: ```json { "data": { "id": "attr_1", "archivedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: - `403` - `404` - `422` — нельзя архивировать system/primary attribute без предварительной смены primary. ### POST `/api/attributes/:attributeId/options` Добавить option. Тело: ```json { "value": "enterprise", "label": "Enterprise", "color": "purple", "order": 3 } ``` Ответ `201`: ```json { "data": { "id": "opt_enterprise", "value": "enterprise", "label": "Enterprise", "color": "purple", "order": 3 } } ``` Ошибки: `400`, `403`, `404`, `409`, `422`. ### PATCH `/api/attribute-options/:optionId` Обновить option. Тело: ```json { "label": "Enterprise", "color": "violet", "order": 1 } ``` Ответ: ```json { "data": { "id": "opt_enterprise", "updatedAt": "2026-06-12T08:01:00.000Z" } } ``` ### DELETE `/api/attribute-options/:optionId` Архивировать option. Ответ: ```json { "data": { "id": "opt_enterprise", "isArchived": true } } ``` ### PUT `/api/objects/:objectId/attributes/reorder` Изменить порядок атрибутов. Тело: ```json { "attributeIds": ["attr_name", "attr_email", "attr_company"] } ``` Ответ: ```json { "data": { "updated": 3 } } ``` Ошибки: `400`, `403`, `404`. ### GET `/api/attributes/:attributeId/usage` Проверить использование атрибута перед archive/type-change. Ответ: ```json { "data": { "recordsWithValue": 804, "views": 4, "filters": 2, "sorts": 1, "workflows": 0, "reports": 1, "canArchive": true, "warnings": [] } } ``` ### POST `/api/ai/attributes/:attributeId/run` Запустить AI для одной записи. Тело: ```json { "recordId": "rec_1", "mode": "single" } ``` Ответ `202`: ```json { "data": { "runId": "airun_1", "status": "QUEUED", "creditsEstimated": 10, "demoMode": false } } ``` Ошибки: - `400` — attribute not AI-enabled. - `402 PAYMENT_REQUIRED` — недостаточно кредитов. - `403` - `404` - `422` — record не принадлежит object атрибута. ### POST `/api/ai/attributes/:attributeId/run-view` Запустить AI по всем строкам текущего view. Тело: ```json { "viewId": "view_inbound", "filtersSnapshot": true, "limit": 500 } ``` Ответ `202`: ```json { "data": { "batchId": "aibatch_1", "status": "QUEUED", "recordsQueued": 128, "creditsEstimated": 1280 } } ``` Ошибки: - `402 PAYMENT_REQUIRED` - `413 TOO_MANY_RECORDS` - `422 VIEW_NOT_COMPATIBLE` ### GET `/api/ai/runs/:runId` Ответ: ```json { "data": { "id": "airun_1", "status": "SUCCEEDED", "attributeId": "attr_icp", "recordId": "rec_1", "output": { "value": "icp", "reasoningSummary": "Matches ICP by size and category." }, "creditsCharged": 1, "demoMode": false } } ``` ### GET `/api/billing/credits` Ответ: ```json { "data": { "balance": 950, "monthlyGrant": 1000, "usedThisMonth": 50, "breakdown": [ { "type": "AI_RESEARCH_AGENT", "credits": 40 }, { "type": "AI_CLASSIFY_RECORD", "credits": 10 } ] } } ``` ### GET `/api/billing/credits/transactions` Query: ```json { "from": "2026-06-01", "to": "2026-06-12", "type": "AI_RESEARCH_AGENT" } ``` Ответ: ```json { "data": [ { "id": "ctx_1", "type": "AI_RESEARCH_AGENT", "amount": -10, "balanceAfter": 950, "entityType": "AiAttributeRun", "entityId": "airun_1", "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` ## 4.4. UI-компоненты ### `CreateAttributeModal` Поля: - `Attribute Type` - `Name` - `Description (optional)` - `Required` - `Unique` - `Set as title field` - type-specific config - `AI autofill` Поведение: - открывается из `+ Add column`, object settings, list settings; - после выбора type перестраивает форму; - генерирует key из name; - валидирует compatibility; - показывает preview для AI output; - создаёт options inline. ### `AttributeTypeDropdown` Группы: - AI: - Classify record - Summarize record - Research agent - Prompt completion - Basic: - Text, Long text, Number, Boolean, Date, Datetime, Rating - Selectors: - Status, Select, Multi-select - Structured: - Currency, Email, Phone, URL, Location - References: - User, Record, Relationship ### `SelectOptionsEditor` Поведение: - add/edit/delete option; - color picker; - drag reorder; - detect duplicate value/label; - archive option with warning. ### `RelationshipAttributeEditor` Поля: - source object readonly; - target object; - source attribute name; - reverse attribute name; - cardinality; - bidirectional toggle; - preview: `Companies ↔ People`. ### `AiAttributeConfigPanel` Поля: - AI type; - guidance/prompt; - variables; - output type preview; - credits per run; - estimated cost for current view; - demo-mode badge; - test on sample record. ### `AttributeSettingsPage` Route: - `/settings/objects/[objectId]/attributes` Компоненты: - table of attributes; - reorder drag handle; - type badge; - system badge; - required/unique toggles; - usage indicator; - row menu: edit, duplicate, archive. ### `AiRunButton` Используется в: - table cell; - board card; - record page Details; - column header. Состояния: - idle; - queued; - running; - success; - failed; - no credits; - disabled due permission. ### `CreditBadge` Показывает баланс AI-кредитов в topbar/settings. ## 4.5. Acceptance-критерии ### Базовые атрибуты: S010–S034 - **S010 🟡**: пользователь открывает `Create attribute`; видит type dropdown, Name, Description; modal закрывается Cancel/ESC; Create disabled до валидных данных. - **S011 ⬜ Text**: создать Text attribute; колонка появляется в view; значение хранится в `Value.textValue`; можно inline-edit. - **S012 ⬜ Long text**: создать Long text; editor textarea; value сохраняется в `textValue`; table показывает truncated preview. - **S013 ⬜ Number**: создать Number; нечисловое значение rejected; фильтры `gt/lt/eq` работают. - **S014 ⬜ Checkbox/Boolean**: создать Boolean; table cell checkbox; значение хранится в `booleanValue`. - **S015 ⬜ Date**: создать Date; date picker; значение хранится в `dateValue` с normalized day. - **S016 ⬜ Timestamp/Datetime**: date+time picker; timezone-aware display. - **S017 ⬜ Rating**: создать Rating; UI stars/score; value ограничен config max. - **S018 ⬜ Status**: создать Status; options являются стадиями; пригоден для Board groupBy. - **S019 ⬜ Select**: создать Select с options; cell dropdown; invalid option rejected. - **S020 ⬜ Multi-select**: выбрать несколько options; хранится массив. - **S021 ⬜ Currency**: amount+currency; форматирование по валюте; aggregates sum/avg. - **S022 ⬜ Email**: email validation; mailto/compose action. - **S023 ⬜ Phone**: phone validation/normalization. - **S024 ⬜ URL**: URL validation; opens external link. - **S025 ⬜ Record link**: выбрать target record; ссылка открывает record page. - **S026 ⬜ User**: выбрать workspace user; avatar/name rendered. - **S027 ⬜ Location**: location editor; country/city/state fields. - **S028 ⬜ Relationship**: создание переводит в relationship flow S040–S049. - **S029 ⬜ Unique**: duplicate value blocked in create/update/import; error shows conflicting record. - **S030 ⬜ Required**: create/update/import without value rejected. - **S031 ⬜ Reorder**: drag attributes in object settings; order persists and affects defaults. - **S032 ⬜ Archive**: archived attribute hidden from create/edit and new views; existing data not deleted. - **S033 ⬜ Options inline**: Select options added during create; immediately available in cells. - **S034 ⬜ System attributes**: system fields visible readonly; user cannot edit/archive locked fields. ### Relationships: S040–S049 - **S040 ⬜**: создать relationship attribute; выбрать target object. - **S041 ⬜ one-to-one**: backend запрещает вторую связь для source/target по этой definition. - **S042 ⬜ one-to-many**: one source → many targets; target restricted to one source for reverse side. - **S043 ⬜ many-to-one**: many sources → one target. - **S044 ⬜ many-to-many**: multiple sources/targets allowed. - **S045 ⬜**: задать имена обеих сторон; reverse attribute создаётся. - **S046 ⬜**: invoice→company виден на invoice, company→invoices виден на company. - **S047 ⬜**: один object может иметь несколько relationships: Company, Billing Admin, Workspace. - **S048 ⬜**: view column может подтянуть nested field: `Billing Admin > Email`. - **S049 ⬜**: на company можно drill-in в team и увидеть email связанных people. ### AI-атрибуты: S160–S173 - **S160 ⬜ Classify record**: создать AI Select/Multi-select; guidance сохраняется; AI возвращает option(s). - **S161 ⬜ Summarize record**: создать AI Text; AI пишет summary по record values. - **S162 ⬜ Research agent**: создать AI Text; question/guidance сохраняется; run списывает 10 кредитов. - **S163 ⬜ Prompt completion**: создать AI Text/Number/Currency; prompt использует selected variables; output typed. - **S164 ⬜ Compatibility**: incompatible pairs rejected: Research→Number, Classify→Text без options и т.д. - **S165 ⬜ Table cell run**: клик AI icon в cell создаёт run и сохраняет value. - **S166 ⬜ Kanban card run**: AI icon на card запускает run для card record. - **S167 ⬜ Column header run**: запускает batch по current view rows, с estimated cost confirm. - **S168 ⬜ Record page run**: AI value можно пересчитать из Details. - **S169 ⬜ Loading**: UI показывает `AI is thinking`; after success value appears; failed state retryable. - **S170 ⬜ Credit charge**: credits списываются согласно AI type. - **S171 ⬜ Credit balance/history**: Billing показывает balance, badge, transactions. - **S172 ⬜ Demo-AI**: без Anthropic key AI возвращает детерминированный осмысленный result. - **S173 ⬜ AI values reusable**: AI атрибут доступен в filters, reports, workflow triggers/actions. ## 4.6. Технические решения ### Value validation algorithm ```ts type NormalizedValue = | { textValue: string | null } | { numberValue: number | null } | { booleanValue: boolean | null } | { dateValue: string | null } | { jsonValue: unknown } | { userValueId: string | null } | { currencyAmount: string | null; currencyCode: string | null }; function normalizeValue(attribute: Attribute, input: unknown): NormalizedValue { // 1. Проверить required. // 2. Проверить type-specific формат. // 3. Очистить все остальные typed columns. // 4. Вернуть normalized typed payload. } ``` ### AI compatibility matrix ```ts const AI_COMPATIBILITY = { CLASSIFY_RECORD: ["SELECT", "MULTI_SELECT", "STATUS"], SUMMARIZE_RECORD: ["TEXT", "LONG_TEXT"], RESEARCH_AGENT: ["TEXT", "LONG_TEXT"], PROMPT_COMPLETION: ["TEXT", "LONG_TEXT", "NUMBER", "CURRENCY", "SELECT"] } as const; ``` ### AI run worker 1. API validates permissions, attribute, record/view, credits. 2. Creates `AiAttributeRun(status=QUEUED)`. 3. Adds job to `aiQueue`. 4. Worker loads record context: - object metadata; - values; - relationship summaries; - recent activities if allowed. 5. Builds prompt by AI type. 6. If `ANTHROPIC_API_KEY` exists → Anthropic provider. 7. Else → deterministic demo provider. 8. Validates output against target attribute type. 9. Saves `Value`. 10. Creates `Activity(type=AI_ATTRIBUTE_UPDATED)`. 11. Charges/finalizes credits. 12. Emits websocket/SSE event for UI update. ### Demo-AI deterministic rules - Classify ICP: - if employee range high/funding/country/category match → `icp`; - else `not_icp`. - Summarize: - deterministic string from displayName + top 5 non-empty fields. - Research: - uses record fields and fixed templates, no web. - Prompt: - simple template completion; number/currency parsed from deterministic heuristics. ### Relationship cardinality enforcement - `ONE_TO_ONE`: max one active target per source attribute and max one source per target. - `ONE_TO_MANY`: source can have many targets; each target has max one source for reverse. - `MANY_TO_ONE`: source has max one target; target can have many sources. - `MANY_TO_MANY`: no cardinality limit except duplicate unique constraint. ### Unique validation in EAV Because typed values live in `Value`, uniqueness is enforced in service: 1. On create/update for `isUnique`. 2. Normalize target typed value. 3. Query same `attributeId`, same typed column, different `recordId`, active record. 4. If exists → `409 CONFLICT`. For high scale, add partial unique indexes per generated unique attribute later via migration/SQL, but MVP service validation is acceptable. ### System attribute policy System attributes split into: - `readonly`: user cannot edit values (`createdAt`, `createdBy`). - `managed`: system updates value, user sees it (`lastInteraction`, `nextDueTask`). - `configurable`: user can show/hide/order but not change type (`dealStage`). - `locked`: cannot archive. --- # 5. Записи (Records) **Статус:** ✅ базовый CRUD; 🟡 inline-edit/details/activity частично; ⬜ bulk/right-click audit. ## 5.1. Описание функциональности Record — конкретная запись объекта: компания, человек, сделка, invoice, workspace, user. Record не хранит бизнес-поля напрямую: значения лежат в `Value`, а сам record хранит tenant/object/audit/display/search metadata. Пользователь может: 1. Открыть объект и увидеть records в Table или Board. 2. Создать запись через `+ New <Object>`. 3. Заполнить значения атрибутов в modal/drawer. 4. Открыть record page кликом по row/card. 5. Inline-edit значения в table cell или details panel. 6. Удалить запись через archive. 7. Искать по primary attribute / `searchText`. 8. Переключать страницы/limit/cursor. 9. Выбрать несколько rows и выполнить bulk action. 10. Right-click по значению и посмотреть created/updated metadata. Сценарии S060–S067 фиксируют: создать запись, открыть карточку, inline-edit, архивировать, поиск, пагинация, bulk selection и right-click audit. :contentReference[oaicite:6]{index=6} ## 5.2. Prisma-модель ```prisma model Record { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) objectId String object Object @relation(fields: [objectId], references: [id], onDelete: Cascade) displayName String? searchText String? createdById String? createdBy User? @relation("RecordCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) updatedById String? updatedBy User? @relation("RecordUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull) values Value[] activities Activity[] emails Email[] notes Note[] tasks Task[] listEntries ListEntry[] sourceRelationshipValues RelationshipValue[] @relation("RelationshipSourceRecord") targetRelationshipValues RelationshipValue[] @relation("RelationshipTargetRecord") createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([objectId]) @@index([orgId, objectId]) @@index([displayName]) @@index([searchText]) @@index([createdAt]) @@index([updatedAt]) @@index([archivedAt]) @@map("crm_records") } model Value { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) attributeId String attribute Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade) textValue String? numberValue Float? booleanValue Boolean? dateValue DateTime? jsonValue Json? userValueId String? userValue User? @relation("ValueUser", fields: [userValueId], references: [id], onDelete: SetNull) currencyAmount Decimal? @db.Decimal(18, 2) currencyCode String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([recordId, attributeId]) @@index([orgId]) @@index([recordId]) @@index([attributeId]) @@index([attributeId, textValue]) @@index([attributeId, numberValue]) @@index([attributeId, booleanValue]) @@index([attributeId, dateValue]) @@index([userValueId]) @@map("crm_values") } model ValueAudit { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String attributeId String valueId String? actorId String? actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull) oldValue Json? newValue Json? action String // CREATED | UPDATED | CLEARED | ARCHIVED createdAt DateTime @default(now()) @@index([orgId]) @@index([recordId, attributeId, createdAt]) @@index([actorId]) @@map("crm_value_audits") } ``` ### Record DTO ```ts type RecordDetailDto = { id: string; objectId: string; objectKey: string; displayName: string | null; values: Record<string, TypedValueDto>; relationships: RelationshipDto[]; lists: ListMembershipDto[]; activitySummary: { lastActivityAt: string | null; nextDueTaskAt: string | null; }; createdAt: string; updatedAt: string; archivedAt: string | null; }; ``` ## 5.3. API-эндпоинты ### GET `/api/objects/:objectId/records` Получить records объекта. Query: ```json { "viewId": "view_all_companies", "limit": 50, "cursor": "rec_cursor", "search": "cosme", "includeArchived": false, "filters": [], "sorts": [] } ``` Ответ: ```json { "data": [ { "id": "rec_1", "objectId": "obj_companies", "objectKey": "companies", "displayName": "Cosme", "values": { "name": { "attributeId": "attr_name", "type": "TEXT", "value": "Cosme" }, "employee_range": { "attributeId": "attr_emp", "type": "SELECT", "value": "51_250", "label": "51–250" } }, "createdAt": "2026-06-12T08:00:00.000Z", "updatedAt": "2026-06-12T08:00:00.000Z" } ], "meta": { "pagination": { "limit": 50, "nextCursor": "rec_next", "hasMore": true }, "count": 804 } } ``` Ошибки: `401`, `403`, `404`, `422`. ### POST `/api/objects/:objectId/records` Создать record. Тело: ```json { "values": { "name": "Cosme", "domain": "cosme.pt", "employee_range": "51_250", "estimated_arr": { "amount": "120000", "currency": "USD" } } } ``` Ответ `201`: ```json { "data": { "id": "rec_1", "displayName": "Cosme", "values": { "name": { "value": "Cosme" } } } } ``` Ошибки: - `400 VALIDATION_ERROR` - `403 FORBIDDEN` - `404 NOT_FOUND` - `409 CONFLICT` — unique violation. - `422 BUSINESS_RULE_VIOLATION` — required missing, type invalid. ### GET `/api/records/:recordId` Получить record detail. Query: ```json { "includeRelationships": true, "includeLists": true, "includeActivitySummary": true } ``` Ответ: ```json { "data": { "id": "rec_1", "objectKey": "companies", "displayName": "Cosme", "values": { "name": { "type": "TEXT", "value": "Cosme" }, "linkedin": { "type": "URL", "value": "https://linkedin.com/company/cosme" } }, "relationships": [], "lists": [], "activitySummary": { "lastActivityAt": "2026-06-12T08:00:00.000Z" }, "createdAt": "2026-06-12T08:00:00.000Z", "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: `401`, `403`, `404`. ### PATCH `/api/records/:recordId` Обновить несколько values. Тело: ```json { "values": { "employee_range": "251_1000", "estimated_arr": { "amount": "250000", "currency": "USD" } } } ``` Ответ: ```json { "data": { "id": "rec_1", "updatedAt": "2026-06-12T08:15:00.000Z", "values": { "employee_range": { "value": "251_1000" }, "estimated_arr": { "amount": "250000", "currency": "USD" } } } } ``` Ошибки: `400`, `403`, `404`, `409`, `422`. ### PATCH `/api/records/:recordId/values/:attributeId` Inline-edit одного значения. Тело: ```json { "value": "Contacted" } ``` Ответ: ```json { "data": { "recordId": "rec_1", "attributeId": "attr_stage", "value": { "type": "STATUS", "value": "contacted", "label": "Contacted" }, "updatedAt": "2026-06-12T08:16:00.000Z" } } ``` Ошибки: `400`, `403`, `404`, `409`, `422`. ### DELETE `/api/records/:recordId` Archive record. Ответ: ```json { "data": { "id": "rec_1", "archivedAt": "2026-06-12T08:17:00.000Z" } } ``` Ошибки: `403`, `404`, `422`. ### POST `/api/records/bulk` Bulk operation. Тело для update attribute: ```json { "recordIds": ["rec_1", "rec_2"], "operation": "UPDATE_VALUE", "payload": { "attributeId": "attr_stage", "value": "contacted" } } ``` Тело для archive: ```json { "recordIds": ["rec_1", "rec_2"], "operation": "ARCHIVE", "payload": {} } ``` Ответ `202`: ```json { "data": { "jobId": "bulk_1", "status": "QUEUED", "recordsCount": 2 } } ``` Ошибки: - `400` - `403` - `404` - `413 TOO_MANY_RECORDS` - `422` ### GET `/api/records/bulk/:jobId` Ответ: ```json { "data": { "id": "bulk_1", "status": "SUCCEEDED", "processed": 2, "failed": 0, "errors": [] } } ``` ### GET `/api/records/:recordId/values/:attributeId/audit` Right-click audit. Ответ: ```json { "data": { "recordId": "rec_1", "attributeId": "attr_stage", "created": { "at": "2026-06-12T08:00:00.000Z", "by": { "id": "usr_1", "name": "Admin" } }, "updated": { "at": "2026-06-12T08:16:00.000Z", "by": { "id": "usr_1", "name": "Admin" } }, "history": [ { "action": "UPDATED", "oldValue": "lead", "newValue": "contacted", "createdAt": "2026-06-12T08:16:00.000Z" } ] } } ``` ### GET `/api/records/search` Глобальный поиск records. Query: ```json { "q": "cosme", "objectKeys": ["companies", "people"], "limit": 20 } ``` Ответ: ```json { "data": [ { "recordId": "rec_1", "objectKey": "companies", "displayName": "Cosme", "matchedText": "cosme.pt" } ] } ``` ## 5.4. UI-компоненты ### `NewRecordModal` Поведение: - открывается из `+ New Company`, `+ New Deal`, board column `+ New`; - строит форму из attributes; - required fields marked; - relationship/user/select fields use popovers; - on success inserts row/card optimistically. ### `DataTableRow` Поведение: - click primary cell → record page; - checkbox → selection; - hover actions; - right-click cell → audit menu. ### `DataTableCell` Типизированный renderer: - Text/Long text; - Number; - Currency; - Select/Status; - Multi-select; - User; - Relationship; - Date/Datetime; - Boolean; - AI. ### `CellEditor` Inline editor: - opens on click/Enter; - Escape cancels; - Enter/blur saves; - optimistic update; - invalid value shows inline error. ### `BulkActionBar` Показывается при selected rows: - count; - Add to list; - Send email; - Run workflow; - Enroll in sequence; - Update attribute; - Archive; - More; - close X. Functional inventory фиксирует People bulk action bar с `21 selected`, `Add to list`, `Send email`, `Run workflow`, `Enroll in sequence`, `More`, а также фильтры и selected rows. :contentReference[oaicite:7]{index=7} ### `CellAuditPopover` Right-click menu: - Created at/by; - Last updated at/by; - View history; - Copy value; - Clear value, если разрешено. ### `RecordSearchInput` - debounce; - searches current object or global; - supports keyboard navigation. ## 5.5. Acceptance-критерии - **S060 ✅ Создать запись**: пользователь нажимает `+ New`, заполняет required values, сохраняет; record появляется в table/board, `Activity RECORD_CREATED` создана. - **S061 ✅ Открыть запись**: click row/card открывает record page с breadcrumbs, tabs, details. - **S062 🟡 Inline-edit**: click cell, edit value, save; backend validates typed value; table updates without reload; invalid value rejected. - **S063 ✅ Удалить/архивировать**: archive action sets `archivedAt`; row исчезает из active view; can be included with `includeArchived=true`. - **S064 ✅ Поиск**: search по primary attribute/displayName/searchText возвращает matching records. - **S065 ✅ Пагинация**: list records supports `limit/cursor` or `page/limit`; next page loads consistently. - **S066 ⬜ Bulk-выбор**: row checkboxes select records; BulkActionBar appears; update/add-to-list/archive works with progress. - **S067 ⬜ Right-click audit**: right-click on value shows when created/updated and by whom; history accessible. ## 5.6. Технические решения ### Create/update transaction 1. Load object + active attributes. 2. Validate permission `READ_WRITE`. 3. Validate required fields. 4. Normalize all incoming values. 5. Validate unique constraints. 6. Create/update `Record`. 7. Upsert `Value` rows. 8. Recompute `displayName`. 9. Recompute `searchText`. 10. Write `ValueAudit`. 11. Write `Activity`. 12. Emit workflow trigger event. ### SearchText generation `searchText` should concatenate: - primary display value; - text/email/url/phone values; - selected option labels; - relationship display names only if cheap/denormalized. Normalize: - lowercase; - trim; - remove duplicate whitespace; - optionally unaccent. ### Pagination MVP: - cursor pagination by `(createdAt, id)` or `(updatedAt, id)`; - include `count` only when requested because count on EAV filters can be expensive. ### Bulk operations For up to 100 selected rows: - execute synchronously or short job. For >100: - BullMQ `bulkQueue`; - progress polling; - per-row errors. ### Activity types - `RECORD_CREATED` - `RECORD_UPDATED` - `RECORD_ARCHIVED` - `VALUE_UPDATED` - `AI_ATTRIBUTE_UPDATED` - `RECORD_ADDED_TO_LIST` - `RECORD_REMOVED_FROM_LIST` ### Workflow triggers Every create/update/archive emits internal event: ```ts type RecordEvent = | { type: "record.created"; orgId: string; objectId: string; recordId: string; actorId?: string } | { type: "record.updated"; orgId: string; objectId: string; recordId: string; changedAttributeIds: string[]; actorId?: string } | { type: "record.archived"; orgId: string; objectId: string; recordId: string; actorId?: string }; ``` --- # 6. Views (виды) **Статус:** 🟡 частично. Table/Board и часть UI есть; сохранение filters/sorts/columns, advanced filters, calculations и полноценный saved views dropdown должны быть доведены. ## 6.1. Описание функциональности View — сохранённый способ отображения records объекта или списка. View не меняет данные, только задаёт: - тип: Table или Board; - видимые колонки; - порядок/ширину колонок; - фильтры; - сортировки; - groupBy для Board; - calculations; - saved name/default state. В demo/storyboard зафиксированы object views с `View settings`, `Sorted by ...`, `Filter`, `Import / Export`, `+ New`, `+ Add column`, `+ Add calculation`, table/kanban переключение и saved view `Maria’s inbound leads`. Для Deals table показаны колонки, фильтр-чипы, column menu и перестроение таблицы после изменения набора колонок. :contentReference[oaicite:8]{index=8} Пользователь может: 1. Открыть объект и выбрать saved view из dropdown. 2. Переключить Table ↔ Board. 3. Добавить/убрать/переупорядочить/ресайзить колонки. 4. Добавить фильтр. 5. Добавить advanced filter group AND/OR. 6. Добавить сортировку. 7. Сохранить изменения в текущий view. 8. Save as new view. 9. На Board перетащить карточку в другую stage column. 10. Видеть count и calculations. Сценарии S080–S092 фиксируют table, board, switcher, filters, operators, advanced AND/OR, sort, columns, save view, view dropdown, drag-drop board, groupBy и counts/calculations. :contentReference[oaicite:9]{index=9} ## 6.2. Prisma-модель ```prisma enum ViewType { TABLE BOARD } enum ViewFilterOperator { EQ NEQ CONTAINS NOT_CONTAINS GT GTE LT LTE IN NOT_IN IS_EMPTY IS_NOT_EMPTY } enum ViewSortDirection { ASC DESC } enum ViewCalculationType { COUNT COUNT_EMPTY COUNT_NOT_EMPTY SUM AVG MIN MAX } model View { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) objectId String? object Object? @relation(fields: [objectId], references: [id], onDelete: Cascade) listId String? list List? @relation(fields: [listId], references: [id], onDelete: Cascade) name String type ViewType @default(TABLE) groupByAttributeId String? groupByAttribute Attribute? @relation("ViewGroupByAttribute", fields: [groupByAttributeId], references: [id], onDelete: SetNull) isDefault Boolean @default(false) isSystem Boolean @default(false) createdById String? createdBy User? @relation("ViewCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) columns ViewColumn[] filters ViewFilter[] sorts ViewSort[] calculations ViewCalculation[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([objectId]) @@index([listId]) @@index([createdById]) @@index([groupByAttributeId]) @@map("crm_views") } model ViewColumn { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) viewId String view View @relation(fields: [viewId], references: [id], onDelete: Cascade) attributeId String? attribute Attribute? @relation(fields: [attributeId], references: [id], onDelete: Cascade) key String? label String? width Int? order Int @default(0) isVisible Boolean @default(true) // Для nested relationship columns: Company > Billing Admin > Email. path Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([viewId]) @@index([attributeId]) @@index([order]) @@map("crm_view_columns") } model ViewFilter { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) viewId String view View @relation(fields: [viewId], references: [id], onDelete: Cascade) attributeId String? attribute Attribute? @relation(fields: [attributeId], references: [id], onDelete: Cascade) operator ViewFilterOperator value Json? groupId String? parentId String? conjunction String @default("AND") order Int @default(0) path Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([viewId]) @@index([attributeId]) @@index([groupId]) @@map("crm_view_filters") } model ViewSort { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) viewId String view View @relation(fields: [viewId], references: [id], onDelete: Cascade) attributeId String? attribute Attribute? @relation(fields: [attributeId], references: [id], onDelete: Cascade) key String? direction ViewSortDirection order Int @default(0) path Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([viewId]) @@index([attributeId]) @@index([order]) @@map("crm_view_sorts") } model ViewCalculation { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) viewId String view View @relation(fields: [viewId], references: [id], onDelete: Cascade) attributeId String? attribute Attribute? @relation(fields: [attributeId], references: [id], onDelete: Cascade) type ViewCalculationType label String? config Json? order Int @default(0) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([viewId]) @@index([attributeId]) @@map("crm_view_calculations") } ``` ## 6.3. API-эндпоинты ### GET `/api/objects/:objectId/views` Ответ: ```json { "data": [ { "id": "view_all", "name": "All Companies", "type": "TABLE", "isDefault": true, "groupByAttributeId": null, "columns": [], "filters": [], "sorts": [] } ] } ``` Ошибки: `401`, `403`, `404`. ### POST `/api/objects/:objectId/views` Создать view. Тело: ```json { "name": "ICP Companies", "type": "TABLE", "sourceViewId": "view_all", "filters": [ { "attributeId": "attr_icp", "operator": "EQ", "value": "icp" } ] } ``` Ответ `201`: ```json { "data": { "id": "view_icp", "name": "ICP Companies", "type": "TABLE" } } ``` Ошибки: `400`, `403`, `404`, `409`. ### GET `/api/views/:viewId` Ответ: ```json { "data": { "id": "view_1", "name": "Marisa: Inbound leads", "type": "TABLE", "objectId": "obj_deals", "listId": null, "groupByAttributeId": null, "columns": [ { "id": "vc_1", "attributeId": "attr_title", "width": 240, "order": 0, "isVisible": true } ], "filters": [ { "id": "vf_1", "attributeId": "attr_stage", "operator": "EQ", "value": "lead", "conjunction": "AND" } ], "sorts": [ { "id": "vs_1", "attributeId": null, "key": "createdAt", "direction": "DESC", "order": 0 } ], "calculations": [] } } ``` ### PATCH `/api/views/:viewId` Обновить name/type/groupBy/default. Тело: ```json { "name": "Enterprise Deal Board", "type": "BOARD", "groupByAttributeId": "attr_deal_stage", "isDefault": false } ``` Ответ: ```json { "data": { "id": "view_1", "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: - `422` если `BOARD` без `groupByAttributeId`; - `422` если groupBy attribute не `SELECT/STATUS/USER`. ### DELETE `/api/views/:viewId` Archive/delete view. Ответ: ```json { "data": { "id": "view_1", "archivedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: `403`, `404`, `422` — нельзя удалить единственный/default view без replacement. ### PUT `/api/views/:viewId/columns` Полностью заменить columns. Тело: ```json { "columns": [ { "attributeId": "attr_title", "width": 240, "order": 0, "isVisible": true }, { "attributeId": "attr_stage", "width": 160, "order": 1, "isVisible": true }, { "label": "Billing Admin Email", "path": [ { "relationshipAttributeId": "attr_billing_admin" }, { "attributeId": "attr_email" } ], "width": 220, "order": 2, "isVisible": true } ] } ``` Ответ: ```json { "data": { "viewId": "view_1", "columnsCount": 3 } } ``` ### PUT `/api/views/:viewId/filters` Тело: ```json { "filters": [ { "attributeId": "attr_owner", "operator": "EQ", "value": "usr_marisa", "conjunction": "AND", "order": 0 }, { "attributeId": "attr_stage", "operator": "IN", "value": ["lead", "contacted"], "conjunction": "AND", "order": 1 } ] } ``` Ответ: ```json { "data": { "viewId": "view_1", "filtersCount": 2 } } ``` Ошибки: - `400` invalid operator/value shape. - `422` operator incompatible with attribute type. ### PUT `/api/views/:viewId/sorts` Тело: ```json { "sorts": [ { "attributeId": "attr_created_at", "key": null, "direction": "DESC", "order": 0 } ] } ``` Ответ: ```json { "data": { "viewId": "view_1", "sortsCount": 1 } } ``` ### PUT `/api/views/:viewId/calculations` Тело: ```json { "calculations": [ { "attributeId": "attr_deal_value", "type": "SUM", "label": "Total pipeline" }, { "attributeId": null, "type": "COUNT", "label": "Count" } ] } ``` Ответ: ```json { "data": { "viewId": "view_1", "calculationsCount": 2 } } ``` ### GET `/api/views/:viewId/records` Получить records по view. Query: ```json { "limit": 50, "cursor": null, "search": "cosme" } ``` Ответ: ```json { "data": [ { "id": "rec_1", "displayName": "Cosme", "values": {} } ], "meta": { "count": 804, "calculations": { "attr_deal_value:SUM": { "value": "1200000", "currency": "USD" } } } } ``` ### GET `/api/views/:viewId/board` Ответ: ```json { "data": { "view": { "id": "view_board", "type": "BOARD", "groupByAttributeId": "attr_stage" }, "columns": [ { "option": { "value": "lead", "label": "Lead", "color": "gray" }, "count": 12, "records": [ { "id": "rec_deal_1", "displayName": "Cosme", "values": {} } ] } ] } } ``` ### PATCH `/api/views/:viewId/board/move` Drag-drop card. Тело: ```json { "recordId": "rec_deal_1", "targetGroupValue": "contacted", "position": 3 } ``` Ответ: ```json { "data": { "recordId": "rec_deal_1", "attributeId": "attr_stage", "value": "contacted", "position": 3 } } ``` Ошибки: `400`, `403`, `404`, `422`. ## 6.4. UI-компоненты ### `ViewSelector` - dropdown saved views; - active view; - `Create new view`; - `Save as new`; - rename/delete actions; - shows Table/Board icon. ### `ViewToolbar` Controls: - View settings; - Sort chip; - Filter chip; - Import/Export; - Share, where relevant; - `+ New <Object>`; - count/calculation summary. ### `TableView` - DataTable from `ViewColumn[]`; - sticky header; - row selection; - typed cells; - horizontal scroll; - add column; - calculation footer. ### `BoardView` Functional inventory describes Deals kanban with stage columns, counters, `+ New Deal` inside stages, cards with amount/company/participants/activity, and filtering/sorting. :contentReference[oaicite:10]{index=10} Components: - `BoardView` - `BoardColumn` - `BoardCard` - `BoardCardFields` - `DndBoardProvider` - `BoardColumnHeader` - `AddRecordInColumnButton` ### `FilterBuilder` - attribute selector; - operator selector; - value editor by attribute type; - AND MVP; - advanced groups AND/OR; - nested relationship path support; - save/cancel/apply. ### `SortBuilder` - attribute/key selector; - direction asc/desc; - multi-sort order; - drag reorder sorts. ### `ColumnSettingsMenu` - list available attributes; - search; - check/uncheck columns; - create new attribute; - nested relationship fields; - reorder; - resize. ### `CalculationFooter` - per-column `+ Add calculation`; - supports count/sum/avg/min/max where type-compatible; - displays loading while calculation query runs. ## 6.5. Acceptance-критерии - **S080 ✅ Table view**: view type TABLE renders typed columns from ViewColumn; records load by view. - **S081 ✅ Board view**: view type BOARD groups records by select/status/user attribute. - **S082 ✅ Switcher**: пользователь переключает Table ↔ Board; setting persists in view. - **S083 🟡 Filter condition**: add filter by attribute/operator/value; records refresh; filter chip appears. - **S084 ⬜ Operators**: `eq`, `neq`, `contains`, `gt`, `lt`, `in`, `is_empty`, `is_not_empty` work and validate by type. - **S085 ⬜ Advanced filter**: AND/OR groups; nested groups; UI shows grouping. - **S086 🟡 Sort**: sort by attribute asc/desc; createdAt/updatedAt supported; typed value sort supported. - **S087 🟡 Columns**: add/hide/reorder/resize columns; config persists. - **S088 🟡 Save view**: changes can be saved to current view or saved as new. - **S089 ⬜ View dropdown**: multiple saved views per object/list; selecting changes records and toolbar state. - **S090 ⬜ Board drag-drop**: moving card updates groupBy attribute value and persists. - **S091 ⬜ Board groupBy**: user can group board by another status/select/user attribute. - **S092 ⬜ Count/calculations**: view shows total count and per-column calculations. ## 6.6. Технические решения ### Query strategy Architecture requires View config to be represented by separate tables, not only JSON, so filters/sorts/columns can be validated and migrated. :contentReference[oaicite:11]{index=11} Algorithm: 1. Load View + columns/filters/sorts. 2. Validate user access. 3. Determine source: object or list. 4. Build base record query: - `orgId`; - `objectId`; - `archivedAt = null`; - if list view: join `ListEntry`. 5. Apply search. 6. Apply filters. 7. Apply sorts. 8. Fetch page of record IDs. 9. Fetch values for visible attributes. 10. Resolve relationship/nested columns. 11. Compute calculations if requested. 12. Return DTO. ### Filter operator compatibility ```ts const FILTER_OPERATORS_BY_TYPE = { TEXT: ["EQ", "NEQ", "CONTAINS", "NOT_CONTAINS", "IS_EMPTY", "IS_NOT_EMPTY"], LONG_TEXT: ["CONTAINS", "NOT_CONTAINS", "IS_EMPTY", "IS_NOT_EMPTY"], NUMBER: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IS_EMPTY", "IS_NOT_EMPTY"], CURRENCY: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IS_EMPTY", "IS_NOT_EMPTY"], DATE: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IS_EMPTY", "IS_NOT_EMPTY"], DATETIME: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IS_EMPTY", "IS_NOT_EMPTY"], BOOLEAN: ["EQ", "NEQ", "IS_EMPTY", "IS_NOT_EMPTY"], SELECT: ["EQ", "NEQ", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], STATUS: ["EQ", "NEQ", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], MULTI_SELECT: ["IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], USER: ["EQ", "NEQ", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], RELATIONSHIP: ["EQ", "NEQ", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] } as const; ``` ### Sorting by EAV value MVP: - sort by `createdAt`, `updatedAt`, `displayName`; - sort by one attribute via raw SQL join. Target: - safe SQL builder; - typed joins for each sort attribute; - nulls last; - stable tie-breaker by `Record.id`. ### Board move Board move must: 1. Check view type BOARD. 2. Load groupByAttribute. 3. Validate target option exists or `No stage`. 4. Update record value. 5. Optionally update `position` metadata if board order is stored. 6. Create Activity. 7. Trigger workflows for record updated. 8. Return updated card. ### Calculations For calculation type: - `COUNT`: count records in current filtered view. - `SUM/AVG/MIN/MAX`: only number/currency/date where meaningful. - For currency: group by currency or convert only if FX table exists; MVP displays same-currency only or errors on mixed currency. --- # 7. Lists (списки) **Статус:** ⬜ не начато / частично заложена модель `List` и `ListEntry`; полноценные list attributes, list import, kanban и bulk add требуют реализации. ## 7.1. Описание функциональности List — процессное подмножество records одного parent object. Custom object моделирует новую сущность; list организует существующие records под процесс: Inbound Leads, Recruiting, Customer Success, Fundraising, Event Invitees, Onboarding Pipeline. Пользователь может: 1. Создать список с нуля. 2. Создать список из шаблона. 3. Выбрать parent object: People, Companies, Deals и т.д. 4. Добавлять records в список по одному или bulk. 5. Хранить list-specific attributes: RSVP, Dietary requirements, Summary, Lead source. 6. Открывать list из сайдбара Lists. 7. Смотреть list как Table или Board. 8. Перемещать entries между стадиями. 9. Импортировать CSV прямо в list: создаются/обновляются parent records и list entries. 10. При конфликте entry выбрать update existing или add separate. 11. Использовать list как source для workflows/sequences/reports. Functional inventory фиксирует Event Invitees как kanban-list поверх People: колонки `No stage`, `Shortlisted`, `Invited`, `Accepted`, `Declined`, карточки людей, list-specific поле `Dietary requirements`, controls `View settings`, `Import / Export`, `Add Person`, `Sort`, `Filter`, `+ Add calculation`. :contentReference[oaicite:12]{index=12} Academy list import уточняет: импорт в список создаёт/обновляет и parent-записи, и list entries; mapping включает parent attributes и list-level attributes; можно создать list attribute на лету; при существующем entry выбирается `update existing entry` или `add as separate entry`; preview показывает created/updated counts и import history. :contentReference[oaicite:13]{index=13} Сценарии S100–S109 покрывают создание list, шаблоны, list attributes, добавление records, стадии, import, collision, sidebar, enroll to sequence, add-to-list bulk. :contentReference[oaicite:14]{index=14} Сценарии S335–S338 покрывают import в список, entry collision, import history и preview. :contentReference[oaicite:15]{index=15} ## 7.2. Prisma-модель Текущая модель содержит `List` и `ListEntry`. Для полного list-level attributes нужны `ListAttribute` и `ListEntryValue`, либо reuse `Attribute` с `listId`. Чтобы не смешивать object attributes и list attributes в одном `Attribute.objectId`, целевая модель — отдельные list attribute таблицы с тем же typed-value подходом. ```prisma enum ListTemplateKey { RECRUITING CUSTOMER_SUCCESS FUNDRAISING EVENT_INVITEES INBOUND_LEADS ONBOARDING CUSTOM } model List { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) objectId String object Object @relation(fields: [objectId], references: [id], onDelete: Cascade) name String description String? icon String? color String? templateKey ListTemplateKey @default(CUSTOM) createdById String? createdBy User? @relation("ListCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) entries ListEntry[] attributes ListAttribute[] views View[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([objectId]) @@index([createdById]) @@index([archivedAt]) @@map("crm_lists") } model ListEntry { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) listId String list List @relation(fields: [listId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) stage String? position Int @default(0) addedById String? addedBy User? @relation("ListEntryAddedBy", fields: [addedById], references: [id], onDelete: SetNull) values ListEntryValue[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@unique([listId, recordId, archivedAt]) @@index([orgId]) @@index([listId]) @@index([recordId]) @@index([stage]) @@index([position]) @@map("crm_list_entries") } model ListAttribute { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) listId String list List @relation(fields: [listId], references: [id], onDelete: Cascade) key String name String description String? type AttributeType isSystem Boolean @default(false) isRequired Boolean @default(false) isUnique Boolean @default(false) isArchived Boolean @default(false) order Int @default(0) config Json? options ListAttributeOption[] values ListEntryValue[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@unique([listId, key]) @@index([orgId]) @@index([listId]) @@index([type]) @@map("crm_list_attributes") } model ListAttributeOption { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) listAttributeId String listAttribute ListAttribute @relation(fields: [listAttributeId], references: [id], onDelete: Cascade) value String label String color String? order Int @default(0) isArchived Boolean @default(false) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([listAttributeId, value]) @@index([orgId]) @@index([listAttributeId]) @@map("crm_list_attribute_options") } model ListEntryValue { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) listEntryId String listEntry ListEntry @relation(fields: [listEntryId], references: [id], onDelete: Cascade) listAttributeId String listAttribute ListAttribute @relation(fields: [listAttributeId], references: [id], onDelete: Cascade) textValue String? numberValue Float? booleanValue Boolean? dateValue DateTime? jsonValue Json? userValueId String? userValue User? @relation(fields: [userValueId], references: [id], onDelete: SetNull) currencyAmount Decimal? @db.Decimal(18, 2) currencyCode String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([listEntryId, listAttributeId]) @@index([orgId]) @@index([listEntryId]) @@index([listAttributeId]) @@index([listAttributeId, textValue]) @@index([listAttributeId, numberValue]) @@index([listAttributeId, dateValue]) @@map("crm_list_entry_values") } ``` ### List stage config Стадии могут быть: - MVP: `ListEntry.stage String?` + `List.config.stages`. - Target: system `ListAttribute` типа `STATUS`, связанный с `ListEntry.stage`. Рекомендуемая целевая структура: ```ts type ListConfig = { stages: Array<{ value: string; label: string; color?: string; order: number; }>; allowDuplicateEntries: boolean; defaultViewType: "TABLE" | "BOARD"; }; ``` ## 7.3. API-эндпоинты ### GET `/api/lists` Список lists workspace. Query: ```json { "includeArchived": false, "objectId": "obj_people" } ``` Ответ: ```json { "data": [ { "id": "list_event", "name": "Event Invitees", "objectId": "obj_people", "objectKey": "people", "entriesCount": 26, "templateKey": "EVENT_INVITEES", "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` Ошибки: `401`, `403`. ### POST `/api/lists` Создать list. Тело: ```json { "objectId": "obj_people", "name": "Event Invitees", "description": "People invited to London event", "icon": "calendar", "color": "blue", "templateKey": "EVENT_INVITEES" } ``` Ответ `201`: ```json { "data": { "id": "list_event", "name": "Event Invitees", "objectId": "obj_people", "defaultViewId": "view_event_table" } } ``` Ошибки: `400`, `403`, `404`, `409`. ### POST `/api/lists/from-template` Тело: ```json { "templateKey": "RECRUITING", "objectId": "obj_people", "name": "Recruiting" } ``` Ответ: ```json { "data": { "id": "list_recruiting", "createdAttributes": ["Role", "Source", "Stage"], "createdViews": ["All candidates", "Candidate pipeline"] } } ``` ### GET `/api/lists/:listId` Ответ: ```json { "data": { "id": "list_event", "name": "Event Invitees", "object": { "id": "obj_people", "key": "people", "pluralName": "People" }, "attributes": [], "views": [], "config": { "stages": [ { "value": "shortlisted", "label": "Shortlisted", "order": 1 }, { "value": "invited", "label": "Invited", "order": 2 } ] } } } ``` ### PATCH `/api/lists/:listId` Тело: ```json { "name": "London Event Invitees", "description": "Invitees for London customer event", "icon": "calendar", "color": "violet", "config": { "allowDuplicateEntries": true } } ``` Ответ: ```json { "data": { "id": "list_event", "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` ### DELETE `/api/lists/:listId` Archive list. Ответ: ```json { "data": { "id": "list_event", "archivedAt": "2026-06-12T08:00:00.000Z" } } ``` ### GET `/api/lists/:listId/entries` Query: ```json { "viewId": "view_event_board", "limit": 50, "cursor": null, "search": "lisa" } ``` Ответ: ```json { "data": [ { "id": "entry_1", "listId": "list_event", "recordId": "rec_person_1", "stage": "invited", "position": 1, "record": { "id": "rec_person_1", "displayName": "Lisa Cohen", "values": { "email": { "value": "lisa@cosme.pt" } } }, "listValues": { "dietary_requirements": { "type": "TEXT", "value": "Vegan" } } } ], "meta": { "count": 26, "nextCursor": null } } ``` ### POST `/api/lists/:listId/entries` Добавить record в list. Тело: ```json { "recordId": "rec_person_1", "stage": "shortlisted", "values": { "dietary_requirements": "None" }, "onConflict": "UPDATE_EXISTING" } ``` Ответ `201` или `200`: ```json { "data": { "id": "entry_1", "recordId": "rec_person_1", "stage": "shortlisted", "created": true } } ``` Ошибки: - `409 CONFLICT` если entry существует и `onConflict` не указан. - `422` if record object != list object. ### POST `/api/lists/:listId/entries/bulk` Bulk add to list. Тело: ```json { "recordIds": ["rec_1", "rec_2", "rec_3"], "stage": "shortlisted", "values": { "source": "Tech Week" }, "onConflict": "SKIP" } ``` Ответ `202`: ```json { "data": { "jobId": "listbulk_1", "queued": 3 } } ``` `onConflict`: - `SKIP` - `UPDATE_EXISTING` - `ADD_SEPARATE` ### PATCH `/api/list-entries/:entryId` Обновить stage/position/list values. Тело: ```json { "stage": "accepted", "position": 2, "values": { "dietary_requirements": "Vegan" } } ``` Ответ: ```json { "data": { "id": "entry_1", "stage": "accepted", "position": 2, "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` ### DELETE `/api/list-entries/:entryId` Удалить record из list. Ответ: ```json { "data": { "id": "entry_1", "archivedAt": "2026-06-12T08:00:00.000Z" } } ``` ### GET `/api/lists/:listId/attributes` Ответ: ```json { "data": [ { "id": "lattr_diet", "key": "dietary_requirements", "name": "Dietary requirements", "type": "TEXT", "isRequired": false, "order": 1 } ] } ``` ### POST `/api/lists/:listId/attributes` Создать list-specific attribute. Тело: ```json { "name": "RSVP", "type": "SELECT", "options": [ { "value": "accepted", "label": "Accepted", "color": "green" }, { "value": "declined", "label": "Declined", "color": "red" } ] } ``` Ответ `201`: ```json { "data": { "id": "lattr_rsvp", "key": "rsvp", "name": "RSVP", "type": "SELECT" } } ``` ### PATCH `/api/list-attributes/:attributeId` Обновить list attribute. ### DELETE `/api/list-attributes/:attributeId` Archive list attribute. ### POST `/api/lists/:listId/imports` Upload CSV в list. Тело multipart: - `file` - `mode`: `CREATE_OR_UPDATE` - `onEntryConflict`: `UPDATE_EXISTING | ADD_SEPARATE | SKIP` Ответ: ```json { "data": { "importId": "imp_list_1", "status": "MAPPING_REQUIRED", "parentObject": { "id": "obj_people", "key": "people" }, "detectedColumns": ["Email", "Name", "Summary", "Lead Source"] } } ``` ### POST `/api/list-imports/:importId/mapping` Тело: ```json { "mappings": [ { "csvColumn": "Email", "target": "PARENT_ATTRIBUTE", "attributeId": "attr_email" }, { "csvColumn": "Summary", "target": "LIST_ATTRIBUTE", "createAttribute": { "name": "Summary", "type": "LONG_TEXT" } }, { "csvColumn": "Stage", "target": "LIST_STAGE" } ], "dedupe": { "parentAttributeId": "attr_email" }, "onEntryConflict": "ADD_SEPARATE" } ``` Ответ: ```json { "data": { "importId": "imp_list_1", "status": "READY_FOR_REVIEW", "preview": { "recordsToCreate": 12, "recordsToUpdate": 8, "entriesToCreate": 20, "entriesToUpdate": 0, "entriesToAddSeparate": 3, "errors": [] } } } ``` ### POST `/api/list-imports/:importId/confirm` Ответ `202`: ```json { "data": { "jobId": "importjob_1", "status": "QUEUED" } } ``` ### GET `/api/imports/:importId` Ответ: ```json { "data": { "id": "imp_list_1", "status": "SUCCEEDED", "progress": { "processed": 20, "total": 20 }, "summary": { "recordsCreated": 12, "recordsUpdated": 8, "entriesCreated": 20, "entriesUpdated": 0, "errors": 0 } } } ``` ### GET `/api/imports` Import history. Query: ```json { "sourceType": "LIST", "listId": "list_event" } ``` Ответ: ```json { "data": [ { "id": "imp_list_1", "fileName": "leads.csv", "status": "SUCCEEDED", "createdAt": "2026-06-12T08:00:00.000Z", "summary": { "recordsCreated": 12, "entriesCreated": 20 } } ] } ``` ## 7.4. UI-компоненты ### `ListsSidebarSection` - loads `/api/lists`; - shows active lists; - highlights current list; - `All lists`. ### `ListPage` Route: - `/lists/[listId]` Behavior: - loads list metadata; - loads views; - renders table/board; - toolbar: view selector, settings, share, import/export, add record. ### `CreateListModal` Поля: - name; - parent object; - template; - icon/color; - initial stages; - create from scratch / from template. ### `ListTemplateGallery` Templates: - Recruiting; - Customer Success; - Fundraising; - Event Invitees; - Inbound Leads; - Onboarding Pipeline. ### `ListAttributesPanel` - create/edit/archive list attributes; - options editor; - required/unique; - reorder. ### `AddToListModal` - select list; - detect duplicate entries; - choose conflict behavior; - fill required list attributes; - show toast/progress. Storyboard фиксирует bulk flow: выделенная строка, нижняя bulk-панель `Add to list / Send email / Run workflow / More`, затем popover выбора списка. :contentReference[oaicite:16]{index=16} ### `ListBoardView` - columns from list stages; - cards are parent records + list values; - drag-drop updates `ListEntry.stage` and `position`; - `+ Add Person` inside stage. ### `ListImportWizard` Steps: 1. Upload. 2. Mapping: - parent attributes; - list attributes; - create new list attribute. 3. Review: - new options; - required errors; - entry collisions. 4. Confirm. 5. Progress. 6. Results/import history. ### `ImportHistoryPage` - list of imports; - status; - created/updated/error counts; - download error CSV; - rollback when supported. ## 7.5. Acceptance-критерии ### Lists: S100–S109 - **S100 ⬜ Создать список с нуля**: пользователь выбирает parent object и name; list появляется в sidebar Lists; default table view создан. - **S101 ⬜ Создать список из шаблона**: template gallery создаёт list attributes, stages, views. - **S102 ⬜ List-атрибут**: создать `Dietary requirements`; поле видно только в list, не в parent object. - **S103 ⬜ Добавить запись в список**: record добавляется как ListEntry; одна record может быть в нескольких lists. - **S104 ⬜ Стадии внутри списка**: board groups by list stage; drag-drop меняет `ListEntry.stage`. - **S105 ⬜ Импорт CSV в список**: wizard поддерживает parent + list attributes. - **S106 ⬜ Entry collision**: при существующем entry пользователь выбирает update existing / add separate / skip. - **S107 ⬜ Sidebar Lists**: список открывается из sidebar; table/board как объект. - **S108 ⬜ Enroll to sequence из people-list**: filtered list entries можно enroll в sequence; sequence enrollment получает person records. - **S109 ⬜ Add to list массово**: bulk footer добавляет selected records в выбранный list; duplicate check shown. ### List import: S335–S338 - **S335 ⬜ CSV import в список**: upload leads.csv; mapping включает parent People email/name и list Summary/stage; records и entries создаются. - **S336 ⬜ Collision**: existing list entry prompts update existing / add separate; selected behavior persists for import. - **S337 ⬜ Import history**: import appears in history with progress, counts, errors, downloadable error rows. - **S338 ⬜ Preview**: before confirm user sees first rows, detected types, created/updated counts, validation errors. ## 7.6. Технические решения ### List vs Object rule - Object = новая сущность данных. - List = процесс над существующими records. - ListEntry всегда ссылается на parent Record. - ListAttribute никогда не загрязняет parent Object attributes. ### Add to list algorithm 1. Validate list access. 2. Validate record belongs to list.objectId. 3. Find existing active ListEntry by `(listId, recordId)`. 4. If exists: - `SKIP`: return existing; - `UPDATE_EXISTING`: update stage/values; - `ADD_SEPARATE`: create duplicate entry only if `allowDuplicateEntries=true`; иначе `409`. 5. Validate list required attributes. 6. Upsert list entry values. 7. Create Activity on record. 8. Emit workflow event `record.added_to_list`. ### Duplicate entries Current schema `@@unique([listId, recordId, archivedAt])` is not enough for `ADD_SEPARATE` because active duplicate entries would conflict. Target options: 1. MVP: default no duplicates; `ADD_SEPARATE` requires adding `entryGroupId` or removing unique. 2. Target: unique only when `dedupeKey` present: - `entryKey String?` - `@@unique([listId, recordId, entryKey])` 3. For event leads where same person can appear multiple times, `entryKey` can be import row group/importId. Recommended addition: ```prisma model ListEntry { entryKey String? importId String? @@index([importId]) @@unique([listId, recordId, entryKey]) } ``` ### List import algorithm 1. Upload CSV. 2. Parse sample rows. 3. Detect columns/types. 4. Mapping UI: - parent attribute mapping; - list attribute mapping; - create new list attribute; - stage mapping. 5. Validate: - required parent attributes; - required list attributes; - type parse; - unique/dedupe parent; - options unknown. 6. Review: - add new options; - reassign bad options; - collision behavior. 7. Confirm. 8. Worker: - for each row: - find/create/update parent record by dedupe attribute; - find/create/update list entry; - write parent values; - write list entry values; - write row result. 9. Summary and import history. ### Workflow/sequence integration List events: ```ts type ListEvent = | { type: "list.created"; orgId: string; listId: string; actorId?: string } | { type: "list.entry.created"; orgId: string; listId: string; entryId: string; recordId: string; actorId?: string } | { type: "list.entry.updated"; orgId: string; listId: string; entryId: string; recordId: string; changedFields: string[]; actorId?: string }; ``` Used by: - workflow trigger `Record added to list`; - sequence enrollment from list; - reports source list; - notifications. ### Board stages - Store stage value on `ListEntry.stage`. - Stage options in `List.config.stages`. - `No stage` is `stage = null`. - Drag-drop: - update stage; - update position; - preserve parent record values; - write Activity. ### Performance Indexes: - `List.orgId` - `List.objectId` - `ListEntry.listId` - `ListEntry.recordId` - `ListEntry.stage` - `ListEntry.position` - `ListEntryValue.listAttributeId + typed value` For large lists: - cursor pagination by `position,id`; - board fetch per column limit; - lazy load cards; - count per stage via grouped query.


---

# 8. Record page (карточка записи) **Статус:** 🟡 частично. Каркас карточки, хлебные крошки, табы и Details-панель уже есть; полноценные configurable highlights, relationship-табы, emails/calls/notes/tasks/files/comments/@mention и уведомления требуют доведения. Academy-карта относит `How to customise record pages` к §8, `Notes, tasks, and email sending` — к §8 Record page, а сводка фиксирует highlights ≤6, relationship-табы, секции атрибутов, action-кнопки, comments/@mention/tasks/notes/email. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1} ## 8.1. Описание функциональности Record page — центральная карточка любой записи объекта: company, person, deal, workspace, user, invoice или кастомной сущности. Она должна быть одинаково metadata-driven для всех объектов, но иметь настраиваемый layout на уровне object. Пользователь открывает карточку кликом по строке таблицы, карточке kanban, relationship-pill, search result или deep link. На странице видит: 1. **Header** - breadcrumbs: `Companies / Cosme`; - иконка объекта; - displayName записи; - action buttons: `Compose email`, `Create task`, `Add note`, `Run workflow`, integration buttons; - меню `⋮` → `Configure page`, `Archive record`, `Copy link`. 2. **Highlights** - до 6 виджетов вверху overview; - attribute widgets: connection strength, associated deals, last interaction, ARR, stage, owner; - integration widgets: Linear, PandaDoc, billing, storage; - empty widget state. 3. **Main tabs** - `Activity`; - `Emails`; - `Calls`; - `Notes`; - `Tasks`; - `Files`; - `Comments`; - relationship-tabs: `Team`, `Deals`, `Invoices`, `Users`, `Workspaces`; - кастомные tabs из object page configuration. 4. **Right details panel** - секции атрибутов: General, Firmographics, Location, Social media, Lists; - inline-edit значений; - readonly system fields; - relationship values; - list memberships; - add attribute / add section, если есть права. 5. **Configure page mode** - вход через `⋮ → Configure page`; - layout редактируется для object type и виден всем пользователям workspace; - 4 зоны настройки: - highlights; - tabs/main panel; - right details sections; - header action buttons; - изменения сохраняются как object-level layout config. 6. **Collaboration** - comments на record и list entry; - @mention коллеги; - replies; - уведомления web/email; - tasks linked to record. 7. **Productivity** - notes from scratch/template; - tasks with assignee/due/linked record; - email composer from record; - calls and AI summaries. ## 8.2. Prisma-модель Текущая схема уже содержит `Activity`, `Email`, `Note`, `Task`. Для полного record page нужны `RecordPageLayout`, `RecordComment`, `FileAttachment`, `Notification`, расширение `Activity`. ```prisma enum RecordTabType { ACTIVITY EMAILS CALLS NOTES TASKS FILES COMMENTS RELATIONSHIP CUSTOM } enum HighlightWidgetType { ATTRIBUTE RELATIONSHIP_COUNT INTEGRATION CALCULATION COMMUNICATION_INTELLIGENCE } enum ActivityType { RECORD_CREATED RECORD_UPDATED RECORD_ARCHIVED VALUE_UPDATED EMAIL_SENT EMAIL_RECEIVED EMAIL_OPENED EMAIL_REPLIED NOTE_CREATED NOTE_UPDATED TASK_CREATED TASK_COMPLETED CALL_RECORDED COMMENT_CREATED COMMENT_REPLIED FILE_ATTACHED AI_ATTRIBUTE_UPDATED RECORD_ADDED_TO_LIST RECORD_REMOVED_FROM_LIST } enum CommentTargetType { RECORD LIST_ENTRY NOTE EMAIL CALL } enum NotificationType { MENTION COMMENT_REPLY TASK_ASSIGNED TASK_DUE RECORD_ASSIGNED SEQUENCE_REPLY WORKFLOW_FAILED } enum FileAttachmentTargetType { RECORD NOTE EMAIL CALL COMMENT } model RecordPageLayout { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) objectId String object Object @relation(fields: [objectId], references: [id], onDelete: Cascade) highlights Json // Array<RecordHighlightConfig> tabs Json // Array<RecordTabConfig> sections Json // Array<RecordDetailsSectionConfig> actions Json // Array<RecordActionConfig> createdById String? createdBy User? @relation("RecordPageLayoutCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([objectId]) @@index([orgId]) @@index([objectId]) @@map("crm_record_page_layouts") } model Activity { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String? record Record? @relation(fields: [recordId], references: [id], onDelete: Cascade) actorId String? actor User? @relation("ActivityActor", fields: [actorId], references: [id], onDelete: SetNull) type ActivityType title String body String? @db.Text metadata Json? createdAt DateTime @default(now()) @@index([orgId, createdAt]) @@index([recordId, createdAt]) @@index([actorId, createdAt]) @@index([type]) @@map("crm_activities") } model Note { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) authorId String? author User? @relation("NoteAuthor", fields: [authorId], references: [id], onDelete: SetNull) title String? body String @db.Text templateId String? meetingEventId String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([recordId, createdAt]) @@index([authorId]) @@map("crm_notes") } model Task { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String? record Record? @relation(fields: [recordId], references: [id], onDelete: Cascade) title String description String? @db.Text assigneeId String? assignee User? @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull) createdById String? createdBy User? @relation("TaskCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) dueAt DateTime? completedAt DateTime? archivedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([recordId]) @@index([assigneeId, dueAt]) @@index([completedAt]) @@map("crm_tasks") } model RecordComment { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) targetType CommentTargetType targetId String recordId String? record Record? @relation(fields: [recordId], references: [id], onDelete: Cascade) parentId String? parent RecordComment? @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade) replies RecordComment[] @relation("CommentReplies") authorId String? author User? @relation(fields: [authorId], references: [id], onDelete: SetNull) body String @db.Text mentions Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([targetType, targetId]) @@index([recordId, createdAt]) @@index([parentId]) @@index([authorId]) @@map("crm_record_comments") } model FileAttachment { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) targetType FileAttachmentTargetType targetId String recordId String? record Record? @relation(fields: [recordId], references: [id], onDelete: Cascade) uploadedById String? uploadedBy User? @relation(fields: [uploadedById], references: [id], onDelete: SetNull) fileName String mimeType String sizeBytes Int storageKey String publicUrl String? createdAt DateTime @default(now()) archivedAt DateTime? @@index([orgId]) @@index([targetType, targetId]) @@index([recordId]) @@index([uploadedById]) @@map("crm_file_attachments") } model Notification { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) userId String user User @relation(fields: [userId], references: [id], onDelete: Cascade) type NotificationType title String body String? entityType String? entityId String? metadata Json? readAt DateTime? emailedAt DateTime? createdAt DateTime @default(now()) @@index([orgId]) @@index([userId, readAt, createdAt]) @@index([type]) @@map("crm_notifications") } ``` ### Layout config DTO ```ts type RecordHighlightConfig = { id: string; type: "ATTRIBUTE" | "RELATIONSHIP_COUNT" | "INTEGRATION" | "CALCULATION" | "COMMUNICATION_INTELLIGENCE"; attributeId?: string; relationshipAttributeId?: string; integrationKey?: string; label?: string; order: number; }; type RecordTabConfig = { id: string; type: "ACTIVITY" | "EMAILS" | "CALLS" | "NOTES" | "TASKS" | "FILES" | "COMMENTS" | "RELATIONSHIP" | "CUSTOM"; label: string; relationshipAttributeId?: string; isVisible: boolean; order: number; }; type RecordDetailsSectionConfig = { id: string; label: string; order: number; attributeIds: string[]; collapsedByDefault?: boolean; }; type RecordActionConfig = { id: string; type: "COMPOSE_EMAIL" | "CREATE_TASK" | "ADD_NOTE" | "RUN_WORKFLOW" | "INTEGRATION"; label: string; integrationKey?: string; order: number; isVisible: boolean; }; ``` ## 8.3. API-эндпоинты ### GET `/api/records/:recordId/page` Получить всё для record page. Ответ: ```json { "data": { "record": { "id": "rec_1", "objectId": "obj_companies", "objectKey": "companies", "displayName": "Cosme", "values": { "name": { "type": "TEXT", "value": "Cosme" }, "employee_range": { "type": "SELECT", "value": "51_250", "label": "51–250" } }, "createdAt": "2026-06-12T08:00:00.000Z", "updatedAt": "2026-06-12T08:00:00.000Z" }, "layout": { "highlights": [], "tabs": [], "sections": [], "actions": [] }, "lists": [], "relationshipSummaries": [], "permissions": { "canRead": true, "canWrite": true, "canConfigurePage": true } } } ``` Ошибки: `401`, `403`, `404`. ### GET `/api/objects/:objectId/record-page-layout` Ответ: ```json { "data": { "id": "layout_1", "objectId": "obj_companies", "highlights": [], "tabs": [], "sections": [], "actions": [], "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: `401`, `403`, `404`. ### PUT `/api/objects/:objectId/record-page-layout` Сохранить layout. Тело: ```json { "highlights": [ { "id": "h1", "type": "ATTRIBUTE", "attributeId": "attr_connection_strength", "label": "Connection strength", "order": 0 } ], "tabs": [ { "id": "activity", "type": "ACTIVITY", "label": "Activity", "isVisible": true, "order": 0 }, { "id": "emails", "type": "EMAILS", "label": "Emails", "isVisible": true, "order": 1 }, { "id": "invoices", "type": "RELATIONSHIP", "label": "Invoices", "relationshipAttributeId": "attr_invoices", "isVisible": true, "order": 2 } ], "sections": [ { "id": "social", "label": "Social Media Links", "order": 0, "attributeIds": ["attr_linkedin", "attr_twitter"] } ], "actions": [ { "id": "compose", "type": "COMPOSE_EMAIL", "label": "Compose email", "order": 0, "isVisible": true } ] } ``` Ответ: ```json { "data": { "id": "layout_1", "objectId": "obj_companies", "updatedAt": "2026-06-12T08:05:00.000Z" } } ``` Ошибки: - `400 VALIDATION_ERROR` — больше 6 highlights, неверный tab type, несуществующий attribute. - `403 FORBIDDEN` — нет Full access на object. - `404 NOT_FOUND`. ### GET `/api/records/:recordId/activities` Query: ```json { "limit": 50, "cursor": null, "types": ["RECORD_UPDATED", "EMAIL_SENT"] } ``` Ответ: ```json { "data": [ { "id": "act_1", "type": "VALUE_UPDATED", "title": "Deal stage changed", "body": "Lead → Contacted", "actor": { "id": "usr_1", "name": "Marisa" }, "metadata": { "attributeId": "attr_stage", "oldValue": "lead", "newValue": "contacted" }, "createdAt": "2026-06-12T08:00:00.000Z" } ], "meta": { "nextCursor": null } } ``` Ошибки: `401`, `403`, `404`. ### GET `/api/records/:recordId/relationship-tabs/:relationshipAttributeId` Ответ: ```json { "data": { "relationshipAttributeId": "attr_invoices", "records": [ { "id": "rec_invoice_1", "displayName": "INV-2026-001", "values": { "amount": { "type": "CURRENCY", "amount": "1200.00", "currency": "USD" } } } ] } } ``` Ошибки: `403`, `404`, `422`. ### GET `/api/records/:recordId/notes` Ответ: ```json { "data": [ { "id": "note_1", "title": "Call prep", "body": "Discuss renewal timeline.", "author": { "id": "usr_1", "name": "Marisa" }, "meetingEventId": "evt_1", "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` ### POST `/api/records/:recordId/notes` Тело: ```json { "title": "Call prep", "body": "Discuss renewal timeline.", "templateId": "tmpl_call_prep", "meetingEventId": "evt_1" } ``` Ответ `201`: ```json { "data": { "id": "note_1", "recordId": "rec_1", "createdAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: `400`, `403`, `404`. ### PATCH `/api/notes/:noteId` Тело: ```json { "title": "Updated call prep", "body": "Updated note content." } ``` Ответ: ```json { "data": { "id": "note_1", "updatedAt": "2026-06-12T08:10:00.000Z" } } ``` ### DELETE `/api/notes/:noteId` Ответ: ```json { "data": { "id": "note_1", "archivedAt": "2026-06-12T08:11:00.000Z" } } ``` ### GET `/api/tasks` Query: ```json { "assigneeId": "usr_1", "recordId": "rec_1", "status": "open", "due": "upcoming" } ``` Ответ: ```json { "data": [ { "id": "task_1", "title": "Follow up with Cosme", "description": "Send pricing recap.", "assignee": { "id": "usr_1", "name": "Marisa" }, "record": { "id": "rec_1", "displayName": "Cosme" }, "dueAt": "2026-06-15T09:00:00.000Z", "completedAt": null } ] } ``` ### POST `/api/tasks` Тело: ```json { "title": "Follow up with Cosme", "description": "Send pricing recap.", "assigneeId": "usr_1", "recordId": "rec_1", "dueAt": "2026-06-15T09:00:00.000Z" } ``` Ответ `201`: ```json { "data": { "id": "task_1", "createdAt": "2026-06-12T08:00:00.000Z" } } ``` ### PATCH `/api/tasks/:taskId` Тело: ```json { "title": "Follow up with Cosme", "assigneeId": "usr_2", "dueAt": "2026-06-16T09:00:00.000Z", "completedAt": "2026-06-12T09:00:00.000Z" } ``` Ответ: ```json { "data": { "id": "task_1", "updatedAt": "2026-06-12T09:00:00.000Z" } } ``` ### POST `/api/records/:recordId/comments` Тело: ```json { "body": "Please review this before renewal call, @usr_2", "mentions": ["usr_2"] } ``` Ответ `201`: ```json { "data": { "id": "comment_1", "recordId": "rec_1", "mentions": ["usr_2"], "createdAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: - `400` — пустой body. - `403` — нет доступа к record. - `404` — record/user not found. ### POST `/api/comments/:commentId/replies` Тело: ```json { "body": "Reviewed. Looks good.", "mentions": [] } ``` Ответ `201`: ```json { "data": { "id": "comment_reply_1", "parentId": "comment_1", "createdAt": "2026-06-12T08:05:00.000Z" } } ``` ### GET `/api/records/:recordId/comments` Ответ: ```json { "data": [ { "id": "comment_1", "body": "Please review this before renewal call, @usr_2", "author": { "id": "usr_1", "name": "Marisa" }, "mentions": ["usr_2"], "replies": [], "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` ### POST `/api/records/:recordId/files` Multipart: - `file` - `targetType=RECORD` Ответ `201`: ```json { "data": { "id": "file_1", "fileName": "contract.pdf", "mimeType": "application/pdf", "sizeBytes": 120000, "createdAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: `400`, `403`, `404`, `413`. ### GET `/api/records/:recordId/files` Ответ: ```json { "data": [ { "id": "file_1", "fileName": "contract.pdf", "mimeType": "application/pdf", "sizeBytes": 120000, "uploadedBy": { "id": "usr_1", "name": "Marisa" }, "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` ## 8.4. UI-компоненты ### `RecordPage` Основной контейнер: - грузит `/api/records/:recordId/page`; - рендерит header, highlights, tabs, details; - синхронизирует URL tab state; - поддерживает skeleton/error/not found. ### `RecordHeader` Поведение: - breadcrumbs; - object icon; - editable displayName через primary attribute; - action buttons; - overflow menu; - archive state. ### `RecordHighlights` - максимум 6 widgets; - empty widget placeholder; - attribute renderer; - integration widget renderer; - click → source tab/relationship/report. ### `RecordTabs` Tabs: - Activity; - Emails; - Calls; - Notes; - Tasks; - Files; - Comments; - Relationship tabs. Поведение: - counts badges; - reorder в configure mode; - скрытие tab; - lazy-load содержимого. ### `ActivityTimeline` - unified feed; - filters by activity type; - grouped by date; - system vs human events; - email/call/note/task cards embedded. ### `DetailsPanel` - sectioned attributes; - inline edit; - readonly system attrs; - relationship pills; - list memberships; - add value / clear value. ### `ConfigureRecordPageModal` Режим настройки: - drag highlights; - add widget; - add relationship tab; - reorder tabs; - create/rename/reorder sections; - drag attributes between sections; - reorder action buttons; - save/cancel. ### `CommentsPanel` - composer with @mention autocomplete; - thread replies; - notification preview; - resolve/archive. ### `NotesPanel` - create from scratch; - create from template; - link meeting; - markdown/rich text editor. ### `TasksPanel` - create task; - assignee picker; - due date picker; - mark complete; - filter open/completed. ### `FilesPanel` - drag upload; - list files; - preview/download; - archive file. ## 8.5. Acceptance-критерии - **S120 ✅** Открыть карточку: row/card click ведёт на record page; видны breadcrumbs, tabs, Details. - **S121 🟡** Inline-edit Details: пользователь редактирует поле в правой панели; typed validation работает; Activity создаётся. - **S122 ⬜** Configure page: вход через `⋮ → Configure page`; включается режим настройки layout. - **S123 ⬜** Highlights: добавить widget, максимум 6; сохранить; widget виден на всех records этого object. - **S124 ⬜** Integration highlight: добавить Linear/PandaDoc-like widget; если integration demo-disabled, показывается demo widget. - **S125 ⬜** Reorder tabs: Activity/Emails/Notes/Tasks можно переупорядочить; порядок сохраняется. - **S126 ⬜** Relationship tab: добавить Team/Deals/Invoices; tab показывает связанные records. - **S127 ⬜** Правая панель: создать секцию атрибутов; секция видна в Details. - **S128 ⬜** Drag attributes: перетащить attribute между секциями; layout сохраняется. - **S129 ⬜** Action buttons reorder: Compose email и другие действия можно reorder/hide/show. - **S130 ⬜** Activity tab: показывает историю взаимодействий и обновлений record. - **S131 ⬜** Emails tab: показывает общий тред писем с учётом sharing settings. - **S132 ⬜** Calls tab: показывает записи звонков и AI summary. - **S133 ⬜** Notes tab: создать note с нуля, из шаблона, связать с meeting. - **S134 ⬜** Tasks tab: создать/отредактировать/complete задачу record. - **S135 ⬜** Files tab: загрузить и увидеть вложение record. - **S136 ⬜** Comment + @mention: коллега получает web notification и, если включено, email. - **S137 ⬜** Reply на comment: автор получает notification. ## 8.6. Технические решения ### Layout fallback Если `RecordPageLayout` отсутствует: 1. Создать default layout из object metadata. 2. Highlights: - primary attribute; - owner/stage/connection strength, если есть; - associated records count. 3. Tabs: - Activity, Emails, Calls, Notes, Tasks, Files, Comments. 4. Details sections: - system attributes отдельно; - остальные по `Attribute.order`. 5. Actions: - Compose email, Add note, Create task, Run workflow. ### Permissions - Read only: видеть record, tabs, comments, notes, emails в рамках sharing. - Read/write: edit values, create notes/tasks/comments/emails. - Full: configure page layout. - Email tab дополнительно проверяет email sharing settings. - Files require storage permission. ### Notifications При comment: 1. Parse mentions. 2. Validate mentioned users are in org. 3. Create `RecordComment`. 4. Create `Notification` for each mentioned user. 5. Optional email digest/immediate email. 6. Activity `COMMENT_CREATED`. При reply: - notify parent author, unless same user; - notify mentioned users. ### Activity fan-in Activity tab не должен делать N+1 запросов. Endpoint: - грузит activities page; - batch-load actors; - batch-load related email/note/task/call snippets by metadata; - returns normalized feed. ### Files storage MVP: - local storage `/uploads` in dev; - DB stores `storageKey`. Target: - S3-compatible storage; - signed URLs; - antivirus scan; - file size limits by plan. --- # 9. Enrichment + Communication Intelligence **Статус:** ⬜ целевая функциональность; 🟡 частично через поля/seed/demo. Email-sync сценарий Academy требует авто-enrichment в right panel и communication intelligence: strength + recency; также People и Companies создаются из mailbox sync, person связывается с company. :contentReference[oaicite:2]{index=2} ## 9.1. Описание функциональности Enrichment — автоматическое заполнение firmographic/person attributes из домена, email, website, LinkedIn, внешних API или demo fallback. Communication Intelligence — вычисляемые сигналы на основе писем, встреч, звонков, заметок и активности: - connection strength; - last interaction; - next calendar interaction; - first interaction; - strongest connection; - mutual contacts; - recent email interaction; - recent meeting; - relationship map. Пользователь видит enrichment в: 1. Companies table: LinkedIn, Employee range, Estimated ARR, Funding raised, Country, Categories. 2. People table: Job title, Company, Location, LinkedIn, Last interaction. 3. Record Details: - Enriched Firmographics; - Location; - Social Media Links; - Communication Intelligence. 4. Filters/views/reports/workflows: - filter `Connection strength is Strong`; - sort by `Last interaction`; - report by `Employee range`; - workflow when `ICP category = ICP`. ## 9.2. Prisma-модель Enrichment можно хранить как обычные system `Attribute` + `Value`, но нужны job/history/source confidence модели. ```prisma enum EnrichmentProvider { DEMO CLEARBIT CRUNCHBASE LINKEDIN APOLLO INTERNAL_EMAIL INTERNAL_CALENDAR INTERNAL_CALLS MANUAL } enum EnrichmentJobStatus { QUEUED RUNNING SUCCEEDED FAILED SKIPPED } enum CommunicationInteractionType { EMAIL_SENT EMAIL_RECEIVED MEETING_PAST MEETING_UPCOMING CALL NOTE TASK } model EnrichmentJob { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) provider EnrichmentProvider status EnrichmentJobStatus @default(QUEUED) input Json output Json? error String? demoMode Boolean @default(false) requestedById String? requestedBy User? @relation(fields: [requestedById], references: [id], onDelete: SetNull) startedAt DateTime? completedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([recordId]) @@index([status]) @@index([provider]) @@map("crm_enrichment_jobs") } model EnrichmentSource { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) attributeId String attribute Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade) provider EnrichmentProvider sourceUrl String? confidence Float? raw Json? refreshedAt DateTime @default(now()) @@index([orgId]) @@index([recordId]) @@index([attributeId]) @@index([provider]) @@map("crm_enrichment_sources") } model CommunicationMetric { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) connectionStrength Float? connectionLabel String? firstInteractionAt DateTime? lastInteractionAt DateTime? nextInteractionAt DateTime? lastEmailAt DateTime? lastMeetingAt DateTime? nextMeetingAt DateTime? strongestConnectionUserId String? mutualContacts Json? counters Json? calculatedAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([recordId]) @@index([orgId]) @@index([lastInteractionAt]) @@index([nextInteractionAt]) @@index([connectionStrength]) @@map("crm_communication_metrics") } model CommunicationInteraction { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String record Record @relation(fields: [recordId], references: [id], onDelete: Cascade) type CommunicationInteractionType sourceType String sourceId String occurredAt DateTime userId String? user User? @relation(fields: [userId], references: [id], onDelete: SetNull) metadata Json? @@index([orgId]) @@index([recordId, occurredAt]) @@index([type]) @@index([userId]) @@map("crm_communication_interactions") } ``` ### System attributes для enrichment Bootstrap должен создать system attributes: Companies: - `linkedin_url` URL - `employee_range` SELECT - `estimated_arr` CURRENCY - `funding_raised` CURRENCY - `industry` SELECT/TEXT - `categories` MULTI_SELECT - `country` TEXT/LOCATION - `city` TEXT/LOCATION - `foundation_date` DATE - `twitter_followers` NUMBER - `connection_strength` RATING/NUMBER - `last_interaction` DATETIME - `next_calendar_interaction` DATETIME - `strongest_connection` USER People: - `job_title` TEXT - `linkedin_url` URL - `location` LOCATION - `company` RELATIONSHIP - `connection_strength` RATING/NUMBER - `last_interaction` DATETIME - `next_calendar_interaction` DATETIME ## 9.3. API-эндпоинты ### POST `/api/records/:recordId/enrich` Запустить enrichment записи. Тело: ```json { "providers": ["DEMO"], "forceRefresh": false } ``` Ответ `202`: ```json { "data": { "jobId": "enrich_1", "status": "QUEUED", "demoMode": true } } ``` Ошибки: - `401` - `403` - `404` - `422` — object не поддерживает enrichment. - `429` — rate limit. ### GET `/api/enrichment/jobs/:jobId` Ответ: ```json { "data": { "id": "enrich_1", "recordId": "rec_1", "status": "SUCCEEDED", "provider": "DEMO", "output": { "employee_range": "51_250", "linkedin_url": "https://linkedin.com/company/cosme" }, "demoMode": true, "completedAt": "2026-06-12T08:00:00.000Z" } } ``` ### GET `/api/records/:recordId/enrichment` Ответ: ```json { "data": { "recordId": "rec_1", "values": { "employee_range": { "value": "51_250", "provider": "DEMO", "confidence": 0.88, "refreshedAt": "2026-06-12T08:00:00.000Z" } }, "sources": [] } } ``` ### POST `/api/communication/recalculate` Пересчитать communication intelligence. Тело: ```json { "recordIds": ["rec_1"], "scope": "SELECTED" } ``` Ответ `202`: ```json { "data": { "jobId": "commcalc_1", "recordsQueued": 1 } } ``` Ошибки: `400`, `403`, `413`. ### GET `/api/records/:recordId/communication` Ответ: ```json { "data": { "recordId": "rec_1", "connectionStrength": 0.82, "connectionLabel": "Strong", "firstInteractionAt": "2026-01-10T10:00:00.000Z", "lastInteractionAt": "2026-06-10T12:00:00.000Z", "nextInteractionAt": "2026-06-15T09:00:00.000Z", "lastEmailAt": "2026-06-10T12:00:00.000Z", "nextMeetingAt": "2026-06-15T09:00:00.000Z", "strongestConnection": { "id": "usr_1", "name": "Marisa" }, "mutualContacts": [ { "recordId": "rec_person_2", "displayName": "Lisa Cohen" } ], "calculatedAt": "2026-06-12T08:00:00.000Z" } } ``` ### GET `/api/communication/interactions` Query: ```json { "recordId": "rec_1", "limit": 50, "cursor": null } ``` Ответ: ```json { "data": [ { "id": "ci_1", "type": "EMAIL_RECEIVED", "sourceType": "Email", "sourceId": "email_1", "occurredAt": "2026-06-10T12:00:00.000Z", "user": { "id": "usr_1", "name": "Marisa" } } ], "meta": { "nextCursor": null } } ``` ### POST `/api/demo/enrichment/seed` Создать demo enrichment values для workspace. Тело: ```json { "objectKeys": ["companies", "people"], "recordsLimit": 100 } ``` Ответ: ```json { "data": { "recordsUpdated": 42, "demoMode": true } } ``` ## 9.4. UI-компоненты ### `EnrichmentPanel` - находится в Details; - показывает enriched fields grouped by source; - badge provider/confidence; - button `Refresh enrichment`; - demo-mode badge. ### `CommunicationIntelligenceCard` - connection strength meter; - last interaction; - next calendar interaction; - strongest connection; - mutual contacts. ### `EnrichmentCell` - table cell with value + source indicator; - hover tooltip: provider, refreshedAt, confidence. ### `CommunicationTimelineMini` - последние коммуникации в Details; - opens Activity/Emails/Calls tabs. ### `MutualContactsPopover` - список общих контактов; - click opens person record. ### `DemoEnrichmentBanner` - если внешние providers не настроены; - объясняет demo fallback. ## 9.5. Acceptance-критерии ### S388–S389 - **S388 ⬜ Enrichment записи**: при наличии domain/email enrichment job заполняет LinkedIn, employee range, job title, location, industry/funding/ARR; без внешних ключей работает demo fallback. - **S389 ⬜ Communication intelligence**: система считает connection strength, last interaction, next calendar interaction по emails/calendar/calls/activities; значения доступны как system attributes. ### Частично S386–S392 - **S386 ⬜ Подключить ящик**: после mailbox connection enrichment/communication jobs запускаются для найденных People/Companies. - **S387 ⬜ Email-sync наполняет People/Company**: новые records получают enrichment values и relationship person→company. - **S390 ⬜ Sharing settings**: communication metrics считаются с учётом приватности писем; скрытые письма не раскрываются в UI. - **S391 ⬜ Emails tab**: email interactions входят в communication metrics. - **S392 ⬜ Calendar-sync**: meeting events входят в last/next interaction. ## 9.6. Технические решения ### Enrichment pipeline 1. Trigger: - record created/updated; - domain/email changed; - mailbox sync imported record; - manual refresh. 2. Create `EnrichmentJob`. 3. Worker resolves provider: - if external key exists → provider adapter; - else `DEMO`. 4. Normalize output to known attributes. 5. For each field: - write `Value`; - write `EnrichmentSource`; - write `Activity` if visible change. 6. Recalculate searchText if needed. ### Demo fallback Demo provider must be deterministic: - domain hash → employee range; - known seed domains → realistic categories; - email local/domain → person name/company; - country/city from static map; - LinkedIn URL from domain/company name. ### Communication strength formula MVP score: ```ts type CommunicationStrengthInput = { emailsSent: number; emailsReceived: number; meetingsPast: number; calls: number; lastInteractionDaysAgo: number | null; upcomingMeetings: number; }; function calculateConnectionStrength(input: CommunicationStrengthInput): number { const volume = input.emailsSent * 1 + input.emailsReceived * 2 + input.meetingsPast * 5 + input.calls * 4 + input.upcomingMeetings * 6; const recencyMultiplier = input.lastInteractionDaysAgo == null ? 0.2 : input.lastInteractionDaysAgo <= 7 ? 1 : input.lastInteractionDaysAgo <= 30 ? 0.7 : input.lastInteractionDaysAgo <= 90 ? 0.4 : 0.2; return Math.min(1, (volume / 50) * recencyMultiplier); } ``` Labels: - `0–0.24` → No connection - `0.25–0.49` → Weak - `0.50–0.74` → Moderate - `0.75–1.00` → Strong ### Privacy - Metrics can count private emails, but UI must not expose subject/body if user lacks access. - `lastInteractionAt` can show date, while source email body remains hidden. - Sharing settings decide detail level: - full content; - subject + participants; - participants only. --- # 10. Email & Calendar sync + продуктивность **Статус:** 🟡 demo/legacy email частично; ⬜ real Gmail/Outlook/calendar sync, sharing settings, templates, outbox/tracking и productivity parity. Academy scenario 27 задаёт comments/tasks/email/notes, а scenario 28 — mailbox sync, People/Company auto-fill, Activity/Email tabs, inbox sharing settings и enrichment/communication intelligence. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4} ## 10.1. Описание функциональности Раздел объединяет: 1. Email composer и отправку писем с record page. 2. Email templates с merge-переменными. 3. Mass send группе records. 4. Mailbox sync Gmail/Outlook/demo. 5. Calendar sync. 6. Emails tab на record page. 7. Notes/tasks productivity. 8. Outbox и tracking. 9. Sharing settings. ### 10.1.1. Email composer Пользователь открывает `Compose email` на record page: - выбирает recipients: - main contact; - associated team; - selected people; - manually entered email; - выбирает template или пишет с нуля; - использует merge variables: - `{person.first_name}`; - `{company.name}`; - `{deal.value}`; - relationship variables; - выбирает: - send individually; - one thread; - include signature; - schedule send; - видит demo SMTP badge, если SMTP не настроен; - отправляет или сохраняет draft. ### 10.1.2. Mailbox sync При регистрации или в Settings → Email and calendar accounts пользователь подключает mailbox. Система: - импортирует historical emails; - создаёт People из email participants; - создаёт Companies по доменам; - связывает Person→Company; - создаёт Email records; - создаёт Activity events; - считает communication intelligence; - применяет sharing settings. ### 10.1.3. Calendar sync Система: - импортирует past/upcoming events; - связывает participants с People/Companies; - показывает meetings на Activity timeline; - считает `next calendar interaction`; - даёт связать note с meeting. ### 10.1.4. Templates Workspace templates: - email templates; - note templates. Template может использовать variables любого attribute текущей record или связанных records. ### 10.1.5. Outbox и tracking Outbox показывает: - manual scheduled emails; - sequence emails; - queued demo emails; - status: queued/scheduled/sending/sent/failed/cancelled; - preview; - sequence/source; - planned time. Tracking: - open pixel; - click redirect; - reply detection; - unsubscribe link. ## 10.2. Prisma-модель ```prisma enum EmailDirection { INBOUND OUTBOUND } enum EmailStatus { DRAFT QUEUED SCHEDULED SENDING SENT FAILED CANCELLED SIMULATED_SENT RECEIVED } enum EmailProvider { DEMO SMTP GMAIL OUTLOOK } enum EmailVisibility { FULL SUBJECT_AND_PARTICIPANTS PARTICIPANTS_ONLY PRIVATE } enum CalendarProvider { DEMO GOOGLE OUTLOOK } enum EmailTemplateType { MANUAL SEQUENCE WORKFLOW } model EmailAccount { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) userId String user User @relation(fields: [userId], references: [id], onDelete: Cascade) provider EmailProvider email String displayName String? accessTokenEncrypted String? refreshTokenEncrypted String? smtpHost String? smtpPort Int? smtpUser String? smtpPasswordEncrypted String? signature String? @db.Text delegatedSendingEnabled Boolean @default(false) syncEnabled Boolean @default(false) visibility EmailVisibility @default(FULL) lastSyncedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([userId]) @@index([email]) @@map("crm_email_accounts") } model Email { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) recordId String? record Record? @relation(fields: [recordId], references: [id], onDelete: SetNull) emailAccountId String? emailAccount EmailAccount? @relation(fields: [emailAccountId], references: [id], onDelete: SetNull) senderUserId String? senderUser User? @relation("EmailSenderUser", fields: [senderUserId], references: [id], onDelete: SetNull) direction EmailDirection status EmailStatus provider EmailProvider @default(DEMO) fromEmail String fromName String? to Json cc Json? bcc Json? subject String? bodyText String? @db.Text bodyHtml String? @db.Text threadId String? providerMessageId String? inReplyToMessageId String? visibility EmailVisibility @default(FULL) scheduledAt DateTime? sentAt DateTime? receivedAt DateTime? openedAt DateTime? repliedAt DateTime? failedAt DateTime? failureReason String? trackingId String? @unique sequenceEnrollmentId String? sequenceStepId String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([recordId, createdAt]) @@index([threadId]) @@index([status, scheduledAt]) @@index([providerMessageId]) @@index([sequenceEnrollmentId]) @@map("crm_emails") } model EmailTemplate { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) name String type EmailTemplateType @default(MANUAL) subject String? body String @db.Text variables Json? createdById String? createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([type]) @@index([createdById]) @@map("crm_email_templates") } model NoteTemplate { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) name String body String @db.Text variables Json? createdById String? createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([createdById]) @@map("crm_note_templates") } model CalendarAccount { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) userId String user User @relation(fields: [userId], references: [id], onDelete: Cascade) provider CalendarProvider email String accessTokenEncrypted String? refreshTokenEncrypted String? syncEnabled Boolean @default(false) lastSyncedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([userId]) @@map("crm_calendar_accounts") } model CalendarEvent { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) calendarAccountId String? calendarAccount CalendarAccount? @relation(fields: [calendarAccountId], references: [id], onDelete: SetNull) providerEventId String? title String description String? @db.Text location String? startAt DateTime endAt DateTime attendees Json meetingUrl String? linkedRecordIds Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@index([orgId]) @@index([calendarAccountId]) @@index([startAt]) @@index([providerEventId]) @@map("crm_calendar_events") } model EmailEvent { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) emailId String email Email @relation(fields: [emailId], references: [id], onDelete: Cascade) type String // OPENED | CLICKED | REPLIED | BOUNCED | UNSUBSCRIBED metadata Json? occurredAt DateTime @default(now()) @@index([orgId]) @@index([emailId]) @@index([type]) @@index([occurredAt]) @@map("crm_email_events") } ``` ## 10.3. API-эндпоинты ### POST `/api/email-accounts/demo-connect` Демо mailbox sync. Тело: ```json { "email": "marisa@example.com", "includeHistorical": true } ``` Ответ `202`: ```json { "data": { "accountId": "eacc_demo", "syncJobId": "sync_1", "provider": "DEMO" } } ``` Ошибки: `400`, `403`, `409`. ### POST `/api/email-accounts` Подключить SMTP/Gmail/Outlook. Тело SMTP: ```json { "provider": "SMTP", "email": "marisa@example.com", "displayName": "Marisa", "smtpHost": "smtp.example.com", "smtpPort": 587, "smtpUser": "marisa@example.com", "smtpPassword": "secret", "visibility": "FULL" } ``` Ответ `201`: ```json { "data": { "id": "eacc_1", "provider": "SMTP", "email": "marisa@example.com", "syncEnabled": false } } ``` Ошибки: `400`, `403`, `409`, `422`. ### GET `/api/email-accounts` Ответ: ```json { "data": [ { "id": "eacc_1", "provider": "DEMO", "email": "marisa@example.com", "syncEnabled": true, "visibility": "FULL", "lastSyncedAt": "2026-06-12T08:00:00.000Z" } ] } ``` ### PATCH `/api/email-accounts/:accountId` Тело: ```json { "syncEnabled": true, "visibility": "SUBJECT_AND_PARTICIPANTS", "signature": "Best,\nMarisa", "delegatedSendingEnabled": true } ``` Ответ: ```json { "data": { "id": "eacc_1", "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` ### POST `/api/email-accounts/:accountId/sync` Запустить sync. Тело: ```json { "mode": "INCREMENTAL", "since": "2026-01-01T00:00:00.000Z" } ``` Ответ `202`: ```json { "data": { "syncJobId": "sync_1", "status": "QUEUED" } } ``` ### POST `/api/calendar-accounts/demo-connect` Тело: ```json { "email": "marisa@example.com" } ``` Ответ `202`: ```json { "data": { "accountId": "cal_demo", "syncJobId": "calsync_1" } } ``` ### GET `/api/records/:recordId/emails` Ответ: ```json { "data": [ { "id": "email_1", "direction": "OUTBOUND", "status": "SENT", "fromEmail": "marisa@example.com", "to": [{ "email": "lisa@cosme.pt", "name": "Lisa Cohen" }], "subject": "Following up", "bodyText": "Hi Lisa...", "visibility": "FULL", "sentAt": "2026-06-12T08:00:00.000Z", "openedAt": null, "repliedAt": null } ] } ``` Ошибки: `403` если sharing не позволяет видеть body. ### POST `/api/records/:recordId/emails/draft` Тело: ```json { "to": [{ "email": "lisa@cosme.pt", "recordId": "rec_person_1" }], "cc": [], "bcc": [], "subject": "Following up with {{company.name}}", "body": "Hi {{person.first_name}},\n\nThanks for your time.", "templateId": "tmpl_1", "sendIndividually": true, "threadMode": "NEW_THREAD" } ``` Ответ `201`: ```json { "data": { "id": "email_draft_1", "status": "DRAFT", "preview": [ { "to": "lisa@cosme.pt", "subject": "Following up with Cosme", "body": "Hi Lisa,\n\nThanks for your time." } ] } } ``` Ошибки: `400`, `403`, `404`, `422`. ### POST `/api/records/:recordId/emails/send` Тело: ```json { "draftId": "email_draft_1", "emailAccountId": "eacc_1", "scheduledAt": null, "trackOpens": true, "trackClicks": true } ``` Ответ `202`: ```json { "data": { "emailId": "email_1", "status": "QUEUED", "demoMode": false } } ``` Ошибки: - `400` - `403` - `404` - `422` — no sender account, invalid recipient. - `429` — rate-limited. ### POST `/api/emails/mass-send` Тело: ```json { "recordIds": ["rec_person_1", "rec_person_2"], "templateId": "tmpl_interview", "emailAccountId": "eacc_1", "sendIndividually": true, "trackOpens": true } ``` Ответ `202`: ```json { "data": { "jobId": "mass_email_1", "recipientsCount": 2, "status": "QUEUED" } } ``` ### GET `/api/emails/outbox` Query: ```json { "status": "QUEUED", "source": "SEQUENCE" } ``` Ответ: ```json { "data": [ { "id": "email_queued_1", "subject": "Invitation to London event", "to": [{ "email": "lisa@cosme.pt" }], "status": "SCHEDULED", "scheduledAt": "2026-06-12T09:00:00.000Z", "source": "SEQUENCE", "sequence": { "id": "seq_1", "name": "ICP Inbound Leads" } } ] } ``` ### POST `/api/email-templates` Тело: ```json { "name": "Onboarding invite", "subject": "Welcome to {{company.name}} onboarding", "body": "Hi {{person.first_name}}, book a time here: {{booking_link}}", "type": "MANUAL" } ``` Ответ `201`: ```json { "data": { "id": "tmpl_1", "name": "Onboarding invite" } } ``` ### GET `/api/email-templates` Ответ: ```json { "data": [ { "id": "tmpl_1", "name": "Onboarding invite", "subject": "Welcome to {{company.name}} onboarding", "variables": ["person.first_name", "company.name"] } ] } ``` ### POST `/api/note-templates` Тело: ```json { "name": "Call prep", "body": "Context:\n{{company.name}}\n\nQuestions:\n-" } ``` Ответ `201`: ```json { "data": { "id": "ntmpl_1", "name": "Call prep" } } ``` ### GET `/api/calendar/events` Query: ```json { "recordId": "rec_1", "from": "2026-06-01T00:00:00.000Z", "to": "2026-06-30T00:00:00.000Z" } ``` Ответ: ```json { "data": [ { "id": "evt_1", "title": "Cosme renewal call", "startAt": "2026-06-15T09:00:00.000Z", "endAt": "2026-06-15T09:30:00.000Z", "attendees": [{ "email": "lisa@cosme.pt" }], "linkedRecordIds": ["rec_1"] } ] } ``` ### GET `/api/email/track/open/:trackingId` Public pixel endpoint. Ответ: transparent 1x1 pixel. Ошибки: never expose internal errors. ### GET `/api/email/track/click/:trackingId` Query: ```json { "url": "https://example.com" } ``` Поведение: записать click event и redirect. ## 10.4. UI-компоненты ### `EmailComposerModal` - recipients selector; - subject; - rich text body; - template picker; - variables menu; - preview per recipient; - send/draft/schedule; - tracking toggles; - demo mode indicator. ### `RecipientPicker` - main contact; - associated team; - relationship records; - manual email; - validation. ### `TemplatePicker` - email templates; - preview; - create/edit template shortcut. ### `VariableMenu` - attributes current record; - related object attributes; - user/sender variables; - system variables. ### `EmailsTab` - thread list; - sharing state; - email detail; - compose reply; - tracking chips opened/replied. ### `OutboxPage` - queued/scheduled/sent/failed tabs; - source sequence/manual/workflow; - preview; - cancel/reschedule. ### `EmailAccountSettingsPage` - connect demo/Gmail/Outlook/SMTP; - sync toggle; - sharing visibility; - signature; - delegated sending. ### `CalendarAccountSettingsPage` - connect demo/Google/Outlook; - sync status; - last sync; - connected calendars. ### `TasksPage` - filter by assignee; - due status; - complete; - grouped today/upcoming/overdue. ## 10.5. Acceptance-критерии ### Email-инструмент / продуктивность S140–S149 - **S140 ⬜** Отправить email с record page: Compose email → выбрать main contact/team → send. - **S141 ⬜** Email из template library: выбрать onboarding template + booking link. - **S142 ⬜** Toggle mass send off: весь team получает один общий thread. - **S143 ⬜** Mass send группе: selected candidates in screening → interview email. - **S144 ⬜** Template variables: `{first_name}`, `{company.name}` подставляются per recipient. - **S145 ⬜** Создать email template: Emails tab → Templates → create → available in composer. - **S146 ⬜** Создать note template: Notes tab → Templates → create → available in notes. - **S147 ⬜** Task create: description + assignee + due + linked record; visible on record. - **S148 ⬜** Task page: filter by assignee; mark complete. - **S149 ⬜** Outbox: sequence/manual queued emails visible with preview and schedule. ### Email sync & enrichment S386–S392 - **S386 ⬜** Подключить ящик: demo/Gmail/Outlook account created; sync job starts. - **S387 ⬜** Email sync populates People/Company: participants create People; domains create Companies; relationship created. - **S388 ⬜** Enrichment: synced records get job title/social/location/company size/financials where available or demo fallback. - **S389 ⬜** Communication intelligence: strength/last/next interaction calculated. - **S390 ⬜** Sharing settings: FULL / subject+participants / participants only / private enforced in Email tab/API. - **S391 ⬜** Emails tab: record shows shared thread/history. - **S392 ⬜** Calendar sync: meetings appear on Activity timeline and update next interaction. ## 10.6. Технические решения ### Demo email If no sender provider: 1. Create Email with `provider=DEMO`. 2. Queue email job. 3. Worker marks `SIMULATED_SENT`. 4. Create Activity `EMAIL_SENT`. 5. Outbox shows demo badge. 6. Tracking events can be simulated. ### Mailbox sync algorithm 1. Connect account. 2. Fetch historical messages/page tokens. 3. Normalize participants. 4. For each participant: - skip internal/org domains if configured; - find/create Person by email; - find/create Company by email domain; - create relationship Person→Company. 5. Create Email records. 6. Link Email to person/company records. 7. Create Activity entries. 8. Recalculate communication metrics. 9. Enrich records. ### Calendar sync algorithm 1. Fetch events. 2. Normalize attendees. 3. Match attendees to People by email. 4. Match domains to Companies. 5. Create CalendarEvent. 6. Create Activity for linked records. 7. Recalculate next/last interaction. ### Template rendering Use safe variable resolver: ```ts type TemplateContext = { record: RecordDetailDto; relationships: Record<string, RecordDetailDto[]>; sender: UserDto; recipient?: RecordDetailDto; }; function renderTemplate(template: string, context: TemplateContext): string { // Resolve only whitelisted {{path}} variables. // Unknown variable stays highlighted in preview and blocks send unless user confirms. return template; } ``` ### Reply detection MVP: - manual/demo reply update; - inbound sync marks `repliedAt`; - match by `threadId`, `inReplyToMessageId`, participants. Target: - Gmail/Outlook webhook; - IMAP polling; - reply classification. ### Tracking - Open pixel creates `EmailEvent(type=OPENED)`. - Click redirect creates `EmailEvent(type=CLICKED)`. - Do not track if user disables tracking. - Respect unsubscribe and privacy. --- # 11. Sequences (цепочки писем) **Статус:** ⬜ новая metadata-driven реализация; 🟡 legacy Campaign/Sequence/Message частично есть, но не Attio-parity. Academy sequence sources cover settings, лимиты 12/час · 5 минут · 200/день, exit reply/meeting, delegated sending, pause/resume/exit, OOO, outbox, unsubscribe list и sequence editor. :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6} ## 11.1. Описание функциональности Sequences — автоматизированные цепочки email outreach. Пользовательский flow: 1. Открыть `Automations → Sequences`. 2. Нажать `New Sequence`. 3. Ввести title: `ICP Inbound Leads`. 4. Открыть editor: - tabs: `Editor`, `Recipients`, `Settings`, `Insights`; - left/main: steps; - right panel: delivery/email/exit settings. 5. Настроить delivery: - sending window; - timezone; - business days only; - limits: - 12 emails/hour/mailbox; - minimum 5 minutes between sends; - 200 emails/day/mailbox; - warm-up ramp for new mailbox. 6. Настроить email: - unsubscribe link text + preview; - thread mode: same thread/new thread; - include sender signature. 7. Настроить exit criteria: - reply received; - meeting booked; - unsubscribe; - bounced/manual exit. 8. Создать steps: - wait N days/business days; - automated email step; - variables from person/company/deal/list; - template or from scratch. 9. Publish sequence. 10. Enroll recipients: - from sequence editor; - from People view bulk; - from record page; - from People list; - from workflow action. 11. Monitor: - recipients active/exited/paused; - outbox; - sent/opened/replied/booked; - OOO handling. 12. Archive/restore sequence. ## 11.2. Prisma-модель Legacy `Sequence` currently belongs to `Campaign`. Target model must be workspace-level and metadata-driven. ```prisma enum SequenceStatus { DRAFT PUBLISHED PAUSED ARCHIVED } enum SequenceStepType { WAIT EMAIL } enum SequenceEnrollmentStatus { ACTIVE PAUSED EXITED COMPLETED UNSUBSCRIBED BOUNCED FAILED } enum SequenceExitReason { REPLY_RECEIVED MEETING_BOOKED UNSUBSCRIBED BOUNCED MANUAL_EXIT COMPLETED OOO_DELAYED ERROR } enum SequenceThreadMode { SAME_THREAD NEW_THREAD } enum SequenceRecipientSource { MANUAL VIEW LIST RECORD_PAGE WORKFLOW IMPORT } enum SequenceStepRunStatus { SCHEDULED QUEUED SENDING SENT SKIPPED FAILED CANCELLED } model Sequence { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) name String description String? status SequenceStatus @default(DRAFT) version Int @default(1) createdById String? createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull) settings Json // SequenceSettings sharing Json? metrics Json? steps SequenceStep[] enrollments SequenceEnrollment[] publishedAt DateTime? archivedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([status]) @@index([createdById]) @@map("crm_sequences") } model SequenceStep { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) sequenceId String sequence Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade) version Int order Int type SequenceStepType waitAmount Int? waitUnit String? // MINUTES | HOURS | DAYS | BUSINESS_DAYS subject String? body String? @db.Text templateId String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt runs SequenceStepRun[] @@index([orgId]) @@index([sequenceId, version, order]) @@map("crm_sequence_steps") } model SequenceEnrollment { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) sequenceId String sequence Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade) sequenceVersion Int recipientRecordId String recipientRecord Record @relation("SequenceRecipientRecord", fields: [recipientRecordId], references: [id], onDelete: Cascade) senderUserId String senderUser User @relation("SequenceSenderUser", fields: [senderUserId], references: [id], onDelete: Cascade) senderEmailAccountId String? senderEmailAccount EmailAccount? @relation(fields: [senderEmailAccountId], references: [id], onDelete: SetNull) source SequenceRecipientSource sourceId String? status SequenceEnrollmentStatus @default(ACTIVE) currentStepOrder Int @default(0) nextSendAt DateTime? pausedAt DateTime? pauseRemainingSeconds Int? exitedAt DateTime? exitReason SequenceExitReason? oooReturnAt DateTime? metadata Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt runs SequenceStepRun[] @@unique([sequenceId, recipientRecordId, senderUserId]) @@index([orgId]) @@index([sequenceId]) @@index([recipientRecordId]) @@index([senderUserId]) @@index([status]) @@index([nextSendAt]) @@map("crm_sequence_enrollments") } model SequenceStepRun { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) sequenceId String sequence Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade) stepId String step SequenceStep @relation(fields: [stepId], references: [id], onDelete: Cascade) enrollmentId String enrollment SequenceEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade) status SequenceStepRunStatus @default(SCHEDULED) scheduledAt DateTime? queuedAt DateTime? sentAt DateTime? failedAt DateTime? error String? emailId String? email Email? @relation(fields: [emailId], references: [id], onDelete: SetNull) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([sequenceId]) @@index([enrollmentId]) @@index([status, scheduledAt]) @@index([emailId]) @@map("crm_sequence_step_runs") } model UnsubscribeEntry { id String @id @default(cuid()) orgId String org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) email String senderUserId String? senderUser User? @relation(fields: [senderUserId], references: [id], onDelete: SetNull) sequenceId String? sequence Sequence? @relation(fields: [sequenceId], references: [id], onDelete: SetNull) reason String? source String // LINK | MANUAL | BOUNCE | REPLY createdAt DateTime @default(now()) @@unique([orgId, email, senderUserId]) @@index([orgId]) @@index([email]) @@index([sequenceId]) @@map("crm_unsubscribe_entries") } ``` ### SequenceSettings DTO ```ts type SequenceSettings = { timezone: string; sendingWindow: { start: string; // "09:00" end: string; // "18:00" }; businessDaysOnly: boolean; includeWeekends: boolean; limits: { maxPerHourPerMailbox: number; // 12 minMinutesBetweenEmails: number; // 5 maxPerDayPerMailbox: number; // 200 }; warmup?: { enabled: boolean; startDailyLimit: number; increasePerDay: number; maxDailyLimit: number; }; unsubscribe: { enabled: boolean; linkText: string; previewText?: string; }; threadMode: "SAME_THREAD" | "NEW_THREAD"; includeSenderSignature: boolean; exitCriteria: { replyReceived: boolean; meetingBooked: boolean; }; delegatedSending: { enabled: boolean; allowedSenderUserIds: string[]; }; }; ``` ## 11.3. API-эндпоинты ### GET `/api/sequences` Query: ```json { "status": "PUBLISHED", "includeArchived": false } ``` Ответ: ```json { "data": [ { "id": "seq_1", "name": "ICP Inbound Leads", "status": "PUBLISHED", "version": 2, "metrics": { "active": 12, "enrolled": 30, "exited": 18, "sent": 40, "opened": 21, "replied": 7, "booked": 3 }, "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` Ошибки: `401`, `403`. ### POST `/api/sequences` Создать sequence draft. Тело: ```json { "name": "ICP Inbound Leads", "description": "Inbound lead outreach" } ``` Ответ `201`: ```json { "data": { "id": "seq_1", "name": "ICP Inbound Leads", "status": "DRAFT", "version": 1 } } ``` Ошибки: `400`, `403`, `409`. ### GET `/api/sequences/:sequenceId` Ответ: ```json { "data": { "id": "seq_1", "name": "ICP Inbound Leads", "status": "DRAFT", "version": 1, "settings": { "timezone": "Europe/Vienna", "sendingWindow": { "start": "09:00", "end": "18:00" }, "businessDaysOnly": true, "limits": { "maxPerHourPerMailbox": 12, "minMinutesBetweenEmails": 5, "maxPerDayPerMailbox": 200 } }, "steps": [], "metrics": {} } } ``` ### PATCH `/api/sequences/:sequenceId` Обновить name/settings. Тело: ```json { "name": "ICP Inbound Leads", "settings": { "timezone": "Europe/Vienna", "sendingWindow": { "start": "09:00", "end": "18:00" }, "businessDaysOnly": true, "includeWeekends": false, "limits": { "maxPerHourPerMailbox": 12, "minMinutesBetweenEmails": 5, "maxPerDayPerMailbox": 200 }, "unsubscribe": { "enabled": true, "linkText": "Unsubscribe" }, "threadMode": "SAME_THREAD", "includeSenderSignature": true, "exitCriteria": { "replyReceived": true, "meetingBooked": true }, "delegatedSending": { "enabled": true, "allowedSenderUserIds": ["usr_heather"] } } } ``` Ответ: ```json { "data": { "id": "seq_1", "updatedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: - `400` invalid settings. - `403` - `404` - `422` published sequence edit creates new draft version unless allowed. ### POST `/api/sequences/:sequenceId/steps` Добавить step. Тело email step: ```json { "type": "EMAIL", "order": 1, "subject": "Invitation for {{person.first_name}}", "body": "Hi {{person.first_name}},\n\nWould you like to join our event?", "templateId": "tmpl_1" } ``` Тело wait step: ```json { "type": "WAIT", "order": 2, "waitAmount": 3, "waitUnit": "BUSINESS_DAYS" } ``` Ответ `201`: ```json { "data": { "id": "step_1", "sequenceId": "seq_1", "type": "EMAIL", "order": 1 } } ``` Ошибки: `400`, `403`, `404`, `422`. ### PATCH `/api/sequence-steps/:stepId` Тело: ```json { "order": 2, "subject": "Following up", "body": "Hi {{person.first_name}}, just checking in.", "waitAmount": 5, "waitUnit": "BUSINESS_DAYS" } ``` Ответ: ```json { "data": { "id": "step_1", "updatedAt": "2026-06-12T08:05:00.000Z" } } ``` ### DELETE `/api/sequence-steps/:stepId` Ответ: ```json { "data": { "id": "step_1", "deleted": true } } ``` ### POST `/api/sequences/:sequenceId/publish` Ответ: ```json { "data": { "id": "seq_1", "status": "PUBLISHED", "version": 1, "publishedAt": "2026-06-12T08:00:00.000Z" } } ``` Ошибки: - `422` — нет email steps, invalid settings, missing unsubscribe, invalid variables. - `403`. ### POST `/api/sequences/:sequenceId/archive` Ответ: ```json { "data": { "id": "seq_1", "status": "ARCHIVED", "archivedAt": "2026-06-12T08:00:00.000Z" } } ``` Поведение: новых recipients добавить нельзя; active enrollments могут завершиться. ### POST `/api/sequences/:sequenceId/restore` Ответ: ```json { "data": { "id": "seq_1", "status": "PUBLISHED" } } ``` ### POST `/api/sequences/:sequenceId/enroll` Enroll recipients. Тело: ```json { "recipientRecordIds": ["rec_person_1", "rec_person_2"], "senderUserId": "usr_heather", "senderEmailAccountId": "eacc_heather", "source": "VIEW", "sourceId": "view_london_people" } ``` Ответ `202`: ```json { "data": { "jobId": "enroll_1", "queued": 2, "skipped": 0, "errors": [] } } ``` Ошибки: - `400` - `403` — no delegated sending permission. - `404` - `409` — already enrolled. - `422` — recipient not People record, unsubscribed, no email. ### GET `/api/sequences/:sequenceId/enrollments` Query: ```json { "status": "ACTIVE", "limit": 50 } ``` Ответ: ```json { "data": [ { "id": "enr_1", "recipient": { "id": "rec_person_1", "displayName": "Lisa Cohen", "email": "lisa@cosme.pt" }, "sender": { "id": "usr_heather", "name": "Heather" }, "status": "ACTIVE", "currentStepOrder": 2, "nextSendAt": "2026-06-15T09:00:00.000Z", "exitReason": null } ] } ``` ### POST `/api/sequence-enrollments/:enrollmentId/pause` Ответ: ```json { "data": { "id": "enr_1", "status": "PAUSED", "pausedAt": "2026-06-12T08:00:00.000Z", "pauseRemainingSeconds": 172800 } } ``` ### POST `/api/sequence-enrollments/:enrollmentId/resume` Ответ: ```json { "data": { "id": "enr_1", "status": "ACTIVE", "nextSendAt": "2026-06-14T08:00:00.000Z" } } ``` ### POST `/api/sequence-enrollments/:enrollmentId/exit` Тело: ```json { "reason": "MANUAL_EXIT" } ``` Ответ: ```json { "data": { "id": "enr_1", "status": "EXITED", "exitReason": "MANUAL_EXIT", "exitedAt": "2026-06-12T08:00:00.000Z" } } ``` ### GET `/api/sequences/:sequenceId/metrics` Ответ: ```json { "data": { "enrolled": 100, "active": 40, "paused": 5, "exited": 55, "completed": 20, "sent": 180, "opened": 90, "clicked": 22, "replied": 18, "booked": 7, "unsubscribed": 3, "bounced": 2 } } ``` ### GET `/api/unsubscribes` Query: ```json { "email": "lisa@cosme.pt", "senderUserId": "usr_1" } ``` Ответ: ```json { "data": [ { "id": "unsub_1", "email": "lisa@cosme.pt", "senderUserId": "usr_1", "sequenceId": "seq_1", "reason": "Not relevant", "source": "LINK", "createdAt": "2026-06-12T08:00:00.000Z" } ] } ``` ### GET `/api/sequences/unsubscribe/:token` Public unsubscribe page. Ответ: HTML/Next page or JSON for API client. ### POST `/api/sequences/unsubscribe/:token` Тело: ```json { "reason": "Not relevant" } ``` Ответ: ```json { "data": { "unsubscribed": true } } ``` ### POST `/api/sequences/:sequenceId/import-recipients` CSV import recipients into sequence. Тело multipart: - file - senderUserId - mapping Ответ: ```json { "data": { "importId": "seq_import_1", "status": "MAPPING_REQUIRED" } } ``` ## 11.4. UI-компоненты ### `SequencesPage` - list of sequences; - status tabs: Draft, Published, Archived; - metrics columns; - New Sequence button; - archive/restore/delete actions. ### `SequenceEditorPage` Tabs: - Editor; - Recipients; - Settings; - Insights. ### `SequenceStepsEditor` - step list; - wait step card; - automated email step card; - add step; - reorder steps; - variables menu; - template picker. ### `SequenceSettingsPanel` Sections: - Delivery: - sending window; - timezone; - business days; - hourly/daily limits; - warm-up. - Email: - unsubscribe; - thread mode; - sender signature. - Exit criteria: - reply received; - meeting booked. - Access/delegated sending. ### `EnrollRecipientsModal` - source selected records/view/list; - sender picker; - delegated sender validation; - unsubscribe conflict warning; - preview recipients; - confirm enroll. ### `SequenceRecipientsTable` - recipient; - sender; - status; - current step; - next send; - sent/opened/replied/booked; - actions: pause/resume/exit. ### `SequenceOutboxPanel` - queued sequence emails; - scheduled time; - recipient; - sequence/step; - preview; - cancel if allowed. ### `UnsubscribeSettingsPage` - workspace unsubscribe list; - search email; - reason/source/date; - immutable entries except allowed manual/bounce policy. ## 11.5. Acceptance-критерии - **S200 ⬜** Create sequence: Automations→Sequences→New → title → draft created. - **S201 ⬜** Sending window: outside window email scheduled to next window start. - **S202 ⬜** Deliverability limits: 12/hour/mailbox, 5 min pause, 200/day/mailbox enforced. - **S203 ⬜** Business days: weekend excluded when enabled; included when disabled. - **S204 ⬜** Unsubscribe link: custom text + preview; link included in outgoing emails. - **S205 ⬜** Subsequent emails: same thread/new thread setting respected. - **S206 ⬜** Sender signature: mailbox signature inserted when enabled. - **S207 ⬜** Exit on reply: inbound reply exits enrollment. - **S208 ⬜** Exit on meeting booked: calendar event with recipient exits enrollment. - **S209 ⬜** Sequence access: default workspace access; can restrict via permissions. - **S210 ⬜** Delegated sending: colleague enrolls; email sends from allowed sender mailbox. - **S211 ⬜** Step 1 scheduling: first email queued immediately or after wait. - **S212 ⬜** Variables: person/company attributes personalize emails. - **S213 ⬜** Template/from scratch: step can use template or raw content. - **S214 ⬜** Add step: follow-up after N days; only if no reply/booking. - **S215 ⬜** Publish: draft becomes live; validation blocks invalid draft. - **S216 ⬜** Enroll one recipient: person record enrolled. - **S217 ⬜** Enroll bulk from People list/view filters. - **S218 ⬜** OOO detect: out-of-office reply does not count as real reply; delay until return if date found. - **S219 ⬜** Pause/resume/manual exit: status and countdown behave correctly. - **S220 ⬜** Outbox: queued sequence emails visible with preview/schedule. - **S221 ⬜** Unsubscribe list: workspace suppress list blocks future enroll with same sender. - **S222 🟡** Metrics: sent/opened/replied/booked displayed; legacy campaign analytics can be referenced but target is sequence metrics. - **S223 ⬜** Warm-up: new mailbox ramp limits start below max and increase over days. - **S224 ⬜** CSV import recipients directly into enroll flow. ## 11.6. Технические решения ### Scheduling algorithm For each enrollment: 1. Find next step. 2. If wait step: - calculate nextSendAt using business days/timezone. 3. If email step: - calculate earliest send time: - after wait; - inside sending window; - after mailbox min gap; - below hourly/daily limit; - respecting warm-up daily cap. 4. Create `SequenceStepRun(status=SCHEDULED)`. 5. Worker picks due runs. ### Worker flow BullMQ `sequenceQueue`: 1. Poll due `SequenceStepRun`. 2. Lock run. 3. Reload enrollment and sequence. 4. Skip if enrollment no longer active. 5. Check exit criteria again. 6. Render template. 7. Create Email queued. 8. Send via `emailQueue`. 9. Mark run sent/failed. 10. Advance enrollment to next step. 11. Schedule next run or complete enrollment. ### Exit criteria Reply received: - inbound email matched by thread/recipient/sender; - OOO classifier returns false for real reply, true for OOO. Meeting booked: - calendar event with recipient after enrollment start; - or booking link click/webhook; - manual mark booked. Unsubscribe: - unsubscribe link creates `UnsubscribeEntry`; - exits enrollment; - blocks future enroll. ### OOO detection MVP deterministic: ```ts function detectOutOfOffice(subject: string, body: string): { isOoo: boolean; returnAt?: Date } { const text = `${subject}\n${body}`.toLowerCase(); const isOoo = text.includes("out of office") || text.includes("ooo") || text.includes("away from") || text.includes("on vacation"); return { isOoo }; } ``` Target: - LLM/email classifier; - parse return date; - set `oooReturnAt`; - reschedule next email to day after return. ### Rate limiting Maintain counters by mailbox: - emails sent in current hour; - emails sent today; - last sent time. Use Redis keys: ```ts type MailboxRateKeys = { hourly: `mailbox:${emailAccountId}:hour:${yyyyMMddHH}`; daily: `mailbox:${emailAccountId}:day:${yyyyMMdd}`; lastSent: `mailbox:${emailAccountId}:lastSentAt`; }; ``` Rules: - hourly count < 12; - daily count < 200 or warmup cap; - now - lastSentAt >= 5 minutes; - inside sending window. ### Versioning When published sequence is edited: - create new `version`; - new enrollments use latest published version; - existing enrollments keep `sequenceVersion` from enrollment time; - steps are versioned by `SequenceStep.version`. ### Demo mode Without SMTP/email account: - sequence can publish; - enroll works; - worker creates demo emails; - marks sent as `SIMULATED_SENT`; - opens/replies can be simulated from dev/demo controls; - OOO demo replies available. ### Suppression Before enroll and before send: 1. Check unsubscribe list by `(orgId, recipientEmail, senderUserId)`. 2. Check bounced/suppressed status. 3. Check duplicate active enrollment. 4. Reject or skip with structured error. ### Tracking - Open pixel updates `Email.openedAt`, `EmailEvent`. - Reply sync updates `Email.repliedAt`, enrollment exit. - Meeting booked event updates enrollment exit. - Metrics are computed from `Email`, `EmailEvent`, `SequenceEnrollment`, `SequenceStepRun`.


---

12. Workflows (автоматизации) — builder, триггеры, логика, действия, интеграции, runs

Статус: ⬜ не начато
Покрываемые сценарии: S230–S247, S255–S276
Источник механики: Academy videos 17–26 описывают workflow-триггеры, condition/delay, calculation, AI, loop/find, HTTP/JSON, integration blocks и общий builder; свод требований подтверждает: триггеры record/list/task/utility/integration, логика Filter/If-else/Switch/Round robin, Delay, Formula/Adjust time/Aggregate/Random, record/list/task/AI/HTTP/Slack blocks, loop/find, runs-лог. 


12.а) Описание функциональности

Workflows — визуальный конструктор автоматизаций в разделе Automations → Workflows. Пользователь видит список workflow, открывает builder и собирает процесс из нод: первый блок всегда trigger, далее логика, действия, вычисления, AI и интеграции.

Основной пользовательский путь:

Пользователь открывает Automations → Workflows.

Видит список workflow:

название;

статус Draft / Live / Paused / Archived;

owner;

last published;

last run;

runs count;

ошибки последнего запуска;

кнопки New workflow, Filter, View settings, Sorted by Last published.

Нажимает New workflow.

Открывается builder:

слева/в центре canvas с dotted grid;

сверху breadcrumbs Workflows / Untitled Workflow;

вкладки Editor, Runs, Settings;

справа inspector/drawer;

снизу zoom/pan controls;

плашка This workflow has not yet been published;

кнопка Publish workflow.

Пользователь выбирает trigger:

Record command;

Record created;

Record updated;

List entry command;

List entry created / record added to list;

List entry updated;

Attribute updated;

Task created;

Manual run;

Recurring schedule;

Webhook received;

Typeform submission;

Outreach event.

После trigger пользователь добавляет шаги:

Logic: Filter / If-else / Switch / Advanced filters / Round robin / Delay / Delay until;

Data actions: Create record / Create-or-update record / Find records / Update record / Delete record;

List actions: Add record to list / Find list entries / Update list entry / Delete list entry;

Task actions: create/update/complete task;

AI: Classify record / Summarize record / Research record / Prompt completion / Classify text;

Calculations: Formula / Adjust time / Aggregate / Random;

Integrations: Slack message / Slack actions / HTTP request / Parse JSON / webhook / enroll in sequence / Mailchimp / Mixmax / Outreach.

Builder показывает переменные из предыдущих блоков:

trigger payload;

current record;

old/new value для updated-триггеров;

found records;

loop current item;

AI output;

HTTP response;

parsed JSON fields;

round robin picked user.

Пользователь публикует workflow.

После публикации workflow запускается автоматически по событиям или вручную.

На вкладке Runs пользователь видит:

список запусков;

статус каждого запуска;

входной payload;

путь по блокам;

время выполнения;

ошибки;

retry;

ручной re-run;

логи каждого step.

Ключевые примеры, которые система обязана поддерживать:

Record command на Companies → Create deal

Пользователь на company record нажимает Run workflow.

Workflow создаёт deal, подставляет company name как deal name, owner = текущий пользователь, associated company = текущая company.

Deal stage updated → Filter Won → Slack

Trigger: Deal updated, attribute = Stage.

Filter: new value = Won.

Action: Slack message в канал sales.

Inbound lead qualification

Trigger: Typeform submission.

Parse JSON.

Create-or-update person по email.

Delay 5 minutes.

If/else: ICP criteria.

Round robin owner.

Create deal.

If ICP true: set ICP=true, stage=Contacted, enroll in sequence.

MRR updated advanced example

Trigger: Workspace MRR updated.

Formula: new MRR − old MRR.

Filter: delta != 0.

Switch:

growth → Slack + HTTP;

contraction → task + adjust time;

cancellation → classify churn reason.

Slack triage actions

Workflow sends Slack message with buttons.

Workflow pauses.

User clicks button.

Workflow resumes along selected branch and updates owner/stage.

12.б) Модель данных

Целевые Prisma-модели:

prisma
enum WorkflowStatus {
  DRAFT
  LIVE
  PAUSED
  ARCHIVED
}

enum WorkflowNodeKind {
  TRIGGER
  LOGIC
  ACTION
  CALCULATION
  AI
  INTEGRATION
  UTILITY
}

enum WorkflowNodeType {
  RECORD_COMMAND
  RECORD_CREATED
  RECORD_UPDATED
  LIST_ENTRY_COMMAND
  LIST_ENTRY_CREATED
  LIST_ENTRY_UPDATED
  RECORD_ADDED_TO_LIST
  ATTRIBUTE_UPDATED
  TASK_CREATED
  MANUAL_RUN
  RECURRING_SCHEDULE
  WEBHOOK_RECEIVED
  TYPEFORM_SUBMISSION
  OUTREACH_EVENT

  FILTER
  IF_ELSE
  SWITCH
  ADVANCED_FILTER
  ROUND_ROBIN
  DELAY
  DELAY_UNTIL

  CREATE_RECORD
  CREATE_OR_UPDATE_RECORD
  FIND_RECORDS
  UPDATE_RECORD
  DELETE_RECORD
  ADD_RECORD_TO_LIST
  FIND_LIST_ENTRIES
  UPDATE_LIST_ENTRY
  DELETE_LIST_ENTRY
  CREATE_TASK
  UPDATE_TASK
  COMPLETE_TASK
  ENROLL_IN_SEQUENCE
  EXIT_FROM_SEQUENCE

  FORMULA
  ADJUST_TIME
  AGGREGATE
  RANDOM_NUMBER

  AI_CLASSIFY_RECORD
  AI_SUMMARIZE_RECORD
  AI_RESEARCH_RECORD
  AI_PROMPT_COMPLETION
  AI_CLASSIFY_TEXT

  SLACK_MESSAGE
  SLACK_ACTIONS
  HTTP_REQUEST
  PARSE_JSON
  WEBHOOK_SEND
  MAILCHIMP_SEQUENCE
  MIXMAX_SEQUENCE
  OUTREACH_SEQUENCE
}

enum WorkflowRunStatus {
  QUEUED
  RUNNING
  WAITING
  WAITING_FOR_EXTERNAL_ACTION
  SUCCEEDED
  FAILED
  CANCELLED
  SKIPPED
}

enum WorkflowStepRunStatus {
  PENDING
  RUNNING
  WAITING
  SUCCEEDED
  FAILED
  SKIPPED
}

model Workflow {
  id            String         @id @default(cuid())
  orgId         String
  org           Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)

  name          String
  description   String?
  status        WorkflowStatus @default(DRAFT)
  version       Int            @default(1)

  createdById   String?
  createdBy     User?          @relation("WorkflowCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedById   String?
  updatedBy     User?          @relation("WorkflowUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  nodes         WorkflowNode[]
  edges         WorkflowEdge[]
  runs          WorkflowRun[]

  publishedAt   DateTime?
  lastRunAt     DateTime?
  archivedAt    DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([orgId])
  @@index([orgId, status])
  @@index([createdById])
  @@map("crm_workflows")
}

model WorkflowNode {
  id            String           @id @default(cuid())
  orgId         String
  workflowId    String
  workflow      Workflow         @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  kind          WorkflowNodeKind
  type          WorkflowNodeType
  name          String
  description   String?
  config        Json
  position      Json
  order         Int              @default(0)

  outgoingEdges WorkflowEdge[]    @relation("WorkflowEdgeFrom")
  incomingEdges WorkflowEdge[]    @relation("WorkflowEdgeTo")
  stepRuns      WorkflowStepRun[]

  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([orgId])
  @@index([workflowId])
  @@index([workflowId, type])
  @@map("crm_workflow_nodes")
}

model WorkflowEdge {
  id            String       @id @default(cuid())
  orgId         String
  workflowId    String
  workflow      Workflow     @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  fromNodeId    String
  fromNode      WorkflowNode @relation("WorkflowEdgeFrom", fields: [fromNodeId], references: [id], onDelete: Cascade)

  toNodeId      String
  toNode        WorkflowNode @relation("WorkflowEdgeTo", fields: [toNodeId], references: [id], onDelete: Cascade)

  label         String?
  conditionKey  String?
  order         Int          @default(0)

  createdAt     DateTime     @default(now())

  @@index([orgId])
  @@index([workflowId])
  @@index([fromNodeId])
  @@index([toNodeId])
  @@map("crm_workflow_edges")
}

model WorkflowRun {
  id            String            @id @default(cuid())
  orgId         String
  workflowId    String
  workflow      Workflow          @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  status        WorkflowRunStatus @default(QUEUED)
  triggerType   WorkflowNodeType
  triggerNodeId String?
  input         Json
  variables     Json?
  errorCode     String?
  errorMessage  String?
  startedAt     DateTime?
  finishedAt    DateTime?
  waitingUntil  DateTime?

  stepRuns      WorkflowStepRun[]

  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([orgId])
  @@index([workflowId, createdAt])
  @@index([status])
  @@index([waitingUntil])
  @@map("crm_workflow_runs")
}

model WorkflowStepRun {
  id            String                @id @default(cuid())
  orgId         String
  runId         String
  run           WorkflowRun            @relation(fields: [runId], references: [id], onDelete: Cascade)

  nodeId        String
  node          WorkflowNode           @relation(fields: [nodeId], references: [id], onDelete: Cascade)

  status        WorkflowStepRunStatus  @default(PENDING)
  input         Json?
  output        Json?
  errorCode     String?
  errorMessage  String?
  startedAt     DateTime?
  finishedAt    DateTime?
  waitingUntil  DateTime?
  attempt       Int                    @default(0)

  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  @@index([orgId])
  @@index([runId])
  @@index([nodeId])
  @@index([status])
  @@map("crm_workflow_step_runs")
}

model WorkflowWebhookEndpoint {
  id            String      @id @default(cuid())
  orgId         String
  workflowId    String
  nodeId         String
  secretHash     String
  urlToken       String      @unique
  isActive       Boolean     @default(true)
  createdAt      DateTime    @default(now())
  revokedAt      DateTime?

  @@index([orgId])
  @@index([workflowId])
  @@map("crm_workflow_webhooks")
}

model WorkflowExternalAction {
  id            String      @id @default(cuid())
  orgId         String
  runId         String
  nodeId         String
  provider      String
  externalId    String?
  payload        Json
  status        String      @default("WAITING")
  selectedAction String?
  createdAt     DateTime    @default(now())
  resolvedAt    DateTime?

  @@index([orgId])
  @@index([runId])
  @@index([provider, externalId])
  @@map("crm_workflow_external_actions")
}

Связи с существующими сущностями:

Workflow.orgId → Organization.id

workflow actions читают и пишут:

Object

Attribute

Record

Value

List

ListEntry

Task

Sequence

Email

Activity

WorkflowRun создаёт Activity для значимых действий:

record updated;

task created;

sequence enrollment;

Slack/HTTP action executed;

workflow failed.

Индексы:

Workflow(orgId, status) — список workflow.

WorkflowNode(workflowId, type) — быстрый поиск trigger/action нод.

WorkflowRun(workflowId, createdAt) — Runs tab.

WorkflowRun(status, waitingUntil) — воркер delay/resume.

WorkflowStepRun(runId) — детализация run.

WorkflowWebhookEndpoint(urlToken) — входящий webhook.

WorkflowExternalAction(provider, externalId) — callback от Slack actions.

12.в) API

Все endpoints требуют JWT, orgId из auth context и RBAC-доступ к workflow.

Список workflow
http
GET /api/workflows?status=LIVE&search=&limit=50&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "wf_1",
      "name": "Enroll invitees in Event sequence and update status",
      "description": "Запускается при добавлении человека в Event Invitees",
      "status": "LIVE",
      "version": 3,
      "createdBy": { "id": "usr_1", "name": "Marisa" },
      "lastRunAt": "2026-06-12T10:00:00.000Z",
      "publishedAt": "2026-06-11T09:00:00.000Z",
      "runsCount": 42,
      "lastRunStatus": "SUCCEEDED"
    }
  ],
  "nextCursor": null
}

Ошибки:

401 UNAUTHORIZED

403 FORBIDDEN

422 VALIDATION_ERROR

Создать workflow
http
POST /api/workflows
Content-Type: application/json

Тело:

JSON
{
  "name": "Untitled Workflow",
  "description": null,
  "templateKey": null
}

Ответ:

JSON
{
  "id": "wf_1",
  "name": "Untitled Workflow",
  "status": "DRAFT",
  "version": 1,
  "nodes": [],
  "edges": []
}

Ошибки:

403 FORBIDDEN — нет права создавать workflow.

409 CONFLICT — имя занято, если включена уникальность на workspace.

422 VALIDATION_ERROR.

Получить workflow
http
GET /api/workflows/:workflowId

Ответ:

JSON
{
  "id": "wf_1",
  "name": "Inbound Lead Qualification",
  "status": "DRAFT",
  "version": 2,
  "nodes": [
    {
      "id": "node_1",
      "kind": "TRIGGER",
      "type": "TYPEFORM_SUBMISSION",
      "name": "Typeform submitted",
      "config": {
        "connectionId": "conn_typeform",
        "formId": "talk-to-sales"
      },
      "position": { "x": 320, "y": 120 }
    }
  ],
  "edges": []
}

Ошибки:

404 NOT_FOUND

403 FORBIDDEN.

Обновить metadata workflow
http
PATCH /api/workflows/:workflowId
Content-Type: application/json

Тело:

JSON
{
  "name": "Inbound Lead Qualification",
  "description": "Создаёт person/deal, классифицирует ICP и enroll в sequence"
}

Ответ:

JSON
{
  "id": "wf_1",
  "name": "Inbound Lead Qualification",
  "description": "Создаёт person/deal, классифицирует ICP и enroll в sequence",
  "status": "DRAFT",
  "updatedAt": "2026-06-12T10:00:00.000Z"
}

Ошибки:

403 FORBIDDEN

404 NOT_FOUND

422 VALIDATION_ERROR.

Добавить node
http
POST /api/workflows/:workflowId/nodes
Content-Type: application/json

Тело:

JSON
{
  "kind": "ACTION",
  "type": "CREATE_RECORD",
  "name": "Create deal",
  "config": {
    "objectKey": "deals",
    "values": {
      "name": "{{trigger.companyName}}",
      "stage": "lead",
      "owner": "{{steps.roundRobin.pickedUserId}}"
    }
  },
  "position": { "x": 320, "y": 360 }
}

Ответ:

JSON
{
  "id": "node_2",
  "kind": "ACTION",
  "type": "CREATE_RECORD",
  "name": "Create deal",
  "config": {},
  "position": { "x": 320, "y": 360 }
}

Ошибки:

400 VALIDATION_ERROR — несовместимый config для node type.

409 CONFLICT — workflow опубликован и редактирование требует draft revision.

403 FORBIDDEN.

Обновить node
http
PATCH /api/workflows/:workflowId/nodes/:nodeId
Content-Type: application/json

Тело:

JSON
{
  "name": "Create deal in Contacted",
  "config": {
    "objectKey": "deals",
    "values": {
      "stage": "contacted",
      "associatedCompany": "{{steps.findCompany.recordId}}"
    }
  },
  "position": { "x": 500, "y": 420 }
}

Ответ:

JSON
{
  "id": "node_2",
  "updatedAt": "2026-06-12T10:00:00.000Z"
}

Ошибки:

404 NOT_FOUND

422 VALIDATION_ERROR

409 CONFLICT.

Удалить node
http
DELETE /api/workflows/:workflowId/nodes/:nodeId

Ответ:

JSON
{
  "ok": true
}

Ошибки:

409 CONFLICT — удаление trigger оставит workflow без trigger.

403 FORBIDDEN.

Создать edge
http
POST /api/workflows/:workflowId/edges
Content-Type: application/json

Тело:

JSON
{
  "fromNodeId": "node_filter",
  "toNodeId": "node_true",
  "label": "True",
  "conditionKey": "true",
  "order": 0
}

Ответ:

JSON
{
  "id": "edge_1",
  "fromNodeId": "node_filter",
  "toNodeId": "node_true",
  "conditionKey": "true"
}

Ошибки:

422 VALIDATION_ERROR — цикл недопустим, кроме loop-container.

409 CONFLICT — duplicate condition edge.

Заменить canvas целиком
http
PUT /api/workflows/:workflowId/graph
Content-Type: application/json

Тело:

JSON
{
  "nodes": [],
  "edges": []
}

Ответ:

JSON
{
  "id": "wf_1",
  "nodesCount": 5,
  "edgesCount": 4,
  "validation": {
    "isValid": true,
    "errors": []
  }
}

Ошибки:

422 VALIDATION_ERROR — нет trigger, несколько trigger, node без обязательных inputs, недостижимые node.

Валидировать workflow перед публикацией
http
POST /api/workflows/:workflowId/validate

Ответ:

JSON
{
  "isValid": false,
  "errors": [
    {
      "nodeId": "node_http",
      "code": "MISSING_URL",
      "message": "HTTP request requires URL"
    }
  ],
  "warnings": [
    {
      "nodeId": "node_slack",
      "code": "MISSING_CONNECTION",
      "message": "Slack connection is not configured"
    }
  ]
}
Publish
http
POST /api/workflows/:workflowId/publish

Ответ:

JSON
{
  "id": "wf_1",
  "status": "LIVE",
  "version": 3,
  "publishedAt": "2026-06-12T10:00:00.000Z"
}

Ошибки:

422 VALIDATION_ERROR — workflow невалиден.

403 FORBIDDEN — нет права publish.

409 CONFLICT — workflow требует explicit permission grant для объектов, которые будет менять.

Pause / resume / archive
http
POST /api/workflows/:workflowId/pause
POST /api/workflows/:workflowId/resume
POST /api/workflows/:workflowId/archive

Ответ:

JSON
{
  "id": "wf_1",
  "status": "PAUSED"
}

Ошибки:

409 CONFLICT — нельзя resume workflow без валидной опубликованной версии.

Запустить command/manual workflow
http
POST /api/workflows/:workflowId/run
Content-Type: application/json

Тело:

JSON
{
  "triggerType": "MANUAL_RUN",
  "recordId": "rec_1",
  "listEntryId": null,
  "payload": {
    "debug": true
  }
}

Ответ:

JSON
{
  "runId": "run_1",
  "status": "QUEUED"
}

Ошибки:

409 CONFLICT — workflow не Live, если запуск не test/debug.

403 FORBIDDEN — нет доступа к записи или workflow.

Webhook receive
http
POST /api/workflows/webhooks/:urlToken
Content-Type: application/json

Тело:

JSON
{
  "event": "booking.created",
  "name": "Lisa Brown",
  "email": "lisa@example.com"
}

Ответ:

JSON
{
  "accepted": true,
  "runId": "run_1"
}

Ошибки:

401 UNAUTHORIZED — invalid signature, если включена подпись.

404 NOT_FOUND

429 RATE_LIMITED.

Runs list
http
GET /api/workflows/:workflowId/runs?status=&limit=50&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "run_1",
      "status": "SUCCEEDED",
      "triggerType": "RECORD_UPDATED",
      "createdAt": "2026-06-12T10:00:00.000Z",
      "startedAt": "2026-06-12T10:00:01.000Z",
      "finishedAt": "2026-06-12T10:00:03.000Z",
      "stepsCount": 5,
      "failedStep": null
    }
  ],
  "nextCursor": null
}
Run detail
http
GET /api/workflow-runs/:runId

Ответ:

JSON
{
  "id": "run_1",
  "status": "FAILED",
  "input": {},
  "variables": {},
  "stepRuns": [
    {
      "id": "step_run_1",
      "nodeId": "node_http",
      "status": "FAILED",
      "input": {},
      "output": null,
      "errorCode": "HTTP_500",
      "errorMessage": "External API returned 500"
    }
  ]
}
Retry run
http
POST /api/workflow-runs/:runId/retry

Тело:

JSON
{
  "fromFailedStep": true
}

Ответ:

JSON
{
  "runId": "run_2",
  "status": "QUEUED"
}
Slack action callback
http
POST /api/integrations/slack/actions
Content-Type: application/json

Тело:

JSON
{
  "externalActionId": "act_1",
  "selectedAction": "triage_to_me",
  "userId": "slack_user_1"
}

Ответ:

JSON
{
  "accepted": true,
  "runId": "run_1",
  "status": "QUEUED"
}
12.г) UI-компоненты

WorkflowsPage — список workflow, фильтры, сортировки, New workflow, карточки быстрых workflow, таблица.

WorkflowListTable — строки workflow, статус Live/Draft/Paused, owner, last published, last run, меню Archive, Duplicate, Delete.

WorkflowBuilderPage — общий экран builder.

WorkflowCanvas — canvas на @dnd-kit, pan/zoom, drag node, drop step, dotted grid.

WorkflowNodeCard — карточка node: icon, type, label, status validation, menu.

WorkflowEdgeLine — визуальные связи между node, branch labels.

TriggerPickerPanel — правая панель выбора trigger; search; группы Records, Lists, Data, Tasks, Utilities, Integrations.

StepPickerPanel — выбор action/logic/calculation/AI/integration step.

WorkflowInspectorPanel — настройка выбранной node.

VariablePicker — вставка переменных из trigger и предыдущих steps, показывает “N blocks ago”.

FilterConditionBuilder — условия по атрибутам, операторы, AND/OR groups.

SwitchBranchEditor — ветки switch + default branch.

RoundRobinConfig — выбор команды/пользователей, стратегия распределения, preview picked variable.

DelayConfig — delay amount/unit, delay until date/time/variable.

FormulaEditor — безопасный expression editor для number/currency/date переменных.

HttpRequestEditor — method, URL, headers, body, variable picker, test request.

ParseJsonEditor — raw JSON sample, path/type/alias mapping.

SlackMessageEditor — workspace/channel/message/buttons.

AiBlockEditor — выбор AI-типа, guidance, output target, credit preview.

WorkflowRunsTab — список runs.

WorkflowRunTimeline — визуальный путь выполнения по node.

WorkflowStepRunDrawer — input/output/error выбранного step.

WorkflowSettingsTab — имя, описание, owner, permissions, archive, danger zone.

WorkflowPublishBar — validation errors/warnings, Publish, Live toggle.

12.д) Acceptance-критерии

S230 ⬜ Создать workflow: пользователь открывает Automations → Workflows → New workflow; видит canvas слева/в центре, правый editor/inspector, вкладки Editor/Runs/Settings; workflow сохраняется как Draft.

S231 ⬜ Trigger: Record created — пользователь выбирает объект; создание записи этого объекта ставит run в очередь; trigger payload содержит recordId и values.

S232 ⬜ Trigger: Record updated — пользователь выбирает объект и атрибут; при изменении атрибута создаётся run; payload содержит oldValue/newValue.

S233 ⬜ Trigger: List created / List updated — workflow запускается при создании списка или изменении list entry/list attribute.

S234 ⬜ Trigger: Record command — на view/record появляется Run workflow; запуск передаёт текущую запись как переменную.

S235 ⬜ Trigger: Task created — создание задачи запускает workflow с task payload.

S236 ⬜ Trigger: Utility — manual/schedule/webhook: manual run работает из editor; recurring schedule создаёт runs по cron; webhook выдаёт URL и принимает POST.

S237 ⬜ Trigger: Integration — Typeform submission / Outreach event запускает workflow; payload нормализуется в переменные.

S238 ⬜ Logic: Filter — workflow продолжает путь только при выполнении условия.

S239 ⬜ Logic: If/else — workflow ветвится на true/false; каждая ветка выполняет свои steps.

S240 ⬜ Logic: Switch — workflow выбирает одну из N веток или default.

S241 ⬜ Logic: Advanced filters — AND/OR + группировка работают в builder и runtime.

S242 ⬜ Logic: Round robin — выбранный пользователь возвращается как переменная и ротируется по команде.

S243 ⬜ Delay — workflow ждёт N минут/часов/дней; run получает статус WAITING; после времени продолжается.

S244 ⬜ Delay until — workflow ждёт до даты/времени из config или variable.

S245 ⬜ Переменные — любой последующий блок может вставить output любого предыдущего блока; UI показывает источник переменной.

S246 ⬜ Холст — пользователь добавляет/удаляет/соединяет блоки, создаёт ветвления; невалидный граф не публикуется.

S247 ⬜ Библиотека шаблонов — пользователь выбирает шаблон workflow по индустрии/задаче; шаблон разворачивается в draft.

S255 ⬜ Action: Create record — workflow создаёт запись объекта с values из переменных.

S256 ⬜ Action: Create-or-update record — workflow ищет по unique attribute; если найдено, обновляет; иначе создаёт.

S257 ⬜ Action: Update record — workflow обновляет значения записи.

S258 ⬜ Action: Find record — workflow ищет запись по критериям и кладёт результат в переменную.

S259 ⬜ Action: Delete record — workflow архивирует запись, создаёт activity.

S260 ⬜ Action: Add record to list — workflow добавляет record в list и заполняет list-level attributes.

S261 ⬜ Action: Task — workflow создаёт/обновляет задачу, assignee и due могут быть переменными.

S262 ⬜ Calculation: Formula — workflow вычисляет выражение над number/currency/date variables.

S263 ⬜ Calculation: Adjust time — workflow создаёт timestamp со сдвигом.

S264 ⬜ Calculation: Aggregate / Random — workflow считает sum/avg/min/max по набору записей или генерирует random number.

S265 ⬜ AI-блок: Classify / Summarize / Research / Prompt — workflow вызывает AI service и возвращает typed output.

S266 ⬜ AI-блок: Classify text — workflow классифицирует произвольный текст в select/multi-select options.

S267 ⬜ Loop/Find — workflow находит до 100 записей и выполняет вложенные блоки для каждой.

S268 ⬜ Integration: Slack — workflow отправляет сообщение в канал с переменными.

S269 ⬜ Integration: Slack actions — workflow отправляет кнопки, ставит run на паузу и продолжает после клика.

S270 ⬜ Integration: HTTP-блок — поддерживаются GET/POST/PUT/PATCH/DELETE/HEAD, headers/body/variables.

S271 ⬜ Integration: Parse JSON — workflow разбирает JSON в typed variables по path.

S272 ⬜ Integration: Mailchimp / Mixmax / Outreach / Webhook — workflow вызывает интеграционный action через connection.

S273 ⬜ Integration: enroll в sequence — workflow enroll recipient в sequence с выбранным sender.

S274 ⬜ Runs-вкладка — прохождение по блокам отображается в реальном времени.

S275 ⬜ Runs retrospective — пользователь видит прошлые runs, ошибки блоков, input/output и retry.

S276 ⬜ Сквозной пример MRR updated работает end-to-end: trigger → formula delta → filter !=0 → switch → Slack/HTTP или task/adjust time или classify churn.

12.е) Технические решения, воркеры BullMQ, edge-cases

Очереди BullMQ:

TypeScript
workflowQueue
workflowDelayQueue
workflowWebhookQueue
workflowIntegrationCallbackQueue
workflowRetryQueue

Сервисы:

TypeScript
workflowService.ts
workflowGraphValidator.ts
workflowRuntime.ts
workflowVariableResolver.ts
workflowConditionEvaluator.ts
workflowActionExecutor.ts
workflowIntegrationService.ts
workflowPermissionService.ts
workflowTemplateService.ts

Алгоритм запуска:

Любой domain event (record.created, record.updated, listEntry.created, task.created, webhook.received) публикуется во внутренний event bus.

workflowTriggerResolver ищет Live workflows с подходящим trigger.

Для каждого workflow создаётся WorkflowRun(status=QUEUED).

workflowQueue получает job { runId }.

Runtime загружает workflow graph, проверяет версию, строит topological execution path.

Выполняет node:

сохраняет WorkflowStepRun;

резолвит variables;

валидирует input;

вызывает executor;

сохраняет output;

выбирает следующий edge.

Если node delay/slack actions/waiting callback:

run становится WAITING;

waitingUntil или WorkflowExternalAction сохраняются;

job завершается без ошибки.

Resume job продолжает run с последней ожидающей node.

При ошибке:

stepRun = FAILED;

run = FAILED;

пишется errorCode/errorMessage;

UI показывает retry.

Edge-cases:

Workflow без trigger: нельзя publish.

Несколько trigger: нельзя publish.

Недостижимые node: warning или validation error.

Циклы: запрещены, кроме контролируемого Loop container.

Loop limit: максимум 100 items; больше — validation warning + hard cap.

Find records: default limit 1, max 100.

Updated trigger: если oldValue == newValue после нормализации, run не создаётся.

Attribute updated fires on create: payload содержит oldValue=null, newValue.

Idempotency: trigger event должен иметь eventId; WorkflowRun не дублируется для (workflowId,eventId).

Permissions: workflow должен иметь automations grant на объект/list, которые меняет. При publish без гранта показывать prompt.

External HTTP: timeout 15s, max response body 256KB, retry только для 429/5xx, secret headers маскируются.

Slack actions: run ждёт callback; кнопки имеют TTL; повторный клик ignored.

AI blocks: перед запуском проверяется кредитный баланс; недостаток кредитов → step failed с INSUFFICIENT_AI_CREDITS.

Formula: запрещён arbitrary JS; использовать safe expression evaluator.

Date/time: все вычисления хранятся UTC, UI показывает workspace timezone.

Versioning: опубликованные runs используют snapshot graph/version, даже если workflow уже отредактирован.

Demo-mode: если Slack/Typeform/HTTP connection отсутствует, integration block может работать в demo simulation mode, но UI явно показывает Demo.

13. Call Intelligence (звонки)

Статус: ⬜ не начато
Покрываемые сценарии: S310–S322
Источник механики: Academy video 12 задаёт recorder для Zoom/Google Meet/Microsoft Teams, Call recording settings, insight templates с секциями prompt/output text или bullets, live transcript, summary/chapters/info/speaker stats, привязку к company/person record, Calls page, filters/favorites, pinned и picture-in-picture playback. 


13.а) Описание функциональности

Call Intelligence — модуль записи, транскрибации, анализа и хранения звонков. В полном целевом продукте recorder автоматически присоединяется к Zoom/Google Meet/Microsoft Teams. В MVP/demo-режиме пользователь загружает transcript вручную или вставляет текст, после чего AI генерирует summary и insights.

Пользовательские пути:

Настройка recorder

Пользователь открывает Settings → Personal → Call recording.

Настраивает:

auto-join all meetings;

auto-join only external meetings;

do not auto-join;

manual recorder;

recorder logo;

meeting providers: Zoom, Google Meet, Microsoft Teams.

После email/calendar sync upcoming meetings получают возможность Start recording.

Запись звонка

Recorder автоматически joins meeting или пользователь нажимает Start recording.

На экране Calls появляется live call.

Во время звонка отображается live transcript.

Пользователь может остановить recording или удалить recorder.

После звонка

Система сохраняет:

transcript;

participants;

recording URL;

summary;

chapters;

meeting info;

speaker stats;

insights по выбранному шаблону.

Call привязывается к People/Company/Deal records по участникам, email domain, calendar event или ручному выбору.

В Activity timeline связанных записей появляется событие CALL_RECORDED.

Insight templates

Пользователь создаёт шаблон:

name;

scope: personal/team/workspace;

sections;

prompt per section;

output format: text/bullets.

Пример sales qualification:

Current tool;

Needed features;

Budget;

Timeline;

Objections;

Next steps.

Один и тот же call можно пересчитать другим template и получить другой ракурс.

Calls page

Пользователь открывает Calls.

Видит все звонки workspace:

title;

date/time;

duration;

participants;

associated records;

owner;

favorite;

summary status.

Фильтрует:

my calls;

team calls;

participant;

associated company/person/deal;

favorite;

date range;

has objections;

has buying signals.

Открывает call detail.

Playback

Call detail показывает video/audio, transcript, insights, chapters.

Pinned mode: мини-плеер и transcript остаются закреплёнными при навигации внутри CRM.

Picture-in-picture: видео поверх других окон.

Demo-mode

Пользователь нажимает Upload transcript.

Вставляет transcript или загружает .txt/.vtt/.srt.

Выбирает related records.

Выбирает insight template.

Система через demo-AI генерирует summary/chapters/speaker stats.

Calls tab record-страницы показывает результат.

13.б) Модель данных
prisma
enum CallProvider {
  ZOOM
  GOOGLE_MEET
  MICROSOFT_TEAMS
  MANUAL_UPLOAD
  DEMO
}

enum CallStatus {
  SCHEDULED
  RECORDING
  PROCESSING
  READY
  FAILED
  DELETED
}

enum CallParticipantRole {
  HOST
  INTERNAL
  EXTERNAL
  RECORDER
  UNKNOWN
}

enum InsightTemplateScope {
  PERSONAL
  TEAM
  WORKSPACE
}

enum InsightOutputFormat {
  TEXT
  BULLETS
}

model Call {
  id            String       @id @default(cuid())
  orgId         String
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  title         String
  provider      CallProvider
  providerCallId String?
  status        CallStatus    @default(PROCESSING)

  startedAt     DateTime?
  endedAt       DateTime?
  durationSec   Int?
  timezone      String?

  recordingUrl  String?
  transcriptText String?      @db.Text
  transcriptJson Json?
  summary       String?       @db.Text
  chapters      Json?
  speakerStats  Json?
  meetingInfo   Json?
  language      String?

  ownerId       String?
  owner         User?         @relation("CallOwner", fields: [ownerId], references: [id], onDelete: SetNull)

  participants  CallParticipant[]
  recordLinks   CallRecordLink[]
  insightRuns   CallInsightRun[]

  isFavorite    Boolean      @default(false)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  archivedAt    DateTime?

  @@index([orgId])
  @@index([orgId, status])
  @@index([ownerId])
  @@index([startedAt])
  @@map("crm_calls")
}

model CallParticipant {
  id            String              @id @default(cuid())
  orgId         String
  callId        String
  call          Call                @relation(fields: [callId], references: [id], onDelete: Cascade)

  name          String?
  email         String?
  role          CallParticipantRole @default(UNKNOWN)
  userId        String?
  recordId      String?

  talkTimeSec   Int?
  speakerLabel  String?

  createdAt     DateTime            @default(now())

  @@index([orgId])
  @@index([callId])
  @@index([email])
  @@index([recordId])
  @@map("crm_call_participants")
}

model CallRecordLink {
  id            String      @id @default(cuid())
  orgId         String
  callId        String
  call          Call        @relation(fields: [callId], references: [id], onDelete: Cascade)

  recordId      String
  record        Record      @relation(fields: [recordId], references: [id], onDelete: Cascade)

  linkType      String      @default("AUTO")
  createdAt     DateTime    @default(now())

  @@unique([callId, recordId])
  @@index([orgId])
  @@index([recordId])
  @@map("crm_call_record_links")
}

model InsightTemplate {
  id            String               @id @default(cuid())
  orgId         String

  name          String
  description   String?
  scope         InsightTemplateScope  @default(WORKSPACE)
  createdById   String?
  isDefault     Boolean              @default(false)
  sections      InsightTemplateSection[]

  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  archivedAt    DateTime?

  @@index([orgId])
  @@index([scope])
  @@map("crm_insight_templates")
}

model InsightTemplateSection {
  id            String              @id @default(cuid())
  orgId         String
  templateId    String
  template      InsightTemplate     @relation(fields: [templateId], references: [id], onDelete: Cascade)

  name          String
  prompt        String              @db.Text
  outputFormat  InsightOutputFormat @default(TEXT)
  order         Int                 @default(0)

  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@index([templateId])
  @@map("crm_insight_template_sections")
}

model CallInsightRun {
  id            String       @id @default(cuid())
  orgId         String
  callId        String
  call          Call         @relation(fields: [callId], references: [id], onDelete: Cascade)

  templateId    String?
  status        String       @default("QUEUED")
  output        Json?
  errorCode     String?
  errorMessage  String?
  creditsUsed   Int          @default(0)

  createdById   String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([orgId])
  @@index([callId])
  @@index([templateId])
  @@map("crm_call_insight_runs")
}

model CallRecordingSettings {
  id            String      @id @default(cuid())
  orgId         String
  userId        String

  autoJoinMode  String      @default("EXTERNAL_ONLY")
  providers     Json?
  recorderName  String?
  recorderLogoUrl String?
  language      String?
  isEnabled     Boolean     @default(false)

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([orgId, userId])
  @@index([orgId])
  @@map("crm_call_recording_settings")
}

Связи:

CallRecordLink.recordId → Record.id

CallParticipant.recordId → Record.id, если participant сматчен к person record.

CallInsightRun списывает AI credits через CreditTransaction.

Call создаёт Activity(type=CALL_RECORDED) для всех linked records.

Индексы:

Call(orgId, startedAt) — Calls page.

Call(orgId, status) — processing queue.

CallParticipant(email) — auto-link.

CallRecordLink(recordId) — Calls tab record page.

CallInsightRun(callId, templateId) — переключение шаблонов.

13.в) API
Получить настройки recorder
http
GET /api/calls/settings

Ответ:

JSON
{
  "autoJoinMode": "EXTERNAL_ONLY",
  "providers": ["ZOOM", "GOOGLE_MEET"],
  "recorderName": "AISDR Recorder",
  "recorderLogoUrl": null,
  "isEnabled": true
}
Обновить настройки recorder
http
PATCH /api/calls/settings
Content-Type: application/json

Тело:

JSON
{
  "autoJoinMode": "ALL_EXTERNAL",
  "providers": ["ZOOM", "GOOGLE_MEET", "MICROSOFT_TEAMS"],
  "recorderName": "Basepoint Recorder",
  "recorderLogoUrl": "https://cdn.example.com/logo.png",
  "isEnabled": true
}

Ответ:

JSON
{
  "ok": true
}

Ошибки:

403 FORBIDDEN

422 VALIDATION_ERROR

Список звонков
http
GET /api/calls?mine=true&favorite=&recordId=&participant=&from=&to=&limit=50&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "call_1",
      "title": "Basepoint <> Cosme discovery",
      "provider": "GOOGLE_MEET",
      "status": "READY",
      "startedAt": "2026-06-12T09:00:00.000Z",
      "durationSec": 1800,
      "participants": [
        { "name": "Lisa Brown", "email": "lisa@cosme.com", "role": "EXTERNAL" }
      ],
      "associatedRecords": [
        { "id": "rec_company", "displayName": "Cosme", "objectKey": "companies" }
      ],
      "isFavorite": false,
      "summary": "Обсудили требования, бюджет и timeline."
    }
  ],
  "nextCursor": null
}
Создать demo-call из transcript
http
POST /api/calls/demo-upload
Content-Type: application/json

Тело:

JSON
{
  "title": "Discovery call with Cosme",
  "transcriptText": "Speaker 1: ...",
  "recordIds": ["rec_company", "rec_person"],
  "participantEmails": ["lisa@cosme.com"],
  "templateId": "tpl_sales_qualification"
}

Ответ:

JSON
{
  "callId": "call_1",
  "status": "PROCESSING",
  "insightRunId": "insight_run_1"
}

Ошибки:

422 VALIDATION_ERROR — transcript слишком короткий или пустой.

404 NOT_FOUND — record/template не найден.

402 PAYMENT_REQUIRED — не хватает AI credits, если не demo-mode.

Получить call detail
http
GET /api/calls/:callId

Ответ:

JSON
{
  "id": "call_1",
  "title": "Discovery call with Cosme",
  "status": "READY",
  "transcriptText": "...",
  "summary": "...",
  "chapters": [
    { "title": "Pricing discussion", "startSec": 420, "endSec": 610 }
  ],
  "speakerStats": {
    "Speaker 1": { "talkTimeSec": 820 },
    "Speaker 2": { "talkTimeSec": 980 }
  },
  "participants": [],
  "associatedRecords": [],
  "insights": []
}
Связать call с record
http
POST /api/calls/:callId/records
Content-Type: application/json

Тело:

JSON
{
  "recordId": "rec_1",
  "linkType": "MANUAL"
}

Ответ:

JSON
{
  "id": "link_1",
  "callId": "call_1",
  "recordId": "rec_1"
}
Удалить связь
http
DELETE /api/calls/:callId/records/:recordId

Ответ:

JSON
{
  "ok": true
}
Calls tab записи
http
GET /api/records/:recordId/calls?limit=50&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "call_1",
      "title": "Discovery call",
      "startedAt": "2026-06-12T09:00:00.000Z",
      "summary": "..."
    }
  ]
}
Insight templates list
http
GET /api/call-insight-templates?scope=

Ответ:

JSON
{
  "items": [
    {
      "id": "tpl_1",
      "name": "Sales qualification",
      "scope": "WORKSPACE",
      "sections": [
        {
          "id": "sec_1",
          "name": "Budget",
          "prompt": "Extract budget signals",
          "outputFormat": "BULLETS"
        }
      ]
    }
  ]
}
Создать insight template
http
POST /api/call-insight-templates
Content-Type: application/json

Тело:

JSON
{
  "name": "Sales qualification",
  "scope": "WORKSPACE",
  "sections": [
    {
      "name": "Current tool",
      "prompt": "Какой инструмент клиент использует сейчас?",
      "outputFormat": "TEXT",
      "order": 0
    },
    {
      "name": "Needed features",
      "prompt": "Какие функции нужны клиенту?",
      "outputFormat": "BULLETS",
      "order": 1
    }
  ]
}

Ответ:

JSON
{
  "id": "tpl_1",
  "name": "Sales qualification"
}
Применить template к call
http
POST /api/calls/:callId/insights
Content-Type: application/json

Тело:

JSON
{
  "templateId": "tpl_1"
}

Ответ:

JSON
{
  "insightRunId": "run_1",
  "status": "QUEUED"
}
Favorite
http
POST /api/calls/:callId/favorite
DELETE /api/calls/:callId/favorite

Ответ:

JSON
{
  "isFavorite": true
}
Удалить/архивировать call
http
DELETE /api/calls/:callId

Ответ:

JSON
{
  "ok": true,
  "status": "DELETED"
}
13.г) UI-компоненты

CallsPage — список всех звонков, фильтры, поиск, upload transcript.

CallsTable — строки звонков с title/date/participants/records/favorite/status.

CallFiltersBar — mine/team/date/participant/record/favorite/status.

CallDetailPage — playback, transcript, summary, insights.

CallPlayer — audio/video player, chapters timeline.

TranscriptViewer — transcript with speakers, timestamps, search, highlighted snippets.

CallInsightsPanel — output по выбранному insight template.

InsightTemplateSelector — выбор шаблона и запуск пересчёта.

InsightTemplateBuilder — sections, prompts, output format text/bullets.

SpeakerStatsPanel — talk time, speaker ratio.

CallRecordLinksPanel — связанные records, add/remove.

UploadTranscriptModal — demo upload transcript, participant emails, related records, template.

CallRecordingSettingsPage — auto-join mode, providers, logo, recorder settings.

PinnedCallPlayer — закреплённый player внутри app shell.

PictureInPictureButton — запуск browser PiP для video.

RecordCallsTab — calls на record page.

13.д) Acceptance-критерии

S310 ⬜ Рекордер авто-джойнит Zoom / Google Meet / MS Teams: после включения auto-join upcoming meeting получает recorder; call создаётся в статусе RECORDING.

S311 ⬜ Account Settings → Call recording: пользователь настраивает auto-join, provider, manual recorder, logo.

S312 ⬜ Ручной recorder: пользователь нажимает Start Recording на meeting/call page; создаётся call в статусе RECORDING.

S313 ⬜ Insight-шаблон: пользователь создаёт template с секциями prompt/output text или bullets.

S314 ⬜ Неограниченно секций; personal/team/workspace templates сохраняются и фильтруются по scope.

S315 ⬜ Любой template применяется к любому call; переключение template показывает другой insight output.

S316 ⬜ Live transcript отображается во время звонка.

S317 ⬜ После звонка система показывает summary, meeting chapters, meeting info, speaker stats.

S318 ⬜ Call привязывается к company/person record и появляется в activity timeline.

S319 ⬜ Calls page показывает все звонки workspace, фильтр по участникам/записям/favorites работает.

S320 ⬜ Playback pinned mode сохраняет player при навигации по CRM.

S321 ⬜ Picture-in-picture открывает видео поверх других окон.

S322 ⬜ Demo: upload transcript → AI summary по template → call связан с record и отображается в Calls tab.

13.е) Технические решения, воркеры BullMQ, edge-cases

Очереди:

TypeScript
callProcessingQueue
callTranscriptQueue
callInsightQueue
callLinkingQueue

Сервисы:

TypeScript
callService.ts
callRecorderService.ts
callTranscriptService.ts
callInsightService.ts
callRecordLinker.ts
callSettingsService.ts

Алгоритм demo-processing:

POST /api/calls/demo-upload создаёт Call(status=PROCESSING).

Сохраняет transcript.

Создаёт CallInsightRun(status=QUEUED).

callInsightQueue запускает AI summary:

если ANTHROPIC_API_KEY есть — provider Anthropic;

иначе deterministic demo-AI.

Генерирует:

summary;

chapters;

speakerStats;

insight sections.

callLinkingQueue связывает call с records:

по явно переданным recordIds;

по participant emails → People.Email;

по domain → Companies.Domains;

по deal participants.

Создаёт Activity(type=CALL_RECORDED) на linked records.

Edge-cases:

Transcript слишком короткий: возвращать validation error.

Нет AI credits: в реальном AI mode insight не запускается; в demo-mode не блокировать.

Дубликат call: dedupe по (orgId, provider, providerCallId).

Participant email private: respect email sharing/privacy settings.

Несколько matching people: linking status = NEEDS_REVIEW; UI предлагает выбрать.

Long transcript: chunking + map-reduce summary.

Multiple languages: хранить language; demo поддерживает ru/en.

Recorder removed: call status = PROCESSING/READY с partial transcript.

Pinned playback: состояние player хранится в frontend global store, не в БД.

PiP unsupported: скрыть кнопку или показать graceful fallback.

Deletion: soft-delete call; record activity остаётся, но ссылка показывает deleted state.

14. Reports & Dashboards

Статус: ⬜ не начато
Покрываемые сценарии: S285–S297
Источник механики: Academy reports videos описывают 5 типов отчётов: Insight, Historical values, Funnel, Time in stage, Stage changed; Insight поддерживает metric/group by/segment by/filter, Historical строит snapshots во времени, pipeline reports работают по status attributes; отчёты группируются в dashboards. 


14.а) Описание функциональности

Reports & Dashboards — аналитический слой поверх универсальной CRM-модели Object/Record/Value/List. Пользователь строит отчёты по любым объектам и спискам, сохраняет их в dashboards и проваливается из графика в исходные записи.

Пользовательские пути:

Reports list

Пользователь открывает Reports.

Видит:

Favorites;

список dashboards;

columns: Dashboard, Reports, Created at, Owner;

New dashboard;

New report;

View settings;

search/sort/filter.

Dashboard

Пользователь открывает dashboard, например Revenue Dashboard.

Видит сетку widgets:

KPI;

bar chart;

line chart;

funnel;

pie;

map;

table.

Может:

добавить report;

resize/reorder widget;

открыть report;

share dashboard;

drill-in из widget в records.

New report builder

Пользователь нажимает New report.

Правая панель спрашивает: What do you want to report on?

Доступные типы:

Insight;

Historical values;

Funnel;

Time in stage;

Stage changed.

Insight report

Real-time состояние данных.

Пользователь выбирает:

source: object/list;

metric: count/sum/avg/min/max по attribute;

group by;

segment by;

filters;

visualization.

Примеры:

open pipeline by deal stage and owner;

new signups weekly;

churn reason count;

total ARR KPI.

Historical values

Анализ того, как состав данных менялся во времени.

X-axis = time period snapshots.

Нельзя подменять X custom date attribute; это именно historical state.

Примеры:

active deals by stage at end of each week;

total customers over time;

ARR from paid invoices over time.

Funnel

Работает по status/stage attribute.

Показывает conversion/loss по стадиям.

Time in stage

Показывает min/avg/max/median время, проведённое record в каждой стадии.

Stage changed

Показывает number/value записей, перешедших в конкретные стадии за период.

Метрика: count records или sum currency attribute, например Deal value.

Drill-in

Пользователь кликает на bar/funnel segment.

Открывается drawer/table с записями, которые составляют это значение.

Можно перейти в record page или сохранить как view/list.

14.б) Модель данных
prisma
enum ReportType {
  INSIGHT
  HISTORICAL
  FUNNEL
  TIME_IN_STAGE
  STAGE_CHANGED
}

enum ReportVisualization {
  SINGLE_VALUE
  TABLE
  BAR
  STACKED_BAR
  LINE
  AREA
  FUNNEL
  PIE
  MAP
}

enum ReportMetricAggregation {
  COUNT
  SUM
  AVG
  MIN
  MAX
  MEDIAN
}

model Dashboard {
  id            String       @id @default(cuid())
  orgId         String
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  name          String
  description   String?
  createdById   String?
  isFavorite    Boolean      @default(false)
  layout        Json?

  widgets       DashboardWidget[]

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  archivedAt    DateTime?

  @@index([orgId])
  @@index([createdById])
  @@map("crm_dashboards")
}

model DashboardWidget {
  id            String       @id @default(cuid())
  orgId         String
  dashboardId   String
  dashboard     Dashboard    @relation(fields: [dashboardId], references: [id], onDelete: Cascade)

  reportId      String?
  report        Report?      @relation(fields: [reportId], references: [id], onDelete: SetNull)

  title         String?
  position      Json
  size          Json
  config        Json?

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([orgId])
  @@index([dashboardId])
  @@index([reportId])
  @@map("crm_dashboard_widgets")
}

model Report {
  id            String              @id @default(cuid())
  orgId         String
  org           Organization        @relation(fields: [orgId], references: [id], onDelete: Cascade)

  dashboardWidgets DashboardWidget[]

  name          String
  description   String?
  type          ReportType
  visualization ReportVisualization

  sourceObjectId String?
  sourceObject   Object?            @relation(fields: [sourceObjectId], references: [id], onDelete: SetNull)
  sourceListId   String?
  sourceList     List?              @relation(fields: [sourceListId], references: [id], onDelete: SetNull)

  metricConfig  Json
  dimensionConfig Json?
  filterConfig  Json?
  visualizationConfig Json?
  hiddenSeries  Json?

  createdById   String?
  isTemplate    Boolean             @default(false)

  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  archivedAt    DateTime?

  @@index([orgId])
  @@index([sourceObjectId])
  @@index([sourceListId])
  @@index([type])
  @@map("crm_reports")
}

model ReportQueryCache {
  id            String       @id @default(cuid())
  orgId         String
  reportId      String
  cacheKey      String
  result        Json
  expiresAt     DateTime
  createdAt     DateTime     @default(now())

  @@unique([reportId, cacheKey])
  @@index([orgId])
  @@index([expiresAt])
  @@map("crm_report_query_cache")
}

model ValueChangeEvent {
  id            String       @id @default(cuid())
  orgId         String
  recordId      String
  record        Record       @relation(fields: [recordId], references: [id], onDelete: Cascade)

  attributeId   String
  attribute     Attribute    @relation(fields: [attributeId], references: [id], onDelete: Cascade)

  oldValue      Json?
  newValue      Json?
  changedById   String?
  changedAt     DateTime     @default(now())

  @@index([orgId])
  @@index([recordId])
  @@index([attributeId, changedAt])
  @@map("crm_value_change_events")
}

model ReportSnapshot {
  id            String       @id @default(cuid())
  orgId         String
  objectId      String?
  listId        String?
  attributeId   String?
  snapshotAt    DateTime
  grain         String
  data          Json

  createdAt     DateTime     @default(now())

  @@index([orgId])
  @@index([objectId, snapshotAt])
  @@index([listId, snapshotAt])
  @@map("crm_report_snapshots")
}

Существующие модели, используемые reports:

Object

Attribute

AttributeOption

Record

Value

ViewFilter

List

ListEntry

Activity

Email

Call

SequenceEnrollment

Индексы:

Report(orgId, type) — список отчётов.

Report(sourceObjectId) и Report(sourceListId) — отчёты по source.

ValueChangeEvent(attributeId, changedAt) — historical/stage/time-in-stage.

ReportSnapshot(objectId, snapshotAt) — historical snapshots.

typed indexes на Value(attributeId, numberValue/dateValue/textValue) обязательны для performance.

14.в) API
Dashboards list
http
GET /api/dashboards?search=&favorite=&limit=50&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "dash_1",
      "name": "Revenue Dashboard",
      "reportsCount": 8,
      "createdAt": "2026-06-12T10:00:00.000Z",
      "isFavorite": true
    }
  ],
  "nextCursor": null
}
Создать dashboard
http
POST /api/dashboards
Content-Type: application/json

Тело:

JSON
{
  "name": "Revenue Dashboard",
  "description": "Pipeline, ARR, inbound volume"
}

Ответ:

JSON
{
  "id": "dash_1",
  "name": "Revenue Dashboard"
}
Dashboard detail
http
GET /api/dashboards/:dashboardId

Ответ:

JSON
{
  "id": "dash_1",
  "name": "Revenue Dashboard",
  "widgets": [
    {
      "id": "widget_1",
      "reportId": "report_1",
      "title": "Total ARR",
      "position": { "x": 0, "y": 0 },
      "size": { "w": 4, "h": 2 }
    }
  ]
}
Update dashboard layout
http
PUT /api/dashboards/:dashboardId/widgets
Content-Type: application/json

Тело:

JSON
{
  "widgets": [
    {
      "id": "widget_1",
      "reportId": "report_1",
      "position": { "x": 0, "y": 0 },
      "size": { "w": 4, "h": 2 }
    }
  ]
}

Ответ:

JSON
{
  "ok": true
}
Reports list
http
GET /api/reports?dashboardId=&type=&sourceObjectId=&limit=50&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "report_1",
      "name": "Open pipeline by stage",
      "type": "INSIGHT",
      "visualization": "STACKED_BAR"
    }
  ]
}
Создать report
http
POST /api/reports
Content-Type: application/json

Тело:

JSON
{
  "name": "Open pipeline by stage",
  "type": "INSIGHT",
  "visualization": "STACKED_BAR",
  "sourceObjectId": "obj_deals",
  "metricConfig": {
    "aggregation": "SUM",
    "attributeId": "attr_deal_value"
  },
  "dimensionConfig": {
    "groupByAttributeId": "attr_stage",
    "segmentByAttributeId": "attr_owner"
  },
  "filterConfig": {
    "conditions": [
      {
        "attributeId": "attr_stage",
        "operator": "not_in",
        "value": ["closed_won", "closed_lost"]
      }
    ]
  }
}

Ответ:

JSON
{
  "id": "report_1",
  "name": "Open pipeline by stage"
}

Ошибки:

422 VALIDATION_ERROR — type требует status attribute, metric incompatible.

403 FORBIDDEN.

Получить report
http
GET /api/reports/:reportId

Ответ:

JSON
{
  "id": "report_1",
  "name": "Open pipeline by stage",
  "type": "INSIGHT",
  "visualization": "STACKED_BAR",
  "metricConfig": {},
  "dimensionConfig": {},
  "filterConfig": {}
}
Обновить report
http
PATCH /api/reports/:reportId
Content-Type: application/json

Тело:

JSON
{
  "name": "US open pipeline",
  "filterConfig": {
    "conditions": [
      { "attributeId": "attr_team", "operator": "eq", "value": "us" }
    ]
  }
}

Ответ:

JSON
{
  "id": "report_1",
  "updatedAt": "2026-06-12T10:00:00.000Z"
}
Query report
http
POST /api/reports/:reportId/query
Content-Type: application/json

Тело:

JSON
{
  "timezone": "Europe/Vienna",
  "dateRange": {
    "from": "2026-01-01",
    "to": "2026-06-12"
  },
  "useCache": true
}

Ответ:

JSON
{
  "reportId": "report_1",
  "type": "INSIGHT",
  "visualization": "STACKED_BAR",
  "data": {
    "series": [
      {
        "name": "Marisa",
        "points": [
          { "x": "Lead", "y": 120000 }
        ]
      }
    ],
    "total": 120000
  },
  "drilldownToken": "drill_abc"
}

Ошибки:

422 VALIDATION_ERROR

504 QUERY_TIMEOUT

403 FORBIDDEN.

Drill-in
http
POST /api/reports/:reportId/drilldown
Content-Type: application/json

Тело:

JSON
{
  "bucket": {
    "group": "Lead",
    "segment": "Marisa"
  },
  "dateRange": {
    "from": "2026-01-01",
    "to": "2026-06-12"
  },
  "limit": 50,
  "cursor": null
}

Ответ:

JSON
{
  "items": [
    {
      "id": "rec_1",
      "displayName": "Cosme Expansion",
      "objectKey": "deals",
      "values": {
        "stage": "Lead",
        "owner": "Marisa",
        "dealValue": 120000
      }
    }
  ],
  "nextCursor": null
}
Add report to dashboard
http
POST /api/dashboards/:dashboardId/widgets
Content-Type: application/json

Тело:

JSON
{
  "reportId": "report_1",
  "title": "Open pipeline",
  "position": { "x": 0, "y": 0 },
  "size": { "w": 6, "h": 4 }
}

Ответ:

JSON
{
  "id": "widget_1"
}
Delete report/dashboard
http
DELETE /api/reports/:reportId
DELETE /api/dashboards/:dashboardId

Ответ:

JSON
{
  "ok": true
}
14.г) UI-компоненты

ReportsPage — список dashboards, favorites, search, new dashboard/report.

DashboardPage — grid dashboard, widgets, share, edit layout.

DashboardGrid — responsive layout widgets.

ReportWidget — оболочка графика/KPI/table.

ReportBuilderDrawer — выбор типа report и настройка source/metric/dimensions.

ReportTypePicker — Insight, Historical, Funnel, Time in stage, Stage changed.

ReportSourcePicker — object/list.

MetricBuilder — count/sum/avg/min/max/median и выбор attribute.

DimensionBuilder — group by / segment by / X-axis / cadence.

ReportFilterBuilder — фильтры по любым attributes, включая AI attributes.

VisualizationPicker — bar/line/table/funnel/pie/map/single value.

HiddenSeriesControl — скрыть stage/series, например Closed Won/Lost.

ChartRenderer — recharts wrapper.

FunnelChart — funnel visualization.

MapChart — гео-агрегация по country/location.

DrilldownDrawer — записи, составляющие выбранный bucket.

DashboardShareModal — права dashboard.

ReportEmptyState — Input needed to display chart.

14.д) Acceptance-критерии

S285 ⬜ Создать отчёт Insight: пользователь выбирает Insight, source object/list, metric, group by; report сохраняется и строит chart.

S286 ⬜ Тип Historical: пользователь выбирает source, metric, interval; график показывает historical snapshots.

S287 ⬜ Тип Funnel: пользователь выбирает status/stage attribute; отчёт показывает conversion по стадиям.

S288 ⬜ Тип Time in stage: отчёт показывает время в каждой стадии по выбранному status attribute.

S289 ⬜ Тип Stage change: отчёт показывает переходы между стадиями за период.

S290 ⬜ Group by: пользователь группирует Insight по attribute rows/X-axis.

S291 ⬜ Segment by: пользователь добавляет segment attribute; chart становится stacked/series.

S292 ⬜ Filter отчёта: фильтры применяются по любым attributes, включая AI attributes.

S293 ⬜ Источник: пользователь выбирает object или list; query работает в обоих случаях.

S294 ⬜ Визуализация: bar/line/table/funnel доступны и соответствуют типу report.

S295 ⬜ Pipeline-отчёт по status attribute: сумма ARR/deal value по стадиям считается корректно.

S296 🟡 Dashboard: пользователь размещает несколько widgets; legacy recharts не считается полным паритетом, нужен Attio-like builder/grid.

S297 ⬜ Drill-in: клик по chart segment открывает records, составляющие метрику.

14.е) Технические решения, воркеры BullMQ, edge-cases

Очереди:

TypeScript
analyticsQueue
reportSnapshotQueue
reportCacheQueue

Сервисы:

TypeScript
reportService.ts
reportQueryBuilder.ts
reportMetricService.ts
historicalSnapshotService.ts
stageDurationService.ts
dashboardService.ts
drilldownService.ts

Алгоритм Insight query:

Загрузить report config.

Проверить RBAC на source object/list.

Построить base record scope:

orgId;

object/list;

non-archived.

Применить report filters.

Join Value по metric/group/segment attributes.

Выполнить aggregation.

Сформировать series/points/total.

Сохранить cache на короткий TTL.

Алгоритм Historical:

Использовать ReportSnapshot, если snapshot существует.

Если snapshot отсутствует:

для MVP строить по ValueChangeEvent;

для будущего — nightly snapshot.

На каждую точку периода брать состояние на конец периода.

Строить series по segment.

Алгоритм Funnel:

Требует Attribute.type=STATUS/SELECT.

Берёт упорядоченные options.

Считает count entering each stage и conversion to target stage.

Исключает archived/lost по config.

Алгоритм Time in stage:

Использует ValueChangeEvent для stage attribute.

Для каждого record считает интервалы между stage changes.

Для текущей стадии end = now.

Агрегирует min/avg/max/median.

Алгоритм Stage changed:

Фильтрует ValueChangeEvent(attributeId=stage, changedAt in range).

Группирует по newValue или oldValue→newValue.

Metric:

count records;

sum currency attribute на момент изменения или current value, по config.

Edge-cases:

Отчёт по AI attribute: если значение отсутствует, bucket Empty; можно trigger AI fill отдельно.

Deleted/archived records: default exclude; option include archived для audit reports.

Currency: суммы приводятся к currency report config; если FX нет, показывать mixed currency warning.

Historical без history: показывать insufficient data и предложить включить tracking.

Large data: query timeout 15s, pagination/drilldown, cache.

List source: учитывать только current list entries, если report не historical; historical list membership требует отдельной истории list entry events.

Timezone: date buckets строить по workspace/user timezone.

Permissions: dashboard permissions применяются к dashboard, но record-level drilldown дополнительно фильтруется по object/list permissions.

Map chart: требует location/country attribute; иначе validation error.

Metric incompatible: sum/avg только number/currency.

Stage reports: разрешены только status/select attributes with ordered options.

15. AI-слой (AI-SDR) и кредиты

Статус: ⬜ не начато
Покрываемые сценарии: S180–S190, S170–S173, S376–S378
Источник механики: Ask Attio — чат-ассистент, доступный с homepage/sidebar/topbar, умеющий искать по calls/notes/emails, делать web research, предлагать updates, создавать tasks и draft follow-up emails; AI-атрибуты/блоки включают Classify/Summarize/Research/Prompt, Research стоит 10 credits, остальные 1, баланс и разбивка находятся в Billing. 


15.а) Описание функциональности

AI-слой AISDR — общий AI foundation для CRM. Он обслуживает:

Ask Attio-like ассистента;

AI attributes;

AI blocks в Workflows;

Call insights;

email draft generation;

enrichment/research;

credit accounting;

prompt library;

demo-AI fallback.

Главные принципы:

AI встроен в CRM-модель

AI не отдельный чат “сбоку”.

AI outputs сохраняются как обычные CRM values, notes, tasks, emails, insights.

AI results используются в filters, views, reports, workflows.

Human-in-the-loop

AI может предложить обновления записи, задачу или email.

Запись в БД происходит только после review/confirm пользователя, кроме явно автоматических workflow/AI attribute runs.

Demo-first

Без ANTHROPIC_API_KEY система работает детерминированно:

генерирует осмысленные summaries;

классифицирует ICP/churn;

создаёт draft email;

возвращает research stub на основе данных записи.

Credit-aware

Research agent = 10 credits.

Classify/Summarize/Prompt = 1 credit.

Call insight может стоить configurable credits, default 1 за template run в MVP или по секциям позже.

Billing показывает balance, usage history, breakdown.

Пользовательские пути Ask Attio:

Homepage

Пользователь видит greeting: Good afternoon, <name>.

Поле Ask anything….

Recent chat.

Meetings.

Tasks.

Quick prompt chips:

Prep for next meeting;

Recap last call;

Draft follow up;

Recent objections.

Prep for my day

Пользователь спрашивает: help me prep for my day.

AI собирает:

upcoming meetings;

deals needing attention;

overdue tasks;

recent calls/notes/emails;

suggested next actions.

Recent objections

AI ищет по calls/notes/emails.

Возвращает grouped objections с цитатами/snippets и ссылками на источники.

Saved prompts

Пользователь открывает Account Settings → Prompts.

Создаёт prompt:

name;

body;

optional variables/context scope.

Prompt доступен в Ask Attio.

Web/company research

Пользователь спрашивает о company/market.

AI использует record context и web research provider, если включён.

В demo-mode возвращает synthetic research из record values.

During call

Пользователь спрашивает: have we spoken to anyone at this company about pricing?

AI ищет по transcript/email/note snippets.

Возвращает who/when/what.

After call actions

suggest updates based on call → AI предлагает patch values; user reviews; backend applies.

create a task to follow up next week → AI предлагает task; user confirms.

draft a follow-up email → AI создаёт draft; user reviews/sends.

AI provider:

Primary: @anthropic-ai/sdk.

Fallback: deterministic demo provider.

Abstraction: aiProvider.generate(), aiProvider.classify(), aiProvider.research().

Все AI requests логируются как AiRun.

Credit system:

Billing/Settings показывает:

current balance;

monthly included credits;

purchased credits;

usage by day/type/user/source;

transactions list.

При запуске AI:

preflight checks balance;

reserves credits;

executes AI;

commits debit on success;

releases reservation on failure.

В demo-mode можно:

либо не списывать реальные credits;

либо списывать demo credits, чтобы тестировать UI.

15.б) Модель данных
prisma
enum AiProvider {
  ANTHROPIC
  DEMO
}

enum AiRunType {
  ASK_ASSISTANT
  CLASSIFY_RECORD
  SUMMARIZE_RECORD
  RESEARCH_RECORD
  PROMPT_COMPLETION
  CLASSIFY_TEXT
  EMAIL_DRAFT
  CALL_INSIGHT
  WORKFLOW_AI_BLOCK
}

enum AiRunStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
  CANCELLED
}

enum CreditTransactionType {
  MONTHLY_GRANT
  PURCHASE
  DEBIT
  REFUND
  ADJUSTMENT
  RESERVATION
  RESERVATION_RELEASE
}

enum CreditUsageType {
  CLASSIFY
  SUMMARIZE
  RESEARCH
  PROMPT
  ASK
  EMAIL_DRAFT
  CALL_INSIGHT
  WORKFLOW_AI
}

model AiRun {
  id            String       @id @default(cuid())
  orgId         String
  userId        String?
  provider      AiProvider
  type          AiRunType
  status        AiRunStatus  @default(QUEUED)

  input         Json
  output        Json?
  model         String?
  promptTokens  Int?
  outputTokens  Int?
  creditsUsed   Int          @default(0)

  sourceType    String?
  sourceId      String?
  recordId      String?
  workflowRunId String?
  callId        String?

  errorCode     String?
  errorMessage  String?

  createdAt     DateTime     @default(now())
  startedAt     DateTime?
  finishedAt    DateTime?

  @@index([orgId])
  @@index([userId])
  @@index([type])
  @@index([status])
  @@index([recordId])
  @@map("crm_ai_runs")
}

model CreditAccount {
  id            String       @id @default(cuid())
  orgId         String       @unique

  balance       Int          @default(0)
  monthlyIncluded Int        @default(0)
  purchasedBalance Int       @default(0)
  reserved      Int          @default(0)

  periodStart   DateTime?
  periodEnd     DateTime?

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  transactions  CreditTransaction[]

  @@map("crm_credit_accounts")
}

model CreditTransaction {
  id            String                  @id @default(cuid())
  orgId         String
  accountId     String
  account       CreditAccount           @relation(fields: [accountId], references: [id], onDelete: Cascade)

  type          CreditTransactionType
  usageType     CreditUsageType?
  amount        Int
  balanceAfter  Int
  description   String?

  aiRunId       String?
  userId        String?
  sourceType    String?
  sourceId      String?

  createdAt     DateTime                @default(now())

  @@index([orgId])
  @@index([accountId, createdAt])
  @@index([usageType])
  @@index([aiRunId])
  @@map("crm_credit_transactions")
}

model PromptTemplate {
  id            String       @id @default(cuid())
  orgId         String
  userId        String?

  name          String
  description   String?
  body          String       @db.Text
  scope         String       @default("PERSONAL")
  category      String?
  variables     Json?
  isSystem      Boolean      @default(false)

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  archivedAt    DateTime?

  @@index([orgId])
  @@index([userId])
  @@index([scope])
  @@map("crm_prompt_templates")
}

model AiChat {
  id            String       @id @default(cuid())
  orgId         String
  userId        String

  title         String?
  contextType   String?
  contextId     String?

  messages      AiChatMessage[]

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  archivedAt    DateTime?

  @@index([orgId])
  @@index([userId])
  @@map("crm_ai_chats")
}

model AiChatMessage {
  id            String       @id @default(cuid())
  orgId         String
  chatId        String
  chat          AiChat       @relation(fields: [chatId], references: [id], onDelete: Cascade)

  role          String
  content       String       @db.Text
  toolCalls     Json?
  citations     Json?
  aiRunId       String?

  createdAt     DateTime     @default(now())

  @@index([orgId])
  @@index([chatId])
  @@map("crm_ai_chat_messages")
}

model AiSuggestedAction {
  id            String       @id @default(cuid())
  orgId         String
  userId        String?
  aiRunId       String?

  type          String
  status        String       @default("PENDING")
  payload       Json
  preview       Json?
  appliedAt     DateTime?
  rejectedAt    DateTime?

  createdAt     DateTime     @default(now())

  @@index([orgId])
  @@index([userId])
  @@index([status])
  @@map("crm_ai_suggested_actions")
}

Расширения к Attribute из раздела AI-атрибутов:

prisma
// conceptually added to Attribute.config or explicit columns in later migration
// config.ai = {
//   enabled: true,
//   type: "CLASSIFY_RECORD" | "SUMMARIZE_RECORD" | "RESEARCH_AGENT" | "PROMPT_COMPLETION",
//   guidance: string,
//   prompt: string,
//   outputType: string,
//   creditCost: number
// }

Индексы:

AiRun(orgId, type, createdAt) — usage history.

CreditTransaction(accountId, createdAt) — billing breakdown.

PromptTemplate(orgId, userId/scope) — saved prompts.

AiChat(orgId, userId) — recent chats.

15.в) API
Ask Attio: создать chat
http
POST /api/ai/chats
Content-Type: application/json

Тело:

JSON
{
  "title": "Prep for my day",
  "contextType": "homepage",
  "contextId": null
}

Ответ:

JSON
{
  "id": "chat_1",
  "title": "Prep for my day"
}
Recent chats
http
GET /api/ai/chats?limit=20&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "chat_1",
      "title": "Check pricing discussion with company",
      "updatedAt": "2026-06-12T10:00:00.000Z"
    }
  ]
}
Send message
http
POST /api/ai/chats/:chatId/messages
Content-Type: application/json

Тело:

JSON
{
  "message": "help me prep for my day",
  "mode": "AUTO",
  "context": {
    "recordId": null,
    "callId": null
  }
}

Ответ:

JSON
{
  "messageId": "msg_2",
  "aiRunId": "airun_1",
  "content": "Сегодня у вас 3 встречи, 2 overdue tasks и 1 deal требует внимания.",
  "citations": [
    {
      "type": "task",
      "id": "task_1",
      "label": "Follow up with Picoma"
    }
  ],
  "suggestedActions": []
}

Ошибки:

402 PAYMENT_REQUIRED — недостаточно credits.

422 VALIDATION_ERROR

500 AI_PROVIDER_ERROR

Prep homepage
http
GET /api/ai/homepage

Ответ:

JSON
{
  "greeting": "Good afternoon, Marisa.",
  "recentChats": [],
  "meetings": [],
  "tasks": [],
  "quickPrompts": [
    { "label": "Prep for next meeting", "prompt": "Help me prep for my next meeting" }
  ]
}
Saved prompts list
http
GET /api/ai/prompts?scope=PERSONAL

Ответ:

JSON
{
  "items": [
    {
      "id": "prompt_1",
      "name": "Detailed call prep",
      "body": "Summarize the latest emails, calls and open tasks..."
    }
  ]
}
Create prompt
http
POST /api/ai/prompts
Content-Type: application/json

Тело:

JSON
{
  "name": "Detailed call prep",
  "body": "Use calls, notes, emails and deal context. Return open questions and next steps.",
  "scope": "PERSONAL",
  "category": "CALL_PREP"
}

Ответ:

JSON
{
  "id": "prompt_1",
  "name": "Detailed call prep"
}
Update/delete prompt
http
PATCH /api/ai/prompts/:promptId
DELETE /api/ai/prompts/:promptId

Ответ:

JSON
{
  "ok": true
}
AI record research
http
POST /api/ai/research
Content-Type: application/json

Тело:

JSON
{
  "recordId": "rec_company",
  "question": "Does this company match our ICP?",
  "guidance": "ICP: B2B SaaS, 50-500 employees, recently funded"
}

Ответ:

JSON
{
  "aiRunId": "airun_1",
  "creditsUsed": 10,
  "result": "Компания похожа на ICP: B2B SaaS, 120 сотрудников, признаки роста..."
}
Suggest record updates
http
POST /api/ai/suggest-record-updates
Content-Type: application/json

Тело:

JSON
{
  "recordId": "rec_1",
  "sourceType": "call",
  "sourceId": "call_1",
  "instruction": "Suggest updates based on the call"
}

Ответ:

JSON
{
  "suggestedActionId": "action_1",
  "type": "UPDATE_RECORD",
  "preview": {
    "changes": [
      {
        "attributeKey": "stage",
        "oldValue": "Qualification",
        "newValue": "Proposal"
      }
    ]
  }
}
Apply suggested action
http
POST /api/ai/suggested-actions/:actionId/apply

Ответ:

JSON
{
  "ok": true,
  "appliedAt": "2026-06-12T10:00:00.000Z"
}

Ошибки:

409 CONFLICT — запись изменилась с момента suggestion; нужен review.

403 FORBIDDEN.

Draft follow-up email
http
POST /api/ai/draft-email
Content-Type: application/json

Тело:

JSON
{
  "recordId": "rec_person",
  "callId": "call_1",
  "instruction": "Draft a follow-up email based on this call"
}

Ответ:

JSON
{
  "aiRunId": "airun_1",
  "draft": {
    "to": ["lisa@cosme.com"],
    "subject": "Follow-up from our call",
    "body": "Hi Lisa,\n\nThanks for the time today..."
  },
  "suggestedActionId": "action_email_1"
}
Credit balance
http
GET /api/billing/credits

Ответ:

JSON
{
  "balance": 940,
  "monthlyIncluded": 1000,
  "purchasedBalance": 0,
  "reserved": 0,
  "periodStart": "2026-06-01T00:00:00.000Z",
  "periodEnd": "2026-06-30T23:59:59.999Z"
}
Credit usage
http
GET /api/billing/credits/transactions?usageType=&from=&to=&limit=100&cursor=

Ответ:

JSON
{
  "items": [
    {
      "id": "txn_1",
      "type": "DEBIT",
      "usageType": "RESEARCH",
      "amount": -10,
      "balanceAfter": 940,
      "description": "Research agent on Cosme",
      "createdAt": "2026-06-12T10:00:00.000Z"
    }
  ],
  "nextCursor": null
}
Purchase credits
http
POST /api/billing/credits/purchase
Content-Type: application/json

Тело:

JSON
{
  "packageKey": "credits_1000"
}

Ответ:

JSON
{
  "checkoutUrl": "https://stripe.example/checkout/session"
}

Ошибки:

402 PAYMENT_REQUIRED

409 CONFLICT — Stripe customer missing.

422 VALIDATION_ERROR.

Monthly grant job endpoint/admin
http
POST /api/admin/billing/credits/monthly-grant

Тело:

JSON
{
  "orgId": "org_1",
  "amount": 1000,
  "periodStart": "2026-06-01",
  "periodEnd": "2026-06-30"
}

Ответ:

JSON
{
  "ok": true
}
15.г) UI-компоненты

AskAttioLauncher — кнопка в homepage/sidebar/topbar.

AskAttioPanel — chat drawer/page.

AskInput — поле Ask anything…, mode selector, submit.

QuickPromptChips — Prep, Recap, Draft follow-up, Recent objections.

AiChatList — recent chats в sidebar/homepage.

AiMessageBubble — user/assistant messages, citations, tool outputs.

AiCitationsList — ссылки на records/calls/tasks/emails/notes.

AiSuggestedActionsPanel — review/apply/reject actions.

PromptLibraryPage — settings prompts list.

PromptEditorModal — name/body/scope/category.

AiResearchPanel — record research, guidance, result, credits.

CreditBadge — текущий баланс credits в topbar/settings.

BillingCreditsPage — balance, breakdown, transactions, purchase.

CreditUsageChart — usage by type/time/user.

AiProviderStatus — Anthropic connected / Demo mode.

AiRunHistoryTable — admin/debug история AI runs.

DemoAiBanner — показывает, что результат synthetic/demo.

15.д) Acceptance-критерии

S180 ⬜ Открыть Ask Attio: ассистент доступен с homepage, sidebar и topbar; открывается chat UI.

S181 ⬜ help me prep for my day возвращает встречи, сделки, задачи и next actions.

S182 ⬜ what objections came up recently? возвращает сводку по calls/notes/emails с citations/snippets.

S183 ⬜ Account settings → Prompts: пользователь создаёт saved prompt с name/body.

S184 ⬜ Saved prompt переиспользуется в Ask Attio и возвращает call-prep summary.

S185 ⬜ Web research по компании/рынку возвращает research brief; в demo-mode brief строится по CRM values.

S186 ⬜ During call question про pricing ищет по прошлым interactions и возвращает who/when/what.

S187 ⬜ suggest updates based on call создаёт preview изменений; после review обновляет record.

S188 ⬜ create a task to follow up создаёт задачу с linked record и due date после подтверждения.

S189 ⬜ draft a follow-up email создаёт draft; пользователь может review/send.

S190 ⬜ Homepage показывает greeting, recent chat, Meetings и Tasks.

S170 ⬜ Credits списываются корректно: Research=10, Classify/Summarize/Prompt=1.

S171 ⬜ Balance badge и Billing history показывают текущий баланс и операции.

S172 ⬜ Demo-AI работает без ключа и возвращает детерминированный осмысленный результат.

S173 ⬜ AI values используются в filters/reports/workflow triggers как обычные values.

S376 ⬜ Billing: AI credits balance, breakdown by type/time/user отображаются в Settings.

S377 ⬜ Списание credits синхронизировано с AI runs и не допускает отрицательный баланс.

S378 ⬜ Purchase credits/monthly package: пользователь видит пакет, может перейти в Stripe checkout, после webhook баланс увеличивается.

15.е) Технические решения, воркеры BullMQ, edge-cases

Очереди:

TypeScript
aiQueue
aiResearchQueue
aiCreditQueue
aiChatQueue

Сервисы:

TypeScript
aiService.ts
aiProvider.ts
anthropicProvider.ts
demoAiProvider.ts
creditService.ts
promptService.ts
askAssistantService.ts
aiActionService.ts

AI provider contract:

TypeScript
type AiGenerateInput = {
  orgId: string;
  userId?: string;
  type: AiRunType;
  system?: string;
  prompt: string;
  context?: Record<string, unknown>;
  outputSchema?: unknown;
};

type AiGenerateResult = {
  text?: string;
  json?: unknown;
  model: string;
  promptTokens?: number;
  outputTokens?: number;
};

Credit debit algorithm:

Resolve credit cost:

Research = 10.

Classify/Summarize/Prompt = 1.

Ask = configurable, default 0 or 1 depending plan.

Start DB transaction.

Load CreditAccount.

If balance - reserved < cost, reject.

Create reservation transaction.

Run AI outside long DB transaction.

On success:

create debit transaction;

decrement balance;

remove reservation;

attach creditsUsed to AiRun.

On failure:

release reservation.

Ensure idempotency by aiRunId.

Demo-AI deterministic behavior:

Classify:

uses keyword matching + select options.

If no match, chooses first non-empty option.

Summarize:

builds summary from displayName, objectKey, top attributes, recent activity.

Research:

uses domain/company/industry/location values.

Returns structured text with “demo research” marker in UI, not in stored value unless configured.

Prompt completion:

supports common normalizations:

country ISO;

currency amount;

score 0–100;

short text extraction.

Ask Attio retrieval algorithm:

Parse user message intent.

Build context:

current page context;

selected record/call/list;

recent tasks;

meetings;

emails/notes/calls/activity snippets;

permissions-filtered records.

Retrieve candidate snippets:

Postgres searchText;

Activity;

Call transcript;

Email subject/body;

Notes.

Build prompt with citations metadata.

Generate answer.

If action requested:

create AiSuggestedAction, not immediate DB mutation.

Return answer + citations + action preview.

Edge-cases:

No Anthropic key: provider = DEMO, no crash.

Provider timeout: mark AiRun failed; release credits; UI offers retry.

Insufficient credits: block paid AI run; show Billing link; demo workspace can use demo credits.

Prompt injection from CRM data: treat record/email/call content as untrusted context; system prompt must forbid following embedded instructions.

PII/privacy: Ask Attio retrieval respects email sharing settings and RBAC.

AI update conflicts: if record values changed between suggestion and apply, require review.

Streaming: optional later; MVP can return full response.

Long context: summarize/chunk; cap tokens; prefer recent/high-signal snippets.

Duplicate credit debit: enforce idempotency with aiRunId.

Workflow AI: if workflow retries after provider failure, do not double-debit successful previous AI step.

Research web unavailable: demo fallback or provider error with graceful UI.

Saved prompt scope: personal prompt видит только author; workspace prompt requires admin/member permission depending settings.

Reports/filter usage of AI values: AI output must be persisted into Value, not only AiRun.output.


---

## 16. Settings — workspace, members, RBAC, apps, developers, billing, security **Статус:** ⬜ не начато **Покрываемые сценарии:** S345–S356, S362–S367, S372–S381 **Назначение раздела:** единый центр управления workspace, участниками, правами, приложениями, API-доступом, биллингом, AI-кредитами, безопасностью и миграциями. Сценарии каталога явно задают роли Admin/Member, четыре уровня доступа, области Workspace/Team/Individual, права на Objects/Lists/Dashboards/Workflows/Sequences, Apps/Integrations, Developers, Billing, Security и Migrate CRM. :contentReference[oaicite:0]{index=0} ### 16.а) Описание функциональности Settings — отдельная область продукта, доступная из workspace menu и user menu. Пользователь видит левый settings-sidebar с группами: - **Personal** - Profile - Appearance - Notifications - Email and calendar accounts - Storage accounts - Call recording - Prompts - **Workspace** - General - Members and teams - Plans - Billing - Developers - Security - Email and calendar - Support requests - Migrate CRM - Apps - **Data** - Objects - Lists - Import History - **Reports** - Dashboards - **Automations** - Sequences - Workflows Экран должен повторять Attio-like IA: слева settings navigation, сверху поиск `Search settings...`, в контенте — выбранная страница. В функциональном инвентаре Settings → Objects уже описан как централизованный экран управления объектами со списком Standard/Custom objects, поиском и кнопкой `+ Create custom object`; эта структура переносится на остальные settings-страницы. :contentReference[oaicite:1]{index=1} #### Workspace General Пользователь может: 1. Изменить workspace name. 2. Загрузить logo. 3. Указать primary domain. 4. Настроить default timezone. 5. Настроить default currency. 6. Включить/выключить demo mode для workspace. 7. Посмотреть workspace ID. 8. Удалить/архивировать workspace только для OWNER. #### Members and teams Пользователь с правами Admin/Owner может: 1. Видеть список участников workspace: - name; - email; - role: OWNER / ADMIN / MEMBER; - status: ACTIVE / INVITED / DISABLED; - teams; - last active; - createdAt. 2. Пригласить пользователя по email. 3. Назначить роль Admin/Member. 4. Отключить пользователя. 5. Создать team. 6. Добавить/удалить пользователей из team. 7. Настроить access groups / expert access groups. RBAC-модель должна соответствовать Attio-подходу: - роли: - **Admin** — управляет workspace settings, объектами, участниками, биллингом и всеми системными настройками; - **Member** — не управляет workspace settings и видит/редактирует только выданные сущности. - уровни доступа: - `NO_ACCESS` — сущность скрыта; - `READ_ONLY` — только просмотр; - `READ_WRITE` — просмотр и изменение данных, но не структуры/прав; - `FULL_ACCESS` — полное управление сущностью. - области: - Workspace — дефолт; - Team — override для команды; - Individual — override для пользователя. - приоритет: - Individual > Team > Workspace. - сущности с правами: - Object; - List; - Dashboard; - Workflow; - Sequence. - отдельный automations grant: - workflow получает право читать/писать конкретный объект/list независимо от того, кто может редактировать сам workflow. #### Object/List/Dashboard/Workflow/Sequence permissions Для каждой защищаемой сущности в её settings появляется вкладка **Permissions**: 1. `Workspace access` — дефолтный уровень. 2. `Teams` — overrides по team. 3. `Individual members` — overrides по конкретным user. 4. `Automations` — grants для workflow. Пример: - Deals: - workspace = `READ_ONLY`; - team Sales = `READ_WRITE`; - individual contractor = `READ_WRITE`. - Recruiting List: - workspace = `NO_ACCESS`; - Head of Talent = `FULL_ACCESS`. - Dashboard: - по умолчанию новый dashboard видит только создатель; - workspace can be `READ_ONLY`; - RevOps team can be `READ_WRITE`. - Workflow: - permission to edit workflow отдельно от permission workflow to mutate records. #### Apps & Integrations Пользователь открывает **Settings → Apps** и видит каталог приложений: - Slack; - Gmail; - Google Calendar; - Outlook; - Zoom; - Google Meet; - Microsoft Teams; - Linear; - PandaDoc; - Typeform; - Mailchimp; - Mixmax; - Outreach; - Intercom; - Segment; - Webhooks; - Custom app. Типы приложений: 1. Native / first-party. 2. OAuth integrations. 3. Custom apps / developer apps. Пользователь может: 1. Искать приложение. 2. Открыть карточку приложения. 3. Увидеть описание, supported features, scopes, status. 4. Нажать `Install` / `Connect`. 5. Пройти OAuth или ввести API key/webhook URL. 6. Настроить workspace scopes. 7. Включить record-page widget, если интеграция поддерживает highlights widget. 8. Disconnect / revoke. #### Email and calendar accounts Пользователь может подключить email/calendar account: - Gmail; - Outlook; - SMTP/IMAP demo; - Google Calendar; - Microsoft Calendar. Настройки: - sharing mode: - private; - metadata only; - shared full content; - default mailbox for sending; - signature; - sequence sending availability; - tracking on/off; - unsubscribe footer. #### Developers Пользователь открывает **Settings → Developers** и может: 1. Создать API key. 2. Посмотреть masked key после создания. 3. Назвать key. 4. Ограничить scopes: - read records; - write records; - manage schema; - run workflows; - webhooks; - billing read. 5. Revoke key. 6. Создать webhook endpoint: - target URL; - events; - secret; - status; - last delivery. 7. Посмотреть webhook delivery logs. 8. Настроить MCP server: - read-only; - read-write; - tools enabled. #### Plans & Billing Пользователь видит: - текущий план; - лимиты; - Stripe subscription status; - next invoice; - payment method; - invoices; - AI credits balance; - credit transactions; - usage breakdown: - Research; - Classify; - Summarize; - Prompt; - Ask; - Call insight; - Workflow AI. - purchase credits button. Планы: - Free; - Plus; - Pro; - Enterprise. Каждый план содержит: - members limit; - records limit; - monthly AI credits; - sequences limit; - workflow runs limit; - call recording minutes; - integrations availability; - support level. #### Security Пользователь с Admin/Owner rights может: 1. Включить/выключить 2FA requirement. 2. Настроить SSO/SAML для Enterprise. 3. Посмотреть active sessions. 4. Revoke session. 5. Настроить password policy. 6. Посмотреть audit log. 7. Настроить allowed domains. 8. Управлять API key security. #### Storage accounts Пользователь может: 1. Подключить storage provider: - local/demo; - S3-compatible; - Google Drive; - OneDrive. 2. Использовать storage для files tab, call recordings, import files. 3. Видеть storage usage. #### Migrate CRM Пользователь открывает **Settings → Migrate CRM**: 1. Выбирает source: - CSV; - HubSpot; - Salesforce; - Pipedrive; - legacy AISDR Lead/Campaign. 2. Запускает migration wizard. 3. Видит mapping: - objects; - attributes; - relationships; - emails; - notes; - tasks; - sequences. 4. Запускает dry-run. 5. Видит counts. 6. Подтверждает migration. 7. Видит import/migration history. 8. Может rollback, если batch поддерживает rollback. ### 16.б) Модель данных Часть моделей уже существует: `User`, `Organization`, `ApiKey`; текущая Prisma-схема хранит пользователей, организации, API keys и flexible CRM-модели `Object`, `Attribute`, `Record`, `Value`, `View`, `List`, `Activity`, `Email`, `Note`, `Task`. В README отдельно указано, что `ARCHITECTURE.md` описывает техническую архитектуру, а `schema.prisma` содержит 25 моделей flexible CRM. :contentReference[oaicite:2]{index=2} Нужные расширения: ```prisma enum WorkspaceRole { OWNER ADMIN MEMBER } enum MemberStatus { INVITED ACTIVE DISABLED } enum AccessLevel { NO_ACCESS READ_ONLY READ_WRITE FULL_ACCESS } enum PermissionEntityType { OBJECT LIST DASHBOARD WORKFLOW SEQUENCE } enum PermissionScope { WORKSPACE TEAM INDIVIDUAL AUTOMATION } enum AppType { NATIVE OAUTH CUSTOM } enum IntegrationStatus { AVAILABLE CONNECTED ERROR DISABLED } enum ApiKeyStatus { ACTIVE REVOKED } enum WebhookDeliveryStatus { PENDING SUCCEEDED FAILED } model WorkspaceSettings { id String @id @default(cuid()) orgId String @unique org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade) logoUrl String? domain String? timezone String @default("Europe/Vienna") defaultCurrency String @default("USD") demoModeEnabled Boolean @default(true) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@map("crm_workspace_settings") } model Membership { id String @id @default(cuid()) orgId String userId String role WorkspaceRole @default(MEMBER) status MemberStatus @default(ACTIVE) invitedById String? invitedAt DateTime? joinedAt DateTime? disabledAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([orgId, userId]) @@index([orgId]) @@index([userId]) @@index([role]) @@map("crm_memberships") } model Team { id String @id @default(cuid()) orgId String name String description String? color String? members TeamMember[] createdAt DateTime @default(now()) updatedAt DateTime @updatedAt archivedAt DateTime? @@unique([orgId, name]) @@index([orgId]) @@map("crm_teams") } model TeamMember { id String @id @default(cuid()) orgId String teamId String team Team @relation(fields: [teamId], references: [id], onDelete: Cascade) userId String addedById String? createdAt DateTime @default(now()) @@unique([teamId, userId]) @@index([orgId]) @@index([userId]) @@map("crm_team_members") } model PermissionGrant { id String @id @default(cuid()) orgId String entityType PermissionEntityType entityId String scope PermissionScope subjectId String? level AccessLevel createdById String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([orgId, entityType, entityId, scope, subjectId]) @@index([orgId]) @@index([entityType, entityId]) @@index([scope, subjectId]) @@map("crm_permission_grants") } model AutomationPermissionGrant { id String @id @default(cuid()) orgId String workflowId String entityType PermissionEntityType entityId String level AccessLevel createdById String? createdAt DateTime @default(now()) @@unique([orgId, workflowId, entityType, entityId]) @@index([orgId]) @@index([workflowId]) @@map("crm_automation_permission_grants") } model WorkspaceInvite { id String @id @default(cuid()) orgId String email String role WorkspaceRole @default(MEMBER) tokenHash String status String @default("PENDING") invitedById String? expiresAt DateTime acceptedAt DateTime? revokedAt DateTime? createdAt DateTime @default(now()) @@unique([orgId, email]) @@index([orgId]) @@index([tokenHash]) @@map("crm_workspace_invites") } model IntegrationConnection { id String @id @default(cuid()) orgId String provider String appType AppType status IntegrationStatus @default(AVAILABLE) displayName String? accountEmail String? config Json? scopes Json? encryptedTokens Json? lastSyncAt DateTime? errorCode String? errorMessage String? connectedById String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt disconnectedAt DateTime? @@index([orgId]) @@index([provider]) @@index([status]) @@map("crm_integration_connections") } model DeveloperApiKey { id String @id @default(cuid()) orgId String name String keyHash String keyPrefix String scopes Json status ApiKeyStatus @default(ACTIVE) createdById String? lastUsedAt DateTime? revokedAt DateTime? createdAt DateTime @default(now()) @@index([orgId]) @@index([keyPrefix]) @@map("crm_developer_api_keys") } model WebhookEndpoint { id String @id @default(cuid()) orgId String name String url String secretHash String events Json isActive Boolean @default(true) createdById String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt revokedAt DateTime? deliveries WebhookDelivery[] @@index([orgId]) @@map("crm_webhook_endpoints") } model WebhookDelivery { id String @id @default(cuid()) orgId String endpointId String endpoint WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade) eventType String payload Json status WebhookDeliveryStatus @default(PENDING) statusCode Int? response String? error String? attempts Int @default(0) deliveredAt DateTime? createdAt DateTime @default(now()) @@index([orgId]) @@index([endpointId, createdAt]) @@index([status]) @@map("crm_webhook_deliveries") } model SecuritySettings { id String @id @default(cuid()) orgId String @unique require2fa Boolean @default(false) ssoEnabled Boolean @default(false) ssoProvider String? ssoConfig Json? allowedDomains Json? sessionTtlHours Int @default(720) apiKeysEnabled Boolean @default(true) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@map("crm_security_settings") } model AuditLog { id String @id @default(cuid()) orgId String userId String? action String entityType String entityId String? ipAddress String? userAgent String? metadata Json? createdAt DateTime @default(now()) @@index([orgId]) @@index([userId]) @@index([entityType, entityId]) @@index([createdAt]) @@map("crm_audit_logs") } model StorageAccount { id String @id @default(cuid()) orgId String provider String status String @default("CONNECTED") config Json? encryptedCredentials Json? createdById String? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt revokedAt DateTime? @@index([orgId]) @@index([provider]) @@map("crm_storage_accounts") } model MigrationJob { id String @id @default(cuid()) orgId String source String status String @default("DRAFT") config Json? mapping Json? dryRunStats Json? resultStats Json? error String? createdById String? startedAt DateTime? finishedAt DateTime? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([orgId]) @@index([status]) @@map("crm_migration_jobs") } ``` Индексы обязательны: - `Membership(orgId,userId)` unique. - `Team(orgId,name)` unique. - `PermissionGrant(orgId,entityType,entityId,scope,subjectId)` unique. - `IntegrationConnection(orgId,provider,status)`. - `DeveloperApiKey(orgId,keyPrefix)`. - `WebhookDelivery(endpointId,createdAt)`. - `AuditLog(orgId,createdAt)`. ### 16.в) API #### Workspace settings ```http GET /api/settings/workspace ``` Ответ: ```json { "id": "org_1", "name": "Basepoint", "logoUrl": null, "domain": "basepoint.com", "timezone": "Europe/Vienna", "defaultCurrency": "USD", "demoModeEnabled": true } ``` ```http PATCH /api/settings/workspace Content-Type: application/json ``` Тело: ```json { "name": "Basepoint", "logoUrl": "https://cdn.example.com/logo.png", "domain": "basepoint.com", "timezone": "Europe/Vienna", "defaultCurrency": "USD" } ``` Ошибки: - `401 UNAUTHORIZED` - `403 FORBIDDEN` - `409 CONFLICT` — domain already used. - `422 VALIDATION_ERROR` #### Members ```http GET /api/settings/members?status=&teamId=&search= ``` Ответ: ```json { "items": [ { "id": "usr_1", "email": "marisa@example.com", "name": "Marisa", "role": "ADMIN", "status": "ACTIVE", "teams": [{ "id": "team_sales", "name": "Sales" }], "lastActiveAt": "2026-06-12T10:00:00.000Z" } ] } ``` ```http POST /api/settings/members/invite Content-Type: application/json ``` Тело: ```json { "email": "new.member@example.com", "role": "MEMBER", "teamIds": ["team_sales"] } ``` Ответ: ```json { "inviteId": "inv_1", "status": "PENDING" } ``` ```http PATCH /api/settings/members/:userId Content-Type: application/json ``` Тело: ```json { "role": "ADMIN", "status": "ACTIVE" } ``` ```http DELETE /api/settings/members/:userId ``` Ответ: ```json { "ok": true, "status": "DISABLED" } ``` #### Teams ```http GET /api/settings/teams POST /api/settings/teams PATCH /api/settings/teams/:teamId DELETE /api/settings/teams/:teamId ``` Тело создания: ```json { "name": "Sales - EU", "description": "EU sales team", "color": "#DDEAFE" } ``` ```http POST /api/settings/teams/:teamId/members ``` Тело: ```json { "userIds": ["usr_1", "usr_2"] } ``` ```http DELETE /api/settings/teams/:teamId/members/:userId ``` #### Permissions ```http GET /api/permissions/:entityType/:entityId ``` Ответ: ```json { "entityType": "OBJECT", "entityId": "obj_deals", "grants": [ { "scope": "WORKSPACE", "subjectId": null, "level": "READ_ONLY" }, { "scope": "TEAM", "subjectId": "team_sales", "level": "READ_WRITE" }, { "scope": "INDIVIDUAL", "subjectId": "usr_contractor", "level": "READ_WRITE" } ], "automationGrants": [ { "workflowId": "wf_1", "level": "READ_WRITE" } ] } ``` ```http PUT /api/permissions/:entityType/:entityId Content-Type: application/json ``` Тело: ```json { "grants": [ { "scope": "WORKSPACE", "subjectId": null, "level": "READ_ONLY" }, { "scope": "TEAM", "subjectId": "team_sales", "level": "READ_WRITE" } ] } ``` ```http GET /api/permissions/effective/:entityType/:entityId?userId=usr_1 ``` Ответ: ```json { "level": "READ_WRITE", "source": "TEAM", "subjectId": "team_sales" } ``` ```http POST /api/permissions/:entityType/:entityId/automation-grants ``` Тело: ```json { "workflowId": "wf_1", "level": "READ_WRITE" } ``` #### Apps & integrations ```http GET /api/apps GET /api/apps/:provider ``` Ответ: ```json { "items": [ { "provider": "slack", "name": "Slack", "type": "OAUTH", "status": "AVAILABLE", "supportsWidgets": false, "supportsWorkflowBlocks": true } ] } ``` ```http POST /api/integrations/:provider/connect ``` Тело для OAuth: ```json { "redirectUrl": "http://localhost:3010/settings/apps/slack/callback" } ``` Ответ: ```json { "authUrl": "https://provider.example/oauth/authorize" } ``` Тело для API key: ```json { "apiKey": "secret", "accountEmail": "ops@example.com" } ``` ```http DELETE /api/integrations/:connectionId ``` #### Email/calendar accounts ```http GET /api/settings/email-calendar/accounts POST /api/settings/email-calendar/accounts/connect PATCH /api/settings/email-calendar/accounts/:accountId DELETE /api/settings/email-calendar/accounts/:accountId ``` Тело настроек sharing: ```json { "sharingMode": "METADATA_ONLY", "defaultSending": true, "signature": "Best,\nMarisa", "trackingEnabled": true } ``` #### Developers ```http GET /api/settings/developers/api-keys POST /api/settings/developers/api-keys DELETE /api/settings/developers/api-keys/:keyId ``` Тело создания: ```json { "name": "Warehouse sync", "scopes": ["records:read", "records:write", "schema:read"] } ``` Ответ: ```json { "id": "key_1", "prefix": "aisdr_live_abc", "secret": "aisdr_live_abc.full_secret_shown_once" } ``` ```http GET /api/settings/developers/webhooks POST /api/settings/developers/webhooks PATCH /api/settings/developers/webhooks/:endpointId DELETE /api/settings/developers/webhooks/:endpointId GET /api/settings/developers/webhooks/:endpointId/deliveries ``` #### Billing ```http GET /api/billing/plan ``` Ответ: ```json { "plan": "PRO", "status": "ACTIVE", "stripeCustomerId": "cus_123", "stripeSubscriptionId": "sub_123", "limits": { "members": 25, "records": 100000, "monthlyAiCredits": 10000, "workflowRuns": 100000 } } ``` ```http POST /api/billing/checkout ``` Тело: ```json { "plan": "PRO", "interval": "monthly" } ``` ```http POST /api/billing/portal ``` Ответ: ```json { "url": "https://billing.stripe.com/session/..." } ``` ```http GET /api/billing/credits GET /api/billing/credits/transactions POST /api/billing/credits/purchase POST /api/stripe/webhook ``` #### Security ```http GET /api/settings/security PATCH /api/settings/security GET /api/settings/security/sessions DELETE /api/settings/security/sessions/:sessionId GET /api/settings/security/audit-log ``` Тело: ```json { "require2fa": true, "ssoEnabled": false, "allowedDomains": ["basepoint.com"], "sessionTtlHours": 720 } ``` #### Storage ```http GET /api/settings/storage-accounts POST /api/settings/storage-accounts DELETE /api/settings/storage-accounts/:storageAccountId ``` #### Migrate CRM ```http POST /api/migrations GET /api/migrations GET /api/migrations/:migrationId PATCH /api/migrations/:migrationId/mapping POST /api/migrations/:migrationId/dry-run POST /api/migrations/:migrationId/run POST /api/migrations/:migrationId/rollback ``` ### 16.г) UI-компоненты - `SettingsLayout` — двухколоночный layout settings. - `SettingsSidebar` — Personal / Workspace / Data / Reports / Automations navigation. - `SettingsSearch` — быстрый поиск настройки. - `WorkspaceGeneralPage` — name/logo/domain/timezone/currency. - `LogoUploader` — загрузка logo с preview. - `MembersPage` — таблица участников, роли, статусы, teams. - `InviteMemberModal` — email, role, teams. - `TeamsPage` — список teams, members, add/remove. - `TeamEditorDrawer` — name, description, color, members. - `PermissionsTab` — reusable permissions UI для Object/List/Dashboard/Workflow/Sequence. - `AccessLevelSelect` — No access / Read only / Read and write / Full access. - `PermissionGrantTable` — Workspace, Teams, Individual, Automations sections. - `AppsCatalogPage` — карточки apps, поиск, категории. - `AppDetailsPage` — описание app, install/connect, scopes, widgets. - `IntegrationConnectionModal` — OAuth/API key/manual credentials. - `EmailCalendarAccountsPage` — mail/calendar accounts, sharing, signature. - `DevelopersPage` — API keys, webhooks, MCP. - `ApiKeyCreateModal` — name/scopes, one-time secret. - `WebhookEndpointEditor` — URL, events, secret, deliveries. - `PlansPage` — планы и лимиты. - `BillingPage` — Stripe subscription, invoices, credits. - `CreditsUsageTable` — транзакции кредитов. - `SecurityPage` — 2FA, SSO, sessions, audit log. - `StorageAccountsPage` — storage integrations. - `MigrateCrmPage` — wizard импорта/migration. - `AuditLogTable` — action/entity/user/time. ### 16.д) Acceptance-критерии - **S345 ⬜** Роли Admin / Member: Admin видит и меняет workspace settings; Member не видит административные страницы и не может управлять участниками/биллингом. - **S346 ⬜** 4 уровня доступа: No access / Read only / Read and write / Full access доступны в permissions UI и применяются backend resolver. - **S347 ⬜** 3 области: Workspace / Team / Individual; более точный grant перекрывает широкий. - **S348 ⬜** Права задаются на Objects / Lists / Dashboards / Workflows / Sequences. - **S349 ⬜** Workspace access задаёт дефолт для всех членов workspace. - **S350 ⬜** Team override: Admin создаёт Sales-EU/US/UK и задаёт разные access levels. - **S351 ⬜** Individual override: конкретный member получает уровень, перекрывающий workspace/team. - **S352 ⬜** Automations grant: workflow получает Read/Read+write доступ к объекту/list; без grant workflow не может менять данные. - **S353 ⬜** Members and teams: пользователь создаёт team и добавляет участников. - **S354 ⬜** Invite: Admin приглашает email в workspace, invite создаётся и принимается по token. - **S355 ⬜** UI применяет права: No access скрывает сущность, Read only блокирует edit controls. - **S356 ⬜** Expert access groups: внешний эксперт получает ограниченный доступ к выбранным entities. - **S362 ⬜** Settings → Apps показывает каталог приложений. - **S363 ⬜** Каталог различает native / OAuth / custom apps. - **S364 ⬜** Пользователь подключает Slack / Gmail / Calendar / Linear / PandaDoc через OAuth/API key. - **S365 ⬜** Виджет приложения доступен на record-page highlights, если app поддерживает widgets. - **S366 ⬜** Settings → Email and calendar accounts позволяет подключить ящик и настроить sharing. - **S367 ⬜** Developers: пользователь создаёт API keys и webhooks, видит delivery logs. - **S372 ⬜** Settings navigation: Personal / Workspace / Data / Reports / Automations работает и сохраняет активный route. - **S373 ⬜** Workspace General: name/logo/domain сохраняются и отражаются в sidebar/workspace switcher. - **S374 ⬜** Appearance: light/dark mode сохраняется для пользователя. - **S375 ⬜** Plans: Free/Plus/Pro/Enterprise и лимиты отображаются. - **S376 ⬜** Billing: AI credits balance и breakdown по типам/времени отображаются. - **S377 ⬜** Списание credits: Research=10, остальные AI runs=1, транзакции отражаются в Billing. - **S378 ⬜** Докупка credits / monthly package через Stripe checkout и webhook увеличивает balance. - **S379 ⬜** Storage accounts: пользователь подключает storage provider и видит usage/status. - **S380 ⬜** Security: 2FA, SSO, sessions и audit log доступны Admin/Owner. - **S381 ⬜** Migrate CRM: migration wizard запускает dry-run и migration из другой CRM или legacy AISDR. ### 16.е) Технические решения, воркеры BullMQ, edge-cases Очереди: ```ts billingQueue stripeWebhookQueue integrationSyncQueue webhookDeliveryQueue migrationQueue notificationQueue emailSyncQueue calendarSyncQueue storageQueue ``` Сервисы: ```ts settingsService.ts membershipService.ts teamService.ts permissionService.ts integrationService.ts developerKeyService.ts webhookService.ts billingService.ts stripeService.ts securityService.ts auditLogService.ts migrationService.ts storageService.ts ``` RBAC resolver: ```ts type EffectiveAccessInput = { orgId: string; userId: string; entityType: 'OBJECT' | 'LIST' | 'DASHBOARD' | 'WORKFLOW' | 'SEQUENCE'; entityId: string; }; type EffectiveAccess = { level: 'NO_ACCESS' | 'READ_ONLY' | 'READ_WRITE' | 'FULL_ACCESS'; source: 'INDIVIDUAL' | 'TEAM' | 'WORKSPACE' | 'OWNER' | 'ADMIN'; }; ``` Алгоритм: 1. Если user.role = OWNER → `FULL_ACCESS`. 2. Если entity относится к workspace settings и user.role != ADMIN/OWNER → deny. 3. Найти individual grant. 4. Если найден — вернуть его. 5. Найти team grants пользователя. 6. Выбрать максимальный level по team grants. 7. Если найден — вернуть его. 8. Вернуть workspace grant. 9. Если grant отсутствует: - для нового dashboard — owner only; - для system objects — default read/write для Admin, read/write или read_only для members по настройке; - для private lists/workflows/sequences — no access. Edge-cases: - Нельзя удалить последнего OWNER. - Нельзя понизить собственную роль, если это оставит workspace без Admin/Owner. - Invite повторно отправляется, если pending invite уже существует. - Individual override должен работать даже если user состоит в нескольких teams. - Если entity archived, permissions still readable but not editable except restore. - API keys показываются полностью только один раз. - Webhook secret нельзя прочитать после создания. - Stripe webhook должен быть idempotent по event ID. - Integration tokens хранятся encrypted. - Disconnect integration должен: - остановить future sync; - не удалять уже созданные CRM records; - пометить source connection как disconnected. - Billing state не должен зависеть только от frontend: enforcement на backend. - Security changes пишутся в AuditLog. - Demo workspace может использовать fake Stripe/demo integration states. --- ## 17. Навигация / IA — sidebar, topbar, command palette, notifications, favorites, home **Статус:** 🟡 частично **Покрываемые сценарии:** S190, S372, S398–S401 **Назначение раздела:** единый AppShell и информационная архитектура продукта: workspace switcher, sidebar sections, topbar, command palette, notifications, favorites, homepage/dashboard, demo-seed entrypoints. Левый сайдбар эталона включает workspace dropdown, Quick actions, поиск, Notifications, Tasks, Notes, Emails, Calls, Reports, Automations, Favorites, Records и Lists; это подтверждено функциональным инвентарём нескольких экранов. :contentReference[oaicite:3]{index=3} ### 17.а) Описание функциональности Навигация должна сделать продукт похожим на Attio: светлая плотная CRM-оболочка, быстрые переходы, Ctrl/⌘K, sidebar с объектами и списками, topbar с контекстными actions. #### App shell После login пользователь попадает в dashboard layout: - left sidebar; - topbar; - content area; - command palette overlay; - notification center; - global modals layer; - toast layer. #### Sidebar Секции: 1. **Workspace** - workspace name/logo; - dropdown switcher; - settings shortcut. 2. **Quick actions** - кнопка/пункт с hotkey `Ctrl+K` / `⌘K`. 3. **Core** - Notifications; - Tasks; - Notes; - Emails; - Calls; - Reports; - Automations. 4. **Automations subitems** - Sequences; - Workflows. 5. **Favorites** - favorite records; - favorite views; - favorite lists; - favorite dashboards; - favorite workflows/sequences. 6. **Records** - Companies; - People; - Deals; - Users; - Workspaces; - Invoices; - custom objects. 7. **Lists** - Inbound Leads; - Recruiting; - Event Invitees; - Customer Success; - Onboarding Pipeline; - PQL; - All lists. Sidebar behavior: - active route highlighted; - objects/lists loaded from API; - empty states for no lists/favorites; - collapsed mode with icons; - keyboard focus states; - badges: - unread notifications; - overdue tasks; - outbox count; - failed workflows; - draft sequences. #### Topbar Topbar меняется по route. For object/list page: - object/list title; - view dropdown; - View settings; - Sort chips; - Filter chips; - Import/Export; - `+ New <Object>`; - user menu/avatar; - help; - global search/Ask AI. For record page: - breadcrumbs; - record name; - action buttons: - Compose email; - Add note; - Create task; - Run workflow; - More. - tabs. For settings: - settings search; - breadcrumbs; - save status. For reports/workflows/sequences: - breadcrumbs; - star/favorite; - share; - status toggle; - primary action. #### Command palette Открывается: - Ctrl+K на Windows/Linux; - ⌘K на macOS; - click Quick actions. Команды: - Go to object/list/report/settings. - Search records. - Create record. - Create object. - Create list. - Create task. - Compose email. - Run workflow. - Enroll in sequence. - Ask AI. - Open recent views. - Switch workspace. - Open settings. Command palette поддерживает: - fuzzy search; - recent commands; - grouped results; - keyboard navigation; - enter to execute; - escape close; - record preview. #### Notifications center Notifications topbar: - mentions; - comment replies; - assigned tasks; - workflow failures; - sequence send failures; - billing alerts; - import/migration finished; - integration disconnected. Поведение: 1. Badge показывает unread count. 2. Click открывает drawer. 3. Notifications grouped by date. 4. Each notification has: - title; - body; - actor; - entity link; - createdAt; - mark read. 5. Bulk mark all read. 6. Email digest sent by schedule. #### Favorites Пользователь может star: - record; - view; - list; - dashboard; - workflow; - sequence; - report. Favorites появляются в sidebar. Favorites сохраняются per user. #### Home / Dashboard Homepage соответствует S190: - greeting; - Ask input; - recent chats; - meetings; - tasks; - suggested actions; - recently viewed records; - outbox summary; - workflow failures; - credit balance warning. Home must be useful even without integrations: - demo meetings; - demo tasks; - demo records; - demo suggestions. #### Demo-mode navigation Сценарии S400–S401 требуют, чтобы весь продукт работал без внешних ключей: - sidebar показывает seeded objects/lists; - workflows/sequences/calls/reports имеют demo entries; - Apps show “Demo connected” where applicable; - AI returns deterministic output; - email send simulated; - Stripe can run in test/demo mode. ### 17.б) Модель данных ```prisma enum FavoriteEntityType { RECORD VIEW LIST DASHBOARD REPORT WORKFLOW SEQUENCE OBJECT } enum NotificationType { MENTION COMMENT_REPLY TASK_ASSIGNED TASK_DUE WORKFLOW_FAILED SEQUENCE_FAILED IMPORT_FINISHED MIGRATION_FINISHED INTEGRATION_ERROR BILLING_ALERT SYSTEM } enum NotificationStatus { UNREAD READ ARCHIVED } model Favorite { id String @id @default(cuid()) orgId String userId String entityType FavoriteEntityType entityId String label String? metadata Json? createdAt DateTime @default(now()) @@unique([orgId, userId, entityType, entityId]) @@index([orgId, userId]) @@index([entityType, entityId]) @@map("crm_favorites") } model Notification { id String @id @default(cuid()) orgId String userId String type NotificationType status NotificationStatus @default(UNREAD) title String body String? actorId String? entityType String? entityId String? url String? metadata Json? readAt DateTime? emailedAt DateTime? createdAt DateTime @default(now()) @@index([orgId, userId, status]) @@index([orgId, userId, createdAt]) @@index([entityType, entityId]) @@map("crm_notifications") } model UserPreference { id String @id @default(cuid()) orgId String userId String theme String @default("light") sidebarCollapsed Boolean @default(false) timezone String? locale String @default("ru") notificationSettings Json? commandPaletteRecent Json? homeLayout Json? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([orgId, userId]) @@index([orgId]) @@map("crm_user_preferences") } model DemoSeedRun { id String @id @default(cuid()) orgId String status String @default("QUEUED") seedVersion String result Json? error String? createdAt DateTime @default(now()) finishedAt DateTime? @@index([orgId]) @@index([seedVersion]) @@map("crm_demo_seed_runs") } ``` Связи: - `Favorite` универсально указывает на entities по `(entityType, entityId)`. - `Notification` создаётся из comments, tasks, workflows, sequences, imports, billing. - `UserPreference` хранит IA preferences. - `DemoSeedRun` фиксирует seeded workspace idempotency. Индексы: - `Notification(orgId,userId,status)` — unread badge. - `Notification(orgId,userId,createdAt)` — drawer timeline. - `Favorite(orgId,userId,entityType,entityId)` — sidebar favorites. - `UserPreference(orgId,userId)` unique. ### 17.в) API #### Navigation payload ```http GET /api/navigation ``` Ответ: ```json { "workspace": { "id": "org_1", "name": "Basepoint", "logoUrl": null }, "core": { "notificationsUnread": 4, "tasksDue": 3, "outboxQueued": 12 }, "records": [ { "id": "obj_companies", "key": "companies", "pluralName": "Companies", "icon": "Building2" } ], "lists": [ { "id": "list_1", "name": "Event Invitees", "objectKey": "people" } ], "favorites": [ { "entityType": "DASHBOARD", "entityId": "dash_1", "label": "Revenue Dashboard" } ], "automations": { "sequencesCount": 5, "workflowsCount": 3, "failedRunsCount": 1 } } ``` Ошибки: - `401 UNAUTHORIZED` #### Homepage ```http GET /api/home ``` Ответ: ```json { "greeting": "Good afternoon, Marisa.", "recentChats": [], "meetings": [], "tasks": [], "suggestedActions": [], "recentRecords": [], "outbox": { "queued": 12, "failed": 0 }, "credits": { "balance": 940 } } ``` #### Command palette search ```http GET /api/command-palette?q=cosme&limit=20 ``` Ответ: ```json { "groups": [ { "label": "Records", "items": [ { "type": "record", "id": "rec_1", "label": "Cosme", "subtitle": "Company", "url": "/crm/companies/records/rec_1" } ] }, { "label": "Actions", "items": [ { "type": "action", "id": "create_task", "label": "Create task", "shortcut": "T" } ] } ] } ``` #### Command execute ```http POST /api/command-palette/execute Content-Type: application/json ``` Тело: ```json { "commandId": "create_task", "context": { "recordId": "rec_1" } } ``` Ответ: ```json { "ok": true, "result": { "action": "OPEN_MODAL", "modal": "CreateTaskModal" } } ``` #### Notifications ```http GET /api/notifications?status=UNREAD&limit=50&cursor= ``` Ответ: ```json { "items": [ { "id": "notif_1", "type": "MENTION", "title": "Marisa mentioned you on Cosme", "body": "Can you follow up?", "url": "/crm/companies/records/rec_1?tab=comments", "createdAt": "2026-06-12T10:00:00.000Z" } ], "nextCursor": null } ``` ```http POST /api/notifications/:notificationId/read POST /api/notifications/read-all DELETE /api/notifications/:notificationId ``` #### Favorites ```http GET /api/favorites POST /api/favorites DELETE /api/favorites/:entityType/:entityId ``` Тело: ```json { "entityType": "DASHBOARD", "entityId": "dash_1", "label": "Revenue Dashboard" } ``` #### Preferences ```http GET /api/preferences PATCH /api/preferences ``` Тело: ```json { "theme": "light", "sidebarCollapsed": false, "notificationSettings": { "emailDigest": true, "emailDigestFrequency": "DAILY" } } ``` #### Demo seed ```http GET /api/demo/status POST /api/demo/seed POST /api/demo/reset ``` Ответ: ```json { "seeded": true, "seedVersion": "2026-06-aisdr-demo-v1", "objects": 6, "records": 350, "lists": 4, "workflows": 2, "sequences": 2, "calls": 3 } ``` ### 17.г) UI-компоненты - `AppShell` — общий layout. - `Sidebar` — left nav. - `WorkspaceSwitcher` — workspace dropdown. - `SidebarSection` — группировка nav links. - `SidebarRecordLink` — object link. - `SidebarListLink` — list link. - `SidebarFavorites` — favorites list. - `TopBar` — context header. - `ContextActionsBar` — buttons per route. - `CommandPalette` — Ctrl/⌘K overlay. - `CommandPaletteResultGroup` — grouped results. - `NotificationBell` — unread count. - `NotificationDrawer` — list/read/archive. - `FavoriteButton` — star/unstar. - `HomePage` — greeting, Ask input, meetings/tasks. - `HomeMeetingsPanel` — meetings list. - `HomeTasksPanel` — tasks list. - `RecentChatsPanel` — Ask AI chats. - `DemoSeedBanner` — prompt to seed demo workspace. - `UserMenu` — profile/settings/logout. - `ToastProvider` — import/workflow/email states. - `GlobalModalProvider` — create record/task/list/email. - `RouteGuard` — auth + permissions. ### 17.д) Acceptance-критерии - **S190 ⬜** Homepage показывает приветствие, recent chat, Meetings и Tasks; при пустых интеграциях показывает demo/empty states. - **S372 ⬜** Settings navigation имеет Personal / Workspace / Data / Reports / Automations sections и корректные nested links. - **S398 ⬜** Центр уведомлений в topbar показывает mentions, tasks, assignments, workflow/sequence/import/billing events. - **S399 ⬜** Email digest notifications собираются по расписанию и отправляются пользователю. - **S400 ⬜** Demo-mode: без внешних keys работают demo-data, demo-SMTP, demo-AI, demo-Stripe/integrations. - **S401 ⬜** Seed demo-workspace создаёт объекты, записи, списки, workflow, sequence, calls, reports для прохождения acceptance. - **Связанные уже покрытые сценарии:** S396–S397 относятся к comments/@mention и реализуются в Record page, но notification delivery и центр уведомлений покрываются здесь. ### 17.е) Технические решения, воркеры BullMQ, edge-cases Очереди: ```ts notificationQueue emailDigestQueue demoSeedQueue navigationCacheQueue ``` Сервисы: ```ts navigationService.ts commandPaletteService.ts notificationService.ts favoriteService.ts preferenceService.ts homeService.ts demoSeedService.ts ``` Navigation payload strategy: 1. На каждый `GET /api/navigation`: - загрузить user/org; - загрузить visible objects через RBAC; - загрузить visible lists через RBAC; - загрузить favorites и отфильтровать недоступные; - подсчитать unread notifications/tasks/outbox/failures. 2. Кэшировать на 30–60 секунд per user/org. 3. Инвалидировать при: - create/archive object/list; - permissions change; - favorite change; - notification read/unread. Command palette search: - records: по `Record.searchText` и `displayName`; - objects/lists/views: по metadata; - actions: статический registry + context availability; - settings: route registry; - recent: `UserPreference.commandPaletteRecent`. Notification generation: - comment mention → notification to mentioned user; - comment reply → notification to thread author; - task assigned → notification to assignee; - workflow failed → notification to workflow owner/admin; - sequence failed → owner/sender; - import finished → importer; - billing alert → admins/owners; - integration error → connection owner/admin. Email digest: - `emailDigestQueue` runs daily. - Собирает unread notifications grouped by type. - Respect user preference. - Не отправлять digest, если no unread or email disabled. Demo seed idempotency: - `DemoSeedRun(seedVersion)` проверяется перед запуском. - Seed создаёт predictable keys: - objects companies/people/deals/users/workspaces/invoices; - lists Event Invitees, Recruiting, Customer Success, PQL; - sample workflows; - sample sequences; - calls/transcripts; - dashboards/reports; - AI credits. - Повторный seed не дублирует entities. - Reset доступен только demo workspace. Edge-cases: - User loses permission to favorited entity → favorite скрыт, но не удаляется. - Object archived → sidebar hides it unless settings includes archived filter. - No lists → sidebar shows empty state + Create list. - Command palette unavailable offline → локальные static commands still show. - Notification target deleted → notification opens safe fallback. - Digest email send fails → retry with exponential backoff. - Collapsed sidebar сохраняется per user. - Home page без calendar/email sync показывает demo prompts and onboarding tasks. --- ## 18. Технический стек и архитектура **Статус:** 🟡 частично **Покрытие:** архитектурная база для S001–S403 **Назначение раздела:** описать неизменяемый стек, структуру monorepo, backend/frontend layers, Prisma/PostgreSQL, BullMQ/Redis, zod validation, AI provider, Stripe, errors, demo-mode, env и запуск. В базе знаний указано, что проект строится на Next.js 14 App Router, Express/Prisma/PostgreSQL, BullMQ/Redis, @anthropic-ai/sdk, Stripe, zod и flexible CRM-схеме; README фиксирует MASTER_TZ как источник истины, BUILD_BASE как blueprint и schema.prisma как модель данных. :contentReference[oaicite:4]{index=4} ### 18.а) Архитектурное описание AISDR — metadata-driven CRM + AI-SDR layer. Ключевой принцип: - структура CRM хранится в metadata: - Object; - Attribute; - View; - List; - Workflow; - Report. - бизнес-данные хранятся универсально: - Record; - Value; - RelationshipValue. - UI строится из metadata. - AI/Sequences/Workflows/Reports работают поверх records, а не legacy Lead. - legacy Lead/Campaign/Sequence/Message сохраняются временно и мигрируют в flexible model. ### 18.б) Monorepo ```txt AISDR/ package.json package-lock.json apps/ backend/ package.json prisma/ schema.prisma migrations/ src/ config.ts index.ts routes/ services/ middleware/ utils/ worker/ frontend/ package.json next.config.js tailwind.config.ts src/ app/ components/ lib/ hooks/ styles/ ``` Root: ```json { "workspaces": [ "apps/backend", "apps/frontend" ], "scripts": { "dev": "npm run dev -w apps/backend & npm run dev -w apps/frontend", "build": "npm run build -w apps/backend && npm run build -w apps/frontend", "typecheck": "npm run typecheck -w apps/backend && npm run typecheck -w apps/frontend" } } ``` ### 18.в) Backend architecture Stack: - Node.js - Express - TypeScript - Prisma - PostgreSQL - BullMQ - ioredis - JWT - bcryptjs - jsonwebtoken - nodemailer - Stripe - zod - @anthropic-ai/sdk #### Backend layers ```txt apps/backend/src/ index.ts config.ts routes/ auth.ts objects.ts attributes.ts records.ts relationships.ts views.ts lists.ts activities.ts emails.ts notes.ts tasks.ts imports.ts sequences.ts workflows.ts calls.ts reports.ts ai.ts billing.ts settings.ts integrations.ts developers.ts navigation.ts notifications.ts demo.ts services/ authService.ts objectService.ts attributeService.ts recordService.ts valueService.ts relationshipService.ts viewService.ts listService.ts activityService.ts emailService.ts noteService.ts taskService.ts importService.ts sequenceService.ts workflowService.ts callService.ts reportService.ts aiService.ts creditService.ts billingService.ts stripeService.ts settingsService.ts permissionService.ts integrationService.ts developerService.ts navigationService.ts notificationService.ts bootstrapService.ts demoSeedService.ts legacyMigrationService.ts middleware/ authMiddleware.ts orgMiddleware.ts roleMiddleware.ts permissionMiddleware.ts validate.ts errorHandler.ts requestLogger.ts rateLimit.ts utils/ prisma.ts redis.ts logger.ts errors.ts asyncHandler.ts normalize.ts crypto.ts dates.ts csv.ts worker/ index.ts queues.ts processors/ importProcessor.ts emailProcessor.ts sequenceProcessor.ts workflowProcessor.ts aiProcessor.ts enrichmentProcessor.ts analyticsProcessor.ts billingProcessor.ts notificationProcessor.ts demoSeedProcessor.ts ``` #### Express bootstrap ```ts const app = express(); app.use(express.json({ limit: '10mb' })); app.use(cors({ origin: config.frontendUrl, credentials: true })); app.use(requestLogger); app.use('/api/auth', authRoutes); app.use('/api/objects', authMiddleware, orgMiddleware, objectsRoutes); app.use('/api/records', authMiddleware, orgMiddleware, recordsRoutes); app.use('/api/views', authMiddleware, orgMiddleware, viewsRoutes); app.use('/api/lists', authMiddleware, orgMiddleware, listsRoutes); app.use('/api/workflows', authMiddleware, orgMiddleware, workflowsRoutes); app.use('/api/sequences', authMiddleware, orgMiddleware, sequencesRoutes); app.use('/api/reports', authMiddleware, orgMiddleware, reportsRoutes); app.use('/api/settings', authMiddleware, orgMiddleware, settingsRoutes); app.use('/api/billing', authMiddleware, orgMiddleware, billingRoutes); app.use(errorHandler); ``` #### zod validation Правило: - каждый route имеет zod schema: - params; - query; - body. - `validate(schema)` кладёт parsed input в `req.validated`. - Все ошибки validation → единый `VALIDATION_ERROR`. Пример: ```ts const createObjectSchema = z.object({ body: z.object({ key: z.string().min(1).regex(/^[a-z0-9_]+$/), singularName: z.string().min(1), pluralName: z.string().min(1), icon: z.string().optional(), description: z.string().optional() }) }); ``` #### Error format ```json { "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": [ { "path": "body.key", "message": "Invalid key" } ], "requestId": "req_123" } } ``` Коды: - `UNAUTHORIZED` - `FORBIDDEN` - `NOT_FOUND` - `VALIDATION_ERROR` - `CONFLICT` - `RATE_LIMITED` - `PAYMENT_REQUIRED` - `INTEGRATION_ERROR` - `AI_PROVIDER_ERROR` - `QUERY_TIMEOUT` - `INTERNAL_ERROR` ### 18.г) Prisma/PostgreSQL architecture Существующая база: - `User` - `Organization` - `ApiKey` - legacy: - `Lead` - `Campaign` - `Sequence` - `CampaignLead` - `Message` - flexible CRM: - `Object` - `Attribute` - `AttributeOption` - `Record` - `Value` - `RelationshipDefinition` - `RelationshipValue` - `View` - `ViewColumn` - `ViewFilter` - `ViewSort` - `List` - `ListEntry` - `Activity` - `Email` - `Note` - `Task` Целевые расширения добавлены в предыдущих разделах: - `Workflow*` - `Sequence*` new model set - `Call*` - `Report*` - `Dashboard*` - `Credit*` - `Ai*` - `Permission*` - `Integration*` - `Notification*` - `Favorite*` - `ImportJob` - `MigrationJob` - `AuditLog` #### EAV rules - `Record` не хранит business fields. - Все business values лежат в `Value`. - `Value` имеет typed columns: - `textValue`; - `numberValue`; - `booleanValue`; - `dateValue`; - `jsonValue`; - `userValueId`; - `currencyAmount`; - `currencyCode`. - Backend записывает значение только в колонку, соответствующую `Attribute.type`. - `Record.displayName` и `Record.searchText` денормализуются. #### Query strategy Чтение таблицы: 1. Load object metadata. 2. Load active view. 3. Resolve visible columns. 4. Build base `Record` query: - `orgId`; - `objectId`; - `archivedAt=null`. 5. Apply filters. 6. Apply sorts. 7. Page records. 8. Fetch values for visible attributes. 9. Serialize DTO. Filters: - Phase 1: - Prisma relation filters. - Phase 2: - safe raw SQL query builder for complex AND/OR/grouping. - Operators: - eq; - neq; - contains; - gt; - lt; - in; - is_empty; - is_not_empty. Sort: - Easy: - createdAt; - updatedAt; - displayName. - Attribute sort: - raw SQL join on Value by attributeId. - Indexes: - `(attributeId, textValue)`; - `(attributeId, numberValue)`; - `(attributeId, dateValue)`. Search: - Phase 1: - `Record.searchText ILIKE`. - Phase 2: - PostgreSQL full-text search. - Phase 3: - dedicated search index. ### 18.д) Frontend architecture Stack: - Next.js 14 App Router - React 18 - TypeScript - TailwindCSS 3 - framer-motion - lucide-react - recharts - @dnd-kit - axios Routes: ```txt apps/frontend/src/app/ (auth)/ login/page.tsx register/page.tsx (dashboard)/ layout.tsx page.tsx crm/ [objectKey]/ page.tsx records/ [recordId]/page.tsx lists/ page.tsx [listId]/page.tsx emails/page.tsx tasks/page.tsx notes/page.tsx calls/page.tsx reports/page.tsx automations/ page.tsx sequences/ page.tsx [sequenceId]/page.tsx workflows/ page.tsx [workflowId]/page.tsx settings/ page.tsx general/page.tsx members/page.tsx billing/page.tsx apps/page.tsx developers/page.tsx security/page.tsx objects/page.tsx objects/[objectId]/page.tsx ``` Frontend libs: ```txt src/lib/ api.ts auth.ts crmApi.ts objects.ts records.ts attributes.ts views.ts lists.ts emails.ts sequences.ts workflows.ts reports.ts settings.ts billing.ts ai.ts ``` UI components: ```txt src/components/ shell/ AppShell.tsx Sidebar.tsx TopBar.tsx CommandPalette.tsx crm/ ObjectPage.tsx DataTable.tsx BoardView.tsx RecordPage.tsx DetailsPanel.tsx CreateAttributeModal.tsx CreateRecordModal.tsx settings/ SettingsLayout.tsx PermissionsTab.tsx MembersTable.tsx AppsCatalog.tsx automations/ SequenceBuilder.tsx WorkflowBuilder.tsx reports/ DashboardGrid.tsx ReportBuilder.tsx ``` Frontend rules: - Все API calls идут через axios instance. - JWT хранится в localStorage key `ai_sdr_token`. - API base URL: `NEXT_PUBLIC_API_URL`. - UI должен graceful handle: - loading; - empty; - error; - no permission; - demo mode. ### 18.е) BullMQ/Redis workers All queues: ```ts export const queues = { importQueue, emailQueue, outboxQueue, sequenceQueue, sequenceTrackingQueue, workflowQueue, workflowDelayQueue, workflowWebhookQueue, aiQueue, aiResearchQueue, enrichmentQueue, callProcessingQueue, callInsightQueue, analyticsQueue, reportSnapshotQueue, billingQueue, stripeWebhookQueue, notificationQueue, emailDigestQueue, integrationSyncQueue, webhookDeliveryQueue, migrationQueue, demoSeedQueue }; ``` Queue responsibilities: - `importQueue` — CSV import objects/lists. - `emailQueue` — transactional/demo email send. - `outboxQueue` — queued manual and sequence emails. - `sequenceQueue` — enrollments, next step scheduling, sending windows. - `sequenceTrackingQueue` — open/reply/booked/unsubscribe. - `workflowQueue` — workflow runs. - `workflowDelayQueue` — delayed workflow resume. - `workflowWebhookQueue` — inbound workflow webhooks. - `aiQueue` — classify/summarize/prompt. - `aiResearchQueue` — research agent. - `enrichmentQueue` — record enrichment/communication intelligence. - `callProcessingQueue` — transcript processing. - `callInsightQueue` — call AI insights. - `analyticsQueue` — report calculations. - `reportSnapshotQueue` — historical snapshots. - `billingQueue` — credit grants, subscription sync. - `stripeWebhookQueue` — Stripe events. - `notificationQueue` — in-app notifications. - `emailDigestQueue` — notification digest. - `integrationSyncQueue` — Gmail/Calendar/Slack/etc sync. - `webhookDeliveryQueue` — outbound webhooks. - `migrationQueue` — legacy/import migrations. - `demoSeedQueue` — demo workspace. Worker process: ```ts async function startWorker() { await startImportProcessor(); await startEmailProcessor(); await startSequenceProcessor(); await startWorkflowProcessor(); await startAiProcessor(); await startEnrichmentProcessor(); await startAnalyticsProcessor(); await startBillingProcessor(); await startNotificationProcessor(); } ``` Worker rules: - Every job must be idempotent. - Every external call has timeout. - Every retry uses exponential backoff. - Failed jobs create Activity/Notification where relevant. - Jobs store structured logs. ### 18.ж) AI architecture Provider abstraction: ```ts interface AiProvider { generateText(input: AiGenerateInput): Promise<AiGenerateResult>; generateJson<T>(input: AiGenerateInput): Promise<T>; } ``` Providers: - `AnthropicProvider`: - uses `@anthropic-ai/sdk`; - model from env `ANTHROPIC_MODEL`. - `DemoAiProvider`: - deterministic; - no network; - works in tests/demo. AI call lifecycle: 1. Create `AiRun(status=QUEUED)`. 2. Check/reserve credits. 3. Execute provider. 4. Persist output. 5. Debit/release credits. 6. Write value/action/email/summary if confirmed or automated. ### 18.з) Stripe architecture Stripe usage: - subscription plans; - checkout sessions; - customer portal; - credit packages; - webhook processing. Required Stripe events: - `checkout.session.completed` - `customer.subscription.created` - `customer.subscription.updated` - `customer.subscription.deleted` - `invoice.paid` - `invoice.payment_failed` Rules: - Stripe webhook route must use raw body. - Webhook idempotency by `event.id`. - Never trust frontend plan state. - Plan limits enforced in backend services. ### 18.и) Demo-mode Demo-mode requirements: - app runs without: - Anthropic key; - SMTP; - Stripe keys; - Slack/Gmail/Calendar OAuth; - Call recorder provider. - fallback behavior: - demo SMTP writes Email/Activity but does not send; - demo AI returns deterministic outputs; - demo Stripe marks plan as starter/pro; - demo integrations show connected/simulated status; - demo call upload creates transcript insights; - demo seed creates full workspace. ### 18.к) Env-переменные ```bash # Runtime NODE_ENV=development PORT=3001 FRONTEND_URL=http://localhost:3010 NEXT_PUBLIC_API_URL=http://localhost:3001 # Database DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aisdr # Auth JWT_SECRET=replace_me JWT_EXPIRES_IN=7d BCRYPT_ROUNDS=10 # Redis / BullMQ REDIS_URL=redis://localhost:6379 # Email SMTP_HOST= SMTP_PORT=587 SMTP_USER= SMTP_PASS= SMTP_FROM=no-reply@aisdr.local DEMO_EMAIL_MODE=true # AI ANTHROPIC_API_KEY= ANTHROPIC_MODEL=claude-3-5-sonnet-latest DEMO_AI_MODE=true # Stripe STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= STRIPE_PRICE_FREE= STRIPE_PRICE_PLUS= STRIPE_PRICE_PRO= STRIPE_PRICE_ENTERPRISE= STRIPE_CREDITS_PRICE_1000= # Integrations SLACK_CLIENT_ID= SLACK_CLIENT_SECRET= GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= MICROSOFT_CLIENT_ID= MICROSOFT_CLIENT_SECRET= TYPEFORM_CLIENT_ID= TYPEFORM_CLIENT_SECRET= # Storage STORAGE_PROVIDER=local S3_ENDPOINT= S3_BUCKET= S3_ACCESS_KEY_ID= S3_SECRET_ACCESS_KEY= # Security ENCRYPTION_KEY=replace_with_32_byte_key API_RATE_LIMIT_PER_MINUTE=120 ``` ### 18.л) Запуск Local dev: ```bash npm install npm run prisma:generate -w apps/backend npm run prisma:migrate -w apps/backend npm run dev -w apps/backend npm run dev -w apps/frontend ``` Backend: ```bash cd apps/backend npm run dev npm run worker npm run build npm run typecheck ``` Frontend: ```bash cd apps/frontend npm run dev -- --port 3010 npm run build npm run typecheck ``` Database: ```bash cd apps/backend npx prisma generate npx prisma migrate dev npx prisma studio ``` Production: ```bash npm run build npm run start -w apps/backend npm run start -w apps/frontend npm run worker -w apps/backend ``` ### 18.м) Acceptance / архитектурные критерии - Все endpoints требуют auth, кроме register/login/webhook/public tracking pixels. - Все org-scoped queries фильтруются по `orgId`. - Все body/query/params валидируются zod. - Все ошибки возвращаются в едином формате. - Все write actions создают audit/activity там, где это нужно. - Все async external calls идут через BullMQ. - Все jobs idempotent. - Demo-mode покрывает S400/S401. - Legacy Lead/Campaign не удаляется до завершения migration S402. - Frontend routes не должны зависеть от legacy Lead для нового CRM UX. - TypeScript build должен быть зелёным. - Prisma migrations должны быть применимы с нуля. - Seed/bootstrap должен быть идемпотентным. --- ## 19. Дорожная карта — блоки, сценарии, статус, приоритеты **Статус:** рабочий план реализации **Назначение раздела:** покрыть все сценарии S001–S403 из каталога и дать порядок реализации так, чтобы платформа дошла до рабочего end-to-end состояния. Каталог сценариев начинается с Objects S001–S007 и дальше распределяет модули по Objects, Attributes, Relationships, Records, Views, Lists, Record page, Email/productivity, AI, Ask, Sequences, Workflows, Reports, Calls, Import, Permissions, Apps, Settings, Email sync/enrichment, Notifications/demo/onboarding. :contentReference[oaicite:5]{index=5} ### 19.а) Принципы приоритизации 1. **Сначала playable flexible CRM foundation** - auth; - bootstrap; - objects; - attributes; - records; - views; - record page; - lists; - import. 2. **Затем коммуникации и AI-SDR** - emails; - sequences; - AI attributes; - Ask AI; - credits. 3. **Затем automation engine** - workflows trigger/logic/actions/integrations/runs. 4. **Затем analytics** - reports/dashboards/historical snapshots. 5. **Затем enterprise layer** - settings; - RBAC; - apps; - developers; - security; - billing enforcement. 6. **Всегда поддерживать demo-mode** - без внешних ключей; - seed workspace; - acceptance runnable locally. ### 19.б) Roadmap table | Приоритет | Блок | Разделы MASTER_TZ | Сценарии Sxxx | Статус | Зависимости | Результат | |---:|---|---|---|---|---|---| | P0 | Auth + bootstrap + demo seed | §2, §3, §17, §18 | S005, S190, S400, S401, S403 | 🟡 | — | Новый пользователь получает готовый demo/workspace с 5 стандартными объектами и рабочей навигацией | | P0 | Objects foundation | §3, §16 | S001–S007 | 🟡 | Auth, bootstrap | Companies/People/Deals/Users/Workspaces + custom objects settings | | P0 | Attributes foundation | §4 | S010–S034 | 🟡 | Objects | Все типы атрибутов, required/unique/system/order/archive | | P0 | Relationships | §5 | S040–S049 | ⬜ | Objects, Attributes, Records | Двусторонние связи, cardinality, relationship columns/drill-in | | P0 | Records CRUD | §5/§6/§8 | S060–S067 | 🟡 | Objects, Attributes | Create/update/delete/search/page records, bulk select | | P0 | Views table/board/filter/sort | §6 | S080–S092 | 🟡 | Records, Attributes | Saved views, table/board, filters, sorts, columns, calculations | | P0 | Navigation / AppShell | §17 | S190, S372, S398 | 🟡 | Auth, Objects, Lists | Sidebar, topbar, command palette, notification entrypoint | | P1 | Record page customization | §8 | S120–S137 | 🟡 | Records, Relationships, Email/Notes/Tasks | Details, highlights, tabs, comments/@mentions | | P1 | Notes/tasks/email productivity | §10, §8 | S140–S149 | ⬜ | Record page, Email model | Compose email, templates, tasks, outbox | | P1 | Lists MVP | §7 | S100–S109 | ⬜ | Records, Views | Lists, list attributes, list entries, list board/table | | P1 | Import objects/lists | §3, §7, §16 | S330–S338 | 🟡 | Objects, Attributes, Lists | CSV upload, mapping, dedupe, preview, import history | | P1 | Settings core + RBAC | §16 | S345–S356, S372–S381 | ⬜ | Membership, permissions resolver | Members/teams/permissions/plans/billing/security/migrate | | P1 | Email sync + enrichment | §9, §10 | S386–S392 | ⬜ | Email/calendar accounts, Records | Mailbox/calendar sync, auto People/Company, communication intelligence | | P2 | AI attributes + credits | §4, §15, §16 | S160–S173, S376–S378 | ⬜ | AI provider, Credits, Attributes | 4 AI attribute types, run from UI, credit accounting | | P2 | Ask Attio / AI assistant | §15, §17 | S180–S190 | ⬜ | AI provider, Search, Notes/Emails/Calls | Ask anything, prep, objections, saved prompts, suggested actions | | P2 | Sequences | §11, §10, §16 | S200–S224, S149 | ⬜ | Email accounts, Records, Lists, Credits optional | Sequence editor, enroll, delivery limits, outbox, tracking, unsubscribe | | P2 | Apps & Integrations | §16, §12 | S362–S367, S268–S273, S386–S392 | ⬜ | Settings, OAuth storage | Apps catalog, Slack/Gmail/Calendar/Linear/PandaDoc, webhooks | | P3 | Workflows trigger/logic | §12 | S230–S247 | ⬜ | Records, Lists, Permissions | Workflow builder, triggers, logic, delay, variables, templates | | P3 | Workflows actions/AI/integrations/runs | §12, §15 | S255–S276 | ⬜ | Workflows base, AI, Integrations | Create/update/find records, list, task, formula, HTTP, Slack, runs | | P3 | Reports & Dashboards | §14 | S285–S297 | 🟡 | Views, Value history, Reports schema | Insight/historical/funnel/time-in-stage/stage-changed, widgets, drill-in | | P3 | Call Intelligence | §13, §15 | S310–S322 | ⬜ | AI provider, Storage, Record page | Call upload/recorder, transcript, insight templates, playback | | P4 | Notifications/collaboration | §8, §17 | S136–S137, S396–S399 | ⬜ | Comments, Notification service | Mentions, replies, notification center, email digest | | P4 | Legacy migration | §18, §16 | S402, S381 | ⬜ | Flexible CRM stable | Lead/Campaign → People/Companies/Sequences migration | | P4 | Hardening, tests, observability | §18, §20 | all Sxxx | ⬜ | All modules | tsc/build green, automated tests, logs, metrics, backup/restore | ### 19.в) Coverage by scenario module | Модуль каталога | Сценарии | Разделы | Статус | Приоритет | |---|---|---|---|---| | Objects | S001–S007 | §3, §16, §17 | 🟡 | P0 | | Attributes | S010–S034 | §4, §6, §16 | 🟡 | P0 | | Relationships | S040–S049 | §5, §6, §8 | ⬜ | P0 | | Records | S060–S067 | §5, §8, §17 | 🟡 | P0 | | Views | S080–S092 | §6, §14 | 🟡 | P0 | | Lists | S100–S109 | §7, §11, §12 | ⬜ | P1 | | Record page | S120–S137 | §8, §10, §13, §17 | 🟡 | P1 | | Email/productivity | S140–S149 | §10, §11, §17 | ⬜ | P1 | | AI attributes | S160–S173 | §4, §15, §16 | ⬜ | P2 | | Ask Attio | S180–S190 | §15, §17 | ⬜ | P2 | | Sequences | S200–S224 | §11, §10, §16 | ⬜ | P2 | | Workflows triggers/logic | S230–S247 | §12, §16 | ⬜ | P3 | | Workflows actions/integrations/runs | S255–S276 | §12, §15, §16 | ⬜ | P3 | | Reports | S285–S297 | §14, §16 | 🟡 | P3 | | Call Intelligence | S310–S322 | §13, §15, §16 | ⬜ | P3 | | Import | S330–S338 | §3, §7, §16, §18 | 🟡 | P1 | | Permissions/RBAC | S345–S356 | §16, §18 | ⬜ | P1 | | Apps & Integrations | S362–S367 | §16, §10, §12 | ⬜ | P2 | | Settings / Workspace / Billing | S372–S381 | §16, §17, §18 | ⬜ | P1 | | Email sync & enrichment | S386–S392 | §9, §10, §16 | ⬜ | P1 | | Notifications / collaboration / demo | S396–S403 | §8, §16, §17, §18 | ⬜ | P0–P4 | ### 19.г) Реализационные фазы #### Phase 0 — Stabilize foundation | Блок | Сценарии | Команды проверки | |---|---|---| | Auth/register/login/me | base | `npm run typecheck -w apps/backend` | | Bootstrap 5 objects | S005, S403 | `POST /api/crm/bootstrap`, проверить idempotency | | Demo seed | S400–S401 | `POST /api/demo/seed` | | AppShell navigation | S190, S372, S398 | открыть frontend на `localhost:3010` | Done when: - login работает; - workspace создаётся; - bootstrap создаёт Companies/People/Deals/Users/Workspaces; - sidebar показывает Records/Lists; - demo seed повторно не создаёт дубли. #### Phase 1 — Flexible CRM MVP | Блок | Сценарии | Статус | |---|---|---| | Objects settings | S001–S007 | ⬜/🟡 | | Attributes UI + validation | S010–S034 | ⬜/🟡 | | Relationships | S040–S049 | ⬜ | | Records | S060–S067 | 🟡 | | Views | S080–S092 | 🟡 | | Lists | S100–S109 | ⬜ | | Record page base | S120–S137 | 🟡 | | Import | S330–S338 | 🟡 | Done when: - пользователь создаёт custom object; - создаёт attributes всех типов; - создаёт records; - table/board views сохраняются; - relationships двусторонние; - list создаётся и отображается; - record page показывает details/activity/notes/tasks/comments. #### Phase 2 — Communication + AI-SDR | Блок | Сценарии | Статус | |---|---|---| | Email composer/templates/outbox | S140–S149 | ⬜ | | AI attributes | S160–S173 | ⬜ | | Ask Attio | S180–S190 | ⬜ | | Sequences | S200–S224 | ⬜ | | Credits/Billing AI | S170–S173, S376–S378 | ⬜ | | Email sync/enrichment | S386–S392 | ⬜ | Done when: - email can be drafted/sent in demo; - AI attributes run and save values; - credits debit/history works; - sequence sends demo emails respecting window/limits; - Ask can prep day, summarize objections, draft email; - demo mailbox sync creates People/Companies. #### Phase 3 — Automation + integrations | Блок | Сценарии | Статус | |---|---|---| | Workflows builder | S230 | ⬜ | | Triggers | S231–S237 | ⬜ | | Logic | S238–S247 | ⬜ | | Actions | S255–S261 | ⬜ | | Calculations | S262–S264 | ⬜ | | AI blocks | S265–S266 | ⬜ | | Loop/find | S267 | ⬜ | | Slack/HTTP/JSON/integrations | S268–S273 | ⬜ | | Runs | S274–S276 | ⬜ | | Apps catalog/developers | S362–S367 | ⬜ | Done when: - workflow can be created, published, triggered; - workflow can update record/list/task; - delay/resume works; - Slack/HTTP demo works; - runs show history and errors. #### Phase 4 — Analytics + Calls | Блок | Сценарии | Статус | |---|---|---| | Reports | S285–S297 | 🟡/⬜ | | Call Intelligence | S310–S322 | ⬜ | | Historical snapshots | S286–S289 | ⬜ | | Drill-in | S297 | ⬜ | Done when: - report builder supports five report types; - dashboard widgets render via recharts; - drill-in opens records; - call transcript upload produces AI summary; - Calls tab and Calls page work. #### Phase 5 — Enterprise settings + migration + hardening | Блок | Сценарии | Статус | |---|---|---| | RBAC | S345–S356 | ⬜ | | Settings/Billing/Security | S372–S381 | ⬜ | | Notifications | S396–S399 | ⬜ | | Legacy migration | S402 | ⬜ | | Full testing | all | ⬜ | Done when: - permissions enforce backend + UI; - Stripe subscriptions/credits work; - security settings and audit log exist; - notifications center/digest work; - legacy Lead/Campaign migrates idempotently. ### 19.д) Dependencies graph ```txt Auth └─ Workspace/Org ├─ Bootstrap │ ├─ Objects │ │ ├─ Attributes │ │ │ ├─ Records │ │ │ │ ├─ Views │ │ │ │ ├─ Record Page │ │ │ │ ├─ Lists │ │ │ │ ├─ Import │ │ │ │ ├─ Email/Tasks/Notes │ │ │ │ ├─ AI Attributes │ │ │ │ ├─ Sequences │ │ │ │ ├─ Workflows │ │ │ │ └─ Reports │ │ │ └─ Relationships │ │ └─ Settings Objects │ └─ Demo Seed ├─ Members/RBAC │ ├─ Settings │ ├─ Permissions │ ├─ Workflows grants │ └─ Dashboard/List/Sequence permissions ├─ Integrations │ ├─ Email sync │ ├─ Calendar sync │ ├─ Slack workflow blocks │ └─ Apps widgets ├─ AI Provider │ ├─ AI Attributes │ ├─ Ask Attio │ ├─ Workflow AI blocks │ ├─ Call insights │ └─ Email drafting └─ Billing/Credits ├─ AI credits ├─ Stripe checkout └─ Plan enforcement ``` ### 19.е) Definition of Done для каждого блока Каждый roadmap-блок считается завершённым, если: 1. Есть Prisma migration и `npx prisma generate` проходит. 2. Есть zod schemas для API. 3. Все endpoints возвращают единый error format. 4. Все queries scoped by `orgId`. 5. RBAC enforced для read/write. 6. Frontend screen имеет: - loading state; - empty state; - error state; - no permission state. 7. Acceptance scenarios Sxxx можно пройти вручную. 8. Demo-mode не ломается без внешних ключей. 9. `npm run typecheck -w apps/backend` зелёный. 10. `npm run build -w apps/frontend` зелёный. 11. Для worker-фич есть idempotent BullMQ job. 12. Есть seed/demo data для проверки. ### 19.ж) Финальная цель roadmap После реализации всех P0–P5 AISDR должен покрывать весь сценарный каталог S001–S403: - гибкая CRM-модель уровня Attio; - стандартные и кастомные объекты; - все типы атрибутов; - relationships; - records/views/lists; - record pages; - email productivity; - AI attributes; - Ask assistant; - sequences; - workflows; - reports/dashboards; - call intelligence; - imports/migrations; - RBAC; - apps/integrations/developer platform; - billing/credits/security; - notifications/collaboration; - demo-mode без внешних ключей.


---

20. Тестирование — unit, integration, e2e, manual acceptance, scenario coverage, CI

Статус: ⬜ не начато
Покрытие: все S001–S403
Назначение раздела: зафиксировать тестовую стратегию, которая превращает MASTER_TZ и каталог сценариев в проверяемую матрицу качества. Источником сценарного покрытия является полный каталог acceptance-сценариев S001–S403; база Academy также подтверждает разбиение сценариев по модулям ТЗ: permissions, Ask, objects, record page, apps, reports, imports, calls, AI attributes, sequences, workflows, email sync и др. 


20.а) Общая стратегия тестирования

Тестирование AISDR строится в 5 слоёв:

Unit tests

сервисы;

валидаторы;

permission resolver;

value normalizers;

workflow runtime helpers;

sequence scheduler;

credit accounting;

AI demo provider;

report query builders.

Integration tests

API routes + Prisma test DB;

BullMQ processors with test Redis;

Stripe webhook handlers;

email outbox;

import pipeline;

AI runs + credits;

permissions enforcement;

migrations.

E2E tests

Playwright;

browser-level flows;

user journey from login to CRM usage;

sequence/workflow/report/call flows;

settings/RBAC flows.

Manual acceptance

ручная проверка каждого Sxxx по чек-листу;

обязательна для UI parity с Attio-like UX;

используется перед крупными релизами.

Build gates / CI

TypeScript;

lint;

Prisma generate/migrate;

backend tests;

frontend build;

smoke tests;

demo-mode smoke without external keys.

Цель: каждый Sxxx должен иметь хотя бы один из типов проверки:

unit;

integration;

e2e;

manual;

smoke.

20.б) Инструменты
Backend
apps/backend:
- TypeScript compiler
- Jest или Vitest
- Supertest для Express API
- Prisma test database
- BullMQ test worker harness
- ioredis test instance
- zod schema tests
- Stripe webhook fixture tests
- nodemailer mock transport
- Anthropic demo/mock provider

Рекомендуемый выбор:

Vitest + Supertest + Testcontainers/local Docker services

Если нужен минимум зависимостей:

Jest + Supertest + локальные Postgres/Redis из docker-compose
Frontend
apps/frontend:
- TypeScript compiler
- ESLint
- React Testing Library
- Vitest
- Playwright
- axe checks для базовой доступности
E2E
Playwright:
- chromium mandatory
- firefox/webkit optional
- trace on retry
- screenshots on failure
- video on failure for CI artifacts
CI
GitHub Actions / GitLab CI:
- postgres service
- redis service
- npm workspaces cache
- prisma generate
- prisma migrate deploy/test
- backend typecheck/test
- frontend typecheck/build
- e2e smoke
20.в) Test data / seed

Тестовые данные делятся на 4 набора.

1. Minimal seed

Используется для unit/integration:

Organization:
- Basepoint Demo

Users:
- owner@aisdr.test
- admin@aisdr.test
- member@aisdr.test
- contractor@aisdr.test

Objects:
- companies
- people
- deals
- workspaces
- users

Attributes:
- system attributes
- title fields
- select/status fields
- relationship fields
- AI attributes

Records:
- Cosme
- Picoma
- VortexAI
- Lisa Cosme
- Marisa McGill
- sample deal
2. Acceptance seed

Используется для E2E и manual acceptance:

Objects:
- Companies
- People
- Deals
- Workspaces
- Users
- Invoices

Lists:
- Inbound Leads
- Recruiting
- Event Invitees
- Customer Success
- Onboarding Pipeline
- PQL

Views:
- All Companies
- Deals overview
- Marisa: Inbound leads
- Recently Contacted People
- All Invoices

Sequences:
- Event Invitees
- ICP inbound leads

Workflows:
- Notify team when deal won
- Enroll high-priority inbound lead
- Add Customer Success Record on Deal Stage Change

Reports:
- Revenue Dashboard
- Sales Overview
- Companies by Country
- Open Pipeline by Stage

Calls:
- Basepoint discussion
- Pricing discussion
- Demo onboarding call
3. Scale seed

Используется для performance:

Records:
- 10 000 companies
- 50 000 people
- 25 000 deals
- 10 000 workspaces
- 100 000 values

Activities:
- 250 000 activities
- 100 000 emails
- 50 000 tasks
- 10 000 notes

Reports:
- 12 months of snapshots
4. Demo seed

Используется для S400–S401:

No external keys:
- DEMO_AI_MODE=true
- DEMO_EMAIL_MODE=true
- fake Stripe state
- simulated integrations
- simulated call transcripts
- deterministic AI outputs
20.г) Unit testing

Unit tests не должны ходить во внешние сервисы.

Backend unit targets
authService:
- password hash/verify
- JWT issue/verify
- invalid token

permissionService:
- owner full access
- admin settings access
- workspace/team/individual priority
- no access hides entity
- workflow automation grant

attributeService:
- key normalization
- required/unique validation
- system attribute protection
- AI attribute compatibility

valueService:
- typed value serialization
- text/number/date/currency/select/multi-select/relationship validation
- searchText update

viewService:
- filter validation
- sort validation
- column ordering
- empty filters

listService:
- list entry uniqueness
- list-specific attributes

sequenceService:
- sending window calculation
- business days only
- hourly/daily limits
- exit criteria
- unsubscribe protection

workflowService:
- graph validation
- cycle detection
- variable resolution
- branch matching
- retry policy

aiService:
- demo provider
- credit cost calculation
- prompt construction
- response parsing

reportService:
- metric validation
- group/segment config
- funnel stage ordering
- historical interval calculation

billingService:
- Stripe event idempotency
- credit grant
- checkout session validation

Пример структуры:

apps/backend/src/services/__tests__/
  permissionService.test.ts
  attributeService.test.ts
  valueService.test.ts
  viewService.test.ts
  sequenceService.test.ts
  workflowService.test.ts
  aiService.test.ts
  reportService.test.ts
  billingService.test.ts

Команда:

Bash
npm run test -w apps/backend
20.д) Integration testing

Integration tests используют реальную test DB и Redis.

API integration targets
Auth:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

Objects:
- GET/POST/PATCH /api/objects
- bootstrap standard objects
- custom object create

Attributes:
- create all attribute types
- unique conflict
- required validation
- archive/reorder

Records:
- create/update/read/delete
- values validation
- bulk actions
- search

Views:
- create/update view
- filters
- sorts
- columns
- board config

Lists:
- create list
- add/remove entries
- list attributes
- list table/board

Record page:
- activities
- emails
- calls
- notes
- tasks
- comments
- files

Emails:
- compose
- template
- outbox
- tracking pixel
- reply webhook/demo

Sequences:
- create sequence
- publish
- enroll
- send step
- exit on reply
- unsubscribe

Workflows:
- create/publish graph
- manual run
- record updated trigger
- webhook trigger
- delayed resume
- failed run retry

AI:
- AI attributes
- Ask chat
- research demo
- credits debit/refund

Reports:
- create dashboard
- create report
- query report
- drilldown

Calls:
- upload transcript
- process insight
- link to record

Settings/RBAC:
- members
- teams
- grants
- effective access
- apps
- API keys
- webhooks
- billing
- security

Import/migration:
- CSV upload
- mapping
- preview
- run
- import history

Команда:

Bash
npm run test:integration -w apps/backend

Требование:

каждый integration test очищает данные по orgId;

нельзя использовать production DB;

все test users имеют predictable credentials;

внешние провайдеры mock/demo.

20.е) E2E testing

E2E проверяет реальные user flows в браузере.

Playwright suites
e2e/
  auth.spec.ts
  navigation.spec.ts
  objects.spec.ts
  attributes.spec.ts
  records.spec.ts
  views.spec.ts
  lists.spec.ts
  record-page.spec.ts
  email-productivity.spec.ts
  ai-attributes.spec.ts
  ask-ai.spec.ts
  sequences.spec.ts
  workflows.spec.ts
  reports.spec.ts
  calls.spec.ts
  import.spec.ts
  settings-rbac.spec.ts
  apps-developers.spec.ts
  billing-security.spec.ts
  demo-mode.spec.ts
E2E smoke path

Минимальный smoke для каждого PR:

1. register/login
2. seed demo workspace
3. open Companies
4. create custom attribute
5. create Company record
6. open record page
7. add note/task/comment
8. send demo email
9. create list and add record
10. create AI attribute and run demo AI
11. create sequence draft
12. create workflow draft
13. open Revenue Dashboard
14. open Settings → Billing

Команда:

Bash
npm run test:e2e -w apps/frontend
20.ж) Manual acceptance

Manual acceptance — обязательный слой для Attio-like интерфейсов, потому что часть критериев касается визуального/интерактивного паритета:

плотность таблиц;

hover controls;

dropdowns;

drawers;

modals;

drag-and-drop;

kanban;

workflow canvas;

sequence editor;

report builder;

call player;

settings layout.

Manual checklist хранится в репозитории:

docs/acceptance/
  S001-S007_objects.md
  S010-S034_attributes.md
  S040-S049_relationships.md
  S060-S067_records.md
  S080-S092_views.md
  S100-S109_lists.md
  S120-S137_record_page.md
  S140-S149_email_productivity.md
  S160-S173_ai_attributes.md
  S180-S190_ask_ai.md
  S200-S224_sequences.md
  S230-S276_workflows.md
  S285-S297_reports.md
  S310-S322_calls.md
  S330-S338_import.md
  S345-S356_rbac.md
  S362-S367_apps.md
  S372-S381_settings_billing_security.md
  S386-S392_email_sync_enrichment.md
  S396-S403_notifications_demo_onboarding.md

Формат одного сценария:

Markdown
### S001 — Standard objects exist

**Precondition:**
- User is logged in as Admin.
- Demo workspace seeded.

**Steps:**
1. Open sidebar.
2. Open Records section.
3. Verify Companies, People, Deals, Workspaces, Users.

**Expected:**
- All standard objects are visible.
- Each opens a table view.
- No console errors.

**Automation:**
- e2e: objects.spec.ts
- smoke: yes

**Status:**
- ⬜ not verified
20.з) Scenario coverage matrix S001–S403
Сценарии	Модуль	Основной тест	Доп. тест	Manual
S001–S007	Objects	objects.spec.ts	objectService.test.ts	✅
S010–S034	Attributes	attributes.spec.ts	attributeService.test.ts, valueService.test.ts	✅
S040–S049	Relationships	relationships.spec.ts	relationshipService.test.ts	✅
S060–S067	Records	records.spec.ts	recordService.test.ts	✅
S080–S092	Views	views.spec.ts	viewService.test.ts	✅
S100–S109	Lists	lists.spec.ts	listService.test.ts	✅
S120–S137	Record page	record-page.spec.ts	activityService.test.ts	✅
S140–S149	Email/productivity	email-productivity.spec.ts	emailService.test.ts, taskService.test.ts	✅
S160–S173	AI attributes	ai-attributes.spec.ts	aiService.test.ts, creditService.test.ts	✅
S180–S190	Ask AI	ask-ai.spec.ts	aiChatService.test.ts	✅
S200–S224	Sequences	sequences.spec.ts	sequenceService.test.ts, sequenceProcessor.test.ts	✅
S230–S247	Workflow triggers/logic	workflows.spec.ts	workflowService.test.ts	✅
S255–S276	Workflow actions/runs	workflows.spec.ts	workflowProcessor.test.ts	✅
S285–S297	Reports	reports.spec.ts	reportService.test.ts, analyticsProcessor.test.ts	✅
S310–S322	Calls	calls.spec.ts	callService.test.ts, callInsightProcessor.test.ts	✅
S330–S338	Import	import.spec.ts	importService.test.ts, importProcessor.test.ts	✅
S345–S356	RBAC	settings-rbac.spec.ts	permissionService.test.ts	✅
S362–S367	Apps/developers	apps-developers.spec.ts	integrationService.test.ts, webhookService.test.ts	✅
S372–S381	Settings/billing/security	billing-security.spec.ts	billingService.test.ts, securityService.test.ts	✅
S386–S392	Email sync/enrichment	email-sync-enrichment.spec.ts	enrichmentService.test.ts	✅
S396–S403	Notifications/demo/onboarding/migration	demo-mode.spec.ts, navigation.spec.ts	notificationService.test.ts, demoSeedService.test.ts, legacyMigrationService.test.ts	✅
20.и) Build gates

Каждый PR должен проходить gates:

Bash
npm ci
npm run typecheck -w apps/backend
npm run typecheck -w apps/frontend
npm run lint -w apps/backend
npm run lint -w apps/frontend
npm run prisma:generate -w apps/backend
npm run test -w apps/backend
npm run test -w apps/frontend
npm run build -w apps/backend
npm run build -w apps/frontend
npm run test:e2e:smoke -w apps/frontend

Если в проекте пока нет lint/test scripts, они добавляются как отдельный технический шаг, но gate считается целевым.

Hard gates

tsc=0 backend.

tsc=0 frontend.

Prisma generate success.

Prisma migrate success на пустой DB.

Backend unit tests pass.

Frontend build pass.

Smoke E2E pass.

Demo-mode smoke pass without external keys.

Soft gates

full E2E pass;

performance benchmarks;

visual regression;

accessibility scan;

security scan.

20.к) Demo-mode testing без ключей

Demo-mode должен запускаться в чистом окружении без внешних секретов:

Bash
ANTHROPIC_API_KEY=
SMTP_HOST=
STRIPE_SECRET_KEY=
SLACK_CLIENT_ID=
GOOGLE_CLIENT_ID=
MICROSOFT_CLIENT_ID=
DEMO_AI_MODE=true
DEMO_EMAIL_MODE=true

Проверки:

S400:
- app starts without external keys
- login/register works
- demo AI returns deterministic values
- demo email writes to outbox/activity
- demo Stripe returns fake checkout/plan state
- demo integrations show simulated status

S401:
- seed demo workspace creates objects
- seed creates records
- seed creates lists/views
- seed creates workflows/sequences
- seed creates reports/calls
- repeated seed is idempotent

Команда:

Bash
npm run test:demo -w apps/backend
npm run test:e2e:demo -w apps/frontend
20.л) Performance testing

Performance тесты обязательны для EAV, views, filters, reports.

Benchmarks
Table view:
- 10k records, 20 visible columns: p95 < 700ms backend
- 50k records, indexed filter: p95 < 900ms backend
- first page frontend render: p95 < 1500ms

Search:
- 100k records searchText: p95 < 500ms

Filters:
- simple filter: p95 < 500ms
- 5-condition AND: p95 < 900ms
- nested AND/OR: p95 < 1500ms or async query fallback

Reports:
- cached dashboard load: p95 < 700ms
- cold report query: p95 < 3000ms
- historical report from snapshots: p95 < 1500ms

Workflow:
- trigger enqueue: p95 < 200ms
- first step start: p95 < 1000ms

Sequences:
- outbox scheduling batch 10k recipients: bounded async job, no request timeout
20.м) CI pipeline
YAML
name: aisdr-ci

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: aisdr_test
        ports:
          - 5432:5432

      redis:
        image: redis:7
        ports:
          - 6379:6379

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/aisdr_test
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: test_secret
      DEMO_AI_MODE: "true"
      DEMO_EMAIL_MODE: "true"
      NEXT_PUBLIC_API_URL: http://localhost:3001

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run prisma:generate -w apps/backend

      - run: npm run prisma:migrate -w apps/backend

      - run: npm run typecheck -w apps/backend

      - run: npm run typecheck -w apps/frontend

      - run: npm run lint -w apps/backend

      - run: npm run lint -w apps/frontend

      - run: npm run test -w apps/backend

      - run: npm run test -w apps/frontend

      - run: npm run build -w apps/backend

      - run: npm run build -w apps/frontend

      - run: npm run test:e2e:smoke -w apps/frontend
20.н) Acceptance: проверка всех S001–S403

Финальный acceptance gate:

Для каждого Sxxx:
- есть строка в docs/acceptance/coverage.csv
- указан module
- указан owner
- указан test type
- указан automated test file или manual checklist
- указан status: NOT_STARTED / IMPLEMENTED / VERIFIED / BLOCKED
- есть дата последней проверки

Формат coverage:

csv
scenario,module,section,priority,test_type,test_file,manual_file,status
S001,objects,3,P0,e2e,objects.spec.ts,docs/acceptance/S001-S007_objects.md,NOT_STARTED
S002,objects,3,P0,e2e,objects.spec.ts,docs/acceptance/S001-S007_objects.md,NOT_STARTED
S400,demo,17,P0,e2e,demo-mode.spec.ts,docs/acceptance/S396-S403_notifications_demo_onboarding.md,NOT_STARTED
S403,onboarding,18,P0,e2e,navigation.spec.ts,docs/acceptance/S396-S403_notifications_demo_onboarding.md,NOT_STARTED

Сборочный gate не считается зелёным, если:

новый Sxxx добавлен в каталог, но отсутствует в coverage;

Sxxx помечен VERIFIED, но test/manual file отсутствует;

demo-mode smoke падает;

migration с нуля не проходит;

frontend build падает;

backend typecheck падает.

21. Риски и решения

Статус: рабочий risk register
Назначение раздела: заранее выделить технические, продуктовые и эксплуатационные риски AISDR и зафиксировать митигации. Основные риски следуют из выбранной metadata-driven CRM архитектуры, EAV-модели, широкого сценарного покрытия S001–S403, AI/Stripe/integration-зависимостей, workflow/sequence асинхронности и необходимости demo-mode без внешних ключей. Свод Academy подтверждает, что продукт должен покрыть широкий набор тяжёлых модулей: permissions, AI, objects, workflows, sequences, reports, calls, imports, apps и record-page customization. 


21.а) Таблица рисков
Риск	Влияние	Вероятность	Решение / митигейшн
EAV performance деградирует на больших таблицах	Высокое	Высокая	Денормализовать Record.displayName, Record.searchText; typed columns в Value; индексы по (attributeId, textValue/numberValue/dateValue); ограничить visible columns; cursor pagination; query explain benchmarks; async export для больших выборок
Сложные фильтры AND/OR по EAV станут медленными	Высокое	Высокая	Построить typed query builder; начать с ограниченного набора операторов; добавить raw SQL только в одном safe-модуле; лимиты на nested groups; saved query cache; fallback на async job для тяжёлых фильтров
Сортировка по атрибутам будет дорогой	Среднее	Высокая	Индексы на typed value columns; сортировка только по одному attribute на MVP; precomputed sortable values; запрет сортировки по multi-select/json без спец-реализации; performance tests на 10k/50k records
Relationship joins усложнят views и record page	Среднее	Средняя	Ограничить глубину relationship columns на MVP до 1 hop; lazy loading relationship tabs; отдельный relationship resolver; кеш metadata; explicit API для related records
Миграция legacy Lead/Campaign/Sequence/Message сломает существующий AI-SDR MVP	Высокое	Средняя	Не удалять legacy models до полной миграции; сделать dual-read/dual-write только там, где нужно; migration dry-run; rollback batch; mapping legacy Lead → People/Company/Deal; покрыть S402 отдельными тестами
Email deliverability при sequences	Высокое	Высокая	Outbox queue; per-mailbox лимиты 12/hour, 5 min pause, 200/day; unsubscribe list; bounce/reply tracking; delegated sending; domain warmup warnings; no bulk BCC; demo-mode отдельно от prod send
AI cost выходит из-под контроля	Высокое	Высокая	Credit reservation/debit/refund; Research=10, остальные=1; per-run budget; monthly plan credits; user/workspace limits; bulk AI confirmation; queue throttling; caching research results; billing alerts
AI hallucinations портят CRM-данные	Высокое	Средняя	Human-in-loop для Ask actions; AI attributes сохраняют source/run metadata; confidence/status; reversible activity log; suggested actions before apply; demo deterministic outputs; prompt injection filters
RBAC-сложность приводит к утечке данных	Критическое	Средняя	Central permissionService; backend enforcement на каждом route; frontend hiding только дополнительно; integration tests на owner/admin/member/contractor; deny-by-default для private lists/dashboards/workflows; audit log
Workflow permissions конфликтуют с user permissions	Высокое	Средняя	Отдельный AutomationPermissionGrant; workflow не наследует права автора на execution; publish-time validation; prompt to grant; run logs show permission failure
Workflow engine может уйти в бесконечные циклы	Высокое	Средняя	Graph validation; no cycles by default; loop block with hard limit 100; max steps per run; timeout per step; idempotency key per event; retry policy with dead-letter state
Sequences могут отправить не те письма/не тем людям	Высокое	Средняя	Preview recipients; sender validation; unsubscribe enforcement; exit on reply/meeting; dry-run mode; schedule preview; immutable published version for enrolled recipients
Сложность UI/Attio-паритет слишком высокая	Высокое	Высокая	Делать по screen-by-screen roadmap; сначала core table/record/list; затем configure modes; использовать единые UI primitives; визуальные snapshots; manual acceptance на ключевые экраны
Workflow canvas и kanban drag-and-drop ломают сборку/UX	Среднее	Средняя	Изолировать @dnd-kit компоненты; fallback controls без drag; тесты keyboard actions; no business logic inside drag handlers
Reports будут неточными без истории значений	Высокое	Средняя	Ввести ValueChangeEvent и ReportSnapshot; для MVP — текущие Insight reports; Historical/Funnel/Time in stage требуют event history; nightly snapshot queue
Historical reports слишком дорогие	Среднее	Средняя	Snapshot tables; pre-aggregation; report cache; interval limits; async recompute; invalidate on relevant changes
Call Intelligence требует внешних recorder-провайдеров	Среднее	Высокая	MVP через transcript upload/demo transcript; recorder integrations later; provider abstraction; storage abstraction; no dependency for core CRM
Vendor lock: Anthropic	Среднее	Средняя	AiProvider interface; AnthropicProvider + DemoAiProvider; model name in env; keep prompts/provider calls in services, not UI/routes
Vendor lock: Stripe	Среднее	Средняя	billingService abstraction; store internal plan/credits state; Stripe as payment provider, not source of all business logic; webhook idempotency
Vendor lock: Gmail/Calendar/Slack	Среднее	Средняя	IntegrationConnection abstraction; provider-specific adapters; demo adapters; sync state stored internally
Demo-mode diverges from production behavior	Высокое	Высокая	Shared service interfaces; demo providers implement same contracts; separate flags; tests run both demo and mock-prod paths; UI shows demo badge
Prod accidentally uses demo-mode	Высокое	Низкая	NODE_ENV=production blocks demo defaults unless explicit ALLOW_DEMO_IN_PROD=true; startup config validation; health endpoint exposes provider mode to admins
External API secrets missing break startup	Среднее	Высокая	Optional providers; config validation distinguishes required core env from optional integrations; demo fallback for AI/email/Stripe in dev
Stripe webhook duplicate events double-credit account	Высокое	Средняя	Store processed event IDs; transaction unique idempotency key; database transaction around credit grant
AI credit double-debit on worker retry	Высокое	Средняя	Reservation model; debit idempotency by aiRunId; retries reuse reservation; failed run releases unused reservation
Data import creates duplicates	Высокое	Высокая	Required unique mapping; preview created/updated counts; warning if unique attribute missing; per-row errors; import history; rollback batch where possible
CSV import accepts bad formats	Среднее	Высокая	Format parser per attribute type; review values step; row-level errors; do not partially commit invalid required rows
Large CSV blocks request thread	Среднее	Средняя	Upload → import job; parse in worker; progress polling; chunked processing; file size limits
Record page becomes slow with many activities/emails/calls	Среднее	Высокая	Lazy tabs; paginated activity timeline; counts preloaded, content on tab open; virtualized lists
Activity timeline becomes inconsistent	Среднее	Средняя	Single activityService append API; all modules write normalized Activity; backfill job for legacy Email/Task/Note
Notification spam	Среднее	Средняя	User preferences; digest batching; dedupe similar events; rate limit mentions; mark read/archive
Security/audit gaps	Высокое	Средняя	AuditLog for settings, RBAC, billing, API keys, integrations; session revoke; API key hashing; webhook secret hashing
API keys leak	Критическое	Низкая	Show secret once; store hash only; prefix for lookup; scopes; revocation; audit log
Webhook delivery overload	Среднее	Средняя	Dedicated queue; retry/backoff; endpoint disable after repeated failures; delivery logs; signing secret
Search quality weak on EAV records	Среднее	Средняя	Maintain Record.searchText; include key text values and relationships; later PostgreSQL full-text; command palette grouped results
Frontend state complexity grows	Среднее	Средняя	Central API clients; route-level data fetching; small components; avoid global store except auth/shell; strict DTO types
Type drift backend ↔ frontend	Среднее	Средняя	Shared DTO package later or generated OpenAPI; zod schemas as source; TypeScript strict mode; API contract tests
Prisma migrations become risky	Высокое	Средняя	Small migrations; no destructive migrations without backup; migration tests from empty DB and from previous schema; seed idempotency
Monorepo scripts inconsistent	Среднее	Средняя	Root scripts for dev/build/typecheck/test; CI runs same scripts as local; document commands in README
Redis unavailable breaks async features	Среднее	Средняя	Health checks; graceful degraded mode for UI; queue errors visible; retry when Redis returns; core read-only CRM routes still work
PostgreSQL indexes missing in prod	Высокое	Средняя	Migration includes indexes; performance tests fail gate if slow; add EXPLAIN snapshots for critical queries
File/storage provider missing	Среднее	Средняя	Local storage in dev/demo; storage abstraction; upload size limits; signed URLs later
Timezone bugs in sequences/reports/tasks	Среднее	Высокая	Store UTC; workspace/user timezone for display; tested sending windows; date helpers only through dates.ts
Multi-org data leakage	Критическое	Средняя	Every model org-scoped; middleware injects orgId; no route accepts orgId from body without validation; integration tests with two orgs
Overbuilding before core CRM works	Высокое	Высокая	Roadmap P0/P1 gate: no P2/P3 expansion until objects/attributes/records/views/lists stable; demo acceptance before integrations
Too many modules for one release	Высокое	Высокая	Incremental release phases; feature flags; statuses ✅/🟡/⬜; every module shippable in demo first
Legal/privacy risk from email/call sync	Высокое	Средняя	Explicit user connection; sharing mode; admin controls; data deletion; transcript upload consent notice; audit log
AI prompt injection through synced emails/web pages	Среднее	Средняя	Treat external text as untrusted; system prompt separation; tool allowlist; no automatic destructive actions without confirmation
Reports/AI use stale data	Среднее	Средняя	Show generatedAt/source; invalidate caches on writes; scheduled refresh; manual refresh button
Browser performance on wide tables	Среднее	Высокая	Column virtualization later; horizontal scroll; limit visible columns; pagination; memoized cells
Drag/drop accessibility	Низкое	Средняя	Keyboard alternatives; buttons for move/reorder; ARIA labels; manual a11y checklist
Build gates slow down development	Среднее	Средняя	Smoke suite on every PR, full suite nightly; cache npm/Playwright; parallel jobs
Test flakiness in E2E	Среднее	Средняя	Deterministic seed; data-testid selectors; no arbitrary sleeps; trace on retry; isolate org per test
Scenario coverage becomes outdated	Среднее	Средняя	coverage.csv required in PR checklist; CI validates S001–S403 presence; update MASTER_TZ and tests together
Manual acceptance not maintained	Среднее	Средняя	Store checklist in repo; add status/date/owner; require manual pass for visual modules before release
External integrations break due provider changes	Среднее	Средняя	Adapter layer; webhook monitoring; integration health page; graceful disconnect state; demo fallback
21.б) Критические митигации, которые нужно реализовать первыми
1. Central permission enforcement
Нельзя размазывать RBAC по route handlers.
Все read/write проверки проходят через permissionService.
Frontend скрывает controls только как UX, но backend всегда решает окончательно.
2. EAV query boundary
Все сложные фильтры/сортировки проходят через один query builder.
Запрещено писать ad-hoc raw SQL в routes/services.
Каждый новый оператор получает unit + integration + performance test.
3. Demo provider contracts
Demo AI, demo email, demo Stripe и demo integrations реализуют те же интерфейсы, что production providers.
Это снижает риск расхождения demo/prod и позволяет гонять acceptance без ключей.
4. Idempotent workers
Каждый BullMQ job получает idempotency key.
Повторный запуск не создаёт дубли:
- emails
- sequence steps
- workflow runs
- AI credit debits
- Stripe credits
- import rows
- notifications
5. Migration safety
Legacy Lead/Campaign/Sequence/Message остаются до конца миграции.
MigrationJob поддерживает dry-run, result stats, row errors и rollback там, где возможно.
21.в) Risk gates перед релизом

Перед первым internal alpha:

- tsc backend = 0
- tsc frontend = 0
- Prisma migrate from scratch = OK
- demo seed = OK
- login/register = OK
- objects/records/views = OK
- no external keys required = OK

Перед beta:

- RBAC backend enforcement = OK
- import rollback/dedupe = OK
- sequence unsubscribe = OK
- workflow idempotency = OK
- billing credit idempotency = OK
- EAV table p95 under target = OK

Перед production:

- two-org data isolation tests = OK
- Stripe webhook idempotency = OK
- API key hashing/revocation = OK
- audit log = OK
- backup/restore procedure = OK
- email deliverability controls = OK
- security review = OK
Итог

Сформирован полный MASTER_TZ из 21 раздела:

Vision / цель продукта

Глоссарий и общая модель

Objects

Attributes + AI attributes

Records / Relationships

Views

Lists

Record page

Enrichment + Communication Intelligence

Email & Calendar sync + продуктивность

Sequences

Workflows

Call Intelligence

Reports & Dashboards

AI-слой и кредиты

Settings

Навигация / IA

Технический стек и архитектура

Дорожная карта

Тестирование

Риски и решения

Покрыто:

гибкая CRM-модель Attio-like;

стандартные и кастомные объекты;

все типы атрибутов, включая AI;

records, relationships, views, lists;

record page, activity, emails, calls, notes, tasks, comments;

email/calendar sync;

enrichment и communication intelligence;

sequences;

workflows;

reports/dashboards;

call intelligence;

Ask AI;

credits/billing/Stripe;

settings/RBAC/apps/developers/security;

navigation, notifications, demo-mode;

testing, CI, risk register.

Осталось ⬜ по реализации:

большая часть backend/frontend модулей после flexible CRM foundation;

RBAC enforcement;

sequences runtime;

workflow runtime;

reports historical snapshots;

call intelligence processing;

Stripe production billing;

email/calendar real sync;

full E2E coverage;

legacy migration.

Все сценарии S001–S403 распределены по разделам, roadmap-блокам и test coverage matrix.
