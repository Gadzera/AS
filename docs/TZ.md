
Техническое задание AISDR
1. Видение продукта

AISDR — веб-платформа для B2B-команд, объединяющая гибкую CRM-модель уровня Attio и встроенный AI-SDR-модуль для генерации, отправки и автоматизации outbound/inbound-коммуникаций.

Продукт должен позволять пользователю:

описывать собственную CRM-модель через объекты, атрибуты, связи, виды и списки;

работать с базовыми объектами Companies, People и Deals из коробки;

импортировать, фильтровать, сортировать и сегментировать записи;

вести карточку записи с атрибутами, активностью, письмами, заметками и задачами;

создавать списки и pipeline-представления;

вручную отправлять письма по лиду в demo-режиме;

позже — запускать последовательности писем, workflow-автоматизации, отчёты, биллинг и полноценный AI-SDR.

Ключевое отличие от текущего состояния: CRM больше не должна быть жёстко завязана на фиксированные таблицы Lead и Campaign. В центре модели должны быть гибкие объекты, атрибуты и записи, а AI-SDR должен работать поверх этой гибкой модели.

2. Глоссарий
Workspace / Organization

Организация пользователя. В текущей схеме соответствует Organization. Все данные CRM, пользователи, объекты, записи, письма, workflow и отчёты принадлежат организации.

User

Пользователь организации. Имеет роль OWNER, ADMIN или MEMBER.

Object

Тип бизнес-сущности в CRM. Примеры: Company, Person, Deal, Invoice, Workspace. В MVP поддерживаются системные объекты Companies, People, Deals и возможность добавлять кастомные атрибуты к ним.

Attribute

Поле объекта. Примеры: Company name, Email, LinkedIn URL, Deal value, Deal stage, Owner, City, Employee range.

Attribute Type

Тип значения атрибута: text, number, boolean, date, datetime, select, multi-select, currency, email, phone, url, relationship, user, json.

Record

Конкретная запись объекта. Например, компания Acme Inc, человек Jane Smith, сделка Enterprise Renewal.

Value

Значение атрибута для конкретной записи. Для гибкости значения хранятся отдельно от записи и типизируются через Attribute.

Relationship

Связь между записями разных или одинаковых объектов. Примеры: Person → Company, Deal → Company, Deal → People.

View

Сохранённое представление объекта или списка. Может быть таблицей или board/kanban. Хранит фильтры, сортировки, колонки и настройки группировки.

List

Пользовательская подборка записей. Списки могут быть обычными сегментами или pipeline-воронками. У записи внутри списка могут быть собственные list-атрибуты, например stage или dietary requirements.

List Entry

Членство записи в списке. Может иметь собственный статус, stage, порядок и дополнительные значения.

Sequence

Последовательность касаний, обычно email. Состоит из шагов: wait, automated email, manual task.

Workflow

Автоматизация из триггера и шагов. Пример: при добавлении записи в список Event Invitees записать человека в sequence и обновить stage.

Activity

Событие в ленте записи: создание, изменение атрибута, отправка письма, открытие письма, ответ, заметка, задача, звонок, запуск workflow.

Email

Письмо, привязанное к записи, sequence, workflow или ручной отправке. В demo-режиме отправка может симулироваться.

Report

Сохранённый отчёт или виджет дашборда.

3. Целевые пользователи
Owner / Founder

Настраивает организацию, объекты, атрибуты, пользователей, billing, лимиты и интеграции.

Sales / SDR

Работает с People, Companies, Deals, списками, письмами, последовательностями и задачами.

Sales Manager

Настраивает pipeline, виды, отчёты, workflow, контролирует эффективность кампаний и команд.

RevOps / Admin

Проектирует CRM-модель, кастомные атрибуты, связи, правила автоматизации и импорт данных.

4. Общая структура продукта
4.1 Глобальная навигация

Левый сайдбар:

переключатель workspace;

Quick actions / command palette;

Search;

Notifications;

Tasks;

Notes;

Emails;

Calls;

Reports;

Automations;

Favorites;

Records:

Companies;

People;

Deals;

позже: Users, Workspaces, Invoices и кастомные объекты;

Lists:

Inbound Leads;

Recruiting;

Customer Success;

Onboarding Pipeline;

PQL;

Event Invitees;

All lists.

4.2 Records

Раздел для работы с объектами CRM.

Для каждого объекта доступны:

список сохранённых views;

table view;

board view;

создание записи;

импорт;

экспорт;

настройка колонок;

фильтры;

сортировки;

bulk operations;

переход в record-страницу.

4.3 Record Page

Детальная карточка записи:

breadcrumbs;

заголовок с primary display attribute;

кнопка Compose email;

вкладки:

Activity;

Emails;

Calls;

Comments;

центральная лента активности;

правая панель Details;

блок Lists;

блок Relationships;

блок Tasks/Notes;

позже: enrichment, firmographics, social links, AI summary.

4.4 Lists

Раздел пользовательских списков и pipeline-подборок.

Функции:

список всех lists;

создание списка;

добавление records;

table view;

board view;

list-specific attributes;

stage/status внутри списка;

bulk operations;

запуск workflow или sequence по выбранным entries.

4.5 Emails

Раздел email-активности.

Функции MVP:

просмотр писем, созданных и отправленных из системы;

ручное создание письма из record page;

demo-режим без внешнего SMTP;

сохранение outbound email как activity.

Позже:

inbound replies;

tracking opens/clicks;

threading;

unsubscribe;

подписи;

реальные SMTP/API-интеграции.

4.6 Sequences

Раздел последовательностей.

Функции позже:

редактор sequence;

шаги wait/email/task;

recipients tab;

настройки delivery window;

timezone;

business days only;

unsubscribe link;

thread emails;

sender signature;

exit criteria;

enroll recipients;

enable/disable sequence.

4.7 Automations / Workflows

Раздел автоматизаций.

Функции позже:

список workflows;

визуальный builder;

trigger nodes;

action nodes;

ветвление;

run history;

live toggle;

настройки workflow.

Пример workflow:

Trigger: Record added to list Event Invitees.

Action: Enroll in sequence.

Action: Update list entry stage.

4.8 Reports / Dashboards

Раздел аналитики.

Функции позже:

создание отчёта;

funnel;

time in stage;

stage changed;

bar/line/pie charts;

revenue dashboard;

sharing;

сохранённые dashboards.

4.9 Tasks, Notes, Calls, Notifications

Служебные модули CRM.

Функции MVP:

базовая модель Task, Note, Activity;

отображение заметок и задач в record page.

Позже:

отдельные inbox-разделы;

напоминания;

звонки;

уведомления;

assignment;

SLA.

5. MVP

MVP должен дать пользователю ощущение гибкой CRM, а не фиксированной таблицы лидов.

5.1 Входит в MVP
5.1.1 Auth и Organization

регистрация;

логин;

JWT;

привязка пользователя к Organization;

роли OWNER, ADMIN, MEMBER.

5.1.2 Системные объекты

Из коробки создаются объекты:

Companies;

People;

Deals.

Для каждого объекта создаются базовые атрибуты.

Companies:

Name;

Domain;

Website;

Industry;

Employee range;

City;

Country;

LinkedIn;

Owner.

People:

First name;

Last name;

Full name;

Email;

Title;

LinkedIn;

Company relationship;

Owner;

Status.

Deals:

Name;

Deal value;

Currency;

Stage;

Associated company;

Associated people;

Owner;

Close date.

5.1.3 Кастомные атрибуты

Пользователь может:

открыть настройки объекта;

добавить новый атрибут;

выбрать тип;

задать label;

задать key;

для select/multi-select настроить options;

для relationship выбрать target object.

В MVP достаточно поддержать типы:

text;

number;

boolean;

date;

select;

multi-select;

currency;

email;

url;

relationship;

user.

5.1.4 Табличный вид

Для каждого объекта:

вывод записей в таблице;

настраиваемые колонки;

порядок колонок;

скрытие/добавление колонок;

фильтры;

сортировка;

создание нового view;

сохранение view;

удаление view;

счётчик записей.

В MVP фильтры:

equals;

not equals;

contains;

is empty;

is not empty;

greater than;

less than;

before;

after.

В MVP сортировка:

по одному или нескольким атрибутам;

ascending/descending.

5.1.5 Record page

Для записи:

просмотр primary title;

просмотр и редактирование атрибутов;

просмотр relationships;

вкладка Activity;

вкладка Emails;

вкладка Comments/Notes;

правая панель Details;

блок Lists;

кнопка Compose email.

5.1.6 Lists

Пользователь может:

создать list;

выбрать primary object;

добавить запись в list;

удалить запись из list;

открыть list table view;

добавить list-specific stage;

видеть членство записи в списках на record page.

5.1.7 Demo email

Пользователь может:

открыть People record;

нажать Compose email;

сгенерировать письмо шаблонно, если нет AI-ключей;

отредактировать subject/body;

отправить в demo-режиме;

увидеть email в Emails tab и Activity.

5.1.8 Миграция текущих Leads

Существующие Lead должны быть перенесены в гибкую модель:

Lead.company → Company record;

Lead.firstName/lastName/email/title/linkedinUrl → Person record;

Lead.companySize/industry/country/city/website → Company attributes;

Lead.score/status/source/enriched/notes → Person attributes или activity/note;

Message → Email + Activity.

Старые таблицы Lead/Campaign могут временно сохраняться как legacy, но новый UI должен работать через Object/Record/Value.

5.2 Не входит в MVP

полноценный visual workflow builder;

production sequence scheduler;

real email tracking;

inbound reply parsing;

enrichment providers;

complex permission model;

custom objects UI;

advanced reports;

Stripe billing enforcement;

mobile UI;

audit log уровня enterprise;

realtime collaboration.

6. Пользовательские сценарии
6.1 Регистрация и вход

Пользователь открывает приложение.

Переходит на страницу регистрации.

Вводит email, имя, пароль и название организации.

Backend создаёт Organization и User с ролью OWNER.

Пользователь получает JWT.

Frontend сохраняет auth state.

Пользователь попадает в dashboard.

6.2 Первый вход в CRM

Пользователь входит в dashboard.

Система проверяет наличие системных объектов.

Если Companies/People/Deals не созданы, backend создаёт bootstrap-набор объектов и атрибутов.

Пользователь видит левый sidebar с Records.

По умолчанию открывается People или Companies table view.

6.3 Создание атрибута

Пользователь открывает object view.

Нажимает View settings.

Нажимает Add column.

Выбирает Create new attribute.

Вводит label.

Выбирает тип.

Для select/multi-select добавляет options.

Для relationship выбирает target object.

Backend создаёт Attribute.

ViewColumn добавляется в текущий view.

Таблица показывает новую колонку.

6.4 Создание записи

Пользователь открывает объект People.

Нажимает + New Person.

Вводит значения базовых полей.

Backend создаёт Record.

Backend создаёт Value для заполненных атрибутов.

Backend создаёт Activity типа RECORD_CREATED.

Frontend добавляет строку в таблицу.

Пользователь может открыть record page.

6.5 Редактирование записи в таблице

Пользователь кликает ячейку.

Frontend определяет Attribute type.

Показывает подходящий editor.

Пользователь меняет значение.

Backend валидирует значение по Attribute type.

Backend обновляет Value.

Backend пишет Activity типа VALUE_UPDATED.

Таблица обновляется.

6.6 Настройка table view

Пользователь открывает view.

Меняет колонки.

Добавляет фильтр.

Добавляет сортировку.

Frontend отправляет изменения view.

Backend сохраняет ViewColumn, ViewFilter, ViewSort.

Следующее открытие view восстанавливает настройки.

6.7 Фильтрация записей

Пользователь открывает фильтр.

Выбирает Attribute.

Выбирает operator.

Вводит значение.

Frontend отправляет query.

Backend строит безопасный Prisma/Postgres-запрос к Record/Value.

Backend возвращает records.

Frontend показывает результат и count.

Если записей нет, UI показывает пустое состояние и кнопку Clear filter.

6.8 Создание relationship

Пользователь создаёт Attribute типа relationship.

Выбирает source object и target object.

Указывает cardinality: one-to-one, one-to-many или many-to-many.

Опционально включает reverse attribute.

Backend создаёт Attribute и RelationshipDefinition.

При заполнении поля backend создаёт RelationshipValue.

Record page показывает связанную запись.

6.9 Создание списка

Пользователь открывает Lists.

Нажимает New list.

Вводит название.

Выбирает primary object.

Backend создаёт List.

Backend создаёт default view для списка.

Пользователь попадает на list page.

6.10 Добавление записи в список

Пользователь выбирает одну или несколько строк в People table.

Нажимает Add to list.

Выбирает список.

Backend создаёт ListEntry.

Backend пишет Activity типа RECORD_ADDED_TO_LIST.

Record page начинает показывать членство в списке.

6.11 Board view для Deals

Пользователь открывает Deals.

Выбирает view типа Board.

View настроен на groupBy Attribute Deal stage.

Backend возвращает records, сгруппированные по stage.

Frontend показывает kanban-колонки.

Пользователь перетаскивает карточку в другую stage.

Backend обновляет Value stage.

Backend пишет Activity.

6.12 Compose email в demo-режиме

Пользователь открывает Person record.

Нажимает Compose email.

Frontend открывает composer.

Backend формирует черновик:

если есть AI-конфигурация, использует AI-сервис;

если ключей нет, возвращает шаблонный текст.

Пользователь редактирует subject/body.

Пользователь нажимает Send.

В demo-режиме backend не отправляет реальное письмо, а создаёт Email со статусом SENT и demo=true.

Backend создаёт Activity типа EMAIL_SENT.

Письмо появляется во вкладке Emails.

6.13 Bulk operations

Пользователь выбирает несколько строк.

Внизу появляется bulk action bar.

В MVP доступны:

Add to list;

Send email в demo-режиме;

Update attribute.

Позже добавляются:

Run workflow;

Enroll in sequence;

Export;

Delete.

6.14 Импорт CSV

Пользователь открывает object table.

Нажимает Import.

Загружает CSV.

Frontend показывает mapping колонок CSV к attributes.

Пользователь подтверждает mapping.

Backend создаёт ImportJob.

Worker обрабатывает строки.

Для каждой строки создаёт Record и Values.

Ошибки сохраняются в ImportJobResult.

UI показывает результат импорта.

Для Phase 1 импорт CSV можно оставить совместимым с текущим leads-import, но целевая реализация должна писать в Record/Value.

6.15 Sequence editor

Реализуется после MVP.

Пользователь открывает Automations → Sequences.

Создаёт sequence.

Добавляет шаг Wait.

Добавляет шаг Automated email.

Заполняет subject/body с merge-тегами.

Настраивает delivery window.

Настраивает exit criteria.

Нажимает Enable sequence.

Добавляет recipients.

Worker создаёт scheduled email jobs.

6.16 Workflow builder

Реализуется после MVP.

Пользователь открывает Automations → Workflows.

Создаёт workflow.

Выбирает trigger.

Добавляет action nodes.

Настраивает inputs.

Включает Live.

Система запускает workflow при наступлении trigger.

Runs tab показывает историю запусков.

6.17 Reports

Реализуется после MVP.

Пользователь открывает Reports.

Нажимает New report.

Выбирает источник данных.

Выбирает тип отчёта.

Настраивает group by, metric, filters.

Сохраняет report.

Добавляет report на dashboard.

7. Функциональные требования по модулям
7.1 Auth

Email должен быть уникальным.

Пароль хранится только как bcrypt hash.

JWT должен включать userId и orgId.

Все CRM-запросы должны фильтроваться по orgId.

Пользователь без orgId не должен видеть CRM-данные.

7.2 Object Metadata

Organization может иметь системные и пользовательские объекты.

Object имеет stable key.

Object key уникален внутри org.

Системные объекты защищены от удаления в MVP.

Object хранит displayName, pluralName, icon, primaryAttributeId.

7.3 Attribute Metadata

Attribute key уникален внутри object.

Attribute имеет type.

Attribute может быть required, unique, archived.

Attribute может иметь config JSON.

Для select/multi-select используются AttributeOption.

Для relationship используется RelationshipDefinition.

7.4 Records

Record всегда принадлежит org и object.

Record может быть archived вместо физического удаления.

Record должен иметь createdBy и updatedBy.

Значения атрибутов хранятся в Value.

Backend должен валидировать тип значения.

7.5 Values

Для каждого record + attribute должно быть не более одного активного Value.

Значение хранится в typed nullable columns.

Для multi-select можно использовать jsonValue или отдельную таблицу ValueOption.

Для Phase 1 допустимо хранить select/multi-select в jsonValue при строгой backend-валидации.

Для relationship значения хранятся отдельно в RelationshipValue.

7.6 Views

View принадлежит object или list.

View может быть TABLE или BOARD.

View хранит name, type, filters, sorts, columns.

ViewColumn определяет attribute, width, order, visibility.

ViewFilter определяет attribute, operator, value.

ViewSort определяет attribute, direction, order.

Board view хранит groupByAttributeId.

7.7 Lists

List принадлежит org.

List имеет primaryObjectId.

ListEntry связывает record и list.

ListEntry уникален по listId + recordId.

List может иметь собственные list attributes.

В MVP stage можно хранить как поле stage в ListEntry или как list-specific Value.

7.8 Email

Email может быть связан с record.

Email хранит direction, subject, body, from, to, cc, bcc, status.

Demo email должен явно помечаться demo=true.

Отправка должна создавать Activity.

Реальная отправка позже идёт через nodemailer или provider API.

7.9 Activity

Activity хранит actor, org, record, type, payload.

Activity immutable.

Activity используется для timeline.

7.10 Notes

Note принадлежит org.

Note может быть связана с record.

Note создаёт Activity.

7.11 Tasks

Task принадлежит org.

Task может быть связана с record.

Task имеет assignee, dueAt, status.

Task создаёт Activity при создании и завершении.

7.12 Sequences

Sequence принадлежит org.

Sequence имеет status.

SequenceStep хранит type, order, delay.

SequenceEnrollment связывает sequence и record.

Worker планирует SequenceStepRun.

Exit criteria останавливает enrollment.

7.13 Workflows

Workflow принадлежит org.

Workflow имеет status draft/live/paused.

WorkflowStep хранит type и config.

WorkflowRun хранит статус запуска.

WorkflowStepRun хранит статус шага.

Триггеры работают через события Activity/Event.

7.14 Reports

Report хранит source object/list, chart type, metrics, dimensions, filters.

Dashboard хранит набор reports.

В MVP можно заложить схему, но UI отложить.

8. Нефункциональные требования
8.1 Производительность

Таблица должна поддерживать пагинацию.

Начальная цель: 10 000 records на org без деградации UX.

Запросы list/table должны иметь limit/offset или cursor.

Значения часто используемых атрибутов должны индексироваться.

Для Phase 1 допустима простая реализация, но API должно быть спроектировано с pagination.

8.2 Безопасность

Все запросы ограничиваются orgId.

Пользователь не может получить record другой организации.

Валидация входа через zod.

SQL-инъекции исключаются через Prisma и контролируемые raw queries.

API keys хранятся отдельно.

Пароли не возвращаются из API.

Email body должен санитизироваться при HTML-рендере.

8.3 Надёжность

Worker jobs должны быть идемпотентными.

Email send jobs должны иметь retry policy.

Workflow runs должны иметь trace.

Ошибки импортов должны сохраняться построчно.

Удаление критичных сущностей должно быть soft delete/archive.

8.4 Масштабируемость

Backend stateless.

Очереди через BullMQ/Redis.

Postgres основной источник истины.

Долгие операции: import, sequence send, workflow run, enrichment — только через worker.

Metadata модель должна позволять добавлять объекты без миграции БД.

8.5 UX

Интерфейс плотный, быстрый, похожий на Attio по паттернам.

Таблица должна быть центральным рабочим элементом.

Все настройки view применяются без перезагрузки страницы.

Пустые состояния должны объяснять, что делать дальше.

Bulk action bar появляется только при выборе строк.

Record page должна открываться быстро и показывать все важные атрибуты справа.

8.6 Совместимость с demo-режимом

Без SMTP/AI ключей платформа должна оставаться демонстрационно работоспособной.

AI generation fallback возвращает шаблон.

Email send fallback симулирует отправку и пишет Email/Activity.

Billing не должен блокировать MVP-сценарии в demo.

8.7 Локализация

Внутренние комментарии и проектные пояснения — на русском.

UI может быть англоязычным в стиле B2B SaaS.

Данные объектов и атрибутов по умолчанию — английские, чтобы соответствовать CRM-паттернам.

9. Приоритеты реализации
MVP / Phase 1

гибкая модель Object/Attribute/Record/Value;

bootstrap Companies/People/Deals;

object table;

view columns/filters/sorts;

record page;

lists;

demo compose/send email;

миграция Lead → People/Companies.

Phase 2

board view;

bulk actions;

CSV import в гибкую модель;

relationship UI;

notes/tasks полноценнее;

базовые activity timelines.

Phase 3

sequence editor;

enroll recipients;

worker-based sending;

unsubscribe;

reply/open tracking;

sequence analytics.

Phase 4

workflow builder;

workflow runs;

triggers/actions;

list automation;

record update automation.

Phase 5

reports/dashboards;

pipeline analytics;

historical values;

stage duration;

revenue dashboards.

Phase 6

billing enforcement;

integrations;

enrichment;

advanced permissions;

audit log;

realtime collaboration.

10. Критерии готовности MVP

MVP считается готовым, если:

Новый пользователь может зарегистрироваться и попасть в CRM.

У организации автоматически есть Companies, People, Deals.

Пользователь может создать Person, Company и Deal.

Пользователь может добавить кастомный атрибут.

Пользователь может вывести атрибут колонкой в table view.

Пользователь может фильтровать и сортировать записи.

Пользователь может открыть record page.

Пользователь может добавить запись в list.

Пользователь может отправить demo email из Person record.

Все данные из текущих Lead могут быть перенесены в People/Companies без потери ключевых полей.

Сборка backend/frontend проходит.

Основные API защищены orgId.