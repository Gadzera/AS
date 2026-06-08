
BUILD_BASE — единая база реализации AISDR
1. Кратко

AISDR = гибкая B2B CRM уровня Attio + встроенный AI-SDR для сегментации, персонализации, sequences, workflows, трекинга писем, звонков, задач и аналитики.

Стек проекта:

Frontend: Next.js 14 App Router, React 18, TypeScript, TailwindCSS, framer-motion, lucide-react, recharts, @dnd-kit, axios.

Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, BullMQ, Redis, JWT, nodemailer, Stripe, zod, Anthropic SDK.

Worker: BullMQ + Redis для фоновой отправки писем, sequences, enrichment, workflow-runs.

БД: PostgreSQL через Prisma.

Уже готово в коде:

Гибкая CRM-схема: Object, Attribute, AttributeOption, Record, Value, RelationshipDefinition, RelationshipValue, View, ViewColumn, ViewFilter, List и связанные сущности.

API объектов/атрибутов/записей: /api/objects, /api/crm, /api/records.

Demo-режим писем: безопасная имитация отправки без реального SMTP.

Legacy-модули AI-SDR: пользователи, организации, лиды, кампании, sequences/messages, базовый email-flow.

Главная цель BUILD_BASE: сделать проект полностью рабочим end-to-end, экран за экраном, начиная с минимального Attio-like CRM MVP и затем доводя AI-SDR слой.

2. Единый реестр экранов
2.1 App shell / Sidebar / Workspace navigation

Назначение: общий layout продукта: workspace, навигация, records, lists, automations, reports, quick actions.

Данные:

Organization

User

Object

List

View

Notification

Task

EmailActivity

CallActivity

Note

Workflow

Sequence

Stripe/billing модели, если уже заведены в legacy.

API:

Уже есть: auth/org context.

Нужны:

GET /api/me

GET /api/navigation

GET /api/workspaces/current

GET /api/notifications/unread-count

GET /api/tasks/count

GET /api/objects

GET /api/lists

GET /api/sequences

GET /api/workflows

Frontend:

Route: глобальный layout apps/frontend/src/app/(dashboard)/layout.tsx

Компоненты:

AppSidebar

WorkspaceSwitcher

SidebarSection

SidebarRecordLink

SidebarListLink

TopBar

QuickActionsTrigger

UserMenu

NotificationBell

Acceptance:

После логина пользователь попадает в dashboard с рабочим сайдбаром.

Сайдбар показывает объекты Companies/People/Deals/Users/Workspaces/Invoices и списки.

Активный route подсвечивается.

Workspace dropdown отображает текущую организацию.

Quick actions открываются по кнопке и по ⌘K / Ctrl+K.

Навигация не ломается при пустых списках, пустых sequences и пустых workflows.

2.2 Companies — table view

Назначение: табличный список компаний с гибкими колонками, фильтрами, сортировкой, импортом/экспортом и созданием записей.

Данные:

Object со slug/key companies

Attribute

AttributeOption

Record

Value

View

ViewColumn

ViewFilter

RelationshipDefinition

RelationshipValue

Атрибуты:

Name / Company

Domains

Categories

Description

LinkedIn

Employee range

Estimated ARR

Funding raised

Primary city/state/country/location

Team

Segment

POC

API:

Уже есть:

/api/objects

/api/crm

/api/records

Нужны/расширить:

GET /api/crm/objects/:objectKey/views

GET /api/crm/objects/:objectKey/records?viewId=&sort=&filters=

POST /api/crm/objects/:objectKey/records

PATCH /api/crm/records/:recordId

DELETE /api/crm/records/:recordId

POST /api/crm/objects/:objectKey/import

GET /api/crm/objects/:objectKey/export

POST /api/crm/views/:viewId/columns

PATCH /api/crm/views/:viewId/columns/reorder

POST /api/crm/views/:viewId/filters

POST /api/crm/views/:viewId/calculations

Frontend:

Route: /companies

Универсальный route позже: /objects/[objectKey]

Компоненты:

ObjectPage

ViewHeader

ViewSelector

ViewSettingsButton

FilterBar

SortControl

ImportExportMenu

NewRecordButton

DataTable

DataTableHeader

DataTableRow

DataTableCell

AddColumnMenu

CalculationRow

CreateAttributeModal

RecordPickerPopover

Acceptance:

Companies открываются из сайдбара.

View All Companies загружает записи из БД.

Колонки строятся из ViewColumn, значения — из Value.

Можно добавить/скрыть колонку.

Можно создать новую компанию.

Можно редактировать ячейку inline.

Фильтр и сортировка меняют список.

Empty state показывает причину: нет записей или фильтр ничего не нашёл.

Нижняя строка показывает count и базовый + Add calculation.

Горизонтальная прокрутка таблицы работает.

2.3 People — table views

Назначение: список людей с email, компанией, LinkedIn, relationship-полями и сигналами последнего контакта.

Данные:

Object people

Record

Attribute

Value

RelationshipDefinition

RelationshipValue

View

ViewColumn

ViewFilter

Activity-модели:

EmailActivity

CallActivity

CalendarActivity или legacy-события, если календаря пока нет.

Атрибуты:

Name

Email addresses

Company

Job title

Phone numbers

Primary location

LinkedIn

Last interaction

Last email interaction

Last calendar interaction

Connection strength

Associated users / User type

API:

Уже есть:

/api/objects

/api/crm

/api/records

Нужны:

GET /api/crm/objects/people/records

GET /api/crm/objects/people/views

POST /api/crm/objects/people/records

POST /api/crm/views

PATCH /api/crm/views/:viewId

GET /api/crm/records/:recordId/activity-summary

POST /api/crm/records/bulk

POST /api/lists/:listId/entries/bulk

Frontend:

Route: /people

Компоненты:

ObjectPage

DataTable

ViewSelector

FilterBar

BulkActionBar

ChooseListModal

NestedAttributeMenu

RelationshipCell

ConnectionStrengthBadge

LastInteractionCell

Acceptance:

View Recently Contacted People показывает last email/calendar interaction.

View Admin users показывает фильтры и укороченный набор колонок.

Можно добавлять nested-колонки через relationship, например Company > CEO.

Можно выбрать много строк.

При выборе строк появляется bulk-панель.

Bulk actions: Add to list, Send email, Run workflow, Enroll in sequence, More.

После добавления в список появляется toast с Go to list.

2.4 Deals — table view

Назначение: табличный список сделок с фильтрами inbound-лидов, qualification-полями и стадиями.

Данные:

Object deals

Record

Attribute

Value

View

ViewColumn

ViewFilter

RelationshipValue

Атрибуты:

Deal name / Title

Deal value

Deal stage

Deal owner

Associated company

Associated people

Created at

Projected close date

Deal confidence

ICP

Typeform answer

Categories

Funding raised

Employees

Country

Priority

Deal type

API:

Уже есть:

/api/objects

/api/crm

/api/records

Нужны:

GET /api/crm/objects/deals/records

POST /api/crm/objects/deals/records

PATCH /api/crm/records/:recordId

POST /api/crm/views/:viewId/filters

POST /api/crm/records/:recordId/enrich

POST /api/email/compose-context

Frontend:

Route: /deals

Компоненты:

ObjectPage

DataTable

DealStageBadge

PriorityBadge

FilterChip

EmptyFilterState

BulkActionBar

ComposeEmailModal

Acceptance:

View All Deals работает как таблица.

View Inbound leads применяет фильтры owner/type/stage.

Empty state показывает No Deals match that filter и кнопку Clear Filter.

Колонка ICP может быть заполнена вручную или через enrichment.

После отправки email deal stage может обновиться на Contacted.

Таблица поддерживает добавление/скрытие колонок.

2.5 Deals — kanban board

Назначение: управление сделками по стадиям pipeline.

Данные:

Object deals

Attribute Deal stage

AttributeOption стадий:

No stage

Lead

Contacted

Prospecting

Qualification

Meeting

Proposal

Negotiation

Won

Lost

Paused

Record

Value

View type BOARD

ViewColumn / board card fields

ViewFilter

API:

Нужны:

GET /api/crm/objects/deals/board?viewId=

PATCH /api/crm/records/:recordId/stage

PATCH /api/crm/records/:recordId/values

POST /api/crm/objects/deals/records

PATCH /api/crm/views/:viewId/board

Frontend:

Route: /deals?view=board или /objects/deals/views/[viewId]

Компоненты:

BoardView

BoardColumn

BoardCard

BoardCardField

StageHeader

AddRecordCard

DndBoardProvider

BoardViewSettings

Acceptance:

Kanban группирует сделки по Deal stage.

Карточки можно drag-and-drop перемещать между стадиями.

Перемещение обновляет Value стадии в БД.

В колонках видны счётчики.

В каждой стадии есть + New Deal.

Карточка показывает название, сумму, компанию, owner/avatars, активность/давность.

Фильтр и сортировка применяются к board view.

2.6 Invoices — table object

Назначение: табличный объект счетов со статусами, due date, суммой, компанией и workspace.

Данные:

Object invoices

Record

Attribute

AttributeOption

Value

RelationshipValue

Атрибуты:

Invoice

Status

Company

Billing Admin

Workspace

Due Date

Amount

Статусы:

Paid

Sent

Draft

Overdue

API:

Уже есть общий CRM API.

Нужны:

GET /api/crm/objects/invoices/records

POST /api/crm/objects/invoices/records

PATCH /api/crm/records/:recordId

GET /api/crm/objects/invoices/export

Frontend:

Route: /invoices

Компоненты:

ObjectPage

DataTable

StatusBadge

CurrencyCell

DateCell

NewInvoiceModal

Acceptance:

Invoices открываются из Records.

Таблица показывает invoice-id, status, company, billing admin, workspace, due date, amount.

Статусы отображаются цветными badge.

Можно создать invoice.

Можно фильтровать по статусу и due date.

Можно добавить кастомную колонку.

2.7 Users — table object

Назначение: CRM-объект пользователей продукта/клиентов workspace.

Данные:

Object users

Record

Attribute

Value

RelationshipValue

Связи с Workspaces, Companies, People

Атрибуты:

Name

Email

User type

Workspace

Company

Created at

Last active

Role

API:

Общий CRM API:

GET /api/crm/objects/users/records

POST /api/crm/objects/users/records

PATCH /api/crm/records/:recordId

Frontend:

Route: /users

Компоненты:

ObjectPage

DataTable

UserTypeBadge

RelationshipCell

Acceptance:

Users работает как стандартный гибкий объект.

Можно смотреть пользователей, фильтровать по типу/роли, связывать с workspace/company.

Добавление колонок работает через общий AddColumnMenu.

2.8 Workspaces — table object

Назначение: CRM-объект customer workspaces/accounts.

Данные:

Object workspaces

Record

Attribute

Value

RelationshipValue

Атрибуты:

Workspace name

Plan

ARR

Compliance type

Created at

Cancellation reason

Associated company

Billing admin

API:

Общий CRM API.

Для аналитики:

GET /api/reports/workspaces/created

GET /api/reports/workspaces/by-plan

GET /api/reports/workspaces/cancellation-reasons

Frontend:

Route: /workspaces

Компоненты:

ObjectPage

DataTable

PlanBadge

CurrencyCell

Acceptance:

Workspaces отображаются как CRM-объект.

Данные можно использовать в reports.

Plan и cancellation reason доступны как select/status поля.

2.9 Lists — table view

Назначение: списки записей поверх объектов, например Inbound Leads, Recruiting, Customer Success, PQL.

Данные:

List

ListEntry

Object

Record

View

ViewColumn

ViewFilter

Value

Attribute

RelationshipValue

API:

Нужны:

GET /api/lists

POST /api/lists

GET /api/lists/:listId

GET /api/lists/:listId/entries

POST /api/lists/:listId/entries

POST /api/lists/:listId/entries/bulk

DELETE /api/lists/:listId/entries/:entryId

PATCH /api/lists/:listId/entries/:entryId

GET /api/lists/:listId/views

Frontend:

Route: /lists/[listId]

Компоненты:

ListPage

ListHeader

DataTable

BoardView

ListEntryStageBadge

AddToListModal

ShareButton

Acceptance:

Список открывается из сайдбара.

Список знает базовый объект: People/Deals/Companies.

Entries отображаются в таблице.

Можно добавить запись в список.

Можно удалить запись из списка без удаления основного record.

Можно создать view внутри списка.

Bulk add из People/Deals работает.

2.10 Event Invitees — kanban list

Назначение: kanban-список приглашённых людей по стадиям события.

Данные:

List Event Invitees

ListEntry

Базовый Object people

Record

Value

Attribute

Stage attribute на уровне list entry:

No stage

Shortlisted

Invited

Accepted

Declined

Дополнительные поля:

Dietary requirements

Company

Last activity

Sequence status

API:

GET /api/lists/:listId/board

PATCH /api/lists/:listId/entries/:entryId/stage

POST /api/lists/:listId/entries

POST /api/sequences/:sequenceId/enroll

POST /api/workflows/run

Frontend:

Route: /lists/event-invitees

Компоненты:

ListPage

BoardView

BoardColumn

ListEntryCard

AddPersonToListModal

TemplatesModal

ListViewSettings

Acceptance:

Event Invitees открывается как список People.

Kanban показывает стадии и счётчики.

Карточки можно перемещать между стадиями.

Можно добавить Person.

Поля карточки настраиваются через View settings.

Share, Import / Export, Add Person доступны.

Workflow может реагировать на Record added to list.

2.11 Record page — base layout

Назначение: детальная страница записи с вкладками activity и правой панелью details/comments.

Данные:

Record

Object

Attribute

Value

RelationshipValue

RelationshipDefinition

EmailActivity

CallActivity

Note

Task

Comment

FileAttachment

ListEntry

CampaignLead / sequence enrollment при связке с AI-SDR.

API:

Нужны:

GET /api/crm/records/:recordId

GET /api/crm/records/:recordId/values

PATCH /api/crm/records/:recordId/values

GET /api/crm/records/:recordId/activity

GET /api/crm/records/:recordId/relationships

GET /api/crm/records/:recordId/lists

POST /api/crm/records/:recordId/comments

GET /api/crm/records/:recordId/comments

POST /api/crm/records/:recordId/tasks

POST /api/crm/records/:recordId/notes

Frontend:

Route: /records/[recordId]

Альтернатива: /objects/[objectKey]/records/[recordId]

Компоненты:

RecordPage

RecordHeader

RecordTabs

ActivityFeed

RecordDetailsPanel

RecordSection

InlineValueEditor

CommentsPanel

RelationshipList

ComposeEmailButton

AddToListButton

Acceptance:

Открытие записи из таблицы/board работает.

Header показывает breadcrumb, title, avatar/icon, favorite.

Вкладки доступны: Activity, Emails, Calls, Team, Associated deals, Notes, Tasks, Files.

Правая панель показывает Details и Comments.

Значения можно редактировать inline.

Секции Details сворачиваются.

Relationship-поля кликабельны и ведут в связанные записи.

Lists секция показывает списки записи и кнопку Add to list.

2.12 Record page — Activity tab

Назначение: единый таймлайн действий по записи.

Данные:

EmailActivity

CallActivity

Note

Task

Comment

WorkflowRun

SequenceEnrollment

Record

User

API:

GET /api/crm/records/:recordId/activity

POST /api/crm/records/:recordId/activity

POST /api/crm/records/:recordId/meetings

POST /api/email/compose

Frontend:

Компоненты:

ActivityFeed

ActivityItem

EmailActivityItem

CallActivityItem

NoteActivityItem

TaskActivityItem

TimelineSkeleton

AddMeetingButton

Acceptance:

Activity показывает события в обратной хронологии.

Loading state не ломает layout.

Новое письмо/звонок/заметка появляются в activity.

Для пустого activity есть корректный empty state.

2.13 Record page — Emails tab

Назначение: список email-активностей и просмотр полного письма.

Данные:

EmailActivity

Message

Campaign

CampaignLead

SequenceEnrollment

Record

User

API:

GET /api/crm/records/:recordId/emails

GET /api/emails/:emailId

POST /api/emails/compose

POST /api/emails/send

POST /api/emails/share

Frontend:

Компоненты:

EmailsTab

EmailList

EmailListItem

ViewEmailModal

ComposeEmailModal

EmailBodyRenderer

Acceptance:

Emails tab показывает список писем с темой, участниками, сниппетом, датой.

Клик по письму открывает View email modal.

Modal показывает subject, sender, recipients, timestamp, body.

Есть кнопка Share.

Compose email доступен из header.

2.14 Record page — Calls tab

Назначение: звонки по записи с AI-summary.

Данные:

CallActivity

CallParticipant

Record

User

Person

Поля:

title

summary

startedAt

endedAt

duration

participants

recordingUrl

transcript

aiSummary

API:

GET /api/crm/records/:recordId/calls

POST /api/crm/records/:recordId/calls

POST /api/calls/:callId/summarize

GET /api/calls/:callId

Frontend:

Компоненты:

CallsTab

CallCard

CallSummary

ParticipantAvatars

DurationBadge

Acceptance:

Calls tab показывает карточки звонков.

Карточка содержит title, summary, дату/время, участников, duration.

AI-summary сохраняется и показывается без повторной генерации.

При отсутствии звонков есть empty state.

2.15 Record page — Associated deals / Team / Relationships tabs

Назначение: просмотр связанных записей внутри record page.

Данные:

RelationshipDefinition

RelationshipValue

Record

Object

Attribute

Value

API:

GET /api/crm/records/:recordId/relationships

POST /api/crm/records/:recordId/relationships

DELETE /api/crm/relationships/:relationshipValueId

POST /api/crm/objects/deals/records

Frontend:

Компоненты:

RelationshipsTab

AssociatedDealsTab

RelatedRecordsTable

AddRelatedRecordButton

RecordPickerPopover

Acceptance:

Для компании видны associated deals.

Можно добавить Deal через + Add Deal.

Связанные записи открываются кликом.

Relationship обновляется с обеих сторон.

2.16 Record page — Comments tab

Назначение: внутренние комментарии команды по записи.

Данные:

Comment

CommentMention

User

Record

Object

API:

GET /api/crm/records/:recordId/comments

POST /api/crm/records/:recordId/comments

GET /api/search/mentions?q=

DELETE /api/comments/:commentId

Frontend:

Компоненты:

CommentsPanel

CommentComposer

MentionAutocomplete

CommentItem

MentionChip

Acceptance:

Comments tab открывается справа.

Можно написать комментарий.

@ открывает autocomplete людей/записей.

Mention вставляется как chip/link.

После отправки комментарий появляется в списке.

Комментарии не смешиваются с email-коммуникацией.

2.17 Notes / Tasks / Files

Назначение: рабочие сущности вокруг записи и workspace.

Данные:

Note

Task

FileAttachment

Record

User

Organization

Activity

API:

GET /api/notes

POST /api/notes

PATCH /api/notes/:id

GET /api/tasks

POST /api/tasks

PATCH /api/tasks/:id

POST /api/files

GET /api/crm/records/:recordId/files

Frontend:

Routes:

/notes

/tasks

внутри record page: tabs Notes, Tasks, Files

Компоненты:

NotesList

TaskList

TaskCheckbox

FileList

FileUploadButton

Acceptance:

Notes и Tasks доступны из сайдбара.

На record page можно создать note/task.

Task имеет статус, due date, assignee.

Files tab показывает вложения и поддерживает upload в рамках ограничений backend.

2.18 Compose email modal

Назначение: ручная или bulk-отправка персонализированных писем из CRM.

Данные:

User

Record

Person

EmailTemplate

EmailActivity

Message

CampaignLead

SequenceEnrollment

Organization

Email account settings.

API:

Уже есть demo email режим.

Нужны:

POST /api/email/compose-context

GET /api/email/templates

POST /api/email/templates

POST /api/email/send

POST /api/email/send-bulk

GET /api/email/outbox

POST /api/ai/email-draft

Frontend:

Компоненты:

ComposeEmailModal

RecipientPicker

TemplatePicker

EmailEditor

MergeFieldMenu

SendIndividuallyToggle

OutboxNotice

Acceptance:

Modal открывается из bulk-панели и record header.

From показывает текущего пользователя.

To заполняется выбранными people/records.

Subject/body редактируются.

Favorite templates, View all templates, Create new template доступны.

Send emails individually влияет на bulk-send payload.

В demo-режиме письмо не уходит наружу, но создаёт EmailActivity.

После отправки появляется toast/status.

Для deal можно обновить stage на Contacted.

2.19 Email templates

Назначение: reusable-шаблоны писем для compose и sequences.

Данные:

EmailTemplate

Organization

User

Merge fields из Object, Attribute, Record, Value.

API:

GET /api/email/templates

GET /api/email/templates/:id

POST /api/email/templates

PATCH /api/email/templates/:id

DELETE /api/email/templates/:id

Frontend:

Routes:

modal внутри compose

позже /settings/templates или /emails/templates

Компоненты:

TemplatePicker

TemplateList

TemplateEditor

MergeFieldMenu

Acceptance:

Можно создать шаблон из compose.

Можно выбрать шаблон и вставить subject/body.

Merge fields подставляются при отправке.

Favorite templates отображаются в compose.

2.20 Sequences — list

Назначение: список outbound-последовательностей.

Данные:

Legacy Sequence

SequenceStep

SequenceEnrollment

Message

User

Organization

Record

CampaignLead

API:

Уже частично есть legacy sequences/campaigns.

Нужны:

GET /api/sequences

POST /api/sequences

GET /api/sequences/:id

PATCH /api/sequences/:id

DELETE /api/sequences/:id

GET /api/sequences/:id/recipients

Frontend:

Route: /sequences

Компоненты:

SequencesPage

SequenceList

SequenceRow

SequenceStatusBadge

NewSequenceButton

ViewSettingsButton

FilterBar

Acceptance:

Sequences открываются из Automations.

Список показывает название, статус, recipients/members, owner, last updated.

Есть Sorted by Creation date, Filter, View settings, New sequence.

Loading и empty states корректны.

2.21 Sequence editor

Назначение: настройка шагов email-sequence, задержек, delivery window и exit criteria.

Данные:

Sequence

SequenceStep

SequenceEmailStep

SequenceWaitStep

SequenceEnrollment

EmailTemplate

User

Record

Message

Настройки:

sendingWindowStart

sendingWindowEnd

timezone

businessDaysOnly

unsubscribeLink

threadEmails

includeSenderSignature

exitOnReply

API:

GET /api/sequences/:id

PATCH /api/sequences/:id

POST /api/sequences/:id/steps

PATCH /api/sequences/:id/steps/:stepId

DELETE /api/sequences/:id/steps/:stepId

POST /api/sequences/:id/enroll

POST /api/sequences/:id/enable

POST /api/sequences/:id/disable

POST /api/ai/sequence-copy

Frontend:

Route: /sequences/[sequenceId]

Компоненты:

SequenceEditor

SequenceStepCard

WaitStepEditor

AutomatedEmailEditor

SequenceSettingsPanel

DeliverySettings

ExitCriteriaSettings

EnrollRecipientsButton

UseAiToGenerateCopyButton

Acceptance:

Editor показывает вкладки Editor, Recipients, Settings.

Можно добавить wait step.

Можно добавить automated email step.

Subject/body редактируются.

Merge fields работают.

Delivery window и timezone сохраняются.

Business days only сохраняется.

Exit criteria Reply received сохраняется.

Enable sequence включает обработку worker-ом.

Enroll recipients добавляет людей/records в sequence.

Worker создаёт demo/scheduled messages с учётом delay и delivery settings.

2.22 Workflows — list

Назначение: список автоматизаций workspace.

Данные:

Workflow

WorkflowNode

WorkflowEdge

WorkflowRun

WorkflowRunStep

User

Organization

API:

GET /api/workflows

POST /api/workflows

GET /api/workflows/:id

PATCH /api/workflows/:id

DELETE /api/workflows/:id

POST /api/workflows/:id/publish

POST /api/workflows/:id/unpublish

Frontend:

Route: /workflows

Компоненты:

WorkflowsPage

WorkflowList

WorkflowRow

WorkflowStatusBadge

NewWorkflowButton

WorkflowCardsStrip

Acceptance:

Workflows открываются из Automations.

Список показывает workflow name, status Live/Draft, owner, last updated.

Есть Sorted by Last published, Filter, View settings, New workflow.

Клик открывает builder.

2.23 Workflow builder — trigger selection

Назначение: создание workflow через выбор триггера.

Данные:

Workflow

WorkflowNode

Типы triggers:

Record command

Record created

Record updated

List entry command

List entry updated

Record added to list

Attribute updated

Task created

Manually run

Recurring schedule

Webhook received

API:

GET /api/workflows/triggers

POST /api/workflows

POST /api/workflows/:id/nodes

PATCH /api/workflows/:id/nodes/:nodeId

POST /api/workflows/:id/publish

Frontend:

Route: /workflows/[workflowId]

Компоненты:

WorkflowBuilder

WorkflowCanvas

TriggerPickerPanel

WorkflowNodeCard

WorkflowInspectorPanel

CanvasControls

PublishWorkflowBanner

Acceptance:

Новый workflow открывается как Untitled Workflow.

Есть вкладки Editor, Runs, Settings.

Draft banner показывает, что workflow не опубликован.

Правая панель показывает trigger search и группы триггеров.

Выбор trigger создаёт node на canvas.

Inspector показывает inputs выбранного trigger.

Workflow можно сохранить как draft.

2.24 Workflow builder — steps and live workflow

Назначение: визуальная цепочка trigger → action steps.

Данные:

Workflow

WorkflowNode

WorkflowEdge

WorkflowRun

Action step types:

Create or update record

Create record

Find records

Update record

Add record to list

Delete list entry

Find list entries

Update list entry

Enroll in sequence

Exit from sequence

Research record

AI classify record

AI summarize record

AI prompt

Send HTTP request

API:

GET /api/workflows/:id

POST /api/workflows/:id/nodes

PATCH /api/workflows/:id/nodes/:nodeId

DELETE /api/workflows/:id/nodes/:nodeId

POST /api/workflows/:id/run

GET /api/workflows/:id/runs

Worker:

обработчик workflow events

обработчик workflow runs

Frontend:

Route: /workflows/[workflowId]

Компоненты:

WorkflowCanvas

AddStepPanel

StepInspectorPanel

WorkflowNodeCard

WorkflowEdge

LiveToggle

RunHistoryTable

Acceptance:

Можно добавить step после trigger.

Step Enroll in sequence сохраняет sequenceId, record source, sender.

Step Update list entry сохраняет listId и values.

Workflow Record added to list → Enroll in sequence → Update list entry работает end-to-end.

Live toggle включает автоматический запуск.

Runs tab показывает историю запусков и ошибки.

Delete block удаляет node и корректно перестраивает edges.

2.25 Reports — dashboard list

Назначение: каталог dashboards и reports.

Данные:

Dashboard

Report

ReportWidget

User

Organization

Источники:

Record

Value

Object

ListEntry

Message

SequenceEnrollment

WorkflowRun

API:

GET /api/reports/dashboards

POST /api/reports/dashboards

PATCH /api/reports/dashboards/:id

DELETE /api/reports/dashboards/:id

POST /api/reports/dashboards/:id/favorite

Frontend:

Route: /reports

Компоненты:

ReportsPage

DashboardFavorites

DashboardTable

DashboardRow

ReportChips

NewDashboardButton

Acceptance:

Reports открывается из сайдбара.

Favorites показывают избранные dashboards.

Таблица показывает Dashboard, Reports, Created at.

Можно создать dashboard.

Можно открыть dashboard.

Звёздочка favorite работает локально/через API.

2.26 Report builder

Назначение: выбор типа отчёта и источника данных.

Данные:

Report

Dashboard

Object

Attribute

View

List

Типы отчётов:

Insight

Historical values

Funnel

Time in stage

Stage changed

API:

GET /api/reports/types

POST /api/reports

PATCH /api/reports/:id

POST /api/reports/:id/query-preview

Frontend:

Route: /reports/new или drawer внутри dashboard.

Компоненты:

ReportBuilder

ReportTypePicker

DataSourcePicker

ChartPlaceholder

ReportConfigPanel

Acceptance:

New report открывает builder.

Правая панель показывает типы отчётов.

До выбора источника canvas показывает Input needed to display chart.

Выбор типа переводит к настройке source/object/list.

Можно закрыть builder через ESC или ×.

2.27 Revenue Dashboard

Назначение: аналитический dashboard по revenue/pipeline.

Данные:

Dashboard

Report

ReportWidget

Object deals, companies, workspaces, invoices

Value

Метрики:

Total ARR / Deal value

Deal stage by team member

Employee range for companies in pipeline

Locations in active pipeline

Funnel report

Monthly inbound leads by owner

Pipeline stage changed

Workspaces created

Workspaces by plan

Workspace cancellation reasons

Total paid invoices YTD

API:

GET /api/reports/dashboards/:id

GET /api/reports/dashboards/:id/widgets

POST /api/reports/query

Специализированные MVP endpoints:

GET /api/analytics/revenue-dashboard

GET /api/analytics/funnel

GET /api/analytics/pipeline-by-stage

GET /api/analytics/employee-ranges

GET /api/analytics/invoices-ytd

Frontend:

Route: /reports/[dashboardId]

Компоненты:

DashboardPage

DashboardHeader

ReportGrid

KpiCard

BarChartCard

PieChartCard

MapChartCard

FunnelChart

LineChartCard

NewReportButton

Acceptance:

Revenue Dashboard открывается из Reports.

Загружаются KPI, bar, pie, map, funnel.

Виджеты имеют kebab menu.

Вертикальный scroll работает.

New report открывает builder.

Share доступен как UI-action.

При отсутствии данных показываются корректные empty states, а не ошибки.

2.28 Templates gallery

Назначение: выбор шаблонов списков/workflows/reports/processes по категориям.

Данные:

Template

TemplateCategory

TemplatePreview

Может быть seed/static JSON на MVP.

Категории:

Sales

Investing

Recruiting

Marketing

Customer Success

Fundraising

Finance

HR

Operations

PR

Startups

Venture Capital

Content

API:

GET /api/templates

GET /api/templates/:id

POST /api/templates/:id/apply

Frontend:

Компоненты:

TemplatesModal

TemplateCategoryList

TemplateSearch

TemplateCard

TemplatePreviewButton

StartFromScratchButton

Acceptance:

Modal открывается из list/workflow/report setup.

Поиск фильтрует шаблоны.

Категории фильтруют шаблоны.

Preview template показывает preview или disabled-state.

Start from Scratch закрывает modal и создаёт пустой объект/список/workflow.

2.29 Settings — Objects

Назначение: управление объектной моделью workspace.

Данные:

Object

Attribute

Record

View

List

RelationshipDefinition

API:

Уже есть:

/api/objects

Нужны:

GET /api/settings/objects

POST /api/objects

PATCH /api/objects/:objectId

DELETE /api/objects/:objectId

GET /api/objects/:objectId/attributes

Frontend:

Route: /settings/objects

Компоненты:

SettingsLayout

SettingsSidebar

ObjectsSettingsPage

ObjectsTable

CreateCustomObjectModal

ObjectRowMenu

Acceptance:

Settings открывается отдельным layout.

В меню есть Account, Workspace, Data, Reports, Automations.

Objects показывает таблицу Object, Type, Records.

Companies/Deals/Invoices/People/Users/Workspaces отображаются как Standard/Custom.

Search фильтрует объекты.

+ Create custom object создаёт новый object.

Row menu открывается.

2.30 Create attribute modal

Назначение: создание гибких полей объекта, включая AI autofill и relationships.

Данные:

Attribute

AttributeOption

RelationshipDefinition

Object

AI config fields:

aiAutofillEnabled

aiAutofillType

aiPrompt

aiModel

Типы:

TEXT

NUMBER

CURRENCY

DATE

BOOLEAN

SELECT

MULTI_SELECT

RELATIONSHIP

URL

EMAIL

LOCATION

USER

STATUS

RECORD

AI_CLASSIFY

AI_SUMMARIZE

AI_RESEARCH

API:

Уже есть/расширить:

POST /api/crm/objects/:objectKey/attributes

GET /api/crm/objects/:objectKey/attributes

POST /api/crm/attributes/:attributeId/options

POST /api/crm/relationship-definitions

POST /api/ai/autofill/preview

Frontend:

Компоненты:

CreateAttributeModal

AttributeTypeSelect

AttributeOptionsEditor

AiAutofillSettings

RelationshipConfig

CardinalitySelect

Acceptance:

Modal открывается из + Add column.

Можно выбрать тип attribute.

Для select/multi-select можно добавить options.

Для relationship можно выбрать target object и cardinality.

Создаётся обратный associated attribute.

AI autofill можно включить и сохранить prompt/type.

После создания attribute появляется в Add column menu.

После добавления column появляется в таблице.

2.31 Settings — Members

Назначение: управление участниками организации.

Данные:

User

Organization

Membership или role-поле в User

Invite-модель, если будет добавлена.

API:

GET /api/settings/members

POST /api/settings/members/invite

PATCH /api/settings/members/:userId

DELETE /api/settings/members/:userId

Frontend:

Route: /settings/members

Компоненты:

MembersSettingsPage

MembersTable

InviteMemberModal

RoleSelect

Acceptance:

Видны участники workspace.

Можно пригласить email.

Можно менять роль.

Нельзя удалить последнего admin/owner.

2.32 Settings — Billing / Plans

Назначение: тарифы, billing status, Stripe checkout/customer portal.

Данные:

Organization

Stripe customer/subscription fields

Plan

Invoice при наличии.

API:

Уже legacy Stripe может быть частично.

Нужны:

GET /api/billing/status

POST /api/billing/checkout

POST /api/billing/portal

POST /api/billing/webhook

Frontend:

Routes:

/settings/plans

/settings/billing

Компоненты:

BillingSettingsPage

PlanCard

CurrentSubscription

BillingPortalButton

Acceptance:

Показывается текущий план.

Checkout создаётся через Stripe.

Billing portal открывается.

Webhook обновляет subscription status.

При отсутствии Stripe env экран показывает безопасный disabled state.

2.33 Settings — Developers

Назначение: API keys, webhooks, developer access.

Данные:

ApiKey

WebhookEndpoint

Organization

User

API:

GET /api/settings/api-keys

POST /api/settings/api-keys

DELETE /api/settings/api-keys/:id

GET /api/settings/webhooks

POST /api/settings/webhooks

DELETE /api/settings/webhooks/:id

Frontend:

Route: /settings/developers

Компоненты:

DevelopersSettingsPage

ApiKeysTable

CreateApiKeyModal

WebhookEndpointsTable

Acceptance:

Можно создать API key.

Секрет показывается один раз.

Можно удалить API key.

Webhook endpoint можно создать и отключить.

2.34 Settings — Lists / Import History / Dashboards / Sequences / Workflows

Назначение: централизованные настройки data/automation сущностей.

Данные:

List

ImportJob

Dashboard

Sequence

Workflow

API:

GET /api/settings/lists

GET /api/settings/import-history

GET /api/settings/dashboards

GET /api/settings/sequences

GET /api/settings/workflows

Frontend:

Routes:

/settings/lists

/settings/import-history

/settings/dashboards

/settings/sequences

/settings/workflows

Компоненты:

SettingsDataTable

ImportHistoryTable

Acceptance:

Все пункты меню настроек открываются.

Для MVP допустимы read-only таблицы.

Пустые состояния корректны.

2.35 Quick actions / Command menu

Назначение: глобальный поиск и быстрые действия.

Данные:

Object

Record

List

View

Dashboard

Sequence

Workflow

Task

User

API:

GET /api/search?q=

POST /api/quick-actions/run

Frontend:

Компоненты:

CommandMenu

CommandSearchInput

CommandResultGroup

CommandResultItem

Acceptance:

Открывается по Quick actions и ⌘K / Ctrl+K.

Поиск находит records, objects, lists, reports, sequences, workflows.

Enter открывает выбранный результат.

Есть быстрые действия: New company, New person, New deal, Compose email, New sequence, New workflow.

2.36 Notifications

Назначение: системные и пользовательские уведомления.

Данные:

Notification

User

Organization

Связанные сущности: Record, Task, WorkflowRun, SequenceEnrollment, EmailActivity.

API:

GET /api/notifications

PATCH /api/notifications/:id/read

POST /api/notifications/read-all

Frontend:

Route: /notifications

Компоненты:

NotificationsPage

NotificationList

NotificationItem

UnreadBadge

Acceptance:

Сайдбар показывает Notifications.

Список уведомлений открывается.

Unread count работает.

Можно отметить уведомление прочитанным.

2.37 Emails inbox / Calls / Tasks / Notes top-level pages

Назначение: верхнеуровневые рабочие центры по активностям.

Данные:

EmailActivity

CallActivity

Task

Note

Record

User

API:

GET /api/emails

GET /api/calls

GET /api/tasks

GET /api/notes

Frontend:

Routes:

/emails

/calls

/tasks

/notes

Компоненты:

ActivityListPage

EmailInboxTable

CallsTable

TasksTable

NotesTable

Acceptance:

Все пункты сайдбара открываются без 404.

MVP может показывать таблицу/empty state.

Активности кликабельны и ведут к связанным records.

2.38 Import / Export

Назначение: загрузка CSV и выгрузка данных объекта/list view.

Данные:

ImportJob

ImportRowError

Object

Attribute

Record

Value

List

ListEntry

API:

POST /api/imports

GET /api/imports/:id

GET /api/imports

POST /api/crm/objects/:objectKey/import

GET /api/crm/objects/:objectKey/export

GET /api/lists/:listId/export

Frontend:

Компоненты:

ImportExportMenu

CsvImportModal

FieldMappingStep

ImportProgress

ImportHistoryTable

Acceptance:

Import / Export menu открывается.

CSV можно загрузить для Companies/People/Deals.

Mapping колонок в MVP может быть auto-by-name.

Ошибки строк сохраняются.

Export скачивает CSV текущего view/list.

2.39 AI enrichment / AI autofill

Назначение: автоматическое заполнение/классификация/суммаризация атрибутов.

Данные:

Attribute

Record

Value

AiJob

AiJobResult

Organization

User

API:

POST /api/ai/autofill/preview

POST /api/ai/autofill/run

POST /api/crm/records/:recordId/enrich

POST /api/crm/objects/:objectKey/enrich

Worker queue:

ai-autofill

ai-research

ai-summarize

Frontend:

Компоненты:

AiAutofillSettings

StartEnrichmentButton

EnrichmentStatusToast

AiGeneratedBadge

Acceptance:

Attribute может иметь AI autofill config.

Для record можно запустить enrichment.

Результат сохраняется в Value.

UI показывает loading/toast.

При отсутствии Anthropic key показывается безопасная ошибка, не падает экран.

3. План по фазам
Phase 1 — минимально рабочий гибкий CRM MVP

Цель: Companies/People/Deals работают как гибкая CRM с таблицами, views, record page, базовой навигацией и demo-email.

Блок 1.1 — App shell и навигация

Dashboard layout.

Sidebar как у Attio.

Workspace switcher.

Records section.

Lists section.

Automations section.

Reports link.

Settings entry.

Quick actions trigger.

Готово, когда пользователь после логина может перейти на Companies, People, Deals, Lists, Reports, Settings без 404.

Блок 1.2 — Bootstrap CRM объектов

Идемпотентный seed/ensure для Companies, People, Deals.

Базовые attributes.

Базовые views:

Companies: All Companies

People: Recently Contacted People, Admin users

Deals: All Deals, Deals overview, Inbound leads

Базовые options:

deal stages

priority

categories

employee range

Готово, когда новая организация получает рабочий набор CRM-объектов.

Блок 1.3 — Object table page

Универсальная страница объекта.

DataTable из ViewColumn.

Value renderer по типам.

Inline edit.

Add column.

FilterBar.

SortControl.

Calculation row MVP: count.

Empty states.

Готово, когда Companies/People/Deals отображаются одной универсальной реализацией.

Блок 1.4 — Attribute creation

CreateAttributeModal.

Типы TEXT, NUMBER, CURRENCY, DATE, BOOLEAN, SELECT, MULTI_SELECT, URL, EMAIL, LOCATION.

SELECT/MULTI_SELECT options.

Add column после создания.

Relationship MVP: Companies ↔ People, Deals ↔ Companies/People.

Готово, когда можно создать POC/Segment/ICP и увидеть колонку в таблице.

Блок 1.5 — Record page

/objects/[objectKey]/records/[recordId].

Header.

Tabs.

Details panel.

Inline edit details.

Activity empty/loading.

Emails tab MVP.

Comments MVP.

Associated deals/team через relationships.

Готово, когда запись компании открывается из таблицы и показывает Details/Emails/Comments/Associated deals.

Блок 1.6 — Lists MVP

List model API.

Add selected People/Deals to list.

List table page.

Event Invitees seed.

Toast после bulk add.

Go to list.

Готово, когда из People можно выбрать записи, добавить в Event Invitees и открыть список.

Блок 1.7 — Compose email demo

ComposeEmailModal.

Recipients from selected rows.

From current user.

Subject/body.

Templates MVP.

Demo send.

EmailActivity creation.

Toast Sending email.

Deal stage update optional.

Готово, когда из Deals/People можно отправить demo email и увидеть его в record Emails tab.

Блок 1.8 — MVP polish

Loading states.

Empty states.

Toasts.

Row hover.

Selected rows.

BulkActionBar.

Keyboard close ESC for modals.

Basic responsive behavior.

Готово, когда основной CRM flow можно пройти без ручного вмешательства.

Phase 2 — board views, bulk actions, templates

Цель: приблизить UX к Attio в списках, kanban и массовых действиях.

Блок 2.1 — Deals kanban

Board view type.

Group by deal stage.

Drag-and-drop через @dnd-kit.

Board card fields.

Add record inside stage.

Блок 2.2 — Event Invitees kanban

List board view.

Stage на list entry.

Drag-and-drop stage update.

Add Person.

Card field settings.

Блок 2.3 — Advanced bulk

Add to list modal.

Send email bulk.

Run workflow bulk.

Enroll in sequence bulk.

More menu.

Bulk API transaction safety.

Блок 2.4 — Templates gallery

Static templates.

Categories.

Search.

Preview placeholder.

Start from Scratch.

Apply template to list/workflow/sequence later.

Phase 3 — AI-SDR sequences

Цель: полноценные outbound sequences с worker scheduling.

Блок 3.1 — Sequences list

/sequences.

Table/list of sequences.

Status.

Owner.

Recipients count.

New sequence.

Блок 3.2 — Sequence editor

Editor/Recipients/Settings tabs.

Wait step.

Automated email step.

Merge fields.

Delivery window.

Timezone.

Business days only.

Thread emails.

Sender signature.

Unsubscribe link.

Exit criteria reply received.

Блок 3.3 — Enroll recipients

Enroll selected People/List entries.

Enrollment state.

Prevent duplicate enrollment.

Recipient tab.

Блок 3.4 — Worker execution

BullMQ jobs per sequence step.

Respect wait step.

Respect delivery window.

Demo send first, SMTP later.

Stop on reply.

Track sent/open/reply if available.

Блок 3.5 — AI copy

Use AI to generate copy.

Prompt uses record values, company firmographics, previous emails/calls.

Save generated draft into step editor.

Phase 4 — Workflows

Цель: визуальные автоматизации CRM + AI-SDR.

Блок 4.1 — Workflow list

/workflows.

List with Live/Draft status.

New workflow.

Last published sorting.

Блок 4.2 — Builder canvas

Canvas.

Node cards.

Edges.

Zoom controls.

Inspector panel.

Draft banner.

Publish workflow.

Блок 4.3 — Triggers

Record created.

Record updated.

Record added to list.

List entry updated.

Attribute updated.

Task created.

Manually run.

Блок 4.4 — Steps

Add record to list.

Update list entry.

Update record.

Enroll in sequence.

Exit from sequence.

AI classify record.

AI summarize record.

AI prompt.

Send HTTP request later.

Блок 4.5 — Runtime

Workflow event dispatcher.

Worker queue.

WorkflowRun/WorkflowRunStep logs.

Runs tab.

Error handling and retry.

Phase 5 — Reports and dashboards

Цель: dashboards как в Attio, сначала с MVP analytics endpoints, затем generic report builder.

Блок 5.1 — Reports list

/reports.

Dashboard favorites.

Dashboard table.

New dashboard.

Блок 5.2 — Revenue Dashboard MVP

KPI.

Stage bar chart.

Employee range pie.

Location placeholder/map.

Funnel chart.

Lower charts placeholders or real queries where easy.

Блок 5.3 — Report builder

Type picker.

Insight.

Historical values.

Funnel.

Time in stage.

Stage changed.

Source picker.

Chart placeholder.

Блок 5.4 — Generic query layer

Aggregate records by attribute.

Count/sum/avg.

Group by select/date/user/stage.

Filter by object/view/list.

Persist report config.

Phase 6 — Settings, billing, developers

Цель: workspace управляется через Settings, billing работает через Stripe.

Блок 6.1 — Settings layout

Sidebar.

Search settings.

Account/Workspace/Data/Reports/Automations sections.

Pages open without 404.

Блок 6.2 — Objects settings

Objects table.

Search.

Create custom object.

Object row menu.

Attribute list per object later.

Блок 6.3 — Members

Members table.

Invite member.

Role change.

Remove member safety.

Блок 6.4 — Billing

Current plan.

Stripe checkout.

Stripe portal.

Webhook.

Disabled state without env.

Блок 6.5 — Developers

API keys.

Webhooks.

Secret one-time display.

Phase 7 — Activity centers and production hardening

Цель: довести платформу до рабочего состояния для реального использования.

Блок 7.1 — Top-level activity pages

Notifications.

Tasks.

Notes.

Emails.

Calls.

Блок 7.2 — Tracking

Open tracking pixel.

Reply tracking via mailbox integration later.

Message events.

Sequence exit on reply.

Блок 7.3 — Permissions

Org isolation.

Role-based access.

API key scopes.

Record-level access later.

Блок 7.4 — Import/export hardening

CSV mapping UI.

Import history.

Row errors.

Duplicate detection.

Блок 7.5 — Observability

Worker logs.

Workflow run logs.

Email send logs.

Error boundaries.

Health checks.

4. Приоритеты
Критично для полностью рабочего MVP

Auth + organization context.

Sidebar/navigation без 404.

CRM bootstrap для Companies/People/Deals.

Универсальная Object table page.

ViewColumn-based DataTable.

View filters/sort MVP.

Create/edit records.

Create attribute + add column.

Relationship MVP.

Record page с Details/Emails/Comments.

Lists MVP + Add to list bulk action.

Compose email demo + EmailActivity.

Deals stage update after email.

Clean loading/empty/error states.

Seed/demo data для всех основных экранов.

Важно сразу после MVP

Deals kanban.

Event Invitees kanban.

Bulk actions: Send email, Enroll in sequence.

Sequences list/editor.

Sequence worker в demo-mode.

Workflow list/builder MVP.

Workflow trigger Record added to list.

Workflow step Enroll in sequence.

Workflow run logs.

Reports list + Revenue Dashboard MVP.

Можно позже

Полный generic report builder.

Гео-карта с реальными координатами.

Advanced calculations в таблицах.

Advanced permissions.

Real mailbox sync.

Calendar sync.

Call recording/transcription.

Full template application engine.

Advanced AI research agent.

HTTP request workflow step.

Public API/webhooks production-grade.

Fine-grained audit log.

Не делать до стабилизации MVP

Сложный no-code builder для всех типов automation.

Полноценный BI query engine.

Мульти-workspace switching beyond current org.

Сложные billing entitlements.

Marketplace/apps.

Глубокая кастомизация UI themes.

Mobile-first адаптация.

5. Минимальный end-to-end сценарий, который должен работать первым

Пользователь регистрируется и логинится.

Организация получает seed CRM: Companies, People, Deals.

Пользователь открывает Companies.

Создаёт attribute Segment.

Добавляет колонку Segment в таблицу.

Открывает компанию Cosme.

Видит Details и Associated deals.

Переходит в Deals.

Открывает inbound view.

Выбирает deal/person.

Нажимает Send email.

Compose modal открывается с recipient.

Пользователь отправляет demo email.

EmailActivity появляется в record Emails tab.

Deal stage обновляется на Contacted.

Пользователь выбирает People.

Массово добавляет людей в Event Invitees.

Открывает Event Invitees list.

Видит добавленные entries.

Позже этот же list запускает workflow → sequence.

Этот сценарий является базовой проверкой, что CRM-ядро, гибкие данные, email demo, activity и lists работают как единая платформа.

---

## Озвучка эталона (аудио-ТЗ)

Извлечён звук из `ref.mp4` (9:17) и распознан в текст (faster-whisper). Полный разбор «что говорит спикер + что строить» — в [NARRATION.md](./NARRATION.md). Транскрипт: [transcript.txt](./transcript.txt) / [transcript.srt](./transcript.srt), аудио [ref_audio.mp3](./ref_audio.mp3). Озвучка = официальное продуктовое ТЗ Attio: 16 фич-блоков с привязкой к таймкодам и кадрам storyboard.
