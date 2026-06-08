
Целевая архитектура AISDR
1. Архитектурный принцип

AISDR должен перейти от фиксированной CRM-модели Lead/Campaign к metadata-driven модели:

структура CRM описывается таблицами Object, Attribute, View, List;

бизнес-данные хранятся как Record + Value;

связи хранятся как RelationshipValue;

UI строится из metadata;

AI-SDR, sequences, workflows и reports работают поверх универсальных records.

Текущие сущности Lead, Campaign, Sequence, Message можно временно сохранить как legacy-слой, но новый UX и новые API должны работать через гибкую модель.

2. Целевой стек
Frontend

Next.js 14 App Router;

React 18;

TypeScript;

TailwindCSS 3;

framer-motion;

lucide-react;

recharts;

@dnd-kit;

axios.

Backend

Node.js;

Express;

TypeScript;

Prisma;

PostgreSQL;

BullMQ;

ioredis;

JWT;

bcryptjs;

jsonwebtoken;

nodemailer;

Stripe;

zod;

@anthropic-ai/sdk.

Runtime

Backend API;

Worker process;

PostgreSQL;

Redis;

Frontend Next.js app.

3. Backend-слои
3.1 Routes

Расположение: apps/backend/src/routes.

Целевые route-модули:

auth.ts;

objects.ts;

attributes.ts;

records.ts;

views.ts;

lists.ts;

emails.ts;

notes.ts;

tasks.ts;

activities.ts;

imports.ts;

sequences.ts;

workflows.ts;

reports.ts;

billing.ts.

3.2 Services

Расположение: apps/backend/src/services.

Целевые service-модули:

objectService.ts;

attributeService.ts;

recordService.ts;

valueService.ts;

relationshipService.ts;

viewService.ts;

listService.ts;

emailService.ts;

activityService.ts;

importService.ts;

sequenceService.ts;

workflowService.ts;

reportService.ts;

bootstrapService.ts;

legacyMigrationService.ts.

3.3 Middleware

authMiddleware.ts — проверка JWT;

orgMiddleware.ts — обязательный orgId;

roleMiddleware.ts — проверка OWNER/ADMIN/MEMBER;

validate.ts — zod-валидация;

errorHandler.ts — единый формат ошибок.

3.4 Worker

Расположение: apps/backend/src/worker.

Очереди:

importQueue;

emailQueue;

sequenceQueue;

workflowQueue;

enrichmentQueue;

analyticsQueue.

В MVP реально нужен только demo-safe email/import слой, но архитектура должна сразу разделять API и worker.

4. Гибкая CRM-модель
4.1 Object

Object описывает тип сущности:

key: companies, people, deals;

singularName;

pluralName;

icon;

primaryAttributeId;

isSystem;

archivedAt.

В MVP кастомные объекты можно не давать в UI, но backend-модель должна их поддерживать.

4.2 Attribute

Attribute описывает поле объекта:

objectId;

key;

name;

type;

isRequired;

isUnique;

isSystem;

config;

options.

Типы:

TEXT;

LONG_TEXT;

NUMBER;

BOOLEAN;

DATE;

DATETIME;

SELECT;

MULTI_SELECT;

CURRENCY;

EMAIL;

PHONE;

URL;

USER;

RELATIONSHIP;

JSON.

4.3 Record

Record — строка объекта:

orgId;

objectId;

createdById;

updatedById;

archivedAt;

createdAt;

updatedAt.

Record не должен содержать бизнес-поля напрямую. Все бизнес-значения лежат в Value.

4.4 Value

Value связывает Record и Attribute.

Для производительности используется несколько typed columns:

textValue;

numberValue;

booleanValue;

dateValue;

jsonValue;

userValueId;

currencyAmount;

currencyCode.

Правило: backend записывает значение только в колонку, соответствующую Attribute.type.

4.5 RelationshipValue

RelationshipValue хранит связи между records:

sourceRecordId;

sourceAttributeId;

targetRecordId;

targetObjectId;

createdAt.

Для bidirectional relationship backend может создавать reverse-связь или вычислять её через RelationshipDefinition.

4.6 View

View хранит представление данных:

objectId или listId;

name;

type TABLE/BOARD;

groupByAttributeId;

filters;

sorts;

columns.

View нельзя хранить только как JSON. Колонки, фильтры и сортировки должны быть отдельными таблицами, чтобы их можно было валидировать и мигрировать.

4.7 List

List — именованная подборка records одного primary object.

ListEntry хранит:

listId;

recordId;

stage;

position;

addedById;

createdAt.

ListAttribute/ListEntryValue нужны для list-specific fields. В MVP stage можно использовать прямо в ListEntry, но schema должна поддерживать расширение.

5. API-структура

Все endpoints ниже подразумевают JWT auth и org scope.

5.1 Auth

POST /api/auth/register

Создаёт Organization и User.

POST /api/auth/login

Возвращает JWT и профиль пользователя.

GET /api/auth/me

Возвращает текущего пользователя и organization.

5.2 Bootstrap

POST /api/bootstrap/default-crm

Создаёт Companies/People/Deals и базовые attributes/views для org.

GET /api/bootstrap/status

Возвращает, создана ли базовая CRM-модель.

5.3 Objects

GET /api/objects

Список объектов организации.

POST /api/objects

Создать объект. В MVP может быть доступно только OWNER/ADMIN и скрыто из UI.

GET /api/objects/:objectId

Получить object metadata.

PATCH /api/objects/:objectId

Обновить object metadata.

DELETE /api/objects/:objectId

Archive object. Системные объекты в MVP удалять нельзя.

5.4 Attributes

GET /api/objects/:objectId/attributes

Список attributes объекта.

POST /api/objects/:objectId/attributes

Создать attribute.

PATCH /api/attributes/:attributeId

Обновить attribute.

DELETE /api/attributes/:attributeId

Archive attribute.

POST /api/attributes/:attributeId/options

Добавить option для select/multi-select.

PATCH /api/attribute-options/:optionId

Обновить option.

DELETE /api/attribute-options/:optionId

Archive option.

5.5 Records

GET /api/objects/:objectId/records

Получить records объекта.

Query параметры:

viewId;

limit;

cursor;

search;

filters;

sorts.

POST /api/objects/:objectId/records

Создать record со значениями.

GET /api/records/:recordId

Получить record detail: metadata, values, relationships, lists, activity summary.

PATCH /api/records/:recordId

Обновить несколько values.

PATCH /api/records/:recordId/values/:attributeId

Обновить одно значение.

DELETE /api/records/:recordId

Archive record.

5.6 Relationships

GET /api/records/:recordId/relationships

Список связей записи.

POST /api/records/:recordId/relationships

Создать relationship value.

DELETE /api/relationship-values/:relationshipValueId

Удалить relationship value.

5.7 Views

GET /api/objects/:objectId/views

Список views объекта.

POST /api/objects/:objectId/views

Создать view.

GET /api/views/:viewId

Получить view config.

PATCH /api/views/:viewId

Обновить name/type/groupBy.

DELETE /api/views/:viewId

Удалить view.

PUT /api/views/:viewId/columns

Полностью заменить набор колонок.

PUT /api/views/:viewId/filters

Полностью заменить набор фильтров.

PUT /api/views/:viewId/sorts

Полностью заменить набор сортировок.

5.8 Lists

GET /api/lists

Список lists.

POST /api/lists

Создать list.

GET /api/lists/:listId

Получить list metadata.

PATCH /api/lists/:listId

Обновить list.

DELETE /api/lists/:listId

Archive list.

GET /api/lists/:listId/entries

Получить records в list.

POST /api/lists/:listId/entries

Добавить records в list.

PATCH /api/list-entries/:entryId

Обновить stage/position.

DELETE /api/list-entries/:entryId

Удалить record из list.

5.9 Emails

GET /api/records/:recordId/emails

Письма записи.

POST /api/records/:recordId/emails/draft

Сгенерировать или создать draft.

POST /api/records/:recordId/emails/send

Отправить или симулировать отправку письма.

GET /api/emails

Глобальный email список.

GET /api/emails/:emailId

Детали письма.

5.10 Activities

GET /api/records/:recordId/activities

Timeline записи.

GET /api/activities

Глобальная activity лента.

5.11 Notes

GET /api/records/:recordId/notes

Список заметок.

POST /api/records/:recordId/notes

Создать заметку.

PATCH /api/notes/:noteId

Обновить заметку.

DELETE /api/notes/:noteId

Удалить заметку.

5.12 Tasks

GET /api/tasks

Список задач.

POST /api/tasks

Создать задачу.

PATCH /api/tasks/:taskId

Обновить задачу.

DELETE /api/tasks/:taskId

Удалить задачу.

5.13 Imports

POST /api/imports

Создать import job.

GET /api/imports/:importId

Статус import job.

POST /api/imports/:importId/confirm

Подтвердить mapping и запустить worker.

5.14 Sequences

После MVP:

GET /api/sequences;

POST /api/sequences;

GET /api/sequences/:sequenceId;

PATCH /api/sequences/:sequenceId;

POST /api/sequences/:sequenceId/steps;

PATCH /api/sequence-steps/:stepId;

POST /api/sequences/:sequenceId/enroll;

POST /api/sequences/:sequenceId/enable;

POST /api/sequences/:sequenceId/pause.

5.15 Workflows

После MVP:

GET /api/workflows;

POST /api/workflows;

GET /api/workflows/:workflowId;

PATCH /api/workflows/:workflowId;

POST /api/workflows/:workflowId/steps;

PATCH /api/workflow-steps/:stepId;

POST /api/workflows/:workflowId/enable;

POST /api/workflows/:workflowId/pause;

GET /api/workflows/:workflowId/runs.

5.16 Reports

После MVP:

GET /api/reports;

POST /api/reports;

GET /api/reports/:reportId;

PATCH /api/reports/:reportId;

POST /api/reports/:reportId/query;

GET /api/dashboards;

POST /api/dashboards.

6. Backend query strategy для Record/Value
6.1 Чтение таблицы

Алгоритм:

Получить object metadata.

Получить view config.

Определить visible attributes.

Построить record query с orgId/objectId.

Применить filters.

Применить sorts.

Получить records page.

Получить values для records + visible attributes.

Собрать rows в API DTO.

6.2 Фильтры

Для Phase 1 допустимо строить Prisma queries через relation filters:

Record where objectId/orgId;

values some attributeId + typed value condition.

Для сложных комбинаций AND/OR позже можно добавить безопасный raw SQL query builder.

6.3 Сортировка

Сортировка по Value сложнее, чем сортировка по колонке Record.

Для MVP:

поддержать сортировку по createdAt/updatedAt;

поддержать сортировку по одному attribute через SQL view/raw query или двухшаговую выборку.

Целевая реализация:

использовать raw SQL с join на Value по сортируемому attributeId;

все параметры передавать безопасно;

индексы на (attributeId, textValue), (attributeId, numberValue), (attributeId, dateValue).

6.4 Поиск

Для MVP:

поиск по primary display attribute;

для People дополнительно email.

Позже:

отдельная search index таблица;

Postgres full text search;

command palette search.

7. Frontend-структура
7.1 App Router

Целевая структура:

src/app/(auth)/login/page.tsx;

src/app/(auth)/register/page.tsx;

src/app/(dashboard)/layout.tsx;

src/app/(dashboard)/page.tsx;

src/app/(dashboard)/objects/[objectKey]/page.tsx;

src/app/(dashboard)/objects/[objectKey]/records/[recordId]/page.tsx;

src/app/(dashboard)/lists/page.tsx;

src/app/(dashboard)/lists/[listId]/page.tsx;

src/app/(dashboard)/emails/page.tsx;

src/app/(dashboard)/tasks/page.tsx;

src/app/(dashboard)/notes/page.tsx;

src/app/(dashboard)/automations/page.tsx;

src/app/(dashboard)/automations/sequences/page.tsx;

src/app/(dashboard)/automations/workflows/page.tsx;

src/app/(dashboard)/reports/page.tsx;

src/app/(dashboard)/settings/page.tsx.

7.2 API client

src/lib/api.ts — axios instance;

src/lib/auth.ts — токены и профиль;

src/lib/objects.ts;

src/lib/records.ts;

src/lib/views.ts;

src/lib/lists.ts;

src/lib/emails.ts.

7.3 Основные компоненты
AppShell

sidebar;

workspace switcher;

top search;

command palette trigger;

content area.

Sidebar

static разделы;

records из /api/objects;

lists из /api/lists;

favorites позже.

ObjectPage

Задачи:

загрузить object metadata;

загрузить views;

определить active view;

отрисовать TableView или BoardView;

поддержать create record;

открыть settings.

DataTable

Ключевой компонент Phase 1.

Функции:

dynamic columns по ViewColumn;

cell renderers по AttributeType;

inline edit;

row selection;

column resize;

column reorder позже;

sort controls;

filter controls;

empty state;

pagination.

CellEditor

Editors:

text input;

number input;

checkbox;

date picker;

select dropdown;

multi-select;

currency input;

relationship picker;

user picker.

ViewToolbar

view switcher;

filter button;

sort button;

add column;

import;

export;

new record.

FilterBuilder

выбрать attribute;

operator;

value editor;

AND conditions в MVP;

OR groups позже.

RecordPage

Состав:

record header;

tabs;

activity timeline;

email thread/list;

notes/comments;

details sidebar;

lists sidebar block;

relationships block.

DetailsPanel

группировка атрибутов;

inline edit;

empty value placeholders;

add attribute.

ListPage

list header;

table view;

board view после Phase 2;

entry stage;

add records.

EmailComposer

To;

Subject;

Body;

Generate button;

Send button;

demo-mode indicator.

BoardView

Phase 2.

columns from select options;

cards;

drag-and-drop через @dnd-kit;

update attribute/list stage on drop.

SequenceBuilder

Phase 3.

steps list;

wait step;

automated email step;

recipients tab;

delivery settings panel.

WorkflowBuilder

Phase 4.

canvas;

nodes;

right config panel;

runs tab;

settings tab.

ReportsDashboard

Phase 5.

recharts widgets;

report builder;

dashboard layout.

8. DTO-контракты
8.1 Object DTO
JSON
8.2 Record Row DTO
JSON
8.3 View DTO
JSON
9. Миграция с текущей фиксированной модели
9.1 Текущая модель

Сейчас есть:

User;

Organization;

ApiKey;

Lead;

Campaign;

Sequence;

CampaignLead;

Message.

Проблема: Lead содержит фиксированный набор полей, Campaign и Sequence жёстко привязаны к Lead.

9.2 Целевая стратегия

Не удалять legacy-таблицы сразу. Добавить новые таблицы гибкой CRM рядом с текущими.

Этапы:

Добавить новые Prisma models.

Создать bootstrap для системных objects/attributes.

Создать migration service Lead → Record.

Начать читать новый UI из Object/Record/Value.

Оставить старые routes как legacy.

Перевести email/message на Email/Activity.

Перевести campaign/sequence на новые Sequence/Enrollment.

После стабилизации удалить legacy-зависимости из UI.

Legacy-таблицы удалить только отдельной миграцией после проверки данных.

9.3 Mapping Lead → гибкая модель
Company

Lead fields:

company;

website;

companySize;

industry;

country;

city.

Mapping:

company → Companies.Name;

website → Companies.Website;

companySize → Companies.Employee range;

industry → Companies.Industry;

country → Companies.Country;

city → Companies.City.

Deduplication:

если website/domain есть, dedupe по domain;

иначе dedupe по normalized company name;

если company empty, не создавать company record.

Person

Lead fields:

firstName;

lastName;

email;

linkedinUrl;

title;

score;

status;

source;

apolloId;

enriched;

notes.

Mapping:

firstName → People.First name;

lastName → People.Last name;

email → People.Email;

linkedinUrl → People.LinkedIn;

title → People.Title;

score → People.Score;

status → People.Status;

source → People.Source;

apolloId → People.Legacy Apollo ID;

enriched → People.Enriched.

Relationships:

Person.Company relationship → Company record.

Notes:

Lead.notes → Note linked to Person record.

Message

Mapping:

Message → Email;

leadId → Person record;

direction/channel/subject/body/sentAt/openedAt/repliedAt/replyClass сохраняются;

создаётся Activity типа EMAIL_SENT/EMAIL_RECEIVED.

Campaign

Для Phase 1 Campaign можно оставить legacy.

Позже:

Campaign → Sequence или Campaign container;

CampaignLead → SequenceEnrollment;

Sequence legacy → SequenceStep.

9.4 Idempotency

Migration service должен быть идемпотентным.

Для этого:

добавить LegacyMapping;

хранить legacyModel, legacyId, recordId/emailId/sequenceId;

перед созданием проверять mapping;

можно запускать миграцию повторно.

10. Phase plan
Phase 1 — Минимально играбельный гибкий CRM

Цель: заменить UX лидов на flexible CRM foundation.

Блок 1.1 Prisma schema + migration

Работы:

добавить Object, Attribute, AttributeOption, Record, Value, RelationshipDefinition, RelationshipValue;

добавить View, ViewColumn, ViewFilter, ViewSort;

добавить List, ListEntry;

добавить Activity, Email, Note, Task;

сохранить User/Organization/ApiKey;

legacy Lead/Campaign оставить временно.

Проверка:

npx prisma generate;

npx prisma migrate dev;

backend TypeScript build.

Блок 1.2 Bootstrap CRM metadata

Работы:

service создания Companies/People/Deals;

базовые attributes;

default views;

default deal stages;

endpoint bootstrap/status.

Проверка:

новая org получает 3 объекта;

повторный bootstrap не создаёт дубли.

Блок 1.3 Object/Attribute API

Работы:

routes для objects;

routes для attributes;

zod schemas;

org scope;

role checks для создания/изменения metadata.

Проверка:

можно получить Companies/People/Deals;

можно создать кастомный attribute;

нельзя получить данные другой org.

Блок 1.4 Record/Value API

Работы:

create record;

update values;

get record detail;

list records;

value validation by AttributeType;

activity creation.

Проверка:

можно создать Person;

можно обновить Email/Title;

invalid value rejected;

activity created.

Блок 1.5 View API

Работы:

CRUD views;

update columns;

update filters;

update sorts;

list records by view.

Проверка:

table view сохраняет колонки;

фильтр contains работает;

сортировка createdAt работает.

Блок 1.6 Frontend shell + object navigation

Работы:

dashboard layout;

sidebar records/lists;

object page route;

API client;

auth state.

Проверка:

после логина видно Records;

переход в People открывает object page.

Блок 1.7 Dynamic DataTable

Работы:

table columns from ViewColumn;

cell renderers;

inline edit;

filters;

sorts;

pagination;

new record modal.

Проверка:

можно создать и отредактировать Person;

добавить колонку;

применить фильтр.

Блок 1.8 Record page

Работы:

route records/[recordId];

details panel;

activity tab;

emails tab;

notes/comments tab;

lists block.

Проверка:

строка открывает record page;

значения редактируются;

activity отображается.

Блок 1.9 Lists MVP

Работы:

list API;

add/remove entries;

list page table;

membership on record page.

Проверка:

можно создать list;

добавить Person в list;

увидеть list на Person record.

Блок 1.10 Demo email

Работы:

Email model integration;

email draft endpoint;

demo send endpoint;

EmailComposer;

Activity EMAIL_SENT.

Проверка:

Compose email на Person;

без SMTP письмо симулируется;

письмо видно в Emails tab.

Блок 1.11 Legacy Lead migration

Работы:

LegacyMapping;

migration endpoint/admin script;

Lead → Company/Person;

Message → Email/Activity.

Проверка:

существующие leads видны как People/Companies;

повторный запуск не создаёт дубли.

Phase 2 — Board, bulk, import
Блок 2.1 Board view

BoardView component;

groupBy select attribute;

drag-and-drop;

update stage on drop.

Блок 2.2 Bulk actions

row selection;

bulk action bar;

add to list;

update attribute;

demo send email.

Блок 2.3 CSV import в гибкую модель

upload;

mapping;

validation;

ImportJob;

worker;

errors report.

Блок 2.4 Relationship UI

relationship picker;

reverse relationships;

related records panel.

Phase 3 — Sequences
Блок 3.1 Sequence schema/API

Sequence;

SequenceStep;

SequenceEnrollment;

SequenceStepRun.

Блок 3.2 Sequence editor UI

editor tab;

recipients tab;

settings panel;

merge tags.

Блок 3.3 Sequence worker

BullMQ scheduling;

business days;

sending window;

exit on reply;

demo and real providers.

Блок 3.4 Tracking

open pixel;

reply webhook/manual parser;

unsubscribe.

Phase 4 — Workflows
Блок 4.1 Workflow schema/API

Workflow;

WorkflowStep;

WorkflowRun;

WorkflowStepRun.

Блок 4.2 Workflow builder UI

canvas;

trigger node;

action nodes;

config panel.

Блок 4.3 Workflow runtime

trigger events;

run queue;

step execution;

error handling.

Phase 5 — Reports
Блок 5.1 Report schema/API

report definitions;

query endpoint;

metrics/dimensions.

Блок 5.2 Dashboard UI

charts via recharts;

saved dashboard;

pipeline reports.

Блок 5.3 Historical values

value change history;

stage duration;

time in stage.

Phase 6 — Billing, integrations, permissions
Блок 6.1 Stripe enforcement

plan limits;

usage counters;

subscription state.

Блок 6.2 Integrations

SMTP;

Apollo;

Unipile;

enrichment.

Блок 6.3 Permissions

object-level permissions;

field-level permissions;

audit log.

11. Индексы и производительность
11.1 Базовые индексы

Нужны индексы:

Object orgId/key;

Attribute objectId/key;

Record orgId/objectId;

Value recordId/attributeId;

Value attributeId + typed value;

RelationshipValue sourceRecordId;

RelationshipValue targetRecordId;

View objectId;

List orgId;

ListEntry listId/recordId;

Activity recordId/createdAt;

Email recordId/createdAt.

11.2 Денормализация

Позже можно добавить:

Record.displayName;

Record.searchText;

Record.lastActivityAt;

Record.ownerId;

Record.stageCache;

Record.primaryEmailCache.

Это ускорит таблицы и search.

12. Ошибки API

Единый формат:

JSON

Типовые коды:

UNAUTHORIZED;

FORBIDDEN;

NOT_FOUND;

VALIDATION_ERROR;

CONFLICT;

RATE_LIMITED;

INTERNAL_ERROR.

13. Тестовая стратегия
Backend

Минимум:

unit tests для value validation;

unit tests для filters;

unit tests для bootstrap idempotency;

integration tests для record create/update/list;

migration test Lead → Record.

Frontend

Минимум:

smoke test dashboard;

object page renders;

create record modal;

record page renders;

email composer demo flow.

Manual acceptance

Для каждого phase-блока должен быть короткий ручной сценарий проверки.

14. Главные инженерные риски
14.1 Сложность сортировки и фильтрации по EAV

Риск: гибкая Value-модель усложняет SQL.

Решение:

в MVP ограничить сложность;

использовать typed columns;

добавить индексы;

позже добавить query builder/raw SQL.

14.2 Слишком широкий MVP

Риск: попытка сразу сделать Attio полностью.

Решение:

Phase 1 только Companies/People/Deals;

custom objects UI позже;

sequences/workflows/reports после playable CRM foundation.

14.3 Миграция legacy данных

Риск: потеря Lead/Campaign данных.

Решение:

legacy-таблицы не удалять;

LegacyMapping;

идемпотентная миграция;

ручная проверка counts.

14.4 UI-сложность таблицы

Риск: таблица становится самым большим компонентом.

Решение:

разделить DataTable, CellRenderer, CellEditor, ViewToolbar, FilterBuilder;

не делать virtualization в первом блоке;

добавить virtualization позже при необходимости.

15. Целевой результат Phase 1

После Phase 1 AISDR должен выглядеть и ощущаться как базовая гибкая CRM:

слева Records и Lists;

есть Companies, People, Deals;

у объектов есть кастомные атрибуты;

таблица настраивается;

записи открываются в полноценную карточку;

списки работают;

email composer работает в demo-режиме;

старые leads не потеряны и видны как People/Companies.