# AISDR — Детальная функциональная спецификация (по сценариям/экранам/меню)

> Исчерпывающий проход: КАЖДЫЙ сценарий S001–S403, а внутри — экран, путь в меню, UI-элементы,
> пошаговый сценарий пользователя, затронутые данные/модели, API, acceptance-чек-лист и edge-cases.
> Пишется частями совместно с GPT (проект AISDR, 16 файлов-знаний в «Источниках» ChatGPT),
> Claude собирает в этот документ. Архитектурный обзор — в [MASTER_TZ.md](./MASTER_TZ.md).

**Единый шаблон каждого сценария:**
`### Sxxx — название` · Экран/меню · Роль/доступ · Предусловие · UI-элементы (с поведением) ·
Шаги · Данные (Prisma) · API (метод/путь/ошибки) · Acceptance (чек-лист) · Edge-cases.

---


---

S001 — Создать кастомный объект

Экран / меню: Settings → Data → Objects → + Create custom object. В эталоне экран Settings → Objects содержит таблицу объектов, поиск, кнопку + Create custom object, строки Companies / Deals / Invoices / People / Users / Workspaces и меню ⋮ у строк. 


Роль / доступ: Owner/Admin. Member не может создавать объекты по умолчанию; если позже вводится granular-доступ, нужен уровень FULL на workspace/object-metadata, но это место требует уточнения. В Academy указано, что кастомные объекты создаёт Admin из workspace settings. 


Предусловие: пользователь авторизован, выбран workspace/org; orgId определён из JWT; bootstrap уже выполнен или workspace пустой, но доступен раздел Settings. Ключ объекта должен быть уникален внутри org.

UI-элементы:

Settings back button — возврат в продукт.

Search settings... — поиск по настройкам.

Левое меню: Account, Workspace, Data, Reports, Automations.

Data → Objects — текущий пункт.

Таблица Objects: колонки Object, Type, Records.

+ Create custom object — открывает модалку создания объекта.

Модалка Create custom object (частично уточнить по кадрам; дефолт по Attio-паритету):

Singular name — например Invoice.

Plural name — например Invoices.

Key / slug — автогенерация из plural name, ручное редактирование.

Icon — выбор иконки.

Description — опционально.

Record text — выбор text-атрибута, который будет отображаться как имя записи; на первом шаге можно создать дефолтный text-атрибут Name / Invoice Name.

Create object — создаёт объект.

Cancel / Esc / × — закрывает без сохранения.

После создания строка объекта появляется в Settings → Objects, а пункт объекта появляется в сайдбаре Records.

Шаги:

Пользователь открывает Settings → Data → Objects.

Нажимает + Create custom object.

Вводит singular/plural name, выбирает icon.

Проверяет или редактирует auto-generated key.

Выбирает / создаёт record-text атрибут.

Нажимает Create object.

Система создаёт объект, системные атрибуты и дефолтный table-view.

UI возвращает пользователя в настройки объекта или открывает новый объект в Records → <PluralName> (уточнить целевой redirect).

Данные: metadata-driven модель хранит структуру в Object, Attribute, View, List, бизнес-данные — в Record + Value, а UI строится из metadata. 


Создаётся Object: orgId, key, singularName, pluralName, description, icon, color?, isSystem=false, isHidden=false, createdById, primaryAttributeId, createdAt, updatedAt.

Создаётся первичный Attribute: objectId, key, name, type=TEXT, isSystem=false, isRequired?, isUnique?, isPrimary=true, order.

Создаются системные атрибуты: List Entries, Next due task, Created at, Created by — источник указывает их как системные и нередактируемые.

Создаётся View: objectId, name=All <PluralName>, type=TABLE, isDefault=true, columns.

Activity: record-level Activity не пишется, так как сценарий меняет metadata, а не record. Нужен отдельный metadata/audit log — (уточнить). Если используем текущую Activity, писать служебное событие с recordId=null в payload, но подход и ActivityType требуют уточнения.

API: архитектура задаёт Objects API: GET /api/objects, POST /api/objects, GET /api/objects/:objectId, PATCH /api/objects/:objectId, DELETE /api/objects/:objectId; создание объекта в MVP доступно только OWNER/ADMIN. 


POST /api/objects

body: { key, singularName, pluralName, icon?, color?, description?, recordTextAttributeName? }

response: { object, primaryAttribute, defaultView }

ошибки:

401 UNAUTHORIZED — нет JWT.

403 FORBIDDEN — роль не Owner/Admin.

409 CONFLICT — key уже существует в org.

422 VALIDATION_ERROR — пустое имя, невалидный key, reserved key.

Дополнительно после создания:

GET /api/objects — сайдбар обновляет список.

GET /api/objects/:objectId — открытие object settings.

Acceptance:

В Settings → Objects доступна кнопка + Create custom object.

Member без прав не видит кнопку или получает disabled-state с объяснением.

При создании Invoices появляется строка Invoices с Type=Custom.

В сайдбаре Records появляется Invoices.

У объекта есть default table-view All Invoices.

У объекта есть primary text attribute; записи отображаются по нему, а не по raw record id.

Повторное создание объекта с тем же key возвращает 409, дубль не создаётся.

После refresh объект остаётся в Settings и sidebar.

Edge-cases:

singularName/pluralName пустые → validation error.

key содержит пробелы/кириллицу/служебные символы → normalizer или error (уточнить).

key совпадает с companies/people/deals/workspaces/users → запрещено.

Пользователь отменил модалку → ничего не создаётся.

Ошибка сети после успешного POST → при повторном submit backend должен вернуть существующий объект или 409; UI должен безопасно обновить список.

Demo-mode: создание работает без внешних ключей; объект создаётся только в локальной БД текущего org.

S002 — Открыть стандартный объект (Companies)

Экран / меню: Sidebar → Records → Companies → All Companies. В storyboard экран Companies / All Companies содержит workspace switcher, Quick actions, разделы Records/Lists, view dropdown All Companies, View settings, sort/filter chips, Import / Export, + New Company, таблицу и + Add calculation. 


Роль / доступ: Owner/Admin/Member с доступом READ или выше к объекту Companies. Demo-mode: доступен seeded объект Companies.

Предусловие: bootstrap создал стандартный объект Companies, атрибуты, default view и хотя бы пустую таблицу. В MASTER_TZ стандартные объекты — Companies, People, Deals, Workspaces, Users; API/sidebar должны показывать объекты. 


UI-элементы:

Sidebar:

Workspace switcher.

Quick actions.

Search.

Notifications, Tasks, Notes, Emails, Calls, Reports, Automations.

Records: Companies, People, Deals, Users, Workspaces, Invoices.

Lists: Inbound Leads, Recruiting, Event Invitees, Customer Success, Onboarding Pipeline, PQL, All lists.

Topbar:

заголовок Companies.

dropdown вида All Companies.

View settings.

chip Sorted by Connection strength.

Filter.

Import / Export.

+ New Company.

Таблица:

row checkbox.

колонки Company, Domains, Categories, Description, LinkedIn, Employee range, Estimated ARR, Primary location.

+ / + Add column.

нижняя строка count и + Add calculation.

Empty-state:

если записей нет: No Companies yet + + New Company / Import.

если фильтр пустой: сообщение про фильтр + Clear filter.

Шаги:

Пользователь кликает Companies в sidebar.

Frontend загружает metadata объекта.

Frontend загружает views объекта и выбирает default view All Companies.

Frontend запрашивает records с учётом view columns/sorts/filters.

Таблица строится динамически по ViewColumn и Attribute.

Пользователь может открыть запись кликом по строке, создать компанию, добавить колонку, включить фильтр или импорт.

Данные:

Читается Object по key=companies, orgId, archivedAt=null.

Читаются Attribute объекта.

Читается default View и связанные ViewColumn, ViewFilter, ViewSort.

Читаются Record объекта и Value только для видимых колонок.

Activity: не пишется, сценарий read-only.

При открытии записи уже в другом сценарии читаются Activity, Email, Note, Task.

API:

GET /api/objects — sidebar.

GET /api/objects/:idOrKey или GET /api/objects/companies — metadata.

GET /api/objects/:objectId/views — список views.

GET /api/objects/:objectId/records?viewId=&limit=&cursor=&search=&filters=&sorts= — строки таблицы; architecture описывает query-параметры records endpoint. 


ошибки:

401 — нет авторизации.

403 — нет read-доступа.

404 — объект не найден/архивирован.

422 — невалидный viewId, cursor, filters/sorts.

500 — ошибка сборки EAV query.

Acceptance:

Companies виден в Records.

Клик открывает Companies / All Companies.

Таблица показывает колонки из view, а не hardcoded поля.

Колонки и значения соответствуют Attribute/Value.

Count отображает число records в текущей выборке.

Filter, View settings, Import / Export, + New Company видимы.

При отсутствии записей показывается пустое состояние, а не ошибка.

При 403 объект не отображается в sidebar или открывается forbidden-state.

Edge-cases:

Bootstrap не выполнен → показать onboarding/bootstrap action.

Companies существует, но нет default view → создать fallback view или показать repair-state (уточнить).

View содержит архивированную колонку → скрыть колонку и предложить обновить view.

Значение не соответствует типу атрибута → показать безопасный placeholder и логировать backend warning.

Большой объём записей → pagination/cursor, не грузить всё сразу.

Demo-mode: если данных нет, seed должен дать несколько компаний или пустой state с Import/New Company.

S003 — Переименовать объект / сменить иконку в object settings

Экран / меню: Settings → Data → Objects → <Object row> → ⋮ / Open settings → Configuration или Appearance (точное размещение rename/icon между Configuration и Appearance уточнить). Каталог фиксирует сценарий как переименование объекта / смену иконки в object settings. 


Роль / доступ: Owner/Admin. Member — только если есть FULL access на конкретный объект и в продукте разрешено менять metadata (уточнить). Read/Read+write недостаточно, так как это изменение структуры, а не данных.

Предусловие: объект существует, archivedAt=null; пользователь имеет metadata-доступ; для системных объектов разрешено менять display-name/icon, но не key (уточнить). Для кастомных объектов можно менять singular/plural/icon/color/description.

UI-элементы:

Settings sidebar.

Objects table.

Строка объекта с Object, Type, Records, ⋮.

Object settings header:

icon picker.

object name.

badge Standard / Custom.

описание Manage object attributes and other relevant settings.

Tabs: Configuration, Permissions, Appearance, Attributes, Templates.

Configuration:

Singular name.

Plural name.

Key / API name — read-only для system objects (уточнить).

Description.

Record text.

Save changes.

Appearance:

icon picker.

color picker.

optional sidebar display settings (уточнить).

Dirty-state: Cancel, Save changes.

Шаги:

Пользователь открывает Settings → Data → Objects.

Находит объект через Search.

Открывает ⋮ → Object settings или кликает строку.

Переходит в Configuration / Appearance.

Меняет plural/singular name и/или icon.

Нажимает Save changes.

Система обновляет metadata.

Sidebar, object table, breadcrumbs и заголовки страниц обновляются без reload или после refetch.

Данные:

Обновляется Object: singularName, pluralName, description?, icon?, color?, updatedAt.

Object.key не должен меняться без отдельного migration-flow, так как используется в routes/API. Если менять key разрешено — нужны redirect/alias и проверка ссылок (уточнить).

Attribute, Record, Value не меняются.

View.name не меняется автоматически, кроме дефолтного All <PluralName> — (уточнить).

Activity: record-level Activity не пишется; нужен metadata audit event (уточнить).

API: Object API поддерживает получение и обновление metadata: GET /api/objects/:objectId, PATCH /api/objects/:objectId. 


PATCH /api/objects/:objectId

body: { singularName?, pluralName?, description?, icon?, color? }

response: { object }

ошибки:

401 — нет JWT.

403 — нет metadata-доступа.

404 — объект не найден/архивирован.

409 — конфликт имени/key, если key редактируется.

422 — невалидные поля.

После успеха:

GET /api/objects — обновить sidebar.

GET /api/objects/:objectId — обновить settings/header.

Acceptance:

Переименование Invoices → Bills меняет строку в Settings → Objects.

Sidebar Records показывает новое plural-name.

Object page header показывает новое имя.

Breadcrumbs/record page используют новое имя объекта.

Icon меняется в sidebar, settings header и object page.

Records и Values сохраняются.

Для system object Companies изменение key недоступно.

Отмена изменений возвращает старые значения.

Edge-cases:

Пустое имя → validation error.

Имя совпадает с другим объектом в org → warning или error (уточнить; key точно должен быть unique).

Два пользователя сохраняют разные изменения → last-write-wins или optimistic lock (уточнить).

Объект архивирован в другой вкладке → 404/409, UI закрывает settings и refetch objects.

Icon не выбран → использовать дефолтную иконку объекта.

Demo-mode: работает как обычное metadata update.

S004 — Архивировать объект

Экран / меню: Settings → Data → Objects → <Object row> → ⋮ → Archive object. Каталог фиксирует сценарий Архивировать объект; архитектура определяет DELETE /api/objects/:objectId как archive, а system objects в MVP удалять нельзя. 


 


Роль / доступ: Owner/Admin. Member не может архивировать объект; FULL на объект может быть недостаточен для system/custom object deletion (уточнить).

Предусловие: объект существует, не архивирован, не является system object или в продукте явно разрешено архивирование system object (по архитектуре — нельзя в MVP). Нужно проверить зависимости: records, relationships, lists, views, workflows/reports/sequences, imports.

UI-элементы:

Settings → Objects table.

⋮ menu:

Open settings.

Rename / Edit.

Archive object.

Confirmation modal:

title Archive <ObjectName>?

предупреждение: объект исчезнет из sidebar и views; records не удаляются физически.

impact summary: records count, lists/views/reports/workflows references (уточнить).

input confirmation for high-risk objects (уточнить).

Cancel.

destructive Archive object.

Toast после успеха: <ObjectName> archived.

Optional Undo (уточнить).

Шаги:

Пользователь открывает Settings → Data → Objects.

Открывает ⋮ у кастомного объекта.

Нажимает Archive object.

Система показывает confirmation modal.

Пользователь подтверждает.

Backend ставит archivedAt.

UI удаляет объект из Settings → Objects default view и из sidebar Records.

Прямые ссылки на объект начинают возвращать archived/not found state.

Данные:

Обновляется Object.archivedAt, updatedAt.

Attribute, View, Record, Value физически не удаляются; для чтения фильтруются через archived object.

Related View можно помечать archived (уточнить).

Relationships на этот object должны стать недоступны для новых записей, но исторические данные сохраняются.

Activity: record-level Activity не пишется; metadata audit event (уточнить).

Если есть record timelines внутри archived object, они сохраняются для restore/admin access (уточнить).

API:

DELETE /api/objects/:objectId

semantics: soft archive.

response: { object: { id, archivedAt } }

ошибки:

401 — нет JWT.

403 — нет прав.

404 — объект не найден.

409 — system object нельзя архивировать; объект используется критическими зависимостями без force.

422 — objectId невалиден.

GET /api/objects после archive не возвращает объект по умолчанию.

GET /api/objects?includeArchived=true — (уточнить) для settings/import history/restore.

Acceptance:

Кастомный объект архивируется через меню ⋮.

После архивации объект исчезает из sidebar Records.

После refresh объект остаётся скрытым.

Records объекта не удаляются из БД.

System object Companies/People/Deals/Workspaces/Users нельзя архивировать в MVP.

Прямая ссылка на archived object показывает controlled state, не 500.

Повторный DELETE идемпотентен: возвращает already archived или текущий archived state.

Edge-cases:

Архивирование объекта с records → показать impact warning.

Архивирование объекта, на который есть relationship из другого объекта → запретить или разрешить с предупреждением (уточнить).

Объект используется в workflows/reports/sequences → запретить до отключения или показать dependency list (уточнить).

Пользователь потерял права между открытием modal и confirm → 403.

Сеть упала после archive → refetch определяет фактическое состояние.

Demo-mode: archive можно проверить на кастомном объекте; system seed objects защищены.

S005 — Bootstrap 5 стандартных объектов при первом входе

Экран / меню: First login / onboarding → workspace bootstrap или backend-trigger после регистрации. В UI это проявляется как заполненный sidebar Records: Companies / People / Deals / Workspaces / Users. Каталог фиксирует bootstrap пяти стандартных объектов при первом входе. 


Роль / доступ: Owner/Admin при создании workspace. Для обычного Member bootstrap не запускается вручную, но Member видит результат, если имеет read-доступ. Demo-mode: bootstrap/seed обязателен.

Предусловие: создана Organization, есть первый User, org ещё не имеет базовой CRM-модели или bootstrap status = false. Операция должна быть идемпотентной.

UI-элементы:

После login:

loading state Setting up your workspace... (уточнить).

sidebar skeleton.

После bootstrap:

sidebar Records: Companies, People, Deals, Workspaces, Users.

default object pages.

Companies / All Companies table.

Optional onboarding wizard:

Create default CRM.

Skip не рекомендуется для demo (уточнить).

Error state:

Retry setup.

Contact support / copy error id (уточнить).

Шаги:

Пользователь регистрируется или впервые логинится в новый workspace.

Frontend вызывает bootstrap status.

Если CRM не создана, frontend вызывает bootstrap endpoint или backend делает это сразу после register.

Backend создаёт standard objects.

Backend создаёт базовые system/custom attributes.

Backend создаёт default views.

Backend создаёт deal stages/options.

Frontend refetch navigation и открывает dashboard/object page.

Данные: Academy подтверждает 5 standard objects: people, companies, deals, workspaces, users; стандартные объекты покрывают B2B CRM и product usage data. 


Создаются Object:

companies, people, deals, workspaces, users.

isSystem=true.

primaryAttributeId.

Создаются Attribute:

Companies: name/domain/categories/description/linkedin/employee range/ARR/location и др. (точный минимальный набор уточнить по seed).

People: name/email/company/job title/linkedin.

Deals: title/value/stage/owner/company/people.

Workspaces: workspace name/plan/ARR/company.

Users: name/email/workspace/person.

Создаются AttributeOption:

Deal stage: lead/contacted/prospecting/qualification/meeting/proposal/won/lost и т.п. (точный набор зависит от seed).

Создаются View, ViewColumn, ViewFilter, ViewSort.

Опционально создаются demo Record/Value, если это seed demo workspace (уточнить).

Activity: для metadata bootstrap не писать record Activity; если создаются demo records, можно писать RECORD_CREATED, но для seed лучше не засорять timeline (уточнить).

API: MASTER_TZ указывает POST /api/crm/bootstrap, архитектура — POST /api/bootstrap/default-crm; нужно унифицировать endpoint. MASTER_TZ говорит, что bootstrap создаёт companies/people/deals + default attributes/views + deal stages; при этом acceptance пока отдельно требует Workspaces/Users. 


GET /api/bootstrap/status или GET /api/crm/bootstrap/status

response: { bootstrapped: boolean, objects: string[] }

POST /api/crm/bootstrap (текущий MASTER_TZ) / POST /api/bootstrap/default-crm (архитектура; уточнить)

body: { includeDemoData?: boolean }

response: { objects, attributesCount, viewsCount, created: boolean }

ошибки:

401

403

409 — bootstrap уже выполняется / locked.

500 — partial failure, нужен rollback или repair.

Acceptance:

После первого входа в sidebar есть Companies, People, Deals, Workspaces, Users.

Каждый объект имеет isSystem=true.

У каждого объекта есть primary text attribute.

У каждого объекта есть default table view.

Deals имеет stage/status options.

Повторный bootstrap не создаёт дубли объектов/атрибутов/views.

Companies открывается в table.

Demo-mode работает без внешних ключей.

Edge-cases:

Bootstrap оборвался после части объектов → повторный запуск дозаполняет недостающее, не дублирует существующее.

Два запроса bootstrap одновременно → lock или transaction; результат один.

Org уже содержит кастомный object с key companies → конфликт reserved key; для fresh org не должно случаться.

Миграция legacy Lead уже создала records → bootstrap не должен удалять legacy data.

Workspaces/Users в MASTER_TZ отмечены как ещё не полностью готовые в UI; bootstrap должен создать metadata даже если UI пока частичный.

Если пользователь не Owner/Admin, status можно читать, trigger нельзя.

S006 — Просмотр вкладок объекта в settings: Configuration / Permissions / Appearance / Attributes / Templates

Экран / меню: Settings → Data → Objects → <Object>. В permission-сценарии Academy показан object settings header: иконка + Deals + badge Standard, описание, вкладки Configuration · Permissions · Appearance · Attributes(31) · Templates · +2 more. 


Роль / доступ: Owner/Admin видит все вкладки. Member:

READ — может не видеть settings или видеть read-only (уточнить).

READ_WRITE — может редактировать records, но не metadata.

FULL — может управлять entity settings/attributes/permissions по логике Attio; применимость к созданию/управлению objects в AISDR требует уточнения.

Object permission model описывает уровни No access / Read only / Read and write / Full access. 


Предусловие: объект существует; settings route доступен; загружены object metadata, attributes count, permissions, templates.

UI-элементы:

Settings sidebar:

Personal: Profile, Appearance, Email/calendar accounts, Storage, Refer, Notifications, Call recording.

Workspace: General, Members, Plans, Billing, Developers, Security, Email/calendar, Support, Migrate CRM, Apps.

Data: Objects, Lists, Import History.

Reports: Dashboards.

Automations: Sequences, Workflows.

Object settings header:

icon.

object name.

badge Standard / Custom.

subtitle Manage object attributes and other relevant settings.

Tabs:

Configuration — names, key, description, record text, default behavior.

Permissions — workspace/team/individual/automation grants.

Appearance — icon/color/sidebar presentation.

Attributes — attributes table, system/unique badges, drag reorder, Create attribute.

Templates — email/note/page templates tied to object (уточнить).

+N more — hidden/overflow tabs (уточнить).

State:

loading skeleton.

forbidden-state.

dirty-state per tab.

Шаги:

Пользователь открывает Settings → Data → Objects.

Выбирает объект, например Deals.

Система открывает object settings.

Пользователь кликает Configuration.

Пользователь кликает Permissions.

Пользователь кликает Appearance.

Пользователь кликает Attributes.

Пользователь кликает Templates.

UI показывает соответствующее содержимое без потери context.

Данные:

Читается Object.

Читаются Attribute + AttributeOption для Attributes.

Читаются View/default view только если configuration показывает default view (уточнить).

Читаются permission grants — модели Team/PermissionGrant ещё не в текущей Prisma-схеме, должны быть добавлены в RBAC phase (уточнить).

Читаются templates — модели шаблонов ещё не описаны в текущем Object module (уточнить).

Activity: не пишется при просмотре вкладок.

API:

GET /api/objects/:objectId — object metadata.

GET /api/objects/:objectId/attributes — attributes tab; Objects API в MASTER_TZ включает GET/POST /api/objects/:id/attributes. 


GET /api/objects/:objectId/permissions — (уточнить; будущий RBAC API).

GET /api/objects/:objectId/templates — (уточнить; будущий templates API).

ошибки:

401

403

404

422 — невалидная вкладка.

Для hidden/unsupported tabs API может вернуть feature flag.

Acceptance:

Из Settings → Objects можно открыть settings любого доступного объекта.

Header показывает icon, object name, badge Standard/Custom.

Вкладки Configuration, Permissions, Appearance, Attributes, Templates видимы.

Активная вкладка подсвечивается.

URL сохраняет вкладку (?tab=attributes или nested route) (уточнить).

Attributes показывает count и список атрибутов.

У Member без metadata-доступа вкладки редактирования скрыты или read-only.

Refresh на вкладке не сбрасывает контекст объекта.

Edge-cases:

Объект архивирован → settings открывается только для Owner/Admin с archived banner или возвращает 404 (уточнить).

Permissions feature не реализован → tab disabled с текстом Coming soon или скрыт (уточнить).

Templates отсутствуют → empty state No templates yet.

Attributes не загружаются → tab-level error, остальные вкладки остаются доступны.

Очень много атрибутов → pagination/search в attributes tab (уточнить).

Demo-mode: permissions/templates могут быть read-only demo или mock-empty, но tabs должны открываться.

S007 — Выбрать Record text атрибут

Экран / меню: Settings → Data → Objects → <Object> → Configuration → Record text. Каталог определяет сценарий как выбор text-атрибута, который становится именем записи вместо Record ID; Academy подтверждает, что record text выбирается из любых text-атрибутов объекта, пример — Invoice Name. 


 


Роль / доступ: Owner/Admin; Member только при FULL metadata access (уточнить). Read/Read+write не хватает, так как меняется объектная конфигурация.

Предусловие: объект существует; есть хотя бы один неархивный text-like attribute (TEXT, возможно LONG_TEXT — уточнить; источник говорит text-атрибуты). Если text-атрибута нет, UI должен предложить создать его.

UI-элементы:

Configuration tab.

Field Record text.

Dropdown со списком eligible attributes:

Name.

Invoice Name.

другие TEXT атрибуты.

Disabled options:

archived attributes.

non-text attributes (NUMBER, CURRENCY, DATE, SELECT, RELATIONSHIP).

Create text attribute link/button, если подходящих нет.

Preview:

пример записи до/после: Record ID → INV-093.

Save changes.

Warning:

изменение повлияет на отображение record names в таблицах, relationship cells, breadcrumbs, search.

Шаги:

Пользователь открывает object settings.

Переходит в Configuration.

Открывает dropdown Record text.

Выбирает text attribute, например Invoice Name.

Нажимает Save changes.

Backend обновляет primary/record text настройку.

Система пересчитывает displayName/searchText для существующих records синхронно или фоново (уточнить).

Tables, relationship picker, breadcrumbs и record page показывают новое имя записи.

Данные:

Обновляется Object.primaryAttributeId.

Обновляется Attribute.isPrimary: выбранный атрибут true, предыдущий false (если используем это поле как денормализацию).

Для Record желательно пересчитать displayName и searchText; schema содержит displayName/searchText на Record, а Object содержит primaryAttributeId. 


 


Value не меняется.

Activity: не писать VALUE_UPDATED, так как значения не изменились. Можно писать metadata audit event (уточнить).

API:

GET /api/objects/:objectId — получить текущий primaryAttributeId.

GET /api/objects/:objectId/attributes?type=TEXT — список eligible attributes.

PATCH /api/objects/:objectId

body: { primaryAttributeId: "attr_id" }

response: { object, primaryAttribute, recalculation: { status } }

ошибки:

401

403

404 — object/attribute не найден.

409 — attribute принадлежит другому object или archived.

422 — attribute type не text-like.

Опционально:

POST /api/objects/:objectId/recalculate-display-names — если пересчёт фоновый (уточнить).

Acceptance:

Dropdown показывает только text attributes текущего объекта.

Non-text attributes нельзя выбрать.

После сохранения Object.primaryAttributeId равен выбранному attribute id.

Новые записи используют выбранное поле как displayName.

Существующие записи отображаются по новому record text после refetch/recalc.

Relationship cells показывают новые имена связанных records.

Search по record name использует новое поле или обновлённый searchText.

Если значение пустое, UI fallback: Untitled <SingularName> или Record ID (уточнить).

Edge-cases:

Нет text attributes → показать empty state и action Create text attribute.

Выбранный атрибут archived после открытия dropdown → сохранить нельзя, 409.

У части records пустое значение выбранного атрибута → fallback name, не пустая строка.

У выбранного атрибута не unique значения → допустимо, так как record text не обязан быть unique (уточнить).

Массовый пересчёт displayName на большом объекте → фоновая job, optimistic UI с banner.

Попытка удалить/архивировать primary attribute позже должна быть заблокирована или требовать выбора нового record text.

Demo-mode: работает без внешних ключей; пересчёт локальный.

[ГОТОВ БАТЧ: S001–S007]


---

S010 — Открыть модалку Create attribute

Экран / меню: Sidebar → Companies → view toolbar → + Add column → Create new attribute или Settings → Data → Objects → <Object> → Attributes → Create attribute. В эталоне модалка открывается поверх таблицы Companies; в ней видны Attribute Type, Name, Description (optional), Set as title field, AI autofill, Cancel, Create attribute. 


Роль / доступ: Owner/Admin; Member — только если имеет FULL доступ к объекту. READ_WRITE может редактировать значения записей, но не структуру атрибутов. Для demo-режима — разрешить Owner/Admin без внешних ключей.

Предусловие: объект существует, не архивирован; пользователь авторизован; загружены Object, список Attribute, текущий View. Для входа через таблицу нужен активный table-view.

UI-элементы:

+ Add column / Create new attribute — вход из view.

Settings → Object → Attributes → Create attribute — вход из настроек.

Модалка Create attribute:

Attribute Type dropdown.

Name input.

Description (optional) textarea/input.

Set as title field / Set as record text toggle — только для text-like типов.

Options block — только для select/multi-select/status.

Set up AI autofill toggle.

Autofill type и Guidance — если включён AI.

Cancel, Esc, ×.

Create attribute.

Dropdown типов: AI-секция и базовые типы; в кадрах видны Text, Number, Checkbox, Date, Rating, Timestamp, Status, Multi-select, Currency, Record, User, Select, Relationship, Location, Phone Number. 


Шаги:

Пользователь открывает объект, например Companies.

Нажимает + Add column.

В меню атрибутов выбирает Create new attribute.

Система открывает модалку Create attribute.

Пользователь выбирает тип, вводит name/description.

Пользователь настраивает type-specific поля.

Нажимает Create attribute или отменяет.

После создания атрибут появляется в объекте и, если вход был из view, добавляется колонкой в текущий view.

Данные: структура CRM хранится в Object, Attribute, View, List; бизнес-данные — в Record + Value; UI строится из metadata. 


Создаётся Attribute: orgId, objectId, key, name, description, type, isSystem=false, isRequired=false, isUnique=false, isPrimary?, order, config.

Для select-like типов создаются AttributeOption.

Если вход из table-view, создаётся/обновляется ViewColumn.

Activity: record-level activity не пишется; это metadata-change. Нужен metadata audit log (уточнить).

API: архитектура задаёт GET /api/objects/:objectId/attributes, POST /api/objects/:objectId/attributes, PATCH /api/attributes/:attributeId, DELETE /api/attributes/:attributeId, а также option endpoints. 


GET /api/objects/:objectId/attributes — список атрибутов.

POST /api/objects/:objectId/attributes

body:

TypeScript
{
  key?: string;
  name: string;
  description?: string;
  type: AttributeType;
  isRequired?: boolean;
  isUnique?: boolean;
  isPrimary?: boolean;
  config?: Record<string, unknown>;
  options?: Array<{ value: string; label: string; color?: string }>;
  addToViewId?: string;
}
- response: `{ attribute, options?, viewColumn? }`
- ошибки: `401`, `403`, `404`, `409`, `422`.

Acceptance:

Модалка открывается из + Add column и из Settings → Attributes.

Dropdown показывает все поддержанные типы.

Name обязателен.

key генерируется из Name и уникален внутри object.

Cancel, Esc, × закрывают модалку без записи в БД.

После успешного создания атрибут виден в settings и доступен как колонка.

Если указан addToViewId, колонка появляется в текущем view.

Ошибки валидации отображаются inline.

Edge-cases:

Дубль key → 409 CONFLICT, UI предлагает изменить имя/key.

Нет metadata-доступа → кнопка скрыта или disabled.

Объект архивирован → 404/409, модалка не открывается.

Сеть оборвалась после submit → повторный submit не должен создавать дубль; idempotency по objectId+key.

Demo-mode: AI-блоки можно показать, но запуск AI — через demo-AI; создание обычных атрибутов не требует ключей.

S011 — Создать атрибут Text

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Text или Settings → Data → Objects → <Object> → Attributes → Create attribute → Text.

Роль / доступ: Owner/Admin или пользователь с FULL доступом к объекту. Demo-mode: доступно без внешних API.

Предусловие: объект существует; имя атрибута не конфликтует с существующими Attribute.key; пользователь может менять metadata.

UI-элементы:

Attribute Type = Text.

Name.

Description (optional).

Set as title field — доступен для text.

Set up AI autofill toggle — доступен, так как AI-autofill может заполнять text.

Cancel, Create attribute.

Если включён AI: Autofill type, Guidance, сообщение, что AI имеет доступ к атрибутам записи. 


Шаги:

Пользователь открывает Create attribute.

Выбирает Text.

Вводит Name, например Business model.

Опционально вводит description.

Опционально включает Set as title field.

Опционально включает AI autofill.

Нажимает Create attribute.

Атрибут появляется в списке и может редактироваться в table/details.

Данные: Attribute содержит type=TEXT; значения Text хранятся в Value.textValue. В Prisma Attribute имеет key/name/description/type/isSystem/isRequired/isUnique/isPrimary/order/config, а Value — typed columns включая textValue. 


 


Attribute.type = TEXT.

Attribute.config: { aiAutofill?, placeholder?, maxLength? } (уточнить).

Если isPrimary=true, обновить Object.primaryAttributeId и снять isPrimary с прежнего primary attribute.

Activity: при создании атрибута record Activity не пишется; при последующем изменении значения пишется VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "TEXT", isPrimary?, config? }

response: { attribute }

errors: 401, 403, 404, 409, 422.

Acceptance:

Text-атрибут создаётся и отображается в Attributes.

В table появляется text-cell editor.

Значение сохраняется в Value.textValue.

Text можно выбрать как Record text.

Пустое значение допустимо, если isRequired=false.

При inline update появляется VALUE_UPDATED на record timeline.

Edge-cases:

Длинный текст, превышающий лимит text input → предложить Long text.

Дубль имени/key → 409.

isPrimary=true, но атрибут не text-like → не применимо; для Text разрешено.

Пустой required Text при создании записи → 422.

Demo-mode: обычный Text работает полностью; AI-autofill — demo fallback.

S012 — Создать атрибут Long text

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Long text или Settings → Objects → <Object> → Attributes → Create attribute → Long text.

Роль / доступ: Owner/Admin или FULL access на объект.

Предусловие: объект активен; имя уникально в пределах object; frontend/backend поддерживают LONG_TEXT. В MASTER_TZ Long text указан как базовый тип, а Prisma enum содержит LONG_TEXT. 


 


UI-элементы:

Attribute Type = Long text.

Name.

Description (optional).

Многострочный value editor в table/details.

AI autofill — допустим для summarization/prompt text (уточнить совместимость).

Cancel, Create attribute.

Шаги:

Пользователь выбирает Long text.

Вводит name, например Notes summary.

Добавляет description.

Нажимает Create attribute.

Система создаёт атрибут.

В table/details для значения используется textarea / rich text-lite editor (уточнить).

Данные:

Attribute.type = LONG_TEXT.

Value.longTextValue хранит значение.

Attribute.config: { maxLength?, multiline: true } (уточнить).

Activity: только при изменении значений — VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "LONG_TEXT", config? }

response: { attribute }

PATCH /api/records/:recordId/values/:attributeId

body: { value: string | null }

пишет в longTextValue.

Acceptance:

Long text создаётся через модалку.

В Attributes отображается тип Long text.

В table ячейка показывает preview/ellipsis.

В details открывается многострочный editor.

Значение сохраняется в Value.longTextValue.

Фильтр contains/is_empty/is_not_empty применим.

Edge-cases:

Очень длинное значение → сохранять в @db.Text; UI должен не ломать таблицу.

Пустое значение при isRequired=true → reject.

Попытка сделать Long text Record text — (уточнить), дефолт: запрещено, только TEXT.

Импорт CSV с переносами строк должен сохранять переносы.

Demo-mode без особенностей.

S013 — Создать атрибут Number

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Number.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; имя/key уникальны; формат чисел поддержан frontend locale-normalizer.

UI-элементы:

Attribute Type = Number.

Name.

Description (optional).

Доп. настройки (уточнить):

decimals/precision.

minimum/maximum.

display format.

AI autofill — совместимо с Prompt completion по MASTER_TZ AI-типа.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Number.

Вводит Name, например Score.

Опционально задаёт precision/min/max.

Создаёт атрибут.

Таблица показывает number-cell editor.

Значения можно фильтровать/sort по numeric operators.

Данные: архитектура требует, чтобы backend писал значение только в колонку, соответствующую Attribute.type; для Number это Value.numberValue. 


Attribute.type = NUMBER.

Attribute.config: { precision?, min?, max? }.

Value.numberValue = Decimal(18,6).

Индексы по attributeId, numberValue используются для фильтров/сортировки.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "NUMBER", config?: { precision?: number; min?: number; max?: number } }

PATCH /api/records/:recordId/values/:attributeId

body: { value: number | string | null }

errors: 422 для NaN, строки без числового parse, нарушения min/max.

Acceptance:

Number-атрибут создаётся.

UI принимает числа и очищает нечисловой ввод.

Значение хранится в Value.numberValue.

Фильтры gt/gte/lt/lte/eq работают как числовые.

Сортировка не лексикографическая.

Empty value не превращается в 0.

Edge-cases:

1,5 vs 1.5 → нормализация (уточнить).

Большие числа сверх Decimal precision → 422.

Значение 0 должно считаться заполненным.

Импорт пустой строки → null, не 0.

Demo-mode без особенностей.

S014 — Создать атрибут Checkbox/Boolean

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Checkbox.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; ключ уникален.

UI-элементы:

Attribute Type = Checkbox.

Name, например Is ICP.

Description (optional).

Default value toggle (уточнить).

В table/details — checkbox editor.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Checkbox.

Вводит name/description.

Создаёт атрибут.

В таблице появляется колонка с checkbox.

Пользователь кликает checkbox в ячейке.

Backend обновляет значение boolean.

Данные:

Attribute.type = BOOLEAN в Prisma, UI label = Checkbox.

Value.booleanValue хранит true/false; null означает не задано.

Attribute.config: { defaultValue?: boolean } (уточнить).

При update значения — Activity(type=VALUE_UPDATED).

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "BOOLEAN", config?: { defaultValue?: boolean } }

PATCH /api/records/:recordId/values/:attributeId

body: { value: boolean | null }

errors: 422 для строк, если parser не включён.

Acceptance:

Checkbox создаётся.

В Attributes тип отображается как Checkbox или Boolean.

В table value редактируется кликом.

true и false различаются с null.

Фильтры equals true/false, is_empty работают.

Изменение пишет Value.booleanValue.

Edge-cases:

Required boolean: false валиден, null невалиден.

CSV yes/no, true/false, 1/0 — parser (уточнить).

Bulk update false не должен очищать value.

Demo-mode без особенностей.

S015 — Создать атрибут Date

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Date.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; timezone workspace известен. Для импорта источники указывают поддержку ISO/EU/US date formats. 


UI-элементы:

Attribute Type = Date.

Name, например Due Date.

Description (optional).

Date picker.

Format hint.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Date.

Вводит Name.

Создаёт атрибут.

В record/table выбирает дату через date picker.

Backend сохраняет дату.

View filters/sorts могут использовать date operators.

Данные:

Attribute.type = DATE.

Value.dateValue хранит дату; время нормализуется к началу дня в workspace timezone или UTC (уточнить).

Attribute.config: { includeTime: false, timezone?: string }.

Activity при изменении values — VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "DATE", config? }

PATCH /api/records/:recordId/values/:attributeId

body: { value: "YYYY-MM-DD" | null }

errors: 422 для невалидной даты.

Acceptance:

Date-атрибут создаётся.

Date picker открывается в ячейке/details.

Значение сохраняется в Value.dateValue.

UI отображает только дату, без времени.

Фильтры before/after/equals/is_empty работают.

Сортировка по дате корректна.

Edge-cases:

Невалидная дата 31/02/2026 → 422.

Timezone shift не должен менять календарный день в UI.

Пустое значение при non-required — null.

Required Date при создании record без значения → reject.

Demo-mode без особенностей.

S016 — Создать атрибут Timestamp/Datetime

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Timestamp.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; timezone workspace известен; backend поддерживает DATETIME. Prisma enum содержит DATETIME; storyboard показывает label Timestamp. 


 


UI-элементы:

Attribute Type = Timestamp.

Name.

Description (optional).

Date-time picker.

Timezone display.

Optional default now (уточнить).

Cancel, Create attribute.

Шаги:

Пользователь выбирает Timestamp.

Вводит name, например Contract signed at.

Создаёт атрибут.

В record/table выбирает дату и время.

Система сохраняет timestamp.

UI отображает значение в timezone пользователя/workspace.

Данные:

Attribute.type = DATETIME.

Value.dateValue хранит DateTime.

Attribute.config: { includeTime: true, timezone?: string, defaultNow?: boolean }.

System timestamps Created at также представлены timestamp/system-атрибутами в эталоне. 


API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "DATETIME", config? }

PATCH /api/records/:recordId/values/:attributeId

body: { value: string | null } // ISO datetime

errors: 422 для невалидного ISO/date-time.

Acceptance:

Timestamp создаётся.

UI даёт выбрать дату и время.

Значение сохраняется в Value.dateValue.

UI отображает дату+время.

Фильтры before/after учитывают timestamp, не только date.

CSV/import ISO timestamp валидируется.

Edge-cases:

DST/timezone shift → хранить UTC, отображать в workspace/user timezone.

Значение без timezone → интерпретировать как workspace timezone (уточнить).

Пустое значение допустимо, если не required.

System Created at нельзя редактировать как custom timestamp.

Demo-mode без особенностей.

S017 — Создать атрибут Rating

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Rating.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; тип Rating есть в эталонном dropdown, но в текущем Prisma enum нет отдельного RATING, поэтому требуется mapping через NUMBER + config.kind="rating" или расширение enum (уточнить). Storyboard подтверждает наличие Rating в UI-типах. 


UI-элементы:

Attribute Type = Rating.

Name.

Description (optional).

Настройки (уточнить):

scale: 1–5 по дефолту.

icon: star/dot.

allow half values: false по дефолту.

Rating cell renderer — звёзды/точки.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Rating.

Вводит name, например Deal confidence.

Оставляет scale 1–5 или меняет настройки.

Создаёт атрибут.

В table/details выбирает rating.

Backend сохраняет числовое значение.

Данные:

Текущий дефолт реализации: Attribute.type = NUMBER, Attribute.config = { kind: "RATING", scale: 5, icon: "star" }.

Альтернатива: добавить RATING в AttributeType (уточнить).

Value.numberValue хранит rating.

Activity при изменении — VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body:

TypeScript
{
  name: string;
  description?: string;
  type: "NUMBER";
  config: { kind: "RATING"; scale?: number; icon?: "star" | "dot"; allowHalf?: boolean };
}

response: { attribute }

errors: 422 при scale < 2 или > 10 (уточнить).

Acceptance:

В UI можно выбрать Rating.

Атрибут отображается как Rating, не как обычное Number.

Значение ограничено scale.

Фильтры/sorts используют numeric value.

Значение сохраняется в numberValue.

Empty state показывает пустой rating, не 0.

Edge-cases:

Текущее Prisma не содержит RATING; нужна явная реализация через config или миграция enum.

Required rating: 0 не должен быть валидным, если scale начинается с 1 (уточнить).

Импорт значения High/Low → reject или mapping (уточнить).

Половинные значения, если allowHalf=false, запрещены.

Demo-mode без особенностей.

S018 — Создать атрибут Status

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Status.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен. В эталоне Status есть среди типов, используется для стадий/воронок; текущий Prisma enum не содержит STATUS, поэтому требуется mapping через SELECT + config.kind="status" или расширение enum (уточнить). MASTER_TZ включает Status как базовый тип. 


UI-элементы:

Attribute Type = Status.

Name.

Description (optional).

Statuses / Options:

label.

value/key.

color.

order.

terminal/open marker (уточнить).

Add status.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Status.

Вводит name, например Deal stage.

Добавляет статусы Lead, Contacted, Qualification, Won, Lost.

Создаёт атрибут.

Атрибут можно использовать как колонку table и groupBy для board/pipeline.

Перемещение карточки board меняет status value.

Данные:

Дефолт реализации: Attribute.type = SELECT, Attribute.config = { kind: "STATUS", terminalOptions?: [...] }.

AttributeOption хранит статусы: value, label, color, order, isArchived.

Value.textValue или jsonValue хранит выбранное option value/id (уточнить текущий контракт Value).

View.groupByAttributeId может ссылаться на status/select attribute для board.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "SELECT", config: { kind: "STATUS" }, options: [...] }

POST /api/attributes/:attributeId/options

PATCH /api/attribute-options/:optionId

DELETE /api/attribute-options/:optionId

errors: 422 если нет ни одного status (уточнить).

Acceptance:

Status создаётся с набором стадий.

Статусы показываются цветными badge.

Атрибут доступен для board groupBy.

Опции сохраняют порядок.

Архивированная status-option не удаляет исторические значения.

Фильтр по status работает через options.

Edge-cases:

Prisma не содержит STATUS; нужно решить mapping vs enum migration.

Дубль option value → 409.

Удаление статуса, используемого records → archive option, не hard delete.

Board без status options показывает empty columns или setup prompt.

Demo-mode: default stage set можно создать автоматически.

S019 — Создать атрибут Select (+ опции)

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Select.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; options могут быть пустыми на старте, но для практического использования нужны AttributeOption.

UI-элементы: после выбора Select форма перестраивается: видны Attribute Type: Select, Name, Description (optional), блок Options со значением No Options, Set up AI autofill, Cancel, Create attribute. 


Add option.

option row: label, color, drag handle, delete.

AI autofill → Classify record совместим с select.

Create attribute.

Шаги:

Пользователь выбирает Select.

Вводит name, например Segment.

Добавляет опции: Prospect, Customer, Partner.

Опционально включает AI autofill/classify.

Нажимает Create attribute.

В table/details ячейка открывает single-select dropdown.

Данные:

Attribute.type = SELECT.

AttributeOption: по одной строке на опцию; Prisma задаёт @@unique([attributeId, value]).

Value хранит выбранную опцию. Так как отдельной optionId колонки нет, целевой контракт: textValue = option.value или jsonValue (уточнить).

Activity: при смене значения — VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "SELECT", options?: [{ value, label, color }] }

POST /api/attributes/:attributeId/options

PATCH /api/attribute-options/:optionId

DELETE /api/attribute-options/:optionId

PATCH /api/records/:recordId/values/:attributeId

body: { value: "customer" | null }

Acceptance:

Select создаётся с нулём или несколькими options.

Options отображаются цветными badge.

В ячейке можно выбрать ровно одну опцию.

Дубль option value запрещён.

Новая option появляется в фильтрах и редакторе.

Значение сохраняется и корректно сериализуется в row DTO.

Edge-cases:

Нет options → empty dropdown с Add option.

Попытка записать value, которого нет в options → 422, кроме import review flow, где можно добавить option.

Удаление используемой option → archive option; historical value сохраняется.

Переименование label не ломает stored value.

Demo-mode без особенностей.

S020 — Создать атрибут Multi-select

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Multi-select.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; options заданы или будут добавлены позже.

UI-элементы:

Attribute Type = Multi-select.

Name.

Description (optional).

Options.

Add option.

Цветные tags.

Multi-select cell editor с search и checkbox options.

AI autofill → Classify record совместим с multi-select.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Multi-select.

Вводит name, например Categories.

Добавляет options: SaaS, Fintech, Healthcare.

Создаёт атрибут.

В table/details выбирает несколько значений.

UI показывает несколько tags в одной ячейке.

Данные:

Attribute.type = MULTI_SELECT.

AttributeOption хранит options.

Value.jsonValue должен хранить массив option values/ids, так как отдельной m2m таблицы для selected options нет (уточнить; дефолт — jsonValue: string[]).

Activity: смена массива значений → VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "MULTI_SELECT", options?: [...] }

PATCH /api/records/:recordId/values/:attributeId

body: { value: string[] }

errors: 422 если value не массив или содержит неизвестную option.

Acceptance:

Multi-select создаётся.

Можно выбрать несколько опций.

Значения отображаются несколькими цветными tags.

Значения сохраняются в jsonValue.

Фильтр in/contains работает по массиву.

Порядок options сохраняется.

Edge-cases:

Пустой массив отличается от null (уточнить).

Дубликаты в массиве удаляются backend-валидатором.

Архивированная option остаётся видимой на старых records, но не доступна для нового выбора.

Большое число options → search в dropdown.

Demo-mode без особенностей.

S021 — Создать атрибут Currency

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Currency.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; задан default currency workspace или field-level default (уточнить). Currency указан в MASTER_TZ и Prisma enum. 


 


UI-элементы:

Attribute Type = Currency.

Name, например MRR или Amount.

Description (optional).

Default currency selector: USD/EUR/GBP/... (уточнить).

Precision/decimal display.

Currency cell editor: amount + currency.

AI autofill совместим с Prompt completion по MASTER_TZ.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Currency.

Вводит name.

Выбирает default currency.

Создаёт атрибут.

В записи вводит amount.

Backend сохраняет amount/code.

Table/report может считать суммы.

Данные:

Attribute.type = CURRENCY.

Attribute.config: { defaultCurrencyCode?: "USD" | "EUR", precision?: 2 }.

Value.currencyAmount = Decimal(18,2).

Value.currencyCode = string.

Для reports/calculations нужны агрегаты по одной валюте или FX normalization (уточнить).

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "CURRENCY", config?: { defaultCurrencyCode?: string } }

PATCH /api/records/:recordId/values/:attributeId

body:

TypeScript
{
  value: { amount: string | number; currencyCode?: string } | null
}

errors: 422 для невалидного amount/currencyCode.

Acceptance:

Currency создаётся.

Значение хранится в currencyAmount/currencyCode.

UI форматирует сумму с валютой.

Empty value не превращается в 0.

Фильтры gt/lt/equals работают по amount при совместимой валюте.

Add calculation может считать sum/avg для currency column (уточнить phase).

Edge-cases:

Разные валюты в одной колонке → запретить aggregate или конвертировать (уточнить).

Отрицательные суммы — разрешить для refund/credit note? (уточнить; дефолт разрешить).

Очень большое значение сверх precision → 422.

Currency code отсутствует → использовать defaultCurrencyCode.

Demo-mode без особенностей.

S022 — Создать атрибут Email

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Email.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; email validation включён. Email есть в целевой архитектуре Attribute types, хотя в части storyboard dropdown не всегда виден; Prisma enum содержит EMAIL. 


 


UI-элементы:

Attribute Type = Email.

Name, например Work email.

Description (optional).

Option (уточнить): allow multiple emails; default false.

Email cell renderer:

mailto link.

copy action.

validation error state.

Cancel, Create attribute.

Шаги:

Пользователь выбирает Email.

Вводит name.

Создаёт атрибут.

В записи вводит email.

Backend валидирует email.

Значение доступно для email composer, dedupe/import matching.

Данные:

Attribute.type = EMAIL.

Value.textValue хранит normalized email.

Attribute.config: { allowMultiple?: boolean, lowercase?: true }.

Для multi-email текущая schema требует jsonValue или отдельного подхода (уточнить; дефолт — один email в textValue).

При isUnique=true email используется для дедупликации imports/workflows.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "EMAIL", isUnique?: boolean, config? }

PATCH /api/records/:recordId/values/:attributeId

body: { value: "person@example.com" | null }

errors: 422 invalid email; 409 unique conflict.

Acceptance:

Email-атрибут создаётся.

Невалидный email не сохраняется.

Email нормализуется lowercase/trim.

Значение отображается как email link/copyable.

Если isUnique=true, дубль запрещён.

Email доступен как recipient source для composer (уточнить).

Edge-cases:

Плюс-адреса name+tag@domain.com валидны.

Internationalized domains/emails (уточнить; дефолт — поддержка punycode/domain normalization позже).

Несколько emails в одном поле — запретить, если allowMultiple=false.

Empty required email → 422.

Demo-mode: email send остаётся demo-safe.

S023 — Создать атрибут Phone

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Phone Number.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; выбран workspace/default country для phone parsing (уточнить). Импорт-источник указывает, что телефоны ожидаются с кодом страны. 


UI-элементы:

Attribute Type = Phone Number.

Name, например Phone.

Description (optional).

Phone input с country code.

Validation hint.

Click-to-call/copy renderer (уточнить).

Cancel, Create attribute.

Шаги:

Пользователь выбирает Phone Number.

Вводит name.

Создаёт атрибут.

В записи вводит phone number.

Backend нормализует/валидирует.

UI отображает phone в человекочитаемом формате.

Данные:

Attribute.type = PHONE.

Value.textValue хранит normalized phone, желательно E.164.

Attribute.config: { defaultCountry?: string, format?: "E164" }.

Activity: при изменении phone value — VALUE_UPDATED.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "PHONE", config?: { defaultCountry?: string } }

PATCH /api/records/:recordId/values/:attributeId

body: { value: "+43123456789" | null }

errors: 422 invalid phone format.

Acceptance:

Phone-атрибут создаётся.

Значение с кодом страны сохраняется.

Невалидный phone получает inline error.

UI отображает phone и copy/call action (уточнить).

Фильтр contains/is_empty работает.

Импорт phone с кодом страны валидируется.

Edge-cases:

Локальный номер без country code → использовать defaultCountry или 422 (уточнить).

Extensions (x123) → хранить в config/json? (уточнить; дефолт reject в MVP).

Разные форматы с пробелами/скобками нормализуются.

Required phone: пустое значение reject.

Demo-mode без особенностей.

S024 — Создать атрибут URL

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: URL.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: объект активен; frontend/backend имеют URL validator. URL есть в MASTER_TZ и Prisma enum как базовый тип. 


 


UI-элементы:

Attribute Type = URL.

Name, например LinkedIn или Website.

Description (optional).

URL input.

Link preview/favicon (уточнить).

Open link/copy actions.

Cancel, Create attribute.

Шаги:

Пользователь выбирает URL.

Вводит name.

Создаёт атрибут.

В записи вводит URL.

Backend валидирует и нормализует URL.

UI отображает кликабельную ссылку.

Данные:

Attribute.type = URL.

Value.textValue хранит normalized URL.

Attribute.config: { allowedProtocols?: ["http","https"], normalizeHttps?: true }.

Для social links можно использовать URL + config { semantic: "linkedin" } (уточнить).

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "URL", config? }

PATCH /api/records/:recordId/values/:attributeId

body: { value: "https://example.com" | null }

errors: 422 invalid URL/protocol.

Acceptance:

URL-атрибут создаётся.

URL сохраняется в Value.textValue.

UI показывает кликабельную ссылку.

Значения без протокола нормализуются или получают validation error (уточнить; дефолт — добавить https://).

Опасные протоколы javascript: запрещены.

URL доступен в table/details/import.

Edge-cases:

example.com → нормализовать в https://example.com (уточнить).

http:// разрешить или принудительно https (уточнить).

mailto:/tel: запрещены для URL; для них есть Email/Phone.

Очень длинный URL → сохранять в textValue с разумным лимитом (уточнить).

Demo-mode без особенностей.

[ГОТОВ БАТЧ: S010–S024]


---

S025 — Создать атрибут Record (link)

Экран / меню: Object page → View settings / + Add column → Create new attribute → Attribute Type: Record или Settings → Data → Objects → <Object> → Attributes → Create attribute → Record.

Роль / доступ: Owner/Admin или пользователь с FULL доступом к объекту. Member с READ_WRITE может редактировать значения, но не создавать атрибуты.

Предусловие: объект-источник существует и не архивирован; целевой объект для ссылки существует; пользователь имеет доступ минимум READ к целевому объекту.

UI-элементы:

Attribute Type = Record.

Name.

Description (optional).

Target object dropdown: Companies, People, Deals, Workspaces, Users, кастомные объекты.

Allow multiple records toggle (уточнить; если включено — фактически relationship many).

Create attribute, Cancel, ×.

В таблице/Details: record-picker popover с поиском по displayName/searchText, ссылкой на запись, возможностью очистить значение.

В отличие от полноценного Relationship, UI не обязан создавать обратную сторону связи (уточнить).

Шаги:

Пользователь открывает Create attribute.

Выбирает Record.

Вводит имя, например Primary company.

Выбирает целевой объект, например Companies.

Сохраняет атрибут.

В таблице выбирает связанную запись через record-picker.

Значение отображается как кликабельная ссылка на record.

Данные: в источниках Record указан как тип атрибута рядом с Relationship; при этом целевая архитектура явно моделирует связи через RelationshipDefinition/RelationshipValue, а не отдельную RecordValue таблицу, поэтому реализацию Record нужно уточнить. Для MVP разумный дефолт — хранить как Attribute.type=RELATIONSHIP с config.kind="RECORD_LINK" без reverse-атрибута, либо добавить отдельный enum RECORD. Relationship-модель и двусторонняя механика описаны для связей между объектами. 


Создаётся Attribute: objectId, key, name, type=RELATIONSHIP или RECORD (уточнить), config.targetObjectId.

При выборе значения создаётся RelationshipValue или значение в Value.jsonValue (уточнить).

Activity: при изменении ссылки писать событие на source record: RELATIONSHIP_UPDATED или VALUE_UPDATED (уточнить текущий enum).

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "RECORD" | "RELATIONSHIP", config: { kind: "RECORD_LINK", targetObjectId, multiple?: boolean } }

response: { attribute }

GET /api/objects/:targetObjectId/records?search=... — record-picker.

PATCH /api/records/:recordId/values/:attributeId или POST /api/records/:recordId/relationships

body: { targetRecordId } или { targetRecordIds: [] }

Ошибки: 401, 403, 404, 409, 422.

Acceptance:

Атрибут Record создаётся и виден в списке атрибутов.

В ячейке открывается picker целевых записей.

Выбранная запись отображается как ссылка с displayName.

При удалении значения ссылка очищается, target record не удаляется.

Нельзя выбрать запись из другого org.

Если используется RelationshipValue, повторная запись той же пары идемпотентна.

Edge-cases:

Целевой объект архивирован → выбор запрещён.

Target record архивирован после выбора → показывать archived badge или placeholder.

Нет доступа к target object → значение скрыто или отображается как Restricted record.

Multiple=false, пользователь выбирает вторую запись → старая связь заменяется.

Demo-mode: picker работает на seeded/demo records.

S026 — Создать атрибут User

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: User или Settings → Data → Objects → <Object> → Attributes → Create attribute → User.

Роль / доступ: Owner/Admin или FULL access к объекту. Редактирование значения User в записи — Member с READ_WRITE.

Предусловие: в workspace есть хотя бы один User; объект активен; пользователь имеет право видеть members workspace.

UI-элементы:

Attribute Type = User.

Name, например Owner, Assignee, Created by.

Description (optional).

Allow multiple users toggle (уточнить; для MVP default=false).

Default to current user toggle (уточнить).

User picker: поиск по имени/email, аватар, роль.

В table/details: avatar chip, имя, email tooltip.

Create attribute, Cancel.

Шаги:

Пользователь выбирает тип User.

Вводит имя атрибута.

Опционально включает default=current user.

Создаёт атрибут.

В record/table выбирает пользователя.

Значение сохраняется и отображается как user chip.

Данные: текущая Prisma-модель Value содержит userValueId, а AttributeType включает USER, значит User-атрибут хранится типизированно через ссылку на User.

Attribute.type = USER.

Attribute.config = { multiple?: false, defaultCurrentUser?: boolean }.

Value.userValueId = <User.id>.

Для multiple users текущая schema неочевидна; нужен jsonValue или отдельная link-table (уточнить).

Activity: VALUE_UPDATED при назначении/смене пользователя.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "USER", config?: { defaultCurrentUser?: boolean } }

response: { attribute }

GET /api/users?search= или GET /api/workspace/members?search= (уточнить endpoint).

PATCH /api/records/:recordId/values/:attributeId

body: { value: userId | null }

Ошибки: 401, 403, 404, 422.

Acceptance:

User-атрибут создаётся.

Picker показывает пользователей текущего workspace.

Значение сохраняется в Value.userValueId.

В таблице отображается avatar/name.

Удалённый/deactivated пользователь отображается как historical user, но не выбирается для новых значений (уточнить).

Фильтр User is me / User is <name> работает.

Edge-cases:

Пользователь из другого org → 422/403.

User удалён после назначения → значение не ломает record view.

Required User без значения при создании record → 422.

Multiple users не реализованы → toggle скрыть.

Demo-mode: использовать demo-members.

S027 — Создать атрибут Location

Экран / меню: Object page → + Add column → Create new attribute → Attribute Type: Location или Settings → Data → Objects → <Object> → Attributes → Create attribute → Location.

Роль / доступ: Owner/Admin или FULL access к объекту.

Предусловие: объект активен; определён формат хранения location. В эталоне Location присутствует как тип, а в record details location может раскрываться на City/State/Country. 


UI-элементы:

Attribute Type = Location.

Name, например Primary location.

Description (optional).

Location editor:

City.

State / Region.

Country.

optional Address line, Postal code (уточнить).

В table: компактный формат City, Country.

В Details: вложенные поля Primary City, Primary State, Primary Country.

Create attribute, Cancel.

Шаги:

Пользователь выбирает Location.

Вводит имя.

Создаёт атрибут.

В записи заполняет city/state/country.

Система сохраняет структурированный объект location.

View может показывать весь location или nested-поля.

Данные: если в текущем AttributeType нет LOCATION, нужен mapping через JSON или миграция enum (уточнить).

Дефолт MVP: Attribute.type=JSON, config.kind="LOCATION".

Value.jsonValue = { city, state, country, countryCode?, addressLine?, postalCode? }.

Для фильтров/сортировок по country/state могут потребоваться derived attributes или JSON path query (уточнить).

Activity: VALUE_UPDATED при изменении location.

API:

POST /api/objects/:objectId/attributes

body: { name, description?, type: "JSON", config: { kind: "LOCATION" } }

PATCH /api/records/:recordId/values/:attributeId

body: { value: { city?: string; state?: string; country?: string; countryCode?: string } | null }

Ошибки: 422 при невалидной структуре.

Acceptance:

Location-атрибут создаётся.

UI показывает структурированный editor.

Значение сохраняется как structured JSON.

В таблице отображается человекочитаемый location.

Можно фильтровать минимум по country (уточнить phase).

Импорт city/state/country из одной или нескольких колонок поддержан.

Edge-cases:

Неполный location: только country валиден, если не required.

Country free-text vs ISO code — хранить оба (уточнить).

Дубликаты городов в разных странах → не нормализовать без country.

Required Location: определить, какие поля обязательны (уточнить; дефолт — country или full object).

Demo-mode без внешнего geocoder.

S028 — Создать атрибут Relationship

Экран / меню: Settings → Data → Objects → <Object> → Attributes → Create attribute → Attribute Type: Relationship или Object page → + Add column → Create new attribute → Relationship.

Роль / доступ: Owner/Admin или FULL access к source object; также нужен metadata-доступ к target object, потому что создаётся обратная сторона связи.

Предусловие: source object и target object существуют; оба не архивированы; имена обеих сторон уникальны в соответствующих объектах.

UI-элементы: источник описывает модалку relationship: Attribute Type = Relationship, информационный блок о том, что изменения на одной стороне отражаются на другой, Configure relationship, выбор связанного объекта, два поля Associated attribute name, dropdown кардинальности и кнопки Cancel/Create attribute. 


Source object read-only: текущий объект.

Source-side attribute name.

Target object dropdown.

Cardinality: one-to-one / one-to-many / many-to-one / many-to-many.

Target-side associated attribute name.

Create attribute.

Шаги:

Пользователь выбирает тип Relationship.

Выбирает target object, например Companies.

Задаёт source-side имя, например Company.

Выбирает cardinality, например Many to one.

Задаёт reverse-side имя, например Invoices.

Нажимает Create attribute.

Система создаёт relationship definition и атрибуты на обеих сторонах.

В source record появляется picker целевых записей; в target record — обратный список/таб.

Данные: Academy прямо описывает relationship как двустороннюю связь между объектами, с cardinality one-to-one / one-to-many / many-to-one / many-to-many, пример Invoices → Companies как many-to-one. 


Создаётся Attribute на source object: type=RELATIONSHIP.

Создаётся reverse Attribute на target object: type=RELATIONSHIP, isSystem? (уточнить; дефолт false, но linked to definition).

Создаётся RelationshipDefinition: sourceObjectId, targetObjectId, sourceAttributeId, reverseAttributeId, cardinality, config.

Значения пишутся в RelationshipValue.

Activity: при создании definition — metadata audit; при link/unlink records — relationship activity на обе записи.

API:

POST /api/objects/:objectId/attributes

body: { type: "RELATIONSHIP", name, config: { targetObjectId, reverseName, cardinality } }

response: { attribute, reverseAttribute, relationshipDefinition }

POST /api/records/:recordId/relationships

body: { sourceAttributeId, targetRecordId }

GET /api/records/:recordId/relationships

DELETE /api/relationship-values/:relationshipValueId

Ошибки: 401, 403, 404, 409, 422.

Acceptance:

Relationship-атрибут создаёт обе стороны связи.

На source record можно выбрать target record.

На target record видна обратная связь.

Cardinality enforced backend-ом.

Relationship можно использовать в view columns.

Связь не создаётся между разными org.

Edge-cases:

Source и target один и тот же объект → self-relationship разрешить только с явными именами сторон (уточнить).

Reverse name конфликтует с существующим атрибутом target object → 409.

У target object нет read-доступа → создать нельзя.

Архивирование relationship attribute должно сохранять historical values.

Demo-mode: работает на seeded records.

S029 — Пометить атрибут Unique

Экран / меню: Settings → Data → Objects → <Object> → Attributes → <Attribute> → ⋮ / Edit → Unique или Create attribute → Advanced → Unique.

Роль / доступ: Owner/Admin или FULL access к объекту.

Предусловие: атрибут не system-only; тип поддерживает уникальность. Для уникальных идентификаторов источник явно указывает: если атрибут хранит ID/уникальный идентификатор, его нужно пометить unique, чтобы предотвращать дубли и update/create при sync/import. 


UI-элементы:

Toggle Unique.

Badge Unique в списке attributes.

Warning: Values must be unique across records in this object.

Duplicate check status: loading / no duplicates / duplicates found (уточнить).

Confirmation modal, если у атрибута уже есть values.

Save changes.

Шаги:

Пользователь открывает настройки атрибута.

Включает Unique.

Система проверяет существующие values.

Если дублей нет — сохраняет isUnique=true.

Если дубли есть — показывает список конфликтов и блокирует сохранение.

После включения новые записи/импорты проходят dedupe по этому атрибуту.

Данные:

Attribute.isUnique = true.

Нужна проверка уникальности по typed value: textValue, numberValue, dateValue, userValueId, currencyAmount/currencyCode, jsonValue.

Для строгой защиты нужна DB-стратегия уникальности (уточнить): частичные unique indexes по (orgId, attributeId, typedValue) или application-level lock.

Import использует unique attribute для update/create dedupe.

Activity: metadata audit; record activities не пишутся.

API:

PATCH /api/attributes/:attributeId

body: { isUnique: true }

response: { attribute, duplicateCheck }

GET /api/attributes/:attributeId/duplicates (уточнить) — preview конфликтов.

Ошибки:

409 — существующие дубли.

422 — тип не поддерживает unique.

403 — нет metadata-доступа.

Acceptance:

Unique можно включить для text/email/url/number/date/user и других deterministic типов (уточнить список).

Badge Unique появляется в Attributes.

Создание записи с дублем возвращает 409.

Inline update на дубль возвращает validation error.

Import использует unique для update existing vs create.

Значение null не конфликтует с другим null (уточнить; дефолт — multiple null allowed).

Edge-cases:

Existing duplicates → нельзя включить, пока не исправлены.

Case-insensitive email/domain uniqueness → нормализовать перед проверкой.

Currency unique без currencyCode невалиден.

Multi-select/JSON unique — сложная семантика; запретить в MVP (уточнить).

Race condition двух одновременных create с одним value → нужен transaction/lock.

S030 — Пометить атрибут Required

Экран / меню: Settings → Data → Objects → <Object> → Attributes → <Attribute> → Edit → Required или Create attribute → Advanced → Required.

Роль / доступ: Owner/Admin или FULL access к объекту.

Предусловие: атрибут не system-only; если у существующих records нет значения, система должна показать impact и потребовать заполнить значения или разрешить включение только для новых records (уточнить). Источник описывает Required как запрет создавать/обновлять запись без значения. 


UI-элементы:

Toggle Required.

Badge Required.

Validation preview: N records are missing this value.

Save changes.

В create/edit record формах: required marker *.

Inline cell: error state при очистке required value.

Шаги:

Пользователь открывает атрибут.

Включает Required.

Система проверяет пустые значения.

Пользователь подтверждает или исправляет missing values.

Backend сохраняет isRequired=true.

Создание/обновление record без значения блокируется.

Данные:

Attribute.isRequired = true.

Backend value validator проверяет required на:

POST /records.

PATCH /records/:id.

import confirm.

workflow create/update record.

false, 0, пустой массив и пустая строка требуют отдельной семантики: false и 0 заполнены; "" обычно пусто.

Activity: metadata audit для включения; value update activity — при исправлении records.

API:

PATCH /api/attributes/:attributeId

body: { isRequired: true }

response: { attribute, missingCount }

POST /api/objects/:objectId/records

ошибка 422 REQUIRED_ATTRIBUTE_MISSING.

PATCH /api/records/:recordId/values/:attributeId

ошибка 422, если value очищается.

Ошибки: 401, 403, 404, 409, 422.

Acceptance:

Required badge появляется в attributes list.

New record modal требует заполнить поле.

Очистка required value запрещена.

Import rows без required value помечаются проблемными.

Workflow update/create record не может записать invalid state.

Required system attributes редактируются только системно.

Edge-cases:

Включение Required при существующих пустых значениях → preview/блокировка (уточнить).

Boolean false валиден.

Number 0 валиден.

Multi-select [] считать пустым.

Relationship required: нужен минимум один target.

Demo-mode без особенностей.

S031 — Reorder атрибутов (drag) в object settings

Экран / меню: Settings → Data → Objects → <Object> → Attributes → drag handle.

Роль / доступ: Owner/Admin или FULL access к объекту.

Предусловие: объект активен; список атрибутов загружен; пользователь имеет metadata-доступ. Источник показывает список атрибутов, где у каждого атрибута есть drag-handle, имя, тип, бейджи и меню ⋮; Academy также указывает управление атрибутами через reorder/archive. 


 


UI-элементы:

Attributes table/list.

Drag handle у каждой reorderable строки.

System attributes могут быть pinned/disabled (уточнить).

Live reorder preview.

Save changes или autosave (уточнить; дефолт autosave с optimistic update).

Toast Attribute order updated.

Шаги:

Пользователь открывает вкладку Attributes.

Берёт drag-handle атрибута.

Перетаскивает строку выше/ниже.

UI показывает новый порядок.

Backend сохраняет order.

Настройки и default ordering в UI обновляются.

Данные:

Обновляется Attribute.order для затронутых атрибутов.

ViewColumn.order не должен автоматически меняться, если reorder идёт в object settings (уточнить).

Record/Value не меняются.

Activity: metadata audit, не record activity.

API:

PATCH /api/objects/:objectId/attributes/reorder (уточнить; добавить endpoint)

body: { attributeIds: string[] }

response: { attributes }

Альтернатива: batch PATCH /api/attributes/:id.

Ошибки: 403, 404, 409, 422.

Acceptance:

Атрибут можно перетащить.

После refresh порядок сохраняется.

Порядок не ломает view columns.

System attributes либо pinned, либо reorderable по правилам (уточнить).

Reorder не меняет значения records.

Несколько быстрых reorder не создают race-visible мусор.

Edge-cases:

Один из attributeIds принадлежит другому object → 422.

Атрибут архивирован между drag и save → refetch.

Два пользователя меняют порядок одновременно → last-write-wins или version conflict (уточнить).

Keyboard accessibility для reorder (уточнить).

Demo-mode без особенностей.

S032 — Archive атрибута

Экран / меню: Settings → Data → Objects → <Object> → Attributes → <Attribute row> → ⋮ → Archive attribute.

Роль / доступ: Owner/Admin или FULL access к объекту.

Предусловие: атрибут существует, не архивирован; не является system-only; не является primary/record-text без выбора замены; не используется критически в required workflows/views без предупреждения (уточнить).

UI-элементы:

Attribute row menu ⋮.

Action Archive attribute.

Confirmation modal:

имя атрибута.

warning: values сохранятся, но поле исчезнет из views/forms.

dependency list: views, filters, workflows, reports (уточнить).

Cancel, destructive Archive.

Toast Attribute archived.

Optional Undo (уточнить).

Шаги:

Пользователь открывает Attributes.

Открывает меню у атрибута.

Нажимает Archive attribute.

Подтверждает.

Backend помечает атрибут архивированным.

UI скрывает атрибут из active list, add-column menu и edit forms.

Значения остаются в БД.

Данные:

Attribute.isArchived=true и/или Attribute.archivedAt=now().

Value не удаляются.

ViewColumn для атрибута нужно удалить/скрыть или пометить invalid (уточнить; дефолт — удалить из активных views).

ViewFilter/ViewSort по атрибуту должны стать invalid или быть удалены с warning.

RelationshipDefinition, если архивируется relationship attr, требует отдельной обработки.

Activity: metadata audit.

API:

DELETE /api/attributes/:attributeId

semantics: soft archive.

response: { attribute: { id, isArchived, archivedAt } }

Ошибки:

403.

404.

409 — system/primary/used by dependency.

422.

Acceptance:

Custom attribute архивируется.

После refresh атрибут не виден в add-column menu.

Values не удаляются физически.

System attributes нельзя архивировать.

Primary record text attribute нельзя архивировать без выбора нового.

Views не падают, если архивированный attribute был колонкой.

Edge-cases:

Attribute is required → при archive required constraint перестаёт применяться только после archive (уточнить).

Relationship attr archive → обратная сторона должна архивироваться/синхронизироваться.

Attribute используется в workflow/report → показать dependency warning.

Повторный DELETE идемпотентен.

Demo-mode без особенностей.

S033 — Добавить опции к Select прямо при создании

Экран / меню: Create attribute → Attribute Type: Select / Multi-select / Status → Options → Add option.

Роль / доступ: Owner/Admin или FULL access к объекту.

Предусловие: открыт Create attribute; выбран тип с опциями: Select, Multi-select, Status. Источник показывает, что после выбора Select форма содержит блок Options и состояние No Options. 


UI-элементы:

Options section.

No Options empty state.

Add option.

Option row:

Label.

generated value/key.

color selector.

drag handle.

delete icon.

Validation: duplicate label/value.

Create attribute.

AI-overlap: для Classify record опции Select/Multi-select являются допустимыми выходными тегами; AI должен выбирать только существующие опции. AI-атрибуты и кредиты описаны отдельно в Academy 13: Classify/Summarize/Prompt = 1 кредит, Research = 10 кредитов. 


Шаги:

Пользователь выбирает Select.

Вводит name, например Segment.

Нажимает Add option.

Вводит Prospect, выбирает цвет.

Добавляет Customer, Partner.

При необходимости меняет порядок.

Нажимает Create attribute.

Backend создаёт Attribute и связанные AttributeOption.

Данные:

Attribute.type=SELECT | MULTI_SELECT.

Для каждой опции создаётся AttributeOption: attributeId, value, label, color, order, isArchived=false.

@@unique([attributeId, value]) защищает от дублей.

Если включён AI Classify, Attribute.config.ai = { enabled, aiType: "CLASSIFY", guidance } (требует расширения schema; уточнить).

Activity: metadata audit.

API:

POST /api/objects/:objectId/attributes

body: { type: "SELECT", name, options: [{ label, value?, color?, order? }] }

response: { attribute, options }

POST /api/attributes/:attributeId/options

PATCH /api/attribute-options/:optionId

DELETE /api/attribute-options/:optionId

Ошибки: 409 duplicate option value, 422 empty label.

Acceptance:

Select можно создать сразу с опциями.

Опции сохраняют label/color/order.

В table picker доступны созданные опции.

Дубли option value запрещены.

Создание атрибута и опций атомарно: если одна опция невалидна, атрибут не создаётся.

Для AI Classify выбор опций ограничивает допустимые теги.

Edge-cases:

Пользователь создаёт Select без опций → разрешить, но picker пустой.

Пользователь удалил все option rows перед submit → создать пустой Select или показать warning (уточнить).

Два одинаковых label с разным value → лучше запретить на UI (уточнить).

AI Classify без опций → запуск невозможен, пока нет вариантов.

Demo-mode: AI classify возвращает deterministic option из списка.

S034 — System-атрибуты нередактируемы

Экран / меню: Settings → Data → Objects → <Object> → Attributes.

Роль / доступ: Owner/Admin видит system attributes, но не может менять защищённые свойства. Member без metadata-доступа обычно не видит settings. Системные значения могут обновляться только backend-ом.

Предусловие: объект создан bootstrap-ом или custom-object flow добавил системные атрибуты. В источнике для Invoices показаны system attributes: List Entries, Next due task, Created at, Created by; строки имеют badge System. 


UI-элементы:

Attributes list.

Rows:

List Entries — type Record/System.

Next due task — type Record/System.

Created at — Timestamp/System.

Created by — User/System.

Badge System.

Disabled controls:

rename.

change type.

archive.

unique/required toggles (уточнить).

Tooltip: System attributes are managed by AISDR.

Menu ⋮ либо скрыт, либо содержит read-only View details.

Шаги:

Пользователь открывает object settings.

Переходит на Attributes.

Видит системные атрибуты с badge System.

Пытается открыть меню/редактирование.

UI не позволяет менять protected fields.

Backend также блокирует mutation.

Данные:

Attribute.isSystem = true.

Attribute.isArchived=false.

Значения:

Created at может быть derived from Record.createdAt.

Created by может быть derived from Record.createdById.

Next due task — derived from Task.

List Entries — derived from ListEntry.

System attributes могут не иметь обычных Value rows и вычисляться на чтении (уточнить).

Activity: нет при просмотре; system updates создаются backend-событиями по соответствующим record/task/list actions.

API:

PATCH /api/attributes/:attributeId

если isSystem=true, разрешить только safe fields (уточнить) или полностью 403/409.

DELETE /api/attributes/:attributeId

409 SYSTEM_ATTRIBUTE_PROTECTED.

GET /api/objects/:objectId/attributes

возвращает isSystem=true.

Ошибки: 403, 409, 422.

Acceptance:

System attributes видны с badge System.

Их нельзя архивировать.

Их нельзя менять на другой type.

Их нельзя удалить из объекта.

Они могут быть добавлены в views как read-only columns.

Inline edit system-derived value запрещён.

Edge-cases:

Bootstrap не создал system attributes → repair/bootstrap должен дозаполнить.

System attribute попал в create attribute name conflict → custom attribute не может использовать reserved key.

Created by user deleted/deactivated → отображать historical user.

Next due task отсутствует → empty state.

Demo-mode: system attributes вычисляются из demo tasks/list entries.

S040 — Создать relationship-атрибут: выбрать целевой объект

Экран / меню: Settings → Data → Objects → <Source Object> → Attributes → Create attribute → Relationship → Configure relationship → Target object.

Роль / доступ: Owner/Admin или FULL access на source object; нужен metadata-read/full access к target object (уточнить точный уровень).

Предусловие: source object активен; target object существует в том же org; имена будущих атрибутов не конфликтуют. Relationship-атрибуты — ядро модели: они связывают записи разных объектов и создают двустороннюю навигацию. 


UI-элементы:

Attribute Type = Relationship.

Configure relationship.

Source side: <Source object> read-only.

Associated attribute name для source side.

Target object dropdown.

Search внутри dropdown.

Cardinality dropdown.

Reverse side preview.

Create attribute.

Шаги:

Пользователь выбирает Relationship.

Открывает target object dropdown.

Выбирает объект, например Companies.

UI показывает reverse-side object и поля имён.

Пользователь задаёт cardinality и имена.

Создаёт relationship.

Данные:

Читаются target Object rows текущего org.

Создаются Attribute на source/target.

Создаётся RelationshipDefinition с sourceObjectId, targetObjectId.

RelationshipValue пока не создаётся — только при linking records.

Activity: metadata audit.

API:

GET /api/objects?includeArchived=false — target dropdown.

POST /api/objects/:sourceObjectId/attributes

body: { type: "RELATIONSHIP", name, config: { targetObjectId, reverseName, cardinality } }

Ошибки: 403, 404, 409, 422.

Acceptance:

Dropdown показывает только объекты текущего org.

Нельзя выбрать archived object.

После выбора target UI показывает обратную сторону.

RelationshipDefinition создаётся.

Source/reverse attributes появляются в соответствующих object settings.

Повторное создание с теми же именами блокируется.

Edge-cases:

Target object скрыт правами → не показывать.

Source=target self relation → требовать разные имена сторон.

Target object архивирован после открытия модалки → submit возвращает 409.

Нет объектов кроме source → empty state.

Demo-mode без особенностей.

S041 — Кардинальность one-to-one

Экран / меню: Create attribute → Relationship → Configure relationship → Cardinality → One to one.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: выбран source и target object; имена обеих сторон заданы; нет existing RelationshipValues, нарушающих one-to-one при изменении (уточнить edit flow).

UI-элементы:

Cardinality dropdown.

Option One to one.

Tooltip с объяснением: одна source-запись может быть связана максимум с одной target-записью, и target — максимум с одной source.

Preview:

Source side: single picker.

Target side: single reverse picker/link.

Create attribute.

Шаги:

Пользователь выбирает One to one.

Создаёт relationship.

В source record выбирает target record.

Backend проверяет, что source ещё не имеет target по этому definition.

Backend проверяет, что target ещё не связан с другим source.

Связь создаётся и видна с обеих сторон.

Данные:

RelationshipDefinition.cardinality = ONE_TO_ONE.

RelationshipValue uniqueness:

unique (sourceRecordId, sourceAttributeId).

unique (targetRecordId, relationshipDefinitionId) или эквивалент.

При замене значения старую связь удалить/архивировать, новую создать (уточнить).

Activity: link/unlink на обеих записях.

API:

POST /api/records/:recordId/relationships

body: { sourceAttributeId, targetRecordId }

errors:

409 SOURCE_CARDINALITY_VIOLATION.

409 TARGET_CARDINALITY_VIOLATION.

DELETE /api/relationship-values/:id.

Acceptance:

Source record может иметь максимум одну связь.

Target record может быть связан максимум с одним source.

UI использует single-select picker.

Попытка связать второй source с тем же target возвращает conflict.

Reverse side показывает одну запись, не список.

Удаление связи освобождает обе стороны.

Edge-cases:

Одновременное связывание одного target двумя users → один success, второй 409.

Замена target должна быть атомарной.

Импорт multiple values в one-to-one → row error.

Self one-to-one: нельзя связать record с самим собой? (уточнить; дефолт запретить, если не разрешено).

Demo-mode без особенностей.

S042 — Кардинальность one-to-many

Экран / меню: Create attribute → Relationship → Configure relationship → Cardinality → One to many.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: source/target выбраны. По направлению source→target: одна source-запись может иметь много target-записей; каждая target-запись относится максимум к одной source по этой связи.

UI-элементы:

Cardinality option One to many.

Tooltip/diagram.

Source side preview: multi-record list/picker.

Target side preview: single reverse link.

Create attribute.

Шаги:

Пользователь выбирает One to many.

Создаёт relationship.

На source record добавляет несколько target records.

На target record reverse side показывает одну source.

При попытке добавить target к другой source backend блокирует или переносит связь (уточнить; дефолт блокировать).

Данные:

RelationshipDefinition.cardinality = ONE_TO_MANY.

RelationshipValue:

source может иметь много rows.

target должен быть unique в рамках definition.

Activity: добавление/удаление каждой связи.

API:

POST /api/records/:recordId/relationships

body: { sourceAttributeId, targetRecordId }

POST /api/records/:recordId/relationships/bulk (уточнить)

Ошибки: 409 TARGET_ALREADY_LINKED.

Acceptance:

Source side позволяет выбрать несколько target records.

Target side показывает максимум одну source.

Один target нельзя добавить в две source-записи по той же связи.

Удаление связи удаляет только одну пару.

Relationship tab/list корректно показывает count.

Edge-cases:

Drag/add duplicate target в source list → idempotent no-op.

Target уже связан с source A, пользователь добавляет в source B → conflict с ссылкой на source A.

Bulk import multiple targets работает.

Empty source list валиден, если relationship не required.

Demo-mode без особенностей.

S043 — Кардинальность many-to-one

Экран / меню: Create attribute → Relationship → Configure relationship → Cardinality → Many to one.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: source/target выбраны. Пример из источника: Invoices → Companies, где много invoices относятся к одной company, а каждый invoice принадлежит одной company. 


UI-элементы:

Cardinality option Many to one.

Source side preview: single target picker (Company на Invoice).

Target side preview: list/tab (Invoices на Company).

Associated attribute name source: Company.

Reverse name: Invoices.

Create attribute.

Шаги:

Пользователь выбирает target Companies.

Выбирает cardinality Many to one.

Называет source-side Company.

Называет reverse-side Invoices.

Создаёт relationship.

На invoice выбирает одну company.

На company видит список invoices.

Данные:

RelationshipDefinition.cardinality = MANY_TO_ONE.

RelationshipValue:

unique (sourceRecordId, sourceAttributeId) — один target на source.

target может иметь много source rows.

Reverse relationship вычисляется по targetRecordId.

Activity: link/unlink/update на invoice и company.

API:

POST /api/records/:invoiceRecordId/relationships

body: { sourceAttributeId: companyAttrId, targetRecordId: companyRecordId }

GET /api/records/:companyRecordId/relationships?attribute=invoices

Ошибки: 409 SOURCE_CARDINALITY_VIOLATION.

Acceptance:

Source record имеет максимум одну target запись.

Target record показывает список source records.

Пример Invoice.Company → Company.Invoices работает.

Замена company у invoice обновляет reverse list.

Импорт relationship по unique company domain поддержан.

Edge-cases:

Source уже имеет target, новое значение → replace или conflict (уточнить; дефолт replace через update value).

Target archived → нельзя выбрать новым значением, но old link отображается с badge.

Required many-to-one: source record нельзя создать без target.

Удаление target record soft archive не удаляет RelationshipValue (уточнить).

Demo-mode без особенностей.

S044 — Кардинальность many-to-many

Экран / меню: Create attribute → Relationship → Configure relationship → Cardinality → Many to many.

Роль / доступ: Owner/Admin или FULL access.

Предусловие: source/target выбраны; имена сторон заданы. Пример: companies ↔ people Team, deals ↔ associated people, event invitees ↔ tags (частично уточнить).

UI-элементы:

Cardinality option Many to many.

Source side: multi-picker/list.

Target side: multi reverse-list.

Optional relationship tab on record page.

Create attribute.

Шаги:

Пользователь выбирает Many to many.

Создаёт relationship.

На source record добавляет несколько target records.

Один target record может быть добавлен к нескольким source records.

Обе стороны показывают списки связанных записей.

Данные:

RelationshipDefinition.cardinality = MANY_TO_MANY.

RelationshipValue допускает много rows с обеих сторон.

Unique только на exact duplicate pair: (sourceRecordId, sourceAttributeId, targetRecordId).

Reverse list строится по targetRecordId.

Activity: link/unlink events.

API:

POST /api/records/:recordId/relationships

DELETE /api/relationship-values/:id

GET /api/records/:recordId/relationships

Ошибки: 409 DUPLICATE_RELATIONSHIP.

Acceptance:

Source может иметь много targets.

Target может иметь много sources.

Дубли одной пары не создаются.

Обе стороны навигируемы.

Relationship tab может отображать связанные records.

Bulk add работает идемпотентно.

Edge-cases:

Большое число связей → pagination в relationship tab.

Удаление одной пары не влияет на другие пары.

Self many-to-many требует защиту от duplicate reverse rows (уточнить).

Импорт списка target unique identifiers создаёт несколько RelationshipValues.

Demo-mode без особенностей.

S045 — Задать имена обеих сторон

Экран / меню: Create attribute → Relationship → Configure relationship → Associated attribute name на обеих сторонах.

Роль / доступ: Owner/Admin или FULL access к source и target metadata.

Предусловие: source object и target object выбраны; имена не заняты existing attributes в соответствующих objects.

UI-элементы: модалка relationship показывает две стороны: source object и target object; у каждой стороны есть Associated attribute name. В примере Invoices source-name Company, reverse-name Invoices. 


Input source-side name.

Input target-side reverse name.

Auto-suggest names:

source: singular target object.

reverse: plural source object.

Validation state.

Preview: Invoices.Company ↔ Companies.Invoices.

Шаги:

Пользователь выбирает Relationship.

Выбирает target object.

Вводит имя source side.

Вводит имя reverse side.

Система генерирует keys.

Пользователь создаёт relationship.

Оба attributes появляются в своих object settings.

Данные:

Attribute.name/key на source object.

Reverse Attribute.name/key на target object.

RelationshipDefinition.sourceAttributeId/reverseAttributeId.

config.labels (уточнить).

Activity: metadata audit.

API:

POST /api/objects/:sourceObjectId/attributes

body: { type: "RELATIONSHIP", name, config: { targetObjectId, reverseName, cardinality } }

Ошибки:

409 SOURCE_ATTRIBUTE_KEY_EXISTS.

409 REVERSE_ATTRIBUTE_KEY_EXISTS.

422 EMPTY_NAME.

Acceptance:

Можно задать разные имена сторон.

Имена превращаются в уникальные keys.

Reverse attribute создаётся с указанным именем.

Preview соответствует фактической навигации.

Дубли имён блокируются.

Rename relationship side позже обновляет UI без потери values (уточнить edit flow).

Edge-cases:

Source=target → имена сторон обязаны быть разными.

Reverse name совпал с system attribute → запрещено.

Пользователь меняет target object после ввода имён → auto-suggest не перетирает ручной ввод (уточнить).

Кириллица в имени → key normalizer.

Demo-mode без особенностей.

S046 — Двусторонняя навигация: invoice→company и company→invoices

Экран / меню: Invoices → record page → Company relationship cell/link и Companies → record page → Invoices relationship tab/section.

Роль / доступ: пользователь должен иметь READ к обеим сторонам. Если есть доступ только к source, target скрывается/маскируется.

Предусловие: создан relationship Invoices.Company ↔ Companies.Invoices с cardinality many-to-one; есть invoice record и company record; создан RelationshipValue.

UI-элементы:

На invoice:

поле Company в Details/table.

linked company chip.

click → открыть company record.

На company:

reverse field/tab Invoices.

список invoice records.

count.

+ Add / link existing (уточнить).

Breadcrumbs при переходе.

Шаги:

Пользователь открывает invoice.

Видит поле Company.

Кликает linked company.

Открывается company record.

Пользователь открывает вкладку/секцию Invoices.

Видит исходный invoice в обратном списке.

Клик по invoice возвращает на invoice record.

Данные:

Читается RelationshipValue по source invoice.

Reverse list вычисляется по targetRecordId=company.id.

Record.displayName используется для chips.

Activity: при навигации не пишется; при создании/удалении связи — пишется relationship event на обе записи.

API:

GET /api/records/:invoiceId/relationships

GET /api/records/:companyId/relationships

GET /api/records/:recordId для открытия linked record.

Ошибки: 403 если нет доступа к одной стороне, 404 archived/не найден.

Acceptance:

Invoice показывает связанную company.

Company показывает reverse invoices.

Переходы кликабельны в обе стороны.

Reverse list обновляется после изменения invoice.company.

Удаление relationship убирает invoice из company.invoices.

Права применяются на обеих сторонах.

Edge-cases:

Target company archived → chip показывает archived state.

У пользователя нет доступа к company → Restricted record.

Reverse list большой → pagination.

RelationshipValue orphan из-за повреждения данных → backend возвращает safe placeholder и health warning (уточнить).

Demo-mode: seed invoice/company связь демонстрирует сценарий.

S047 — Несколько relationship на объект: Company, Billing Admin, Workspace

Экран / меню: Settings → Data → Objects → Invoices → Attributes и Invoices record page → Details.

Роль / доступ: Owner/Admin или FULL access для настройки; READ_WRITE для заполнения значений.

Предусловие: объект Invoices создан; целевые объекты Companies, People, Workspaces существуют. Источник прямо показывает Invoices с relationship-атрибутами Company, Billing Admin, Workspace. 


UI-элементы:

Attributes list:

Company → Companies, Relationship.

Billing Admin → People, Relationship.

Workspace → Workspaces, Relationship.

Create attribute.

В invoice Details:

record picker для Company.

person picker для Billing Admin.

workspace picker.

В target record:

reverse tabs/sections: Invoices / Billing invoices / Workspace invoices (уточнить names).

Шаги:

Admin открывает Invoices → Attributes.

Создаёт relationship Company → Companies.

Создаёт relationship Billing Admin → People.

Создаёт relationship Workspace → Workspaces.

Пользователь открывает invoice record.

Заполняет все три relationship поля.

Target records показывают обратные списки.

Данные:

Три RelationshipDefinition.

Три source Attribute.

Три reverse Attribute.

Несколько RelationshipValue на один source record, но разные sourceAttributeId.

Activity: каждый link/unlink фиксируется отдельно с указанием attribute.

API:

POST /api/objects/:invoiceObjectId/attributes × 3.

POST /api/records/:invoiceId/relationships × 3.

GET /api/records/:invoiceId/relationships.

Ошибки: 409 при конфликте имён, 422 при target mismatch.

Acceptance:

Один объект может иметь несколько relationship attributes.

Значения разных relationship attributes не конфликтуют.

Picker для каждого поля ограничен своим target object.

Reverse navigation работает для каждой связи.

View columns могут отображать все три relationship.

Activity различает, какое relationship поле изменено.

Edge-cases:

Одинаковый target object несколько раз с разными ролями → разрешено, если имена разные.

User выбирает People record в поле Company → 422.

Billing Admin optional, Company required (уточнить) — required enforcement работает по attribute.

Архивация одной relationship не ломает остальные.

Demo-mode без особенностей.

S048 — Подтянуть поле связанной записи в колонку view

Экран / меню: Object page → View settings / + Add column → Relationship path → <Relationship> → <Target attribute>, например Invoices → Billing Admin → Email.

Роль / доступ: пользователь с правом редактировать view (READ_WRITE или FULL на view/object; уточнить). Для просмотра nested column нужен READ к связанному объекту и атрибуту.

Предусловие: есть relationship attribute; target object имеет нужный attribute, например People.Email; view существует. Источник прямо указывает, что в view settings можно вытягивать данные из связей, например email billing admin. 


UI-элементы:

+ Add column.

Attribute menu:

direct attributes.

relationship groups.

nested attributes under relationship.

Search.

Preview column label: Billing Admin > Email.

Column settings:

width.

display label.

read-only marker for nested column (уточнить).

Table cell renders target attribute value.

Шаги:

Пользователь открывает object table.

Нажимает + Add column.

Выбирает relationship Billing Admin.

Выбирает target attribute Email.

Колонка добавляется в view.

Таблица показывает email связанного person.

Клик может открыть target record или email action (уточнить).

Данные:

Создаётся ViewColumn:

viewId.

attributeId может быть target attribute или source relationship attr (уточнить).

config.path = [{ relationshipAttributeId }, { attributeId: targetEmailAttributeId }].

order, width.

Value не создаётся: nested value вычисляется на read.

Activity: не пишется, это view metadata update.

API:

PUT /api/views/:viewId/columns

body includes nested path config.

GET /api/objects/:objectId/records?viewId=...

response cell contains resolved nested value.

Ошибки:

422 INVALID_RELATIONSHIP_PATH.

403 no access to target object/attribute.

404 target attribute archived.

Acceptance:

Relationship path появляется в add-column menu.

Nested column сохраняется в view.

После refresh колонка остаётся.

Значения читаются из target records.

Если relationship пустой, cell пустая.

Если many relationship возвращает несколько targets, UI показывает список/first/count (уточнить).

Edge-cases:

Many-to-many path → несколько email values; дефолт — chips/list, не строковая склейка (уточнить).

Target attribute archived → колонка invalid и предлагает удалить.

Нет доступа к target → restricted cell.

Сортировка/фильтр по nested column — (уточнить; сложный SQL/EAV).

Demo-mode: пример Company → Team → Email addresses.

S049 — Drill-in: на company показать email-адреса team

Экран / меню: Companies → table view → + Add column → Team → Email addresses или Company record page → Team relationship tab → columns → Email addresses.

Роль / доступ: пользователь с READ к Companies и People; для изменения view нужен доступ к view/object. Email visibility дополнительно зависит от email sharing settings (уточнить для synced emails; для атрибута email — обычные права).

Предусловие: есть relationship Companies ↔ People / Team; people records имеют email attribute; company имеет связанные people. В источниках standard relationships включают companies↔people/team, а custom views могут добавлять team emails через relationship drill-in. 


 


UI-элементы:

Company table.

Column menu with nested path:

Team.

Email addresses.

Cell renderer:

multiple email chips.

overflow +N.

tooltip/popover with all emails.

Record page relationship tab Team:

table of people.

columns: Person, Email, Job title, Last interaction (уточнить).

Empty state: No team members linked.

Шаги:

Пользователь открывает Companies.

Нажимает + Add column.

Раскрывает relationship Team.

Выбирает Email addresses.

Таблица добавляет nested column.

Для каждой company система показывает emails связанных people.

Пользователь кликает chip, чтобы открыть person/email action (уточнить).

Данные:

RelationshipDefinition companies ↔ people.

RelationshipValue для связей company-person.

Target Attribute email на People.

ViewColumn.config.path хранит nested route.

Values читаются из Value.textValue target email attribute.

Activity: при добавлении nested column — view metadata audit; при изменении team relationship — relationship activity.

API:

PUT /api/views/:viewId/columns

body: nested path Team.Email.

GET /api/objects/:companyObjectId/records?viewId=...

response: { values: { "team.email": [...] } } (уточнить shape).

GET /api/records/:companyId/relationships?attribute=team.

Ошибки: 403, 404, 422.

Acceptance:

Можно добавить колонку Team → Email addresses.

Для company с несколькими people отображаются несколько emails.

Для company без team — empty cell.

Клик по person/email не ломает table navigation.

После refresh nested column сохраняется.

Permissions скрывают emails, если нет доступа к People/email attribute.

Edge-cases:

У linked person нет email → показать только имеющиеся emails.

Дубликаты email у нескольких people → можно показывать один раз или все (уточнить; дефолт — unique display).

Team содержит много people → overflow/popover/pagination.

RelationshipValue указывает на archived person → скрыть или archived chip.

Demo-mode: seeded company Cosme / team people показывают emails.

AI-атрибуты — настройка/запуск Classify/Summarize/Research/Prompt (сквозное требование к модулю атрибутов)

Экран / меню: Object/List view → + Add column → Create new attribute → AI Autofill или Settings → Data → Objects → <Object> → Attributes → Create attribute → Set up AI autofill. Academy 13 показывает AI-секцию в dropdown типов и модалку с Autofill type, Guidance, текстом про доступ AI ко всем record attributes. 


Роль / доступ: Owner/Admin или FULL access для создания AI-атрибута; READ_WRITE для запуска по записи, если разрешено списание кредитов (уточнить). Billing/credits видит Owner/Admin.

Предусловие: создан обычный совместимый атрибут или выбран AI-type при создании; у workspace есть credits или включён demo-mode. Совместимость: CLASSIFY → SELECT/MULTI_SELECT, SUMMARIZE/RESEARCH → TEXT, PROMPT → NUMBER/TEXT/CURRENCY. 


UI-элементы:

AI Autofill section.

Classify record, Summarize record, Research agent, Prompt completion.

Guidance (optional) / prompt editor.

Credit badge:

Classify = 1.

Summarize = 1.

Prompt = 1.

Research = 10.

Run icon in table cell.

Column header action: run for all rows in current view.

Kanban card action.

Record page action.

Loading state AI is thinking.

Error state: insufficient credits / provider unavailable / demo fallback.

Шаги:

Пользователь создаёт AI-атрибут или включает AI autofill на совместимом атрибуте.

Выбирает Autofill type.

Заполняет guidance/prompt.

Сохраняет attribute.

Запускает AI по одной ячейке, record page или колонке.

Backend собирает record context.

AI-сервис возвращает значение.

Backend валидирует значение по типу attribute.

Backend сохраняет Value и списывает credits.

UI показывает новое значение как обычное поле.

Данные:

Требуется расширение Attribute: aiType, aiPrompt/guidance, aiEnabled, aiCreditCost или хранение в config.

Требуется CreditTransaction (уточнить/добавить).

Значение сохраняется в обычных Value typed columns.

Для Classify результат должен совпадать с AttributeOption.

Activity: AI_VALUE_GENERATED или VALUE_UPDATED с source=AI.

API:

POST /api/objects/:objectId/attributes

body includes { config: { ai: { enabled, type, guidance } } }

POST /api/attributes/:attributeId/ai/run

body: { recordId }

POST /api/attributes/:attributeId/ai/run-view

body: { viewId, filters? }

GET /api/billing/credits / GET /api/ai/credits (уточнить).

Ошибки: 402 INSUFFICIENT_CREDITS, 422 INCOMPATIBLE_AI_TYPE, 429 RATE_LIMIT, 503 AI_PROVIDER_UNAVAILABLE.

Acceptance:

Classify Select/Multi-select запускается и записывает option tag, списывает 1 credit.

Summarize Text записывает summary, списывает 1 credit.

Prompt completion записывает Text/Number/Currency, списывает 1 credit.

Research agent записывает text brief, списывает 10 credits.

Запуск по заголовку колонки пересчитывает все rows текущего view.

Demo-mode возвращает детерминированные значения без внешнего ключа и без реального списания денег.

Edge-cases:

Недостаточно credits → запуск блокируется до вычисления.

Classify вернул тег вне options → remap/retry или validation error.

Research без internet/provider → demo fallback или provider error.

Bulk run частично упал → показать per-row status.

Повторный запуск перезаписывает значение и создаёт новую credit transaction (уточнить подтверждение overwrite).

[ГОТОВ БАТЧ: S025–S049]


---

S060 — Создать запись (+ New) с заполнением атрибутов

Экран / меню: Sidebar → Records → <Object> → + New <Object>; пример: Sidebar → Companies → + New Company или Sidebar → Deals → + New Deal.

Роль / доступ: Owner/Admin/Member с доступом READ_WRITE или FULL к объекту. READ может открыть таблицу, но не видит активную кнопку создания или получает disabled-state.

Предусловие: объект существует и не архивирован; у объекта есть Attribute[], включая primary/record-text attribute; required-атрибуты известны; пользователь авторизован и находится в org scope.

UI-элементы:

Кнопка + New <SingularName> в toolbar объекта.

В Board view — кнопка + New <Object> внутри колонки/stage.

Модалка/side-panel создания записи:

заголовок New Company / New Deal;

поля по атрибутам объекта;

required-маркеры;

typed editors: text input, number input, checkbox, date picker, select, multi-select, currency, user picker, relationship picker;

Create, Cancel, ×.

Inline validation под полями.

После создания: toast, добавление строки в таблицу или карточки в board.

Шаги:

Пользователь открывает объект.

Нажимает + New <Object>.

Система строит форму по metadata атрибутов.

Пользователь заполняет primary field и другие значения.

Пользователь выбирает значения для typed attributes.

Нажимает Create.

Backend валидирует required/unique/type.

Backend создаёт Record и связанные Value.

UI добавляет новую запись в текущий view, если она проходит фильтры; иначе показывает toast с ссылкой на запись.

Данные (Prisma):

Object: читается id, orgId, key, primaryAttributeId, archivedAt.

Attribute: читаются id, type, isRequired, isUnique, isSystem, config, options.

Record: создаётся orgId, objectId, createdById, updatedById, displayName, searchText.

Value: создаётся по одному значению на заполненный атрибут:

textValue для TEXT, EMAIL, PHONE, URL, SELECT;

longTextValue для LONG_TEXT;

numberValue для NUMBER;

booleanValue для BOOLEAN;

dateValue для DATE/DATETIME;

jsonValue для MULTI_SELECT, LOCATION/JSON;

userValueId для USER;

currencyAmount/currencyCode для CURRENCY.

RelationshipValue: создаётся для relationship/link fields.

Activity: пишется событие RECORD_CREATED; для каждого заполненного поля можно писать compact payload { attributeId, valuePreview } (уточнить детализацию).

API:

POST /api/objects/:objectId/records

body: { values: { [attributeIdOrKey]: unknown } }

response: { record, values, relationships?, activity }

errors:

401 UNAUTHORIZED;

403 FORBIDDEN;

404 OBJECT_NOT_FOUND;

409 UNIQUE_CONSTRAINT;

422 VALIDATION_ERROR.

Acceptance:

Кнопка + New <Object> видна только пользователю с правом записи.

Форма строится из Attribute[], а не hardcoded полей.

Required поля нельзя оставить пустыми.

Unique поля проверяются до записи.

Значения пишутся в правильные typed columns.

displayName строится из primary/record-text атрибута.

В timeline записи появляется RECORD_CREATED.

Новая запись появляется в table/board без reload, если проходит текущий view.

Edge-cases:

Текущий view отфильтрован так, что новая запись не подходит → показать toast Created, but hidden by current filters.

Required boolean false валиден.

Number 0 валиден.

Empty string для required text невалиден.

Relationship target из другого org → 422/403.

Demo-mode: создание работает локально без внешних ключей.

S061 — Открыть запись → record-страница

Экран / меню: Sidebar → Records → <Object> → table row click или Board card click → Record page.

Роль / доступ: Owner/Admin/Member с READ или выше к объекту. Для редактирования Details нужен READ_WRITE или FULL.

Предусловие: запись существует, не архивирована; пользователь имеет доступ к object; доступны metadata объекта и layout record page.

UI-элементы:

Хедер record page:

breadcrumbs: <Object> / <Record displayName>;

icon объекта;

имя записи;

action buttons, например Compose email.

Tabs:

Activity;

Emails;

Calls;

Notes;

Tasks;

Comments;

relationship tabs (если настроены).

Правая панель Details:

секции атрибутов;

поля и typed renderers;

inline-edit controls.

Lists block:

membership записи в списках;

Add to list.

Empty states по вкладкам.

Шаги:

Пользователь кликает строку/карточку.

Frontend открывает route записи.

Загружает record detail.

Загружает object metadata и attributes.

Загружает values, relationships, lists, activity summary.

Рендерит record page.

Пользователь может переключать tabs и редактировать Details при наличии прав.

Данные (Prisma):

Record: id, orgId, objectId, displayName, searchText, createdById, updatedById, createdAt, updatedAt, archivedAt.

Object: metadata объекта.

Attribute: все активные атрибуты.

Value: значения записи.

RelationshipValue: связи source/reverse.

ListEntry: членство записи в списках.

Activity: timeline записи.

Email, Note, Task: для соответствующих вкладок.

Activity: при просмотре не пишется.

API:

GET /api/records/:recordId

response: { record, object, attributes, values, relationships, lists, activitySummary }

GET /api/records/:recordId/activities

GET /api/records/:recordId/emails

GET /api/records/:recordId/notes

GET /api/records/:recordId/tasks

errors: 401, 403, 404.

Acceptance:

Клик по строке открывает record page.

Breadcrumbs показывают объект и displayName.

Details содержит значения всех видимых атрибутов.

Tabs отображаются в ожидаемом порядке.

Activity tab загружается.

Если запись архивирована, обычный route не показывает её как активную.

Пользователь без READ получает forbidden/not found state.

Edge-cases:

displayName пустой → fallback Untitled <Object> или Record ID (уточнить).

Attribute архивирован, но value есть → поле скрыто из active Details.

Relationship target недоступен → Restricted record.

Очень много Activity → пагинация.

Demo-mode: record page открывается на seeded/demo записях.

S062 — Inline-редактирование значения в таблице

Экран / меню: Object page → Table view → cell click / double click.

Роль / доступ: Owner/Admin/Member с READ_WRITE или FULL к объекту. READ видит значения, но не может открыть editor.

Предусловие: table view открыт; запись и атрибут активны; атрибут не isSystem; значение доступно для редактирования.

UI-элементы:

Editable cell.

Type-specific editor:

text input;

textarea for long text;

number input;

checkbox;

date/datetime picker;

select/multi-select dropdown;

currency input;

user picker;

relationship picker;

URL/email/phone inputs.

Save-on-blur или Enter (уточнить; дефолт — save-on-commit).

Escape cancels.

Loading spinner в ячейке.

Inline validation error.

Optimistic update и rollback on error.

Шаги:

Пользователь кликает editable cell.

UI открывает editor по типу атрибута.

Пользователь меняет значение.

Нажимает Enter/выбирает option/blur.

Frontend отправляет PATCH.

Backend валидирует тип/required/unique.

Backend обновляет Value.

UI показывает новое значение.

Activity timeline получает событие изменения.

Данные (Prisma):

Record.updatedAt, updatedById обновляются.

Value upsert:

существующее значение обновляется;

если значения не было — создаётся.

Для relationship — создаётся/удаляется/заменяется RelationshipValue.

Activity: VALUE_UPDATED с attributeId, oldValuePreview, newValuePreview.

Для primary attribute пересчитать Record.displayName/searchText.

API:

PATCH /api/records/:recordId/values/:attributeId

body: { value: unknown }

response: { record, value, activity }

Альтернатива batch:

PATCH /api/records/:recordId

body: { values: { [attributeId]: unknown } }

errors: 401, 403, 404, 409, 422.

Acceptance:

Inline edit работает для каждого поддержанного типа.

System fields read-only.

Required поле нельзя очистить.

Unique conflict показывает ошибку и откатывает UI.

Значение сохраняется в правильной typed колонке.

Изменение primary field обновляет displayName в таблице и record page.

Activity появляется в timeline.

Edge-cases:

Пользователь потерял доступ до сохранения → 403, rollback.

Запись архивирована в другой вкладке → 404/409.

Два пользователя меняют одну ячейку → last-write-wins или optimistic version conflict (уточнить).

Empty string normalizes to null для non-required text (уточнить).

Demo-mode без особенностей.

S063 — Удалить / архивировать запись

Экран / меню: Object page → row menu ⋮ → Archive record или Record page → ⋮ → Archive record.

Роль / доступ: Owner/Admin/Member с READ_WRITE или FULL (уточнить: destructive actions могут требовать FULL для некоторых объектов).

Предусловие: запись существует, активна; пользователь имеет write-доступ; запись не защищена системным процессом (уточнить).

UI-элементы:

Row menu ⋮.

Action Archive record.

Confirmation modal:

имя записи;

warning: запись будет скрыта из активных views;

Cancel;

destructive Archive.

Toast Record archived.

Optional undo (уточнить).

Если открыта record page — redirect назад к object table.

Шаги:

Пользователь открывает меню записи.

Выбирает Archive record.

Подтверждает действие.

Backend ставит Record.archivedAt.

UI удаляет строку/карточку из текущего view.

Activity фиксирует архивирование.

Прямой route записи показывает archived state или 404 (уточнить).

Данные (Prisma):

Record.archivedAt = now().

Record.updatedAt, updatedById.

Value не удаляются.

RelationshipValue не удаляются физически (уточнить; дефолт сохранять, но скрывать archived target).

ListEntry можно оставить, но списки должны фильтровать archived records.

Activity: RECORD_ARCHIVED.

API:

DELETE /api/records/:recordId

response: { record: { id, archivedAt } }

errors: 401, 403, 404, 409.

Повторный DELETE должен быть идемпотентным или возвращать already archived.

Acceptance:

Запись архивируется, не hard delete.

После refresh не видна в active table/board.

Values остаются в БД.

Timeline содержит событие archive.

Счётчик view уменьшается.

Relationship/list views не падают при archived record.

Edge-cases:

Архивирование записи, связанной relationship — target/source показывается как archived или скрывается.

Запись участвует в sequence/workflow → остановить/предупредить (уточнить).

Недостаточно прав → действие скрыто/403.

Ошибка сети после успешного архивирования → refetch восстанавливает факт.

Demo-mode без особенностей.

S064 — Поиск записей

Экран / меню: Object page → search input или global Quick actions / Search.

Роль / доступ: Owner/Admin/Member с READ к объекту. Результаты ограничиваются правами.

Предусловие: records имеют displayName/searchText; primary attribute определён; backend поддерживает query search.

UI-элементы:

Search input в object toolbar (точное расположение уточнить).

Placeholder Search <Object>.

Debounce.

Clear ×.

Loading state.

Empty state No records found.

Highlight matches (уточнить).

При global search — grouped results по объектам.

Шаги:

Пользователь вводит строку поиска.

Frontend debounce отправляет request.

Backend ищет по Record.searchText, displayName, primary text values и, возможно, email/domain (уточнить).

Результаты возвращаются с пагинацией.

Таблица обновляется.

Clear search возвращает view к исходной выборке.

Данные (Prisma):

Record.searchText: денормализованный текст для поиска.

Record.displayName: имя записи.

Value.textValue/longTextValue: может участвовать в search build.

Object/Attribute: определяют searchable fields (уточнить).

Activity: поиск не пишет события.

API:

GET /api/objects/:objectId/records?search=<query>&viewId=&limit=&cursor=

response: { records, nextCursor, totalCount? }

errors: 401, 403, 404, 422.

Для global:

GET /api/search?q=... (уточнить).

Acceptance:

Поиск находит запись по displayName.

Поиск находит запись по primary text/email/domain, если включено в searchText.

Результаты учитывают текущий object и права.

Empty state корректен.

Clear возвращает полный текущий view.

Поиск совместим с фильтрами: применяется поверх текущего view (дефолт).

Edge-cases:

Query короче 2 символов → не искать или искать (уточнить).

Спецсимволы не ломают SQL.

Архивированные записи не показываются.

Большой объём данных → индекс по searchText; возможно full-text search позже.

Demo-mode: search работает по demo-data.

S065 — Пагинация списка записей

Экран / меню: Object page → Table/Board → scroll / pagination footer.

Роль / доступ: любой пользователь с READ к объекту.

Предусловие: у object есть records; backend поддерживает limit/cursor; view filters/sorts стабильны.

UI-элементы:

Table:

infinite scroll или footer pagination (уточнить; дефолт — cursor/infinite scroll).

count внизу.

loading skeleton rows.

Board:

per-column lazy loading (уточнить).

Load more / virtualized scrolling (уточнить).

Шаги:

Пользователь открывает object view.

Frontend запрашивает первую страницу.

Пользователь скроллит вниз или нажимает Load more.

Frontend отправляет request с cursor.

Backend возвращает следующую страницу.

UI добавляет записи без дубликатов.

Данные (Prisma):

Record.id, createdAt, sort attribute values.

ViewSort определяет stable ordering.

Value подгружаются только для нужных records/columns.

Activity: не пишется.

API:

GET /api/objects/:objectId/records?viewId=&limit=50&cursor=<cursor>&search=&filters=&sorts=

response: { records, nextCursor, hasMore, totalCount? }

errors: 422 INVALID_CURSOR.

Acceptance:

Первая страница открывается быстро.

Следующая страница загружается по cursor.

Дубликатов между страницами нет.

Смена фильтра/сортировки сбрасывает cursor.

Count соответствует текущей выборке (если totalCount включён).

Empty state отличает нет records от нет records по фильтру.

Edge-cases:

Record добавлен между страницами → stable cursor не должен ломать список.

Record удалён между страницами → пропуск допустим, 500 недопустим.

Сортировка по non-unique field → cursor должен включать tie-breaker id.

Очень большой offset не использовать; только cursor.

Demo-mode без особенностей.

S066 — Bulk-выбор записей → массовое действие

Экран / меню: Object page → Table view → row checkboxes → bulk action bar.

Роль / доступ: READ для выбора; конкретные действия требуют READ_WRITE/FULL. Например Add to list, Send email, Run workflow, Enroll in sequence.

Предусловие: table view открыт; записи загружены; пользователь имеет доступ к bulk actions. В эталоне при выборе строк появляется нижняя панель Add to list, Send email, Run workflow, Enroll in sequence, More.

UI-элементы:

Header checkbox.

Row checkboxes.

Bulk action bar:

selected count;

Add to list;

Send email;

Run workflow;

Enroll in sequence;

More;

Clear selection.

Modal для каждого действия.

Toast/progress for bulk job.

Шаги:

Пользователь отмечает одну или несколько строк.

Появляется bulk action bar.

Пользователь выбирает действие.

UI открывает modal/confirmation.

Backend выполняет действие синхронно или создаёт job.

UI показывает progress/result.

Selection очищается или остаётся (уточнить).

Данные (Prisma):

Читаются Record.id[].

В зависимости от действия:

ListEntry для Add to list;

Email/outbox для Send email;

WorkflowRun (модель уточнить) для Run workflow;

sequence enrollment (модель уточнить) для Enroll in sequence.

Activity: action-specific events на каждой записи.

API:

POST /api/records/bulk

body: { recordIds: string[], action: string, payload: unknown } (уточнить endpoint).

Более явно:

POST /api/lists/:listId/entries/bulk;

POST /api/emails/bulk/draft;

POST /api/workflows/:workflowId/run;

POST /api/sequences/:sequenceId/enroll.

errors: 403, 404, 409, 422, 207 PARTIAL_SUCCESS (уточнить формат).

Acceptance:

Checkbox selection работает.

Bulk bar появляется только при selected count > 0.

Header checkbox выбирает текущую страницу.

Actions проверяют права.

Массовое действие пишет данные для всех доступных records.

Partial failure отображается по строкам/summary.

Selection можно очистить.

Edge-cases:

Выбраны records, часть скрыта после фильтра → selection policy (уточнить; дефолт — selection сохраняется до clear).

Выбраны records из разных objects → в object table невозможно; global bulk требует проверки.

Один record архивирован до action → partial failure.

Большой bulk → job queue.

Demo-mode: email/sequence выполняются в demo-safe режиме.

S067 — Right-click на значении → когда создано/обновлено

Экран / меню: Object page → Table cell → right click / context menu → field history.

Роль / доступ: пользователь с READ к записи; для просмотра audit/history может требоваться READ_WRITE или FULL (уточнить).

Предусловие: значение существует или было изменено; Activity/audit содержит информацию о created/updated. В источниках scenario catalog фиксирует right-click на значении для просмотра времени создания/обновления.

UI-элементы:

Context menu по cell:

View value details;

Copy value;

Clear value (если write access);

Created at;

Last updated at;

Updated by;

View activity.

Popover/sidebar:

attribute name;

current value;

created timestamp;

updated timestamp;

actor.

Empty state: No update history.

Шаги:

Пользователь right-click по ячейке.

Открывается context menu.

Пользователь выбирает details/history.

Frontend запрашивает audit для recordId + attributeId.

UI показывает created/updated metadata.

Пользователь может перейти в Activity timeline.

Данные (Prisma):

В текущей Value модели нужно хранить createdAt/updatedAt/updatedById (уточнить наличие в schema; если отсутствует — добавить).

Activity хранит события VALUE_UPDATED с payload.

User для actor name.

Для system/derived values использовать source record/task timestamps.

API:

GET /api/records/:recordId/values/:attributeId/history (уточнить endpoint)

response: { createdAt, createdBy, updatedAt, updatedBy, events }

или GET /api/records/:recordId/activities?attributeId=...

errors: 401, 403, 404.

Acceptance:

Right-click открывает context menu.

Для значения показывается last updated timestamp.

Actor отображается, если известен.

После inline edit updatedAt меняется.

Пользователь без write access не видит destructive actions.

Переход к activity показывает связанные события.

Edge-cases:

История отсутствует для старых значений → показать fallback по Record.createdAt.

Значение пустое, но ранее было → history still available (уточнить).

User удалён → Deleted user/historical name.

Timezone отображать в user/workspace timezone.

Demo-mode: seeded history может быть пустой.

S080 — Table-вид с типизированными колонками

Экран / меню: Sidebar → Records → <Object> → View selector → Table view.

Роль / доступ: Owner/Admin/Member с READ к объекту/view. Редактирование колонок требует READ_WRITE/FULL на view/object (уточнить).

Предусловие: object имеет хотя бы один View(type=TABLE); view содержит ViewColumn[]; records/values доступны.

UI-элементы:

View selector: All Companies, All Deals и т.п.

View settings.

Filter/sort chips.

Table header.

Typed columns:

text;

number;

boolean;

date/datetime;

select/multi-select;

currency;

user;

relationship;

URL/email/phone;

JSON/location.

Row checkbox.

+ Add column.

Footer count и + Add calculation.

Шаги:

Пользователь открывает объект.

Система выбирает table view.

Backend возвращает view config и records.

Frontend строит колонки по ViewColumn + Attribute.

Cells рендерятся по типам.

Пользователь может скроллить, редактировать, сортировать, фильтровать.

Данные (Prisma):

View: type=TABLE, objectId, name.

ViewColumn: viewId, attributeId, order, width, config.

Attribute: type/config/options.

Record: rows.

Value: typed cell values.

RelationshipValue: relationship cells.

Activity: просмотр не пишет.

API:

GET /api/objects/:objectId/views

GET /api/views/:viewId

GET /api/objects/:objectId/records?viewId=&limit=&cursor=

response: { view, columns, records, nextCursor, count }

errors: 401, 403, 404, 422.

Acceptance:

Table строится из metadata.

Каждый тип отображается корректным renderer/editor.

Columns идут в порядке ViewColumn.order.

Width сохраняется (если реализовано).

Relationship/user/select отображаются не raw JSON, а chips/badges.

Таблица работает при пустых records.

Edge-cases:

ViewColumn с archived attribute → скрыть/invalid-state.

Unknown attribute type → fallback renderer Unsupported.

Много колонок → horizontal scroll.

Много строк → pagination/virtualization.

Demo-mode: table работает на seed data.

S081 — Board (kanban) по select/status-атрибуту

Экран / меню: Sidebar → Records → Deals → View selector → Deals overview / Board.

Роль / доступ: READ для просмотра; READ_WRITE для drag-drop/change stage; FULL для настройки board.

Предусловие: есть View(type=BOARD); groupByAttributeId указывает на SELECT, STATUS или config.kind="STATUS" attribute; у атрибута есть AttributeOption[].

UI-элементы:

Board toolbar:

view selector;

View settings;

sort/filter chips;

Import / Export;

+ New Deal.

Columns:

option label;

color marker;

count;

+ New <Object>.

Cards:

displayName;

selected card fields;

badges;

avatars;

activity age.

Empty column state.

Шаги:

Пользователь открывает Board view.

Backend группирует records по groupBy attribute.

UI рендерит колонку на каждую option + No stage.

Cards распределяются по значению select/status.

Пользователь открывает card или создаёт record в колонке.

При создании в колонке значение groupBy проставляется автоматически.

Данные (Prisma):

View.type=BOARD.

View.groupByAttributeId.

AttributeOption для колонок.

Record/Value для cards.

ViewColumn или View.config.cardFields для card fields (уточнить).

Activity: просмотр не пишет; drag/create пишет.

API:

GET /api/objects/:objectId/records?viewId=<boardViewId>

response grouped or flat (уточнить; дефолт backend возвращает grouped columns).

PATCH /api/records/:recordId/values/:groupByAttributeId для смены стадии.

errors: 422 если groupBy attribute не select/status.

Acceptance:

Board группирует записи по options.

Есть колонка No stage для пустого значения.

Counts по колонкам корректны.

Cards открывают record page.

Фильтры view применяются к board.

Создание из колонки проставляет stage/status.

Edge-cases:

У groupBy attribute нет options → setup empty state.

Option archived → historical cards показывать в archived column или No stage (уточнить).

Record с unknown option value → Unknown.

Много карточек в колонке → per-column pagination.

Demo-mode: Deals board seeded stages.

S082 — Переключатель Table ↔ Board

Экран / меню: Object page → view toolbar → View type switcher Table / Board.

Роль / доступ: READ для переключения между существующими views; создание/изменение типа view требует READ_WRITE/FULL.

Предусловие: для object есть table и board views или текущий view можно переключить на другой type (уточнить). Board требует groupBy select/status.

UI-элементы:

Toggle/segmented control Table | Board.

View selector.

Если Board ещё не настроен:

setup modal Choose grouping attribute.

Loading state при смене.

URL state: ?viewId= или route view id.

Шаги:

Пользователь открывает object.

Нажимает Board.

Если board view существует — UI загружает его.

Если нет — предлагает создать board view и выбрать groupBy.

Пользователь возвращается в Table.

Table view восстанавливает свои columns/filters/sorts.

Данные (Prisma):

View.type: TABLE или BOARD.

View.groupByAttributeId для board.

ViewColumn, ViewFilter, ViewSort сохраняются отдельно по view.

Activity: не пишется; это view navigation.

API:

GET /api/objects/:objectId/views

GET /api/views/:viewId

POST /api/objects/:objectId/views при создании нового board/table.

errors: 422 BOARD_REQUIRES_GROUP_BY.

Acceptance:

Переключатель меняет представление без потери данных.

Table и Board имеют независимые настройки.

URL/refresh сохраняет выбранный view.

Если Board невозможен, UI объясняет, что нужен select/status attribute.

Права применяются одинаково.

Переключение не создаёт дубликаты views без явного действия.

Edge-cases:

У объекта нет select/status атрибутов → Board disabled/setup prompt.

Текущий фильтр даёт 0 cards → empty filter state.

Быстрое переключение → отмена предыдущих requests.

View удалён в другой вкладке → fallback на default view.

Demo-mode без особенностей.

S083 — Фильтр: добавить условие

Экран / меню: Object page → View toolbar → Filter → + Add condition.

Роль / доступ: READ может применять временный фильтр (уточнить); сохранение фильтра в view требует READ_WRITE/FULL.

Предусловие: object имеет attributes; view открыт; backend поддерживает фильтры по типам.

UI-элементы:

Кнопка/chip Filter.

Filter popover/panel.

+ Add condition.

Condition row:

attribute dropdown;

operator dropdown;

value input по типу;

remove condition.

Apply.

Save view / unsaved changes indicator.

Filter chips в toolbar.

Шаги:

Пользователь нажимает Filter.

Нажимает + Add condition.

Выбирает attribute.

Выбирает operator.

Вводит/выбирает value.

Нажимает Apply.

Table/board обновляется.

Пользователь сохраняет фильтр в view или оставляет временным (уточнить).

Данные (Prisma):

ViewFilter: viewId, attributeId, operator, value, order, groupId? (для advanced later).

Для временных фильтров БД не меняется.

Record/Value читаются с условиями.

Activity: не пишется.

API:

PUT /api/views/:viewId/filters

body: { filters: [{ attributeId, operator, value }] }

GET /api/objects/:objectId/records?viewId=&filters=<json>

errors: 422 INVALID_FILTER.

Acceptance:

Можно добавить одно условие.

Условие отображается chip-ом.

Records обновляются по условию.

Filter сохраняется в view после Save.

Удаление условия возвращает записи.

Невалидный value показывает inline error.

Edge-cases:

Attribute archived → filter invalid.

Operator не подходит типу → скрыть или 422.

Empty value допустим только для is_empty/is_not_empty.

Фильтр по relationship/nested attribute (уточнить; сложная фаза).

Demo-mode без особенностей.

S084 — Операторы фильтра: eq / neq / contains / gt / lt / in / is_empty / is_not_empty

Экран / меню: Object page → Filter → condition row → Operator dropdown.

Роль / доступ: READ для временного применения; READ_WRITE/FULL для сохранения.

Предусловие: выбран attribute; backend знает совместимые операторы по типу.

UI-элементы:

Operator dropdown:

equals;

does not equal;

contains;

greater than;

less than;

is one of;

is empty;

is not empty.

Value editor зависит от operator:

hidden for empty operators;

multi-picker for in;

number/date input for gt/lt.

Inline validation.

Шаги:

Пользователь создаёт condition.

Выбирает attribute.

Открывает operator dropdown.

UI показывает только совместимые операторы.

Пользователь выбирает operator и value.

Применяет фильтр.

Backend возвращает filtered records.

Данные (Prisma):

ViewFilter.operator.

ViewFilter.value как JSON.

Typed query строится по Attribute.type и соответствующей колонке Value.

Activity: не пишется.

API:

PUT /api/views/:viewId/filters

body:

TypeScript
{
  filters: Array<{
    attributeId: string;
    operator: "eq" | "neq" | "contains" | "gt" | "lt" | "in" | "is_empty" | "is_not_empty";
    value?: unknown;
  }>;
}

errors: 422 UNSUPPORTED_OPERATOR_FOR_TYPE.

Acceptance:

Операторы доступны по типу атрибута.

contains работает для text-like.

gt/lt работает для number/date/currency.

in работает для select/multi-select/user.

is_empty/is_not_empty работает для всех nullable типов.

Неверная комбинация operator/type невозможна через UI и отклоняется backend.

Edge-cases:

contains для email/url — разрешить как text-like.

Currency gt/lt при разных currencyCode → reject или normalize (уточнить).

Multi-select contains vs in семантика (уточнить; дефолт: contains any selected option).

Relationship empty — нет RelationshipValue.

Demo-mode без особенностей.

S085 — Advanced filter: комбинация AND/OR + группировка

Экран / меню: Object page → Filter → Advanced filters.

Роль / доступ: READ для временного использования; сохранение в view — READ_WRITE/FULL.

Предусловие: базовые фильтры работают; UI поддерживает группы; backend может интерпретировать nested boolean expression.

UI-элементы:

Advanced filters toggle.

Group container.

AND / OR selector на уровне группы.

+ Add condition.

+ Add group.

Indentation/visual nesting.

Remove group.

Preview chips (уточнить).

Apply, Save view.

Шаги:

Пользователь открывает Filter.

Включает Advanced.

Создаёт группу AND.

Добавляет условия.

Создаёт вложенную группу OR.

Применяет фильтр.

Backend строит запрос по дереву условий.

Пользователь сохраняет view.

Данные (Prisma):

В источниках указано, что View нельзя хранить только JSON; колонки/фильтры/сортировки должны быть отдельными таблицами. Для advanced grouping текущий ViewFilter должен иметь groupId, parentGroupId, logicalOperator, order или отдельную ViewFilterGroup (уточнить/добавить).

ViewFilter.value JSON.

Activity: не пишется.

API:

PUT /api/views/:viewId/filters

body:

TypeScript
{
  root: {
    op: "AND" | "OR";
    children: Array<
      | { attributeId: string; operator: string; value?: unknown }
      | { op: "AND" | "OR"; children: unknown[] }
    >;
  }
}

errors: 422 INVALID_FILTER_TREE.

Acceptance:

Можно создать AND-группу.

Можно создать OR-группу.

Можно вложить группу в группу.

Результаты соответствуют boolean logic.

Фильтр сохраняется и восстанавливается после refresh.

Невалидное дерево не сохраняется.

Edge-cases:

Пустая группа → validation error или игнор (уточнить).

Слишком глубокая вложенность → ограничить, например 5 уровней (уточнить).

Attribute archived внутри группы → mark invalid.

OR по разным typed values требует корректный query builder.

Demo-mode без особенностей.

S086 — Сортировка (атрибут + asc/desc)

Экран / меню: Object page → toolbar → Sorted by ... или column header → Sort ascending/descending.

Роль / доступ: READ для временной сортировки; сохранение сортировки в view — READ_WRITE/FULL.

Предусловие: view открыт; выбран sortable attribute; backend умеет сортировать по typed value.

UI-элементы:

Chip Sorted by <Attribute>.

Sort popover:

attribute dropdown;

direction Ascending / Descending;

remove sort;

add sort (multi-sort уточнить).

Column header sort icon.

Save view.

Шаги:

Пользователь нажимает sort chip или column header.

Выбирает attribute.

Выбирает asc или desc.

Таблица/board перезагружается.

Пользователь сохраняет view.

Данные (Prisma):

ViewSort: viewId, attributeId, direction, order.

Query сортирует по typed value column.

Tie-breaker: Record.id или Record.createdAt.

Activity: не пишется.

API:

PUT /api/views/:viewId/sorts

body: { sorts: [{ attributeId, direction: "asc" | "desc" }] }

GET /api/objects/:objectId/records?sorts=<json>

errors: 422 UNSORTABLE_ATTRIBUTE.

Acceptance:

Сортировка по text/number/date/currency работает корректно.

Direction меняется.

Sort chip отображается.

После Save сортировка сохраняется.

Pagination остаётся стабильной.

Empty values сортируются предсказуемо (уточнить; дефолт — last).

Edge-cases:

Сортировка по multi-select/json/relationship сложная → запретить или определить display sort (уточнить).

Currency mixed codes → reject/normalize.

Attribute archived → sort invalid.

Быстрая смена sort отменяет предыдущий request.

Demo-mode без особенностей.

S087 — Выбор/порядок/ширина колонок (+ колонка)

Экран / меню: Object page → Table header → + Add column и View settings → Columns.

Роль / доступ: READ_WRITE/FULL к view/object для сохранения. READ может временно менять local view (уточнить).

Предусловие: table view открыт; есть доступные attributes; view columns загружены.

UI-элементы:

+ Add column.

Column menu:

список direct attributes;

relationship/nested attributes;

Create new attribute.

View settings → Columns:

visible columns;

hidden attributes;

drag reorder;

width controls.

Column header drag.

Resize handle.

Remove/hide column.

Шаги:

Пользователь нажимает + Add column.

Выбирает attribute.

Колонка появляется в таблице.

Пользователь меняет порядок drag-and-drop.

Пользователь меняет ширину.

View сохраняет columns config.

Данные (Prisma):

ViewColumn: viewId, attributeId, order, width, config.

Для nested relationship columns — config.path.

Attribute не меняется, если добавляют существующую колонку.

Activity: не пишется.

API:

PUT /api/views/:viewId/columns

body: { columns: [{ attributeId, order, width?, config? }] }

PATCH /api/views/:viewId/columns/reorder (если отдельный endpoint; уточнить).

errors: 403, 404, 409, 422.

Acceptance:

Можно добавить существующий attribute как колонку.

Можно скрыть колонку.

Можно изменить порядок колонок.

Можно изменить ширину и сохранить после refresh.

Колонки не дублируются в одном view.

Create new attribute создаёт attribute и сразу добавляет колонку.

Edge-cases:

Attribute уже добавлен → disabled/checkmark.

Attribute archived → не показывать в add menu.

Width слишком мала/большая → min/max.

Concurrent column edits → last-write-wins или conflict (уточнить).

Demo-mode без особенностей.

S088 — Сохранить вид (Save view) / Save as new

Экран / меню: Object page → View toolbar → unsaved changes → Save view / Save as new.

Роль / доступ: READ_WRITE/FULL к view для Save; создание нового view требует create-view permission (уточнить).

Предусловие: пользователь изменил filters/sorts/columns/type/grouping; текущий view существует или это temporary view.

UI-элементы:

Unsaved changes indicator.

Button/dropdown Save view.

Menu:

Save changes;

Save as new view;

Discard changes.

Modal Save as new:

View name;

Type;

visibility/permissions (уточнить);

Create view.

Toast success.

Шаги:

Пользователь меняет columns/filter/sort.

UI показывает unsaved state.

Пользователь нажимает Save view.

Для save — backend обновляет текущий view.

Для save as — пользователь вводит имя.

Backend создаёт новый view с текущей конфигурацией.

View selector переключается на новый view.

Данные (Prisma):

View: name, type, groupByAttributeId, updatedAt.

ViewColumn, ViewFilter, ViewSort заменяются/обновляются.

createdById для нового view.

Activity: не record activity; metadata audit (уточнить).

API:

PATCH /api/views/:viewId

PUT /api/views/:viewId/columns

PUT /api/views/:viewId/filters

PUT /api/views/:viewId/sorts

POST /api/objects/:objectId/views

body: { name, type, columns, filters, sorts, groupByAttributeId? }

errors: 403, 404, 409, 422.

Acceptance:

Unsaved changes появляются после изменения view config.

Save view сохраняет текущий view.

Save as new создаёт отдельный view.

После refresh конфигурация сохраняется.

Новый view появляется в dropdown.

Пользователь без прав не может сохранить, но может discard.

Edge-cases:

View удалён в другой вкладке → 404, предложить Save as new.

Name duplicate → 409.

Board view без groupBy → 422.

Partial save columns/filters/sorts должен быть transactional (уточнить).

Demo-mode без особенностей.

S089 — Дропдаун выбора сохранённого вида

Экран / меню: Object page → header → View selector.

Роль / доступ: READ к object/view. Скрытые/private views показываются только permitted users (уточнить).

Предусловие: у объекта есть один или несколько View; пользователь имеет доступ минимум к одному view.

UI-элементы:

View selector dropdown.

Список views:

All Companies;

All Deals;

custom views;

board/table icons;

active checkmark.

Create new view.

Manage views (уточнить).

Search views (уточнить).

Empty state, если нет custom views.

Шаги:

Пользователь открывает object page.

Нажимает dropdown текущего view.

Выбирает другой saved view.

Frontend загружает view config.

Records перезагружаются по columns/filters/sorts/type.

URL обновляется.

Данные (Prisma):

View: список views для objectId/listId.

ViewColumn/ViewFilter/ViewSort — config выбранного view.

createdById, permissions (уточнить).

Activity: не пишется.

API:

GET /api/objects/:objectId/views

response: { views: [{ id, name, type, isDefault?, createdById }] }

GET /api/views/:viewId

errors: 403, 404.

Acceptance:

Dropdown показывает все доступные views объекта.

Активный view отмечен.

Выбор view меняет table/board.

URL/refresh сохраняет выбранный view.

View, к которому нет доступа, не отображается.

Если выбранный view удалён, fallback на default view.

Edge-cases:

У объекта нет view → создать default view repair (уточнить).

Много views → search/scroll.

Duplicate view names → разрешить с owner/type hint или запретить (уточнить).

Last used view per user (уточнить).

Demo-mode без особенностей.

S090 — Drag-drop карточки в Board → смена стадии

Экран / меню: Object page → Board view → drag card between columns.

Роль / доступ: READ_WRITE или FULL к объекту. READ может перетаскивать визуально не должен; drag disabled.

Предусловие: board view открыт; groupByAttributeId — select/status; target column option active; record not archived.

UI-элементы:

Draggable board cards.

Drop zones in columns.

Drag ghost/placeholder.

Column hover highlight.

Optimistic card movement.

Error toast + rollback.

Activity age/status update.

Шаги:

Пользователь берёт card.

Перетаскивает в другую колонку.

UI optimistic перемещает card.

Frontend отправляет PATCH stage/status value.

Backend валидирует option и права.

Backend обновляет Value.

UI подтверждает новое положение.

Activity записывает изменение stage.

Данные (Prisma):

View.groupByAttributeId.

AttributeOption target column.

Value по groupBy attribute:

old option → new option.

Record.updatedAt/updatedById.

Activity: VALUE_UPDATED с old/new stage.

Если board поддерживает ordering внутри колонки — нужна position в view/list-specific model (уточнить; для object board нет явного поля).

API:

PATCH /api/records/:recordId/values/:attributeId

body: { value: optionValue | null }

или PATCH /api/crm/records/:recordId/stage (если legacy endpoint; уточнить)

errors: 403, 404, 409, 422.

Acceptance:

Drag между колонками меняет значение groupBy атрибута.

Счётчики колонок обновляются.

После refresh card остаётся в новой колонке.

Ошибка откатывает card в старую колонку.

Drop в No stage очищает значение (если разрешено).

Activity показывает stage change.

Edge-cases:

Target option archived → drop disabled.

Record больше не проходит фильтр после смены stage → card исчезает с toast.

Required stage нельзя очистить в No stage.

Concurrent change → last-write-wins или conflict (уточнить).

Demo-mode без особенностей.

S091 — Группировка Board по другому status-атрибуту

Экран / меню: Board view → View settings → Board settings → Group by.

Роль / доступ: READ_WRITE/FULL к view.

Предусловие: объект имеет минимум один select/status attribute с options; board view открыт.

UI-элементы:

View settings.

Board settings.

Group by dropdown.

Список eligible attributes:

status/select;

maybe user/date grouping (уточнить; каталог требует status-атрибут).

Preview columns.

Save.

Warning, если текущие cards уйдут в другие columns.

Шаги:

Пользователь открывает Board settings.

Открывает Group by.

Выбирает другой status/select attribute.

UI перестраивает колонки по options нового атрибута.

Пользователь сохраняет view.

Backend обновляет View.groupByAttributeId.

Данные (Prisma):

View.groupByAttributeId меняется.

ViewColumn/ViewFilter/ViewSort не обязательно меняются.

Records/Values не изменяются.

Activity: не record activity; view metadata audit (уточнить).

API:

PATCH /api/views/:viewId

body: { groupByAttributeId }

response: { view }

GET /api/objects/:objectId/records?viewId=...

errors:

422 GROUP_BY_ATTRIBUTE_NOT_SELECT_OR_STATUS;

404 ATTRIBUTE_NOT_FOUND.

Acceptance:

Dropdown показывает только допустимые groupBy attributes.

После выбора board columns соответствуют options нового атрибута.

После Save настройка сохраняется.

После refresh board группируется по новому атрибуту.

Records без значения попадают в No stage.

Фильтры view продолжают применяться.

Edge-cases:

Новый groupBy attribute без options → empty setup.

Attribute archived после выбора → 409/422.

Старый groupBy required, новый optional — No stage появляется.

Board cards field settings остаются валидными.

Demo-mode без особенностей.

S092 — Счётчик записей в виде + per-column calculations

Экран / меню: Object page → Table footer / Board column headers → count / + Add calculation.

Роль / доступ: READ для просмотра counts/calculations; настройка calculations требует READ_WRITE/FULL к view.

Предусловие: view открыт; backend может посчитать count и агрегаты по filtered records. В эталоне table footer показывает count и + Add calculation; board columns показывают count.

UI-элементы:

Table footer:

общий count, например 804 count;

под колонками + Add calculation;

calculation result: Sum, Average, Min, Max, Count, Empty count (уточнить набор).

Board:

count в header каждой колонки.

optional sum per column (уточнить).

Calculation menu:

выбрать aggregate;

выбрать column/attribute;

display formatting.

Loading state для aggregate.

Шаги:

Пользователь открывает view.

Система показывает total count.

Пользователь нажимает + Add calculation под колонкой.

Выбирает тип расчёта.

Backend считает aggregate по текущему view filters/search.

UI показывает результат.

Calculation сохраняется в view (уточнить).

Данные (Prisma):

Count считается по Record с учетом filters/search/archivedAt.

Calculation config хранится в ViewColumn.config.calculation или отдельной модели (уточнить).

Numeric/currency calculations читают Value.numberValue или currencyAmount.

Select/multi-select calculations могут считать count by option (уточнить).

Activity: не пишется.

API:

GET /api/objects/:objectId/records?viewId=...

response includes totalCount?.

POST /api/views/:viewId/calculations (уточнить endpoint)

body: { attributeId, type: "count" | "sum" | "avg" | "min" | "max" }

GET /api/views/:viewId/calculations

errors: 422 UNSUPPORTED_CALCULATION_FOR_TYPE.

Acceptance:

Table показывает общий count.

Board показывает count по колонкам.

Calculation можно добавить под поддерживаемую колонку.

Sum/avg работают для number/currency.

Count работает для любого типа.

Calculation учитывает текущие filters/search.

После refresh сохранённая calculation отображается.

Edge-cases:

Currency с разными codes → aggregate запрещён или требует normalization (уточнить).

Null values исключаются из sum/avg.

Большая выборка → aggregate должен считаться SQL-запросом, не на frontend.

Count при pagination показывает общий count, не только loaded rows.

Demo-mode без особенностей.

[ГОТОВ БАТЧ: S060–S092]


---

S100 — Создать список с нуля

Экран / меню: Sidebar → Lists → All lists / + New list или Settings → Data → Lists → Create list.

Роль / доступ: Owner/Admin или Member с правом создавать Lists. По модели прав Attio Lists имеют отдельные permissions; уровень FULL даёт управление настройками/правами, READ_WRITE — работу с entries без изменения структуры. 


Предусловие: пользователь авторизован; workspace существует; выбран parent object, например People, Companies, Deals; объект не архивирован.

UI-элементы:

New list / Create list.

Модалка:

Name — имя списка.

Parent object dropdown.

Icon / Color (уточнить).

Start from scratch.

Create from template.

Create list, Cancel.

После создания:

список появляется в sidebar Lists;

открывается пустой list page;

view selector All records;

View settings;

Add <ParentObject>.

Empty-state: No records in this list yet.

Шаги:

Пользователь открывает Lists.

Нажимает New list.

Выбирает Start from scratch.

Вводит имя, например Event Invitees.

Выбирает parent object, например People.

Нажимает Create list.

Backend создаёт List и default views.

UI добавляет список в sidebar и открывает страницу списка.

Данные(Prisma):

List: orgId, objectId/parentObjectId, name, description?, icon?, color?, createdById, archivedAt.

View: default table view для списка; опционально default board view.

ViewColumn: первичные колонки parent object + list-stage (уточнить дефолтный набор).

ListEntry: не создаётся, пока записи не добавлены.

Activity: record-level activity не пишется. Нужен workspace/list audit event (уточнить).

MASTER_TZ фиксирует List как подмножество записей под процесс с собственными list-атрибутами и entries. 


API:

POST /api/lists

body:

TypeScript
{
  name: string;
  objectId: string;
  description?: string;
  icon?: string;
  color?: string;
}
- response: `{ list, defaultView }`
- errors:
  - `401 UNAUTHORIZED`;
  - `403 FORBIDDEN`;
  - `404 PARENT_OBJECT_NOT_FOUND`;
  - `409 LIST_NAME_CONFLICT`;
  - `422 VALIDATION_ERROR`.

GET /api/lists — обновление sidebar.

Acceptance:

Список создаётся с выбранным parent object.

Список появляется в sidebar Lists.

Открывается list page с пустым состоянием.

У списка есть default table view.

Parent object нельзя изменить после создания (дефолт; уточнить).

Повтор имени в рамках org обрабатывается валидно: запрет или auto-suffix (уточнить).

Edge-cases:

Parent object архивирован → создание запрещено.

Name пустой → 422.

Пользователь без прав → кнопка скрыта или 403.

Создание дважды из-за retry → idempotency по client request id (уточнить).

Demo-mode: список создаётся без внешних ключей.

S101 — Создать список из шаблона

Экран / меню: Sidebar → Lists → New list → Templates или List page → Templates.

Роль / доступ: Owner/Admin или Member с правом создавать Lists.

Предусловие: доступна библиотека list templates; выбран template совместим с parent object. В storyboard для Event Invitees показана модалка Templates с категориями Sales, Fundraising, Recruiting, Marketing, Customer Success, Productivity, Finance, HR, Operations, IT, Startups, Venture Capital, поиском, Start from Scratch, Preview template. 


UI-элементы:

Templates modal.

Категории шаблонов.

Search for templates....

Template cards/rows:

Recruiting;

Customer success;

Fundraising;

Event Invitees;

другие (уточнить).

Preview template.

Use template.

Start from Scratch.

Preview:

parent object;

stages;

list attributes;

default views.

Шаги:

Пользователь нажимает New list.

Выбирает Templates.

Фильтрует категорию, например Recruiting.

Открывает preview.

Проверяет parent object, stages, attributes.

Вводит имя списка.

Нажимает Use template.

Backend создаёт список, list-атрибуты, stages и views.

Данные(Prisma):

List: создаётся из template config.

ListEntry: не создаётся, если template без demo-data.

ListAttribute/ListEntryValue: требуются для list-specific fields; если в текущей схеме их нет, добавить (уточнить).

Attribute: не засорять parent object list-specific полями.

View: table/board views из шаблона.

AttributeOption: stage/options для list-stage или list-status.

Activity: metadata audit (уточнить).

API:

GET /api/list-templates

response: { templates: [...] }

GET /api/list-templates/:templateId

POST /api/lists/from-template

body:

TypeScript
{
  templateId: string;
  name: string;
  objectId?: string;
}
- response: `{ list, attributes, views }`
- errors: `401`, `403`, `404`, `409`, `422`.

Acceptance:

Пользователь видит галерею шаблонов.

Можно preview до создания.

Template создаёт список с корректным parent object.

Template создаёт list-specific attributes.

Template создаёт board/table views.

Список появляется в sidebar.

Edge-cases:

Template требует object People, а пользователь выбирает Companies → запрет или mapping (уточнить).

Template содержит stage option, уже существующую в списке невозможно, так как список новый.

Библиотека templates недоступна → fallback Start from Scratch.

Demo-mode: templates локальные, без внешнего каталога.

S102 — List-атрибут

Экран / меню: List page → View settings / + Add column → Create list attribute или Settings → Data → Lists → <List> → Attributes.

Роль / доступ: Owner/Admin или пользователь с FULL доступом к списку. READ_WRITE может заполнять list values, но не менять структуру.

Предусловие: список существует; parent object выбран; list-specific field не должен становиться атрибутом parent object.

UI-элементы:

+ Add column.

Attribute menu разделяет:

Parent record attributes;

List attributes.

Create list attribute.

Модалка:

Attribute Type;

Name;

Description;

Required (уточнить);

Options, если select/status.

В table: list-attribute columns рядом с parent columns.

В import mapping: доступны parent attributes и list attributes.

Шаги:

Пользователь открывает list page.

Нажимает + Add column.

Выбирает Create list attribute.

Создаёт поле, например RSVP, Dietary requirements, Summary.

Поле появляется только в этом списке.

Пользователь заполняет значение для конкретного ListEntry.

Данные(Prisma):

Требуемая модель: ListAttribute: orgId, listId, key, name, type, config, options, isRequired, order, archivedAt.

Требуемая модель: ListEntryValue: orgId, listEntryId, listAttributeId, typed columns аналогично Value.

Если текущая схема использует общий Attribute с listId, это нужно подтвердить (уточнить).

ListEntry: связывает parent Record и список.

Activity: при создании list attribute — list metadata audit; при изменении list value — activity на parent record и/или list entry (уточнить).

API:

GET /api/lists/:listId/attributes

POST /api/lists/:listId/attributes

body: { name, type, description?, options?, isRequired?, config? }

response: { listAttribute }

PATCH /api/list-entries/:entryId/values/:listAttributeId

body: { value: unknown }

errors: 401, 403, 404, 409, 422.

Acceptance:

List-атрибут создаётся только внутри списка.

Он не появляется в parent object settings.

Значения различаются по entry, а не по record глобально.

Один и тот же record в двух списках может иметь разные list-значения.

List-атрибуты доступны в list table/board/import.

Архивирование list-атрибута не удаляет parent record.

Edge-cases:

Record добавлен в список дважды (если add separate entry разрешён) → list-values принадлежат entry, не record.

Required list attribute при add entry → либо требовать сразу, либо разрешить пустой draft (уточнить).

Дубликат key в list → 409.

Bulk update list attribute по нескольким entries → отдельный сценарий позже.

Demo-mode без особенностей.

S103 — Добавить запись в список

Экран / меню: Record page → Details → Lists → Add to list или Object table → row/bulk action → Add to list.

Роль / доступ: Member/Admin с READ к parent record и READ_WRITE к target list. Для создания нового list нужен отдельный permission.

Предусловие: list существует; record принадлежит parent object списка; record не архивирован.

UI-элементы:

На record page:

блок Lists;

Add to list.

На table/bulk:

bulk action Add to list.

Modal/popover:

Choose list;

Search lists...;

список доступных lists;

Create new list;

Add.

Если список имеет required list attributes:

форма заполнения initial list values (уточнить).

Toast: Added to <List> + Go to list.

Шаги:

Пользователь выбирает запись.

Нажимает Add to list.

Выбирает список.

Backend проверяет parent object compatibility.

Backend создаёт ListEntry.

UI показывает toast и обновляет блок Lists.

На странице списка запись появляется в table/board.

Данные(Prisma):

List: target list.

Record: parent record.

ListEntry: orgId, listId, recordId, stage?, position?, addedById, createdAt, archivedAt?.

ListEntryValue: initial list values (если есть).

Activity: RECORD_ADDED_TO_LIST на record; возможно list-level activity.

API:

POST /api/lists/:listId/entries

body: { recordId: string, values?: Record<string, unknown>, stage?: string }

response: { entry }

errors:

403;

404;

409 ENTRY_ALREADY_EXISTS;

422 OBJECT_MISMATCH.

Acceptance:

Запись можно добавить в совместимый список.

Одна запись может быть во многих списках.

Entry появляется на list page.

Record page показывает membership.

Добавление в список пишет Activity.

Несовместимый parent object недоступен в picker.

Edge-cases:

Entry уже существует → показать Already in list или предложить duplicate entry, если список разрешает duplicates (уточнить).

Record archived → запрещено.

List archived → не показывать в picker.

Нет доступных lists → empty state + create list.

Demo-mode без особенностей.

S104 — Стадии внутри списка

Экран / меню: Sidebar → Lists → <List> → Board view или List settings → Stages.

Роль / доступ: READ для просмотра; READ_WRITE для перемещения entries; FULL для настройки стадий.

Предусловие: list существует; у list есть stage/status field. В storyboard показан Event Invitees как kanban со стадиями No stage, Shortlisted, Invited, Accepted, Declined; в Academy permissions также подтверждён Recruiting list как kanban с колонками pipeline. 


 


UI-элементы:

Board toolbar:

list name;

view selector;

View settings;

Share;

Import / Export;

Add <ParentObject>.

Columns:

stage name;

color dot;

count;

+ Add <ParentObject>.

Cards:

parent record displayName;

company/secondary fields;

list attributes;

activity icons.

Drag-and-drop between columns.

Шаги:

Пользователь открывает list.

Переключается в Board view.

Система строит колонки по list-stage options.

Пользователь добавляет запись в конкретную стадию или перемещает card.

Backend обновляет ListEntry.stage или list-stage value.

UI обновляет counts и card position.

Данные(Prisma):

ListEntry.stage и position — MVP field.

Альтернатива: ListAttribute(type=STATUS) + ListEntryValue (расширяемый вариант; уточнить).

View.type=BOARD, View.groupByAttributeId может ссылаться на list-stage.

Activity: LIST_ENTRY_STAGE_UPDATED.

API:

GET /api/lists/:listId/entries?viewId=...

PATCH /api/list-entries/:entryId

body: { stage?: string, position?: number }

response: { entry }

PATCH /api/lists/:listId/stages (уточнить настройки стадий)

errors: 403, 404, 409, 422.

Acceptance:

List board отображает стадии.

Entry перемещается между стадиями drag-and-drop.

Stage сохраняется после refresh.

Counts по колонкам корректны.

No stage показывает entries без стадии.

Стадии list не меняют parent object attributes.

Edge-cases:

Stage удалён/архивирован → entries попадают в No stage или archived column (уточнить).

Required stage → нельзя drop в No stage.

Duplicate entries одной record в списке имеют независимые stages.

Большая колонка → per-column pagination.

Demo-mode без особенностей.

S105 — Импорт CSV в список

Экран / меню: List page → Import / Export → Import CSV.

Роль / доступ: READ_WRITE или FULL к списку; также нужен write-доступ к parent object, потому что импорт создаёт/обновляет parent records.

Предусловие: list существует; выбран CSV; есть mapping parent attributes и list attributes. Academy 11 фиксирует отличие list import: он создаёт/обновляет и parent records, и list entries; в mapping доступны parent-атрибуты и list-level attributes; можно создать list attribute на лету. 


UI-элементы:

Import / Export.

Import CSV.

File picker.

Mapping screen:

CSV columns слева;

parent object attributes;

list attributes;

Create new attribute;

Create list attribute.

Review values:

warnings for invalid values;

add select option;

required errors.

Entry collision policy:

Update existing entry;

Add as separate entry.

Preview:

parent records created/updated;

list entries created/updated.

Progress + Import History.

Шаги:

Пользователь открывает список.

Выбирает Import CSV.

Загружает файл.

Маппит CSV columns на parent/list attributes.

Настраивает unique/dedupe parent record.

Выбирает collision policy для существующего list entry.

Review исправляет значения.

Подтверждает import.

Worker создаёт/обновляет parent records и list entries.

UI показывает результат.

Данные(Prisma):

ImportJob (если модель есть/нужна; уточнить).

Record + Value для parent object.

ListEntry для связи record со списком.

ListEntryValue для list attributes.

AttributeOption при добавлении новых select/list-stage values.

Activity:

RECORD_CREATED/UPDATED;

RECORD_ADDED_TO_LIST;

LIST_ENTRY_UPDATED.

API:

POST /api/imports

body: multipart { file, targetType: "LIST", listId }

GET /api/imports/:importId

POST /api/imports/:importId/confirm

body:

TypeScript
{
  mappings: Array<{ csvColumn: string; target: "parent" | "list"; attributeId?: string; createAttribute?: unknown }>;
  dedupeAttributeId?: string;
  entryCollision: "update_existing" | "add_separate";
}

errors: 400, 403, 404, 409, 422.

Acceptance:

CSV import в list доступен.

Можно маппить parent attributes и list attributes.

Можно создать list attribute на лету.

Parent records dedupe по unique attribute.

List entries создаются/обновляются.

Import History показывает прогресс и ошибки.

Edge-cases:

CSV без unique parent attribute → создаёт новые parent records для каждой строки или требует mapping (уточнить).

Required parent/list attribute не заполнен → row error.

Select option отсутствует → add option или reassign.

Import можно продолжить в фоне.

Demo-mode: import worker локальный, без внешних API.

S106 — Коллизия entry при импорте: update existing / add separate

Экран / меню: List import → Mapping / Review → Existing list entry behavior.

Роль / доступ: READ_WRITE или FULL к списку и parent object.

Предусловие: CSV содержит строку, которая по unique parent attribute совпадает с record, уже добавленным в список. Academy 11 указывает выбор действия при существующем list entry: update existing entry или add as separate entry; пример — новые лиды с ивента можно добавить повторно, чтобы не перезатереть старый entry. 


UI-элементы:

Collision section:

When record is already in this list;

radio Update existing entry;

radio Add as separate entry;

explanation text.

Preview:

entries updated;

entries created;

duplicate rows indicator.

Row-level conflict warnings.

Шаги:

Пользователь импортирует CSV в list.

Система обнаруживает parent record, уже имеющий entry в list.

UI показывает collision policy.

Пользователь выбирает Update existing entry.

Или выбирает Add as separate entry.

Backend применяет policy при confirm.

Preview/result показывает created/updated counts.

Данные(Prisma):

Record: deduped parent record.

ListEntry: existing entry.

ListEntryValue:

update existing → обновить values существующего entry;

add separate → создать новый entry с отдельными values.

Требуется schema support для duplicate entries: убрать/не создавать unique (listId, recordId) или добавить entryKey/batchId (уточнить).

Activity: LIST_ENTRY_UPDATED или RECORD_ADDED_TO_LIST повторно.

API:

POST /api/imports/:importId/confirm

body: { entryCollision: "update_existing" | "add_separate" }

errors:

409 DUPLICATE_ENTRY_NOT_ALLOWED, если список запрещает separate entries;

422 INVALID_COLLISION_POLICY.

Acceptance:

Import UI предлагает две политики.

Update existing не создаёт новый entry.

Add separate создаёт отдельный ListEntry.

List-values не смешиваются между separate entries.

Preview counts корректны.

Activity отражает выбранное действие.

Edge-cases:

Текущая schema имеет unique (listId, recordId) → add_separate невозможен без миграции (уточнить).

Multiple matching entries already exist → update latest или error (уточнить; дефолт — выбрать latest createdAt с warning).

Parent record dedupe не найден → создаётся record + entry, collision не возникает.

Demo-mode без особенностей.

S107 — Сайдбар LISTS → открыть список

Экран / меню: Sidebar → Lists → <ListName>.

Роль / доступ: READ или выше к списку. NO_ACCESS скрывает список в sidebar.

Предусловие: список существует, не архивирован; пользователь имеет доступ; list имеет default view. Sidebar должен показывать Lists как отдельную секцию наряду с Records — это зафиксировано в IA. 


UI-элементы:

Sidebar section Lists.

List links:

Inbound Leads;

Recruiting;

Customer Success;

Onboarding Pipeline;

PQL;

Event Invitees;

All lists.

Active state.

List page:

header list name;

view selector;

View settings;

table/board toggle;

Share;

Import / Export;

Add <ParentObject>.

Empty state.

Шаги:

Пользователь находит список в sidebar.

Кликает список.

Frontend открывает list route.

Backend возвращает list metadata, parent object, views, entries.

UI рендерит table или board.

Active item подсвечивается.

Данные(Prisma):

List: metadata.

Object: parent object.

View: list views.

ListEntry: entries.

Record + Value: parent record data.

ListEntryValue: list-specific values.

Activity: просмотр не пишет.

API:

GET /api/lists

GET /api/lists/:listId

GET /api/lists/:listId/views

GET /api/lists/:listId/entries?viewId=&limit=&cursor=

errors: 401, 403, 404.

Acceptance:

Доступные списки видны в sidebar.

Клик открывает list page.

Active list подсвечен.

List page показывает entries.

Table/board работают как у object.

Список без доступа не виден.

Edge-cases:

List archived → скрыт из sidebar, direct link → archived/not found state.

Default view отсутствует → repair/create default view.

Нет entries → empty state.

Много lists → collapse/search (уточнить).

Demo-mode: seeded lists появляются в sidebar.

S108 — Enroll to sequence из people-списка с фильтрами

Экран / меню: Lists → <People list> → Filter → select rows / Select all → bulk footer → Enroll in sequence.

Роль / доступ: READ к list entries; READ_WRITE к sequence enrollment; право отправки из выбранного mailbox/sender. Если delegated sending включён — пользователь может выбрать коллегу-сендера с разрешением.

Предусловие: список parent object = People или entries резолвятся в people recipients; есть опубликованная sequence; у people есть email; текущие filters применены. Academy 15 указывает enroll из object views, record pages и people-списков, включая фильтры и select all по отфильтрованному view. 


UI-элементы:

Filter chips.

Row checkboxes / Select all.

Bulk footer:

selected count;

Enroll in sequence.

Enroll modal:

sequence dropdown;

sender dropdown;

delegated sender marker;

recipients preview;

invalid recipients list;

Enroll.

Toast/progress.

Шаги:

Пользователь открывает people-list.

Применяет filters.

Выбирает строки или Select all.

Нажимает Enroll in sequence.

Выбирает sequence и sender.

Система валидирует recipients.

Пользователь подтверждает.

Backend создаёт enrollments.

Emails попадают в sequence queue/outbox.

Данные(Prisma):

ListEntry → parent Record people.

Value email атрибута.

Sequence, SequenceStep, Enrollment (модели добавить/уточнить; legacy Campaign/Sequence недостаточно для Attio-like flow).

Email/Outbox records.

Activity: SEQUENCE_ENROLLED на person record/list entry.

API:

POST /api/sequences/:sequenceId/enroll

body:

TypeScript
{
  recordIds?: string[];
  listEntryIds?: string[];
  viewId?: string;
  filterSnapshot?: unknown;
  senderUserId: string;
}
- response: `{ enrolledCount, skipped, errors }`

errors:

403;

404;

409 ALREADY_ENROLLED;

422 MISSING_EMAIL;

422 UNSUPPORTED_PARENT_OBJECT.

Acceptance:

Enroll доступен из people-list.

Фильтры ограничивают выбранных получателей.

Select all применяет текущий filtered view.

People без email попадают в skipped/errors.

Уже enrolled recipients не дублируются.

Outbox показывает будущие sequence emails (сценарий S149 подробнее).

Edge-cases:

Parent object не People → action скрыт или требует mapping recipient relation (уточнить).

Unsubscribed recipient → skipped.

Sender не подключил mailbox → 422.

Sequence draft/unpublished → нельзя enroll.

Demo-mode: enqueue demo emails без реальной отправки.

S109 — Add to list массово

Экран / меню: Object table → select rows → bulk footer → Add to list.

Роль / доступ: READ к selected records; READ_WRITE к target list.

Предусловие: object table открыт; выбраны записи; target list имеет тот же parent object или совместимую relationship mapping (уточнить). Storyboard показывает bulk-панель с Add to list, модалку Choose list, варианты списков и кнопку Add 21, затем toast с Go to list. 


UI-элементы:

Row checkboxes.

Bulk footer:

N selected;

Add to list;

Send email;

Run workflow;

Enroll in sequence;

More;

X.

Modal Choose list:

search Search lists...;

list results;

Create new list;

primary button Add N.

Toast:

success count;

Go to list;

close.

Шаги:

Пользователь выбирает записи.

Нажимает Add to list.

Выбирает target list.

Нажимает Add N.

Backend создаёт ListEntry для каждой записи.

UI показывает toast.

Пользователь может перейти в список.

Данные(Prisma):

Record[]: selected.

List: target.

ListEntry[]: создаются для новых entries.

Activity: RECORD_ADDED_TO_LIST для каждой записи.

Если duplicates запрещены — существующие entries skipped.

Если target list требует list-values — либо создаются пустые, либо показывается additional form (уточнить).

API:

POST /api/lists/:listId/entries/bulk

body: { recordIds: string[], duplicatePolicy?: "skip" | "add_separate" }

response: { createdCount, skippedCount, errors }

errors: 403, 404, 409, 422.

Acceptance:

Bulk footer появляется при выборе строк.

Add to list открывает picker.

Показываются только совместимые списки.

После подтверждения создаются entries.

Toast показывает результат и Go to list.

Partial duplicates не ломают весь bulk.

Edge-cases:

1000+ selected → background job.

Часть records архивирована → partial errors.

Target list уже содержит часть records → skip или add separate по policy.

Нет совместимых списков → empty state + create list.

Demo-mode без особенностей.

S120 — Открыть карточку

Экран / меню: Object table → record row click или Board card click → Record page.

Роль / доступ: READ к объекту/record. READ_WRITE — для inline-edit; FULL — для настройки layout.

Предусловие: запись существует, не архивирована; object metadata и layout доступны. Record page структура в MASTER_TZ включает breadcrumbs, tabs и Details; текущий каркас уже частично готов. 


UI-элементы:

Breadcrumbs: <Object> / <Record>.

Header:

object icon;

record displayName;

action buttons, например Compose email.

Tabs:

Activity;

Emails;

Calls;

relationship tabs (Team, Associated deals);

Notes;

Tasks;

Files.

Main panel: selected tab content.

Right side:

Details;

Comments tab/panel.

Details sections:

owner/people/description/categories;

firmographics;

location;

social links;

lists.

Loading/empty/error states.

Шаги:

Пользователь кликает запись.

Frontend открывает record route.

Запрашивает record detail.

Запрашивает object metadata/layout.

Рендерит header, tabs, Details.

По умолчанию активен Activity.

Пользователь переключает tabs или редактирует Details.

Данные(Prisma):

Record: id, objectId, displayName, createdAt, updatedAt, archivedAt.

Object, Attribute, Value.

RelationshipValue.

ListEntry.

Activity.

Email, Note, Task, будущий Call/File/Comment (часть моделей уточнить).

Record page layout model отсутствует/требует добавления (уточнить).

API:

GET /api/records/:recordId

GET /api/records/:recordId/activities

GET /api/records/:recordId/emails

GET /api/records/:recordId/notes

GET /api/records/:recordId/tasks

errors: 401, 403, 404.

Acceptance:

Клик из table/board открывает карточку.

Breadcrumbs корректны.

Header показывает displayName.

Tabs видимы.

Details показывают атрибуты и значения.

Запись без activity показывает empty timeline.

Пользователь без доступа не видит запись.

Edge-cases:

displayName пустой → fallback Untitled.

Record archived → archived state.

Relationship target недоступен → restricted chip.

Layout config отсутствует → default layout.

Demo-mode: seeded records открываются.

S121 — Inline-редактирование полей Details

Экран / меню: Record page → Right panel → Details → attribute value click.

Роль / доступ: READ_WRITE или FULL к объекту/record. READ видит read-only values.

Предусловие: record активен; attribute editable; user имеет write access; typed value validator доступен.

UI-элементы:

Details field row:

label;

current value;

empty placeholder Set value;

hover edit affordance.

Type-specific editors:

text/long text;

select/multi-select;

date/datetime;

currency;

user;

relationship picker;

checkbox.

Save-on-blur/Enter (уточнить).

Esc cancel.

Inline error.

Loading state.

Шаги:

Пользователь открывает record page.

Наводит на поле Details.

Кликает значение.

UI открывает editor.

Пользователь меняет значение.

Frontend отправляет PATCH.

Backend валидирует и сохраняет typed value.

UI обновляет Details и Activity.

Данные(Prisma):

Value upsert/update по recordId + attributeId.

Record.updatedAt/updatedById.

Record.displayName/searchText пересчитываются, если изменён primary attribute.

RelationshipValue для relationship fields.

Activity: VALUE_UPDATED.

API:

PATCH /api/records/:recordId/values/:attributeId

body: { value: unknown }

response: { record, value, activity }

errors: 403, 404, 409, 422.

Acceptance:

Details inline-edit работает для всех supported types.

Read-only/system fields нельзя редактировать.

Required/unique validations работают.

После сохранения значение обновляется без reload.

Activity показывает изменение.

Primary field edit меняет header displayName.

Edge-cases:

Empty required value → rollback + error.

Unique conflict → error.

Relationship target archived → запретить выбор.

Параллельное изменение в table и Details → refetch/last-write (уточнить).

Demo-mode без особенностей.

S122 — Configure page: вход через «⋮» → режим настройки

Экран / меню: Record page → top-right ⋮ → Configure page.

Роль / доступ: Owner/Admin или пользователь с FULL access к объекту. Изменения видимы всем пользователям объекта.

Предусловие: record page открыта; object layout configurable; пользователь имеет metadata/layout permission. Academy 05 указывает вход через три точки на record page и режим Configure page; изменения применяются к типу объекта. 


UI-элементы:

Header меню ⋮.

Action Configure page.

Configure mode:

breadcrumb Companies › Configure record page;

close ×;

record preview;

editable Highlights;

tab reorder area;

right details sections editor;

action buttons editor (S129 позже);

footer: Changes will be visible to all;

Cancel;

Save changes.

Unsaved changes warning.

Шаги:

Пользователь открывает record page.

Нажимает ⋮.

Выбирает Configure page.

UI переходит в configure mode.

Пользователь меняет layout.

Нажимает Save changes.

Backend сохраняет object-level record page layout.

Все записи этого object используют новый layout.

Данные(Prisma):

Требуется модель RecordPageLayout / ObjectRecordPageConfig (уточнить/добавить):

orgId;

objectId;

highlights;

tabs;

sections;

actions;

updatedById.

Object может хранить layout в config как временный вариант (уточнить).

Activity: metadata audit; record Activity не пишется.

API:

GET /api/objects/:objectId/record-layout

PATCH /api/objects/:objectId/record-layout

body: { highlights, tabs, sections, actions }

response: { layout }

errors: 403, 404, 409, 422.

Acceptance:

Configure page доступен из ⋮.

Configure mode открывается поверх текущей записи/как отдельный экран.

Cancel не сохраняет изменения.

Save changes сохраняет layout.

Layout применяется ко всем записям объекта.

Пользователь без FULL не видит action.

Edge-cases:

Layout изменён другим пользователем → conflict или last-write (уточнить).

Object archived → configure запрещён.

Невалидный layout (удалённый attribute) → 422.

Закрытие с unsaved changes → confirm.

Demo-mode без особенностей.

S123 — Highlights: добавить виджет (≤6)

Экран / меню: Record page → ⋮ → Configure page → Highlights → Add widget.

Роль / доступ: Owner/Admin или FULL access к object layout.

Предусловие: configure mode открыт; object имеет attributes, подходящие для highlight; текущих highlight widgets меньше 6. Academy 05 фиксирует Highlights как верхнюю область overview-tab, максимум 6 widgets; на кадре видна кнопка Add widget (4/6). 


UI-элементы:

Highlights section.

Add widget (N/6).

Widget picker:

attributes;

relationship summaries;

integration widgets (S124).

Preview widget:

label;

value;

icon;

drag handle;

remove.

Counter limit.

Save changes.

Шаги:

Пользователь открывает configure page.

В Highlights нажимает Add widget.

Выбирает attribute, например Connection strength.

Widget появляется в highlights preview.

Пользователь сохраняет layout.

Record page показывает новый highlight у всех records объекта.

Данные(Prisma):

RecordPageLayout.highlights: array { id, type: "attribute", attributeId, order, config }.

Attribute: source metadata.

Value: runtime value для конкретного record.

Activity: metadata audit.

API:

PATCH /api/objects/:objectId/record-layout

body: { highlights: [...] }

response: { layout }

errors:

422 HIGHLIGHT_LIMIT_EXCEEDED;

404 ATTRIBUTE_NOT_FOUND;

403.

Acceptance:

Можно добавить highlight widget.

Нельзя добавить больше 6.

Widget показывает value конкретной записи.

После Save виджет остаётся после refresh.

Remove widget удаляет его из layout, не удаляет attribute.

Архивированные attributes не доступны для выбора.

Edge-cases:

Attribute удалён после сохранения layout → widget invalid/hidden.

Empty value → placeholder.

Relationship attribute with many values → count/summary (уточнить).

Counter корректно обновляется при remove/add.

Demo-mode без особенностей.

S124 — Highlights: виджет интеграции

Экран / меню: Record page → ⋮ → Configure page → Highlights → Add widget → Integrations.

Роль / доступ: Owner/Admin или FULL access к object layout; также право на подключённую integration/app.

Предусловие: integration установлена и поддерживает record widget. Academy 05 показывает integration widget в Highlights (Customer requests (Linear)), а Apps Academy описывает приложения, которые добавляют виджеты на record pages. 


 


UI-элементы:

Add widget.

Integrations tab/filter.

Widget options:

Linear customer requests;

PandaDocs;

другие (уточнить).

Connection status:

connected;

install/connect required.

Widget preview.

Permissions warning.

Save changes.

Шаги:

Пользователь открывает Highlights widget picker.

Выбирает integration widget.

Если app не подключён — переходит к install/connect или видит disabled state.

Добавляет widget.

Сохраняет layout.

Record page подтягивает данные integration по текущей записи.

Данные(Prisma):

RecordPageLayout.highlights: { type: "integration", appKey, widgetKey, config }.

Integration/AppConnection модели нужны (уточнить/добавить).

External data не хранить как Value, если это live widget; можно cache (уточнить).

Activity: metadata audit; integration data reads не пишут record activity.

API:

GET /api/apps/widgets?objectId=...

PATCH /api/objects/:objectId/record-layout

GET /api/records/:recordId/widgets/:widgetKey

errors:

403;

404;

409 APP_NOT_CONNECTED;

503 INTEGRATION_UNAVAILABLE.

Acceptance:

Connected integration widget можно добавить в highlights.

Widget занимает один слот из 6.

Widget отображается на record page.

Если integration отключена, widget показывает controlled error.

Пользователь без доступа к app не видит данные.

Удаление widget не отключает integration.

Edge-cases:

App removed after widget saved → placeholder Connect app.

External API down → widget error, страница не падает.

Widget не поддерживает object type → не показывать.

Demo-mode: интеграционные widgets показывают mock-data.

S125 — Reorder дефолтных табов

Экран / меню: Record page → ⋮ → Configure page → Main panel / Tabs → drag tabs.

Роль / доступ: Owner/Admin или FULL access к object layout.

Предусловие: configure mode открыт; layout содержит default tabs. Academy 05 описывает main panel как место для reorder дефолтных tabs Activity, Emails, Notes, Tasks и добавления relationship tabs. 


UI-элементы:

Tabs editor:

Activity;

Emails;

Calls;

Notes;

Tasks;

Files;

Comments (если отдельный tab; уточнить).

Drag handle.

Visibility toggle (уточнить).

Save changes.

Preview order.

Шаги:

Пользователь открывает configure page.

Перетаскивает Emails перед Activity или меняет порядок.

UI показывает новый порядок.

Пользователь сохраняет layout.

Record page показывает tabs в новом порядке.

Данные(Prisma):

RecordPageLayout.tabs: array { key, type: "system", order, visible }.

Activity/Email/Note/Task data не меняется.

Activity: metadata audit.

API:

PATCH /api/objects/:objectId/record-layout

body: { tabs: [...] }

errors: 422 INVALID_TAB_CONFIG.

Acceptance:

Default tabs можно reorder.

Новый порядок сохраняется после refresh.

Данные вкладок не теряются.

Required/core tab можно скрыть только если разрешено (уточнить).

Порядок применяется ко всем records объекта.

Пользователь без FULL не может менять порядок.

Edge-cases:

Tab data feature не реализована — tab может быть disabled, но order сохраняется (уточнить).

Duplicate tab key → 422.

Удаление tab из layout payload → восстановить default или считать hidden (уточнить).

Concurrent save → conflict/last-write.

Demo-mode без особенностей.

S126 — Добавить relationship-таб

Экран / меню: Record page → ⋮ → Configure page → Tabs → + Add tab → Relationship.

Роль / доступ: Owner/Admin или FULL access к object layout.

Предусловие: у объекта есть relationship attribute; target object доступен; relationship не архивирован. Academy 05 прямо указывает возможность добавлять relationship-tabs, например team/deals/invoices. 


UI-элементы:

+ Add tab.

Tab type dropdown:

Relationship;

maybe custom/integration (уточнить).

Relationship picker:

Team;

Deals;

Invoices;

other relationship attributes.

Tab name input.

Table/board mode options (уточнить).

Save changes.

Шаги:

Пользователь открывает configure page.

Нажимает + Add tab.

Выбирает relationship attribute, например Invoices.

Задаёт tab label.

Сохраняет layout.

Record page показывает вкладку Invoices.

При открытии вкладки отображаются связанные records.

Данные(Prisma):

RecordPageLayout.tabs: { type: "relationship", relationshipAttributeId, label, order, viewConfig? }.

RelationshipDefinition/RelationshipValue для runtime data.

Optional embedded View для relationship tab (уточнить).

Activity: metadata audit.

API:

GET /api/objects/:objectId/relationships

PATCH /api/objects/:objectId/record-layout

GET /api/records/:recordId/relationships?attributeId=...

errors: 404 RELATIONSHIP_NOT_FOUND, 422 DUPLICATE_TAB.

Acceptance:

Relationship tab можно добавить.

Tab появляется на record page после Save.

Tab показывает связанные records.

Empty relationship показывает empty state.

Relationship tab respects permissions target object.

Архивированный relationship нельзя выбрать.

Edge-cases:

Many relationship — tab table/list.

One-to-one relationship — tab может показывать single record card (уточнить).

Target object доступ запрещён → tab hidden/restricted.

Relationship deleted after layout saved → invalid tab placeholder.

Demo-mode: seeded Associated deals / Team tabs.

S127 — Правая панель: создать секцию атрибутов

Экран / меню: Record page → ⋮ → Configure page → Right side / Details → + Add section.

Роль / доступ: Owner/Admin или FULL access к object layout.

Предусловие: configure mode открыт; layout right panel доступен. Academy 05 показывает right side sections: Record Details, Enriched Firmographics, Location, Social Media Links, Lists, + Add section. 


UI-элементы:

Right-side layout editor.

Existing sections.

+ Add section.

Section form:

Section name;

optional description/icon (уточнить).

Section controls:

rename;

drag;

delete;

collapse (уточнить).

Save changes.

Шаги:

Пользователь открывает configure page.

В правой панели нажимает + Add section.

Вводит имя, например Social Media Links.

Добавляет/перетаскивает атрибуты в секцию.

Сохраняет layout.

Record page показывает новую секцию в Details.

Данные(Prisma):

RecordPageLayout.sections: array { id, title, order, attributeIds: [], collapsedByDefault? }.

Attribute: доступные fields.

Value: runtime values.

Activity: metadata audit.

API:

PATCH /api/objects/:objectId/record-layout

body: { sections: [...] }

errors:

422 EMPTY_SECTION_NAME;

409 DUPLICATE_SECTION_ID;

403.

Acceptance:

Можно создать новую секцию.

Секция появляется в configure preview.

После Save секция видна на всех records объекта.

Секция может быть пустой или требует атрибуты (уточнить; дефолт — можно пустую, но показывать placeholder).

Порядок секций сохраняется.

Cancel откатывает создание.

Edge-cases:

Duplicate section name — разрешить или warning (уточнить).

Пустое имя → error.

Удаление секции не удаляет attributes/values.

Attribute already in another section — move, not duplicate (дефолт).

Demo-mode без особенностей.

S128 — Перетащить атрибут между секциями

Экран / меню: Record page → ⋮ → Configure page → Right side / Details → drag attribute.

Роль / доступ: Owner/Admin или FULL access к object layout.

Предусловие: configure mode открыт; есть минимум две sections; атрибут не system-pinned или разрешён к перемещению (уточнить).

UI-элементы:

Details sections editor.

Attribute rows with drag handle.

Drop zones between sections.

Highlight destination section.

Empty section placeholder.

Save changes.

Cancel.

Шаги:

Пользователь открывает configure page.

Находит атрибут, например LinkedIn.

Перетаскивает его из Record Details в Social Media Links.

UI показывает новый порядок.

Пользователь сохраняет layout.

На record page поле отображается в новой секции.

Данные(Prisma):

RecordPageLayout.sections[].attributeIds обновляется:

удалить attributeId из старой секции;

добавить в новую позицию.

Attribute и Value не меняются.

Activity: metadata audit.

API:

PATCH /api/objects/:objectId/record-layout

body: { sections: [...] }

errors:

422 ATTRIBUTE_NOT_FOUND;

422 DUPLICATE_ATTRIBUTE_IN_LAYOUT;

403.

Acceptance:

Атрибут можно drag-and-drop между секциями.

После Save новое расположение сохраняется.

Значение атрибута не меняется.

Атрибут не дублируется в двух секциях.

После refresh layout восстановлен.

Cancel откатывает drag.

Edge-cases:

Attribute archived во время настройки → Save возвращает invalid layout.

System/Lists section pinned (уточнить) — запретить drag для pinned fields.

Перетаскивание в пустую секцию работает.

Concurrent layout edit → conflict/last-write (уточнить).

Demo-mode без особенностей.

[ГОТОВ БАТЧ: S100–S128]


---

S129 — Настроить action buttons на record page

Экран / меню: Record page → ⋮ → Configure page → Header actions / Action buttons.

Роль / доступ: Owner/Admin или пользователь с FULL доступом к объекту. Обычный READ_WRITE может нажимать доступные actions, но не менять layout.

Предусловие: открыта record page; включён configure mode; объект активен; список доступных actions известен: Compose email, Add note, Create task, Add to list, Run workflow, Enroll in sequence, custom app actions (уточнить).

UI-элементы:

⋮ в header record page.

Configure page.

Блок Action buttons.

Список текущих кнопок.

Add action.

Action picker:

Compose email;

Add note;

Create task;

Add to list;

Run workflow;

Enroll in sequence;

integration/custom actions (уточнить).

Drag handle для порядка.

Visibility toggle.

Save changes, Cancel.

Шаги:

Пользователь открывает record page.

Через ⋮ входит в Configure page.

Открывает блок Action buttons.

Добавляет или удаляет action.

Меняет порядок кнопок.

Сохраняет layout.

Record page всех записей этого объекта показывает новый набор кнопок.

Данные(Prisma):

Требуется layout-конфиг объекта: RecordPageLayout / Object.recordPageConfig (уточнить).

Поле: actions: Array<{ key, label, type, order, visible, config }> .

Object, Attribute, Integration читаются для проверки применимости action.

Activity на конкретной записи не пишется; это metadata/layout audit (уточнить модель аудита).

API:

GET /api/objects/:objectId/record-layout

PATCH /api/objects/:objectId/record-layout

body: { actions: Array<{ key: string; type: string; order: number; visible: boolean; config?: unknown }> }

response: { layout }

Ошибки: 401, 403, 404, 409, 422.

Acceptance:

Action buttons можно настроить из configure mode.

Порядок кнопок сохраняется после refresh.

Кнопки видны на всех records объекта.

Пользователь без FULL не видит настройку.

Недоступные actions скрываются или disabled по правам.

Удаление action из layout не удаляет данные emails/tasks/notes/sequences.

Edge-cases:

Action требует mailbox, но mailbox не подключён → кнопка disabled с подсказкой.

Action требует People/email recipient, а объект не People → hidden или требует mapping (уточнить).

Integration action остался после удаления app → placeholder Reconnect app.

Concurrent layout edit → conflict или last-write (уточнить).

Demo-mode: actions доступны, внешние эффекты имитируются.

S130 — Activity timeline

Экран / меню: Record page → Activity tab.

Роль / доступ: пользователь с READ к записи. Некоторые приватные email/calendar events могут скрываться по email sharing settings (уточнить).

Предусловие: запись существует; у неё есть Activity[] или empty state; backend пишет события при create/update/archive, email open/reply, note/task/list/sequence events.

UI-элементы:

Tab Activity.

Timeline list по времени.

Фильтры:

All;

Emails;

Notes;

Tasks;

Field changes;

Sequences;

Lists (уточнить набор).

Activity item:

icon;

title;

actor avatar/name;

timestamp;

body/preview;

payload details.

Pagination / Load more.

Empty state No activity yet.

Шаги:

Пользователь открывает record page.

По умолчанию или кликом открывает Activity.

Frontend загружает последние activity events.

Пользователь фильтрует timeline.

Пользователь раскрывает конкретное событие.

При скролле загружается следующая страница.

Данные(Prisma):

Activity: orgId, recordId, actorId, type, title, body, payload, createdAt.

Возможные ActivityType:

RECORD_CREATED;

RECORD_UPDATED;

RECORD_ARCHIVED;

VALUE_UPDATED;

RELATIONSHIP_CREATED;

RELATIONSHIP_REMOVED;

RECORD_ADDED_TO_LIST;

RECORD_REMOVED_FROM_LIST;

LIST_STAGE_CHANGED;

NOTE_CREATED;

TASK_CREATED;

TASK_COMPLETED;

EMAIL_SENT;

EMAIL_OPENED;

EMAIL_REPLIED;

SEQUENCE_ENROLLED;

SEQUENCE_EXITED.

User: actor.

Email, Note, Task: optional linked entities.

Read-only action: просмотр timeline не пишет Activity.

API:

GET /api/records/:recordId/activities?type=&cursor=&limit=

response: { activities, nextCursor, hasMore }

GET /api/records/:recordId

Ошибки: 401, 403, 404.

Acceptance:

Timeline отображает события записи в обратной хронологии.

События имеют icon, actor, timestamp, title.

VALUE_UPDATED показывает изменённый атрибут и old/new preview.

Email/Note/Task события кликабельны и открывают связанный контент.

Pagination работает.

Empty state отображается без ошибок.

Edge-cases:

Actor удалён → показывать historical name или Deleted user.

Payload старой версии → graceful fallback.

Много событий → cursor pagination, не offset.

Нет доступа к email body → показывать masked activity.

Demo-mode: timeline строится из demo events.

S131 — Emails tab на record page

Экран / меню: Record page → Emails tab.

Роль / доступ: пользователь с READ к записи и правом видеть synced emails. Приватные письма видны только владельцу/участникам согласно mailbox sharing rules (уточнить).

Предусловие: email sync включён или demo-mode; запись имеет email/domain/relationship, по которым письма связываются с record; есть Email[] или empty state.

UI-элементы:

Tab Emails.

Email thread list:

sender/recipient;

subject;

snippet;

timestamp;

direction inbound/outbound;

open/reply status;

attachments badge.

Compose email.

Search/filter внутри emails (уточнить).

Empty state:

No emails yet;

Connect email account;

Compose email.

Thread drawer/detail.

Шаги:

Пользователь открывает Emails.

Frontend запрашивает emails, связанные с записью.

UI показывает threads/messages.

Пользователь кликает thread.

Открывается email detail.

Пользователь может нажать Reply или Compose email.

Данные(Prisma):

Email: orgId, recordId?, threadId, providerMessageId, direction, from, to, cc, bcc, subject, body, snippet, sentAt, receivedAt, openedAt?, repliedAt?, hasAttachments.

EmailAttachment (если отдельная модель; уточнить).

Record, Value.email, Value.domain/url для auto-association.

Activity: EMAIL_SENT, EMAIL_OPENED, EMAIL_REPLIED.

API:

GET /api/records/:recordId/emails?cursor=&limit=

GET /api/emails/:emailId

POST /api/emails/compose или POST /api/records/:recordId/emails/draft

Ошибки: 401, 403, 404.

Acceptance:

Emails tab показывает связанные письма.

Threads отсортированы по последней активности.

Письмо открывается в detail/drawer.

Compose доступен из tab.

Письма без доступа скрыты или masked.

Empty state предлагает подключить email или написать письмо.

Edge-cases:

Один email связан с несколькими records → показывать в каждом релевантном record.

Дубликаты provider sync → dedupe по providerMessageId.

Body недоступен из-за privacy → только metadata.

Record email изменился → старые связанные emails остаются по stored association (уточнить).

Demo-mode: emails показываются из demo seed.

S132 — Calls tab

Экран / меню: Record page → Calls tab.

Роль / доступ: пользователь с READ к записи; прослушивание/расшифровка звонков может требовать отдельного permission (уточнить).

Предусловие: calls модуль включён; звонки импортированы/созданы вручную; record связан с contact/company.

UI-элементы:

Tab Calls.

Call list:

direction inbound/outbound;

participants;

timestamp;

duration;

outcome;

recording badge;

transcript badge.

Log call.

Add call note.

Call detail:

summary;

transcript;

recording player (если есть);

linked tasks/notes.

Шаги:

Пользователь открывает Calls.

Система загружает calls по record.

Пользователь просматривает список.

Открывает call detail.

При необходимости логирует новый звонок.

Backend создаёт call record и activity.

Данные(Prisma):

Требуется Call модель (если отсутствует; добавить):

orgId;

recordId;

direction;

participants;

startedAt;

durationSeconds;

outcome;

recordingUrl?;

transcript?;

summary?;

createdById.

Activity: CALL_LOGGED / CALL_RECORDED (если enum отсутствует — добавить или использовать generic).

API:

GET /api/records/:recordId/calls

POST /api/records/:recordId/calls

body: { direction, startedAt, durationSeconds?, outcome?, notes?, participants? }

GET /api/calls/:callId

Ошибки: 401, 403, 404, 422.

Acceptance:

Calls tab отображает список звонков.

Log call создаёт новый call.

Call появляется в timeline Activity.

Duration/timestamp отображаются корректно.

Recording/transcript показываются только при наличии.

Empty state корректен.

Edge-cases:

Recording URL expired → показать error и retry.

Transcript privacy restricted → masked.

Call связан с несколькими records → support many-to-many (уточнить; MVP — primary recordId).

Timezone для startedAt.

Demo-mode: mock calls/transcripts.

S133 — Notes tab: создать заметку

Экран / меню: Record page → Notes tab → New note или Header action → Add note.

Роль / доступ: READ_WRITE или FULL к записи. READ может читать публичные notes, если разрешено.

Предусловие: запись активна; user авторизован; notes модуль включён.

UI-элементы:

Tab Notes.

New note.

Note editor:

rich text / markdown-lite (уточнить);

@mention;

attachments/files (уточнить);

Save;

Cancel.

Notes list:

author;

timestamp;

body preview;

edit/delete menu.

Empty state No notes yet.

Шаги:

Пользователь открывает Notes.

Нажимает New note.

Вводит текст.

Опционально добавляет @mention.

Нажимает Save.

Backend создаёт note.

Note появляется в списке и Activity.

Данные(Prisma):

Note: orgId, recordId, authorId, body, createdAt, updatedAt, archivedAt?.

Mention: orgId, noteId, mentionedUserId, createdById (если отдельная модель; уточнить).

Activity: NOTE_CREATED, NOTE_UPDATED.

Notification: для mentions (если модель есть/добавить).

API:

GET /api/records/:recordId/notes

POST /api/records/:recordId/notes

body: { body: string }

response: { note, mentions, activity }

PATCH /api/notes/:noteId

DELETE /api/notes/:noteId

Ошибки: 401, 403, 404, 422.

Acceptance:

Note создаётся из record page.

Note отображается в Notes tab.

Timeline получает NOTE_CREATED.

Author и timestamp видны.

Пустую note сохранить нельзя.

@mention создаёт notification.

Edge-cases:

User без write access → editor скрыт.

Note удалена → soft archive.

Mentioned user без доступа к record → warning или запрет mention (уточнить).

Большой текст → body в Text.

Demo-mode без особенностей.

S134 — Tasks tab: создать задачу

Экран / меню: Record page → Tasks tab → New task или Header action → Create task.

Роль / доступ: READ_WRITE или FULL к записи. Assignee должен быть пользователем workspace.

Предусловие: запись активна; user авторизован; task module включён.

UI-элементы:

Tab Tasks.

New task.

Task form:

title;

description;

assignee;

due date;

priority (уточнить);

status;

related record read-only.

Task list:

checkbox complete;

title;

assignee avatar;

due date;

overdue indicator.

Filters: open/completed (уточнить).

Empty state.

Шаги:

Пользователь открывает Tasks.

Нажимает New task.

Вводит title.

Выбирает assignee и due date.

Сохраняет.

Backend создаёт task.

Task появляется в list и Activity.

При отметке complete backend пишет completion activity.

Данные(Prisma):

Task: orgId, recordId, title, description?, assigneeId?, createdById, dueAt?, status, completedAt?.

Activity: TASK_CREATED, TASK_COMPLETED.

Notification: assignee notification (уточнить).

Record: Next due task system attribute может вычисляться из open tasks.

API:

GET /api/records/:recordId/tasks?status=

POST /api/records/:recordId/tasks

body: { title, description?, assigneeId?, dueAt?, priority? }

PATCH /api/tasks/:taskId

POST /api/tasks/:taskId/complete

Ошибки: 401, 403, 404, 422.

Acceptance:

Task создаётся и связывается с record.

Task отображается в Tasks tab.

Activity показывает создание.

Complete меняет статус и пишет TASK_COMPLETED.

Next due task обновляется.

Assignee получает notification (если включено).

Edge-cases:

Due date в прошлом → warning, но можно сохранить (уточнить).

Assignee из другого org → 422.

Record archived → нельзя создавать новые tasks.

Completed task нельзя completed повторно, идемпотентно.

Demo-mode без особенностей.

S135 — Files tab: загрузить файл

Экран / меню: Record page → Files tab → Upload file.

Роль / доступ: READ_WRITE или FULL к записи для upload; READ — только просмотр файлов, если разрешено.

Предусловие: storage включён; размер файла в лимите; запись активна.

UI-элементы:

Tab Files.

Upload file.

Drag-and-drop zone.

File list:

filename;

type/icon;

size;

uploaded by;

uploaded at;

download/open;

delete menu.

Upload progress.

Empty state.

Error state for size/type.

Шаги:

Пользователь открывает Files.

Нажимает Upload file или drag-and-drop.

Frontend отправляет файл.

Backend сохраняет metadata и объект в storage.

File появляется в списке.

Activity фиксирует upload (если enum добавить; уточнить).

Данные(Prisma):

Требуется File / Attachment модель:

orgId;

recordId;

filename;

mimeType;

sizeBytes;

storageKey;

uploadedById;

createdAt;

archivedAt.

Activity: FILE_UPLOADED / generic (если enum отсутствует — добавить).

Storage provider: local/dev или S3-compatible (уточнить).

API:

GET /api/records/:recordId/files

POST /api/records/:recordId/files multipart

GET /api/files/:fileId/download

DELETE /api/files/:fileId

Ошибки: 401, 403, 404, 413, 415, 422.

Acceptance:

Файл можно загрузить на record.

Progress отображается.

File виден после refresh.

Download/open работает.

Удаление soft-archives файл.

Oversized file получает понятную ошибку.

Edge-cases:

Storage недоступен → upload fails, metadata не создаётся.

Одинаковые filenames разрешены с разными ids.

Virus scanning (уточнить; MVP — нет).

Record archived → upload disabled, download старых файлов разрешён (уточнить).

Demo-mode: local/mock storage.

S136 — Comments tab / боковая панель комментариев

Экран / меню: Record page → Comments tab или Right panel → Comments.

Роль / доступ: READ для просмотра; READ_WRITE для добавления комментариев. Mentions требуют доступ к списку workspace users.

Предусловие: запись активна; comments module включён.

UI-элементы:

Tab/section Comments.

Comment composer:

textarea;

@mention;

submit button;

cancel.

Comment thread:

author;

avatar;

timestamp;

body;

reactions (уточнить);

edit/delete menu.

Reply thread (уточнить; MVP — flat comments).

Empty state.

Шаги:

Пользователь открывает Comments.

Пишет комментарий.

Добавляет @mention, если нужно.

Нажимает submit.

Backend создаёт comment.

UI добавляет comment в thread.

Mentioned users получают notification.

Данные(Prisma):

Требуется Comment:

orgId;

recordId;

authorId;

body;

createdAt;

updatedAt;

archivedAt.

Mention: commentId, mentionedUserId.

Notification: mention delivery.

Activity: COMMENT_CREATED (если enum отсутствует — добавить) или не писать отдельно (уточнить).

API:

GET /api/records/:recordId/comments

POST /api/records/:recordId/comments

body: { body: string }

PATCH /api/comments/:commentId

DELETE /api/comments/:commentId

Ошибки: 401, 403, 404, 422.

Acceptance:

Комментарий создаётся.

Комментарий виден после refresh.

Автор и timestamp отображаются.

Пустой комментарий нельзя отправить.

Edit/delete доступны автору или Admin (уточнить).

Mentions внутри comments работают.

Edge-cases:

Mention user без доступа к record → warning/запрет (уточнить).

Очень длинный comment → лимит и validation.

Deleted comment → tombstone или скрыть (уточнить).

Concurrent comments → сортировка по createdAt.

Demo-mode без особенностей.

S137 — @mention в note/comment/task

Экран / меню: Record page → Notes / Comments / Tasks composer → type "@".

Роль / доступ: пользователь с правом создавать соответствующую сущность; mentioned user должен принадлежать org/workspace. Видимость зависит от доступа mentioned user к record.

Предусловие: composer открыт; workspace users загружены или доступны через search endpoint.

UI-элементы:

@ trigger.

Mention popover:

user avatar;

name;

email;

role/team (уточнить).

Search/filter as user types.

Highlight inserted mention chip.

Notification indicator after save.

Warning if mentioned user has no access.

Шаги:

Пользователь в editor вводит @.

UI открывает user picker.

Пользователь выбирает teammate.

Editor вставляет mention token.

Пользователь сохраняет note/comment/task.

Backend парсит mention tokens.

Backend создаёт Mention и notification.

Mentioned user получает уведомление и ссылку на record.

Данные(Prisma):

User: mentioned user.

Mention: orgId, recordId, entityType, entityId, mentionedUserId, createdById, createdAt.

Notification: userId, type="MENTION", payload, readAt.

Source entity: Note, Comment, Task.

Activity: source entity creation/update; mention как notification.

API:

GET /api/users?search=<query> или GET /api/workspace/members?search=

POST /api/records/:recordId/notes

POST /api/records/:recordId/comments

POST /api/records/:recordId/tasks

GET /api/notifications

Ошибки: 403, 404, 422.

Acceptance:

@ открывает picker пользователей.

Выбор пользователя вставляет mention token.

После сохранения mention сохраняется структурно.

Mentioned user получает notification.

Клик по mention открывает user/profile или search (уточнить).

Mention не ломается при редактировании текста.

Edge-cases:

Mentioned user удалён → показывать historical mention.

Mentioned user без доступа к record → предупреждение и не отправлять notification или предложить share (уточнить).

Duplicate mention одного user в одном entity → одна notification.

Plain text @ без выбора не создаёт mention.

Demo-mode: notification mock/local.

S140 — Подключить email account

Экран / меню: Settings → Account → Email/calendar accounts → Connect email или onboarding prompt в Emails tab / Compose.

Роль / доступ: любой пользователь может подключить свой mailbox; Admin может видеть workspace-level status, но не private secrets. Shared/delegated access требует отдельного разрешения (уточнить).

Предусловие: OAuth credentials настроены в env; пользователь авторизован; provider поддержан: Gmail/Google Workspace, Outlook/Microsoft 365 (уточнить MVP).

UI-элементы:

Settings sidebar: Email/calendar accounts.

Connect email account.

Provider buttons:

Google;

Microsoft;

IMAP/SMTP (уточнить).

Connection status:

connected;

sync running;

error;

reconnect.

Sync settings:

sharing/privacy;

signature;

tracking default;

delegated sending (уточнить).

Disconnect button.

Шаги:

Пользователь открывает email/calendar settings.

Нажимает Connect email.

Выбирает provider.

Проходит OAuth.

Backend сохраняет account connection и tokens.

Запускается initial sync job.

UI показывает connected status.

Данные(Prisma):

EmailAccount:

orgId;

userId;

provider;

email;

accessTokenEncrypted;

refreshTokenEncrypted;

scopes;

syncStatus;

lastSyncedAt;

sharingMode;

createdAt.

SyncJob / BullMQ job.

Email создаются sync worker-ом.

Activity: sync сам по себе не record activity; привязанные письма создают email events (уточнить).

API:

GET /api/email-accounts

POST /api/email-accounts/oauth/start

body: { provider }

GET /api/email-accounts/oauth/callback

POST /api/email-accounts/:id/sync

DELETE /api/email-accounts/:id

Ошибки: 401, 403, 409, 422, 503.

Acceptance:

Пользователь может подключить mailbox.

OAuth callback создаёт EmailAccount.

Tokens хранятся зашифрованно.

Initial sync стартует.

Settings показывает status.

Disconnect останавливает дальнейший sync.

Edge-cases:

OAuth denied → user-friendly error.

Token expired → refresh; если refresh fail — reconnect required.

Один mailbox подключают два пользователя → policy (уточнить).

Provider scopes недостаточны → показать required scopes.

Demo-mode: email account можно симулировать без OAuth.

S141 — Подключить calendar account / sync calendar

Экран / меню: Settings → Account → Email/calendar accounts → Connect calendar или общий Connect Google/Microsoft.

Роль / доступ: пользователь подключает свой calendar; Admin может настраивать workspace defaults (уточнить).

Предусловие: OAuth provider поддерживает calendar scopes; пользователь авторизован; calendar sync включён в config.

UI-элементы:

Calendar account status.

Provider selector.

Calendars list:

primary calendar;

secondary calendars;

toggle sync.

Sync range settings (уточнить).

Privacy/sharing:

show busy only;

show event details.

Reconnect/disconnect.

Шаги:

Пользователь открывает settings.

Подключает account с calendar scopes.

Выбирает calendars для sync.

Backend сохраняет connection.

Worker синхронизирует events.

Events связываются с records по participants/email/domain (уточнить).

Данные(Prisma):

CalendarAccount или расширение EmailAccount:

provider;

calendarId;

syncStatus;

lastSyncedAt;

sharingMode.

CalendarEvent:

orgId;

userId;

providerEventId;

title;

startsAt;

endsAt;

attendees;

location;

recordId?.

Activity: event-created/synced можно показывать как calendar activity (enum уточнить).

API:

GET /api/calendar-accounts

POST /api/calendar-accounts/oauth/start

POST /api/calendar-accounts/:id/sync

GET /api/records/:recordId/calendar-events

Ошибки: 401, 403, 404, 422, 503.

Acceptance:

Calendar account подключается.

Пользователь выбирает calendars для sync.

Events появляются в record activity/productivity area (уточнить UI placement).

Privacy mode применяется.

Reconnect работает при истёкшем token.

Demo-mode показывает mock calendar events.

Edge-cases:

Event без attendees не связывается с records.

Private event → показывать busy/hidden.

Recurring events → хранить occurrence или master+instances (уточнить).

Timezone/DST.

Provider rate limit → retry via worker.

S142 — Email composer из record

Экран / меню: Record page → Header action Compose email или Emails tab → Compose email.

Роль / доступ: пользователь с READ_WRITE к record и подключённым mailbox/send permission. Для demo-mode реальная отправка отключена.

Предусловие: record имеет recipient email или relationship к person; mailbox подключён или demo-mailbox доступен; пользователь имеет право отправлять.

UI-элементы:

Compose email button.

Composer modal/drawer:

From;

To;

Cc;

Bcc;

Subject;

body editor;

template selector;

variables/merge tags;

attachments;

tracking toggles;

Save draft;

Send;

Schedule (уточнить).

Recipient resolution warning.

Signature block.

Шаги:

Пользователь нажимает Compose email.

Система prefill To из record email.

Пользователь выбирает sender mailbox.

Вводит subject/body.

Опционально выбирает template.

Нажимает Send или Save draft.

Backend создаёт email draft/outbox item.

Worker отправляет письмо или сохраняет draft.

Данные(Prisma):

Email:

recordId;

from;

to;

subject;

body;

status=DRAFT|QUEUED|SENT|FAILED;

providerMessageId?;

trackingEnabled.

EmailAccount.

EmailAttachment.

Activity: EMAIL_DRAFTED, EMAIL_SENT.

OutboxJob / BullMQ job.

API:

POST /api/records/:recordId/emails/draft

POST /api/emails/send

body: { recordId, fromAccountId, to, cc?, bcc?, subject, body, templateId?, tracking?: boolean }

POST /api/emails/:emailId/send

Ошибки: 403, 404, 409, 422, 503.

Acceptance:

Composer открывается с record page.

Recipient prefill работает.

Draft сохраняется.

Send создаёт queued/sent email.

Activity показывает drafted/sent.

Demo-mode не отправляет наружу, но создаёт sent/demo email.

Edge-cases:

Record без email → composer показывает recipient required.

Несколько emails → пользователь выбирает.

Mailbox disconnected → send disabled.

Provider send fail → email status FAILED, retry.

Unsubscribed recipient → warning/block (уточнить).

S143 — Email templates

Экран / меню: Composer → Template selector и Settings → Workspace/Data → Email templates (точное меню уточнить).

Роль / доступ: использование template — READ_WRITE; создание/редактирование shared templates — Admin или FULL; personal templates — владелец.

Предусловие: templates module включён; record/object metadata доступна для merge tags.

UI-элементы:

Composer button/dropdown Templates.

Template library:

search;

categories;

personal/shared badge;

preview.

Template editor:

name;

subject;

body;

merge tags;

visibility;

save.

Merge tags menu:

record attributes;

sender fields;

company/person fields;

relationship fields (уточнить).

Шаги:

Пользователь открывает composer.

Нажимает Templates.

Выбирает template.

Система подставляет subject/body.

Merge tags резолвятся по record context.

Пользователь редактирует письмо.

Отправляет или сохраняет draft.

Данные(Prisma):

EmailTemplate:

orgId;

createdById;

name;

subject;

body;

visibility;

objectId?;

createdAt;

updatedAt.

Email.templateId.

Activity: использование template не обязательно; email drafted/sent пишется.

API:

GET /api/email-templates?objectId=&search=

POST /api/email-templates

PATCH /api/email-templates/:templateId

DELETE /api/email-templates/:templateId

POST /api/email-templates/:templateId/render

body: { recordId }

Ошибки: 403, 404, 409, 422.

Acceptance:

Template можно выбрать в composer.

Subject/body подставляются.

Merge tags резолвятся.

Missing merge value получает fallback или warning.

Shared templates видны другим users.

Personal templates видны только владельцу.

Edge-cases:

Template создан для People, применяется к Company → block или partial merge (уточнить).

Merge tag удалённого attribute → warning.

Пустой subject/body разрешить? (уточнить; дефолт subject required for send).

HTML sanitation.

Demo-mode без особенностей.

S144 — Notes productivity: quick note из composer/header

Экран / меню: Record page → Header action Add note или Activity composer → Note.

Роль / доступ: READ_WRITE или FULL к record.

Предусловие: record активен; notes module включён.

UI-элементы:

Quick action Add note.

Inline activity composer tabs:

Note;

Task;

Email (уточнить).

Note editor:

text body;

@mention;

formatting;

Save.

Recent notes in Activity.

Шаги:

Пользователь нажимает Add note.

Быстрый editor открывается без перехода на Notes tab.

Пользователь пишет заметку.

Сохраняет.

Backend создаёт note.

Activity timeline обновляется.

Данные(Prisma):

Note: recordId, authorId, body.

Mention, если есть @mention.

Activity: NOTE_CREATED.

Notification для mentions.

API:

POST /api/records/:recordId/notes

body: { body }

GET /api/records/:recordId/activities

Ошибки: 403, 404, 422.

Acceptance:

Quick note создаётся без ухода со страницы.

Note появляется в Notes tab.

Activity обновляется.

Mentions работают.

Пустая note не сохраняется.

Read-only пользователь не видит quick action.

Edge-cases:

Editor закрыт с unsaved text → confirmation.

Network error → сохранить draft локально (уточнить).

Mention без доступа → warning.

Demo-mode без особенностей.

S145 — Tasks productivity: quick task / next due task

Экран / меню: Record page → Header action Create task или Activity composer → Task.

Роль / доступ: READ_WRITE или FULL.

Предусловие: record активен; workspace users доступны для assignee; task module включён.

UI-элементы:

Create task.

Quick task form:

title;

assignee;

due date;

priority (уточнить);

notes.

Save.

System field/section Next due task.

Task completion checkbox.

Шаги:

Пользователь нажимает Create task.

Вводит title.

Выбирает due date/assignee.

Сохраняет.

Backend создаёт task.

Next due task пересчитывается.

Activity получает TASK_CREATED.

Данные(Prisma):

Task: recordId, title, assigneeId, dueAt, status.

Record system attribute Next due task вычисляется по ближайшей open task.

Activity: TASK_CREATED, TASK_COMPLETED.

Notification: assignee.

API:

POST /api/records/:recordId/tasks

PATCH /api/tasks/:taskId

POST /api/tasks/:taskId/complete

GET /api/records/:recordId/tasks

Ошибки: 403, 404, 422.

Acceptance:

Quick task создаётся.

Task появляется в Tasks tab.

Next due task обновляется.

Complete меняет статус.

Assignee получает notification (если включено).

Overdue визуально выделяется.

Edge-cases:

Assignee удалён → historical display.

Due date timezone.

Task без due date не участвует в Next due task или отображается после due tasks (уточнить).

Record archived → task creation disabled.

Demo-mode без особенностей.

S146 — Outbox: очередь писем

Экран / меню: Sidebar / Productivity → Outbox или Settings/Email → Outbox (точный route уточнить).

Роль / доступ: пользователь видит собственный outbox; Admin может видеть workspace outbox (уточнить).

Предусловие: emails/sequences создают queued messages; BullMQ/worker включён; mailbox подключён или demo-mode.

UI-элементы:

Outbox list:

recipient;

subject;

related record;

sender;

scheduledAt;

status: Draft, Queued, Scheduled, Sending, Sent, Failed, Cancelled;

retry/error.

Filters by status.

Actions:

open/edit;

send now;

cancel;

retry.

Empty state.

Шаги:

Пользователь отправляет email или enroll sequence.

Backend создаёт Email/Outbox item.

Outbox показывает письмо.

Worker отправляет в scheduled time.

Status меняется на Sent или Failed.

Пользователь может retry/cancel при allowed status.

Данные(Prisma):

Email: status, scheduledAt, sentAt, failedAt, failureReason, recordId, sequenceEnrollmentId?.

OutboxJob (опционально отдельная модель; иначе BullMQ job id в Email).

EmailAccount.

Activity: EMAIL_DRAFTED, EMAIL_SENT; failed может не писать record activity (уточнить).

BullMQ job хранит delivery task.

API:

GET /api/outbox?status=&cursor=

POST /api/outbox/:emailId/send-now

POST /api/outbox/:emailId/cancel

POST /api/outbox/:emailId/retry

Ошибки: 403, 404, 409, 422, 503.

Acceptance:

Queued emails видны в Outbox.

Status обновляется.

Failed emails показывают причину.

Cancel работает до отправки.

Retry создаёт/обновляет worker job.

Demo-mode не отправляет наружу, но проходит статусы.

Edge-cases:

Worker down → status остаётся queued, health warning.

Mailbox disconnected перед отправкой → failed/reconnect required.

Duplicate job → отправить письмо не более одного раза.

ScheduledAt в прошлом → send immediately.

Rate limit provider → retry with backoff.

S147 — Tracking opens: пиксель открытия

Экран / меню: Composer → Tracking toggle и Record page → Emails/Activity.

Роль / доступ: sender включает tracking; просмотр tracking events — пользователь с доступом к email/record.

Предусловие: email tracking включён; public tracking endpoint доступен; outgoing email содержит tracking pixel; email status sent.

UI-элементы:

Composer toggle Track opens.

Email detail:

opened count;

first opened at;

last opened at.

Activity item Email opened.

Outbox/email list badge Opened.

Privacy/notice copy (уточнить).

Шаги:

Пользователь включает tracking.

Backend вставляет tracking pixel в body.

Recipient открывает email.

Почтовый клиент запрашивает pixel URL.

Backend валидирует tracking token.

Backend создаёт open event.

UI показывает opened status и Activity.

Данные(Prisma):

Email: trackingEnabled, openedAt, openCount.

EmailOpenEvent: emailId, recordId, openedAt, userAgent, ipHash (если отдельная модель; добавить).

Activity: EMAIL_OPENED.

Tracking token должен быть opaque/signed, не raw id.

API:

Public:

GET /api/tracking/open/:token.gif

Internal:

GET /api/emails/:emailId/tracking

Ошибки public endpoint не должны раскрывать существование email; всегда отдавать transparent pixel.

Acceptance:

Отправленное письмо содержит pixel при enabled tracking.

Open request создаёт open event.

Email получает openedAt/openCount.

Activity показывает EMAIL_OPENED.

Повторные opens увеличивают count, но activity можно debounce (уточнить).

Disabled tracking не вставляет pixel.

Edge-cases:

Apple Mail Privacy / proxy opens → помечать как possible proxy (уточнить).

Gmail image proxy → IP/userAgent не являются реальным получателем.

Bot/security scanner → debounce/filter (уточнить).

Token invalid → вернуть pixel без записи.

Demo-mode: simulate open event.

S148 — Tracking replies: inbound reply detection

Экран / меню: Record page → Emails tab / Activity, Sequence enrollment status.

Роль / доступ: пользователь с доступом к synced mailbox/email thread.

Предусловие: inbound email sync включён; outgoing email/thread имеет providerThreadId или headers; sync worker получает новые inbound messages.

UI-элементы:

Email thread badge Replied.

Activity item Email replied.

Sequence status:

Replied;

exit/stop reason (уточнить).

Notification to sender (уточнить).

Reply message detail.

Шаги:

Пользователь отправляет email.

Recipient отвечает.

Email sync получает inbound message.

Backend сопоставляет reply по thread headers/providerThreadId.

Backend связывает reply с record/email/sequence enrollment.

Backend ставит repliedAt.

UI показывает reply в Emails и Activity.

Sequence останавливается, если настроено stop-on-reply.

Данные(Prisma):

Email: outbound и inbound messages.

EmailThread: providerThreadId, participants (если отдельная модель; уточнить).

Email.repliedAt / threadRepliedAt.

SequenceEnrollment.status = REPLIED/STOPPED (если sequence model есть).

Activity: EMAIL_REPLIED, SEQUENCE_EXITED.

API:

Sync webhook/poll:

POST /api/email-sync/webhook/:provider

POST /api/email-accounts/:id/sync

Internal:

GET /api/records/:recordId/emails

Ошибки: provider retry/idempotency.

Acceptance:

Inbound reply появляется в Emails tab.

Outbound email/thread получает replied status.

Activity пишет EMAIL_REPLIED.

Sequence enrollment останавливается при reply (если sequence setting включён).

Повторный sync не создаёт дубль.

Reply связывается с правильным record.

Edge-cases:

Reply пришёл с alias/forwarded address → matching по thread headers.

Один thread связан с несколькими records → activity для всех или primary (уточнить).

Out-of-office auto-reply → не считать reply? (уточнить; дефолт detect auto-submitted и не stop sequence).

Mailbox disconnected → reply не фиксируется до reconnect/sync.

Demo-mode: simulate reply event.

S149 — Sequence outbox / будущие письма после enroll

Экран / меню: Record page → Emails/Activity, Outbox, Sequence enrollment modal/result.

Роль / доступ: пользователь с правом sequence enrollment и send permission. Просмотр будущих писем — owner/sender/Admin (уточнить).

Предусловие: sequence опубликована; recipient enrolled; есть schedule/delivery settings; mailbox подключён или demo-mode; sequence steps созданы.

UI-элементы:

Enrollment result:

enrolled count;

skipped count;

next email time.

Outbox:

sequence email steps;

step number;

recipient;

scheduledAt;

status.

Record page Activity:

Sequence enrolled;

future scheduled emails (уточнить показывать ли в Activity).

Actions:

pause enrollment;

remove from sequence;

send now;

edit draft (уточнить).

Шаги:

Пользователь enroll record/list selection в sequence.

Backend создаёт SequenceEnrollment.

Backend планирует первый email step в outbox/BullMQ.

Outbox показывает future email.

Worker отправляет step в нужное время.

После send планируется следующий step с delay.

Reply/open/tracking обновляет enrollment.

При reply enrollment выходит из sequence, если включено stop-on-reply.

Данные(Prisma):

Sequence: metadata.

SequenceStep: order, delay, template, subject/body.

SequenceEnrollment: recordId, sequenceId, status, currentStep, senderAccountId, enrolledById, nextStepAt, exitedAt, exitReason.

Email: future/draft/queued/sent emails with sequenceEnrollmentId.

BullMQ job id stored in Email/Enrollment.

Activity: SEQUENCE_ENROLLED, EMAIL_SENT, EMAIL_REPLIED, SEQUENCE_EXITED.

API:

POST /api/sequences/:sequenceId/enroll

GET /api/records/:recordId/sequence-enrollments

GET /api/outbox?sequenceEnrollmentId=

POST /api/sequence-enrollments/:id/pause

POST /api/sequence-enrollments/:id/resume

DELETE /api/sequence-enrollments/:id

Ошибки: 403, 404, 409, 422, 503.

Acceptance:

После enroll создаётся enrollment.

Первый future email появляется в Outbox.

ScheduledAt рассчитывается по delivery settings.

После отправки step создаётся следующий.

Reply останавливает enrollment, если включено.

Demo-mode создаёт будущие demo emails без реальной отправки.

Edge-cases:

Recipient уже в этой sequence → 409/skipped.

Recipient без email/unsubscribed → skipped.

Mailbox disconnected до scheduled send → failed/reconnect required.

User paused sequence → jobs cancelled/paused.

Timezone/work hours/holidays delivery settings (уточнить).

[ГОТОВ БАТЧ: S129–S149]


---

S160 — Создать AI-атрибут из dropdown AI Autofill

Экран / меню: Object/List view → + Add column → Create new attribute → AI Autofill или Settings → Data → Objects → <Object> → Attributes → Create attribute. В эталоне AI-секция в dropdown содержит Classify record, Summarize record, Research agent, Prompt completion; модалка Create attribute содержит Set up AI autofill, Autofill type, Guidance, предупреждение, что AI имеет доступ ко всем атрибутам записи. 


Роль / доступ: Owner/Admin или пользователь с FULL доступом к объекту/list metadata. Запуск AI по записи может быть доступен READ_WRITE, если включено право списания кредитов (уточнить).

Предусловие: объект/list существует; есть writable attribute или пользователь создаёт новый; в workspace включён AI-модуль; есть demo-AI fallback или provider key; доступны credits.

UI-элементы:

+ Add column.

Create new attribute.

Dropdown Attribute Type.

Секция AI Autofill:

Classify record;

Summarize record;

Research agent;

Prompt completion.

Модалка:

Attribute Type;

Name;

Description (optional);

Set up AI autofill;

Autofill type;

Guidance (optional);

credit badge;

Cancel;

Create attribute.

Шаги:

Пользователь открывает table/list view.

Нажимает + Add column.

Выбирает Create new attribute.

В dropdown выбирает AI type из секции AI Autofill.

Система автоматически подбирает совместимый базовый тип.

Пользователь вводит name/guidance.

Нажимает Create attribute.

Атрибут появляется как обычная колонка, но с AI-run affordance.

Данные(Prisma):

Attribute: type, name, key, description, config.

Расширить Attribute.config.ai:

enabled: true;

type: CLASSIFY | SUMMARIZE | RESEARCH | PROMPT;

guidance;

model;

creditCost;

outputSchema.

AttributeOption: для classify-атрибутов.

ViewColumn: если создан из + Add column.

CreditTransaction: не создаётся при создании атрибута, только при запуске.

Activity: metadata audit (уточнить); record activity не пишется.

API:

POST /api/objects/:objectId/attributes

body:

TypeScript
{
  name: string;
  description?: string;
  type: "TEXT" | "SELECT" | "MULTI_SELECT" | "NUMBER" | "CURRENCY";
  config: {
    ai: {
      enabled: true;
      type: "CLASSIFY" | "SUMMARIZE" | "RESEARCH" | "PROMPT";
      guidance?: string;
    }
  };
  options?: Array<{ label: string; value: string; color?: string }>;
  addToViewId?: string;
}

response: { attribute, options?, viewColumn? }

errors: 401, 403, 404, 409, 422.

Acceptance:

AI-секция видна в dropdown типов.

Можно создать AI-атрибут из object view.

Можно создать AI-атрибут из settings.

После создания колонка добавляется в текущий view, если указан addToViewId.

Атрибут хранит AI-конфиг.

Создание не списывает credits.

Demo-mode создаёт AI-атрибут без внешнего provider key.

Edge-cases:

AI disabled в workspace → секция hidden/disabled.

Несовместимый базовый тип → 422.

Дубль key → 409.

Research agent без provider key в prod → создать можно, запуск покажет provider error (уточнить).

У пользователя нет credit permission → создать можно только если запуск ограничен (уточнить).

S161 — Настроить guidance / prompt AI-атрибута

Экран / меню: Create attribute → Set up AI autofill → Guidance или Settings → Objects → <Object> → Attributes → <AI attribute> → Edit AI settings.

Роль / доступ: Owner/Admin или FULL к объекту/list metadata.

Предусловие: выбран AI type; пользователь понимает, какие атрибуты записи доступны модели. В эталоне guidance объясняется как инструкция, что генерировать из details/attributes записи. 


UI-элементы:

Toggle Set up AI autofill.

Dropdown Autofill type.

Textarea Guidance (optional).

Helper text: Tell the AI what to generate from record details and attributes.

Notice: AI will have access to all record attributes.

Variable picker (для Prompt completion; уточнить).

Preview/test button (уточнить).

Save changes.

Шаги:

Пользователь выбирает AI type.

Открывает поле Guidance.

Пишет инструкцию, например Summarize onboarding blockers and next steps.

Для Prompt completion вставляет variables.

Сохраняет.

Backend валидирует длину/безопасность prompt.

AI-run использует guidance при каждом запуске.

Данные(Prisma):

Attribute.config.ai.guidance.

Attribute.config.ai.promptTemplate для Prompt completion.

Attribute.config.ai.inputAttributeIds? (уточнить; дефолт — все readable record attributes).

Attribute.config.ai.updatedById/updatedAt (если нужен audit).

Activity: metadata audit, не record activity.

API:

PATCH /api/attributes/:attributeId

body:

TypeScript
{
  config: {
    ai: {
      enabled: true;
      type: "SUMMARIZE" | "CLASSIFY" | "RESEARCH" | "PROMPT";
      guidance?: string;
      promptTemplate?: string;
      inputAttributeIds?: string[];
    }
  }
}

errors: 403, 404, 422.

Acceptance:

Guidance сохраняется.

Guidance применяется при следующем AI-run.

Пустой guidance допустим для Summarize/Classify, если есть дефолтный prompt.

Prompt completion требует непустой prompt.

UI предупреждает о доступе AI к record attributes.

Изменение guidance не пересчитывает существующие значения автоматически.

Edge-cases:

Guidance слишком длинный → 422.

Prompt содержит ссылку на удалённый attribute → validation warning.

У пользователя нет доступа к части attributes → AI context должен исключать их.

Изменение guidance во время bulk-run → job использует snapshot config на момент запуска.

Demo-mode использует guidance для deterministic mock, но не вызывает provider.

S162 — Classify record

Экран / меню: + Add column → AI Autofill → Classify record или Create attribute → Autofill type: Classify record.

Роль / доступ: создание — FULL; запуск — READ_WRITE + право тратить credits (уточнить).

Предусловие: базовый attribute type — SELECT или MULTI_SELECT; есть options; запись доступна для чтения AI context. Совместимость Classify → Select/Multi-select и списание 1 credit описаны в источнике. 


UI-элементы:

AI type Classify record.

Options для допустимых классов.

Guidance.

Badge 1 credit / run.

Run icon в ячейке.

Header action Run AI for view.

Cell loading AI is thinking.

Result badge/tag.

Шаги:

Пользователь создаёт Select/Multi-select attribute.

Включает Classify record.

Добавляет options, например ICP, Agency, Investor, Other.

Пишет guidance.

Запускает AI по записи.

AI получает record context.

AI возвращает одну или несколько options.

Backend валидирует, что output входит в options.

Значение сохраняется как обычный select/multi-select value.

Списывается 1 credit.

Данные(Prisma):

Attribute.type = SELECT | MULTI_SELECT.

Attribute.config.ai.type = CLASSIFY.

AttributeOption[].

Value.textValue для select или Value.jsonValue для multi-select.

AiRun: recordId, attributeId, status, inputSnapshot, output, creditCost=1.

CreditTransaction: type=DEBIT, amount=1, reason=AI_CLASSIFY.

Activity: VALUE_UPDATED с source=AI.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId: string }

response: { value, aiRun, creditTransaction }

errors:

402 INSUFFICIENT_CREDITS;

422 CLASSIFY_REQUIRES_OPTIONS;

422 AI_OUTPUT_NOT_IN_OPTIONS;

503 AI_PROVIDER_UNAVAILABLE.

Acceptance:

Classify создаётся только для Select/Multi-select.

Запуск по записи присваивает option.

Output не может быть произвольным текстом.

Списывается ровно 1 credit за успешный run.

Result доступен в фильтрах, reports, workflows.

Demo-mode возвращает deterministic option из списка.

Edge-cases:

Нет options → run disabled.

AI вернул неизвестный tag → retry/remap или validation error.

Multi-select вернул дубли → dedupe.

Запись не содержит достаточного контекста → fallback option запрещён без confidence (уточнить).

Повторный run перезаписывает значение только после подтверждения, если поле заполнено (уточнить).

S163 — Summarize record

Экран / меню: + Add column → AI Autofill → Summarize record или Create attribute → Autofill type: Summarize record.

Роль / доступ: создание — FULL; запуск — READ_WRITE + credits permission (уточнить).

Предусловие: базовый attribute type — TEXT или LONG_TEXT (источник указывает Text; Long text как расширение уточнить); запись имеет readable attributes; credits ≥ 1. Summarize принимает запись и guidance, возвращает Text, стоимость — 1 credit. 


UI-элементы:

AI type Summarize record.

Attribute type Text.

Guidance.

Badge 1 credit / run.

Run icon.

Loading AI is thinking.

Text preview/ellipsis.

Regenerate action (уточнить).

Шаги:

Пользователь создаёт Text AI-атрибут.

Выбирает Summarize record.

Пишет guidance, например Summarize onboarding status, blockers, and next step.

Запускает по записи.

Backend собирает record context.

AI возвращает summary.

Backend сохраняет summary в text value.

Списывается 1 credit.

Timeline фиксирует AI update.

Данные(Prisma):

Attribute.type = TEXT | LONG_TEXT.

Attribute.config.ai.type = SUMMARIZE.

Value.textValue или Value.longTextValue.

AiRun.creditCost = 1.

CreditTransaction.reason = AI_SUMMARIZE.

Activity: VALUE_UPDATED, payload { source: "AI", aiType: "SUMMARIZE" }.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId }

response: { value, aiRun, credits }

errors: 402, 403, 404, 422, 503.

Acceptance:

Summarize создаётся для Text-compatible attribute.

Запуск возвращает текст.

Summary сохраняется как обычное значение.

1 credit списывается только за successful run.

Summary можно фильтровать/search как text value (если searchText обновляется; уточнить).

Demo-mode генерирует deterministic summary.

Edge-cases:

Очень длинный record context → truncate по policy с логом.

Summary превышает max length → trim/422 (уточнить).

Поле уже заполнено → overwrite confirmation (уточнить).

Provider timeout → no debit, run status failed.

Запись без данных → summary Not enough information или validation (уточнить).

S164 — Research agent

Экран / меню: + Add column → AI Autofill → Research agent или Create attribute → Autofill type: Research agent.

Роль / доступ: создание — FULL; запуск — READ_WRITE + permission to spend 10 credits. Admin может ограничить Research отдельно из-за стоимости (уточнить).

Предусловие: базовый attribute type — TEXT/LONG_TEXT; запись содержит достаточно идентификаторов для research: company name, domain, LinkedIn, workspace/company relationship. Research agent делает web research и стоит 10 credits. 


 В workflow-источнике Research Agent выбирает запись, принимает вопросы, скрейпит запись и интернет, возвращает ответы; demo даёт deterministic brief. 


UI-элементы:

AI type Research agent.

Research questions / Guidance.

Badge 10 credits / run.

Warning: Uses web research.

Run icon.

Long-running state:

queued;

researching;

writing result;

done.

Sources/citations panel (уточнить).

Result text field.

Шаги:

Пользователь создаёт Text AI-атрибут ICP research.

Выбирает Research agent.

Вводит вопросы: funding, business model, ICP fit.

Запускает по компании/записи.

Backend резервирует 10 credits или проверяет баланс.

Worker собирает context записи.

Research service выполняет веб-ресёрч или demo fallback.

AI возвращает structured brief.

Backend сохраняет text value.

Credits списываются.

Activity фиксирует AI update.

Данные(Prisma):

Attribute.type = TEXT | LONG_TEXT.

Attribute.config.ai.type = RESEARCH.

Attribute.config.ai.questions: string[].

AiRun: status=QUEUED|RUNNING|SUCCEEDED|FAILED, creditCost=10, provider, startedAt, completedAt.

AiRunSource (уточнить): URL/title/snippet для источников.

Value.longTextValue.

CreditTransaction.reason = AI_RESEARCH.

Activity: VALUE_UPDATED с source=AI_RESEARCH.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId }

response: { aiRunId, status: "QUEUED" } для long-running.

GET /api/ai/runs/:aiRunId

POST /api/ai/runs/:aiRunId/cancel (уточнить)

errors:

402 INSUFFICIENT_CREDITS;

422 RESEARCH_REQUIRES_TEXT_OUTPUT;

429 AI_LIMIT_EXCEEDED;

503 RESEARCH_PROVIDER_UNAVAILABLE.

Acceptance:

Research agent создаётся только для text output.

UI явно показывает стоимость 10 credits.

Запуск long-running не блокирует страницу.

Successful result сохраняется в value.

Demo-mode возвращает deterministic brief и может не требовать web.

Failed run не списывает credits или создаёт refund transaction (policy уточнить).

Edge-cases:

Нет domain/company name → показать Not enough data to research.

Provider недоступен → run failed, no debit.

User запускает bulk Research на 100 rows → предварительная стоимость 1000 credits.

Web results противоречат друг другу → result должен пометить uncertainty (уточнить).

Compliance: не использовать запрещённые/закрытые источники.

S165 — Prompt completion

Экран / меню: + Add column → AI Autofill → Prompt completion или Create attribute → Autofill type: Prompt completion.

Роль / доступ: создание — FULL; запуск — READ_WRITE + credits permission.

Предусловие: output attribute type совместим: TEXT, NUMBER, CURRENCY; prompt задан; переменные доступны из record context. Prompt completion принимает prompt + variables и возвращает Number/Text/Currency за 1 credit. 


 В workflow-примере Prompt completion нормализует локацию в ISO country code. 


UI-элементы:

AI type Prompt completion.

Output type selector:

Text;

Number;

Currency.

Prompt editor.

Variable picker:

record attributes;

relationship fields;

sender/user fields (уточнить).

Output validation preview.

Badge 1 credit / run.

Run icon.

Шаги:

Пользователь создаёт AI-атрибут.

Выбирает Prompt completion.

Выбирает output type, например Text.

Пишет prompt: Return ISO country code for {{Primary location}}.

Запускает по записи.

Backend рендерит prompt с переменными.

AI возвращает output.

Backend валидирует output по типу.

Значение сохраняется.

Списывается 1 credit.

Данные(Prisma):

Attribute.type = TEXT | NUMBER | CURRENCY.

Attribute.config.ai.type = PROMPT.

Attribute.config.ai.promptTemplate.

Attribute.config.ai.outputType.

Value.textValue | numberValue | currencyAmount/currencyCode.

AiRun.creditCost = 1.

CreditTransaction.reason = AI_PROMPT.

Activity: VALUE_UPDATED с source AI.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId }

response: { value, aiRun, creditTransaction }

POST /api/ai/prompt/preview

body: { attributeId, recordId } (уточнить)

errors: 402, 422 INVALID_PROMPT, 422 OUTPUT_TYPE_MISMATCH, 503.

Acceptance:

Prompt completion создаётся для Text/Number/Currency.

Prompt supports variables.

Output валидируется по target type.

1 credit списывается за success.

Значение сохраняется как обычный typed value.

Demo-mode deterministic: например London → GB.

Edge-cases:

Missing variable → warning или empty string (уточнить; дефолт — block run).

Output GB. для ISO prompt → normalizer trims punctuation (уточнить).

Number output содержит текст → parse/retry/error.

Currency output без currencyCode → использовать attribute default.

Prompt injection из record values → guardrails/system prompt.

S166 — Запуск AI по одной ячейке Table

Экран / меню: Object/List table → AI attribute cell → Run icon.

Роль / доступ: READ_WRITE или выше к record/list entry; permission to spend credits; READ не может запускать.

Предусловие: AI-атрибут создан; record активен; credits хватает; cell visible в текущем view. Запуск через иконку в table cell описан как один из основных входов. 


UI-элементы:

AI icon в пустой/заполненной cell.

Tooltip:

Run AI;

credit cost.

Loading state AI is thinking.

Disable state при insufficient credits.

Success: value rendered.

Error popover:

insufficient credits;

validation failed;

provider unavailable.

Regenerate for existing value (уточнить).

Шаги:

Пользователь наводит на AI cell.

Нажимает AI icon.

Frontend показывает estimated credit cost.

Backend запускает AI run.

UI показывает loading.

Backend сохраняет value.

UI обновляет cell.

Balance обновляется.

Данные(Prisma):

AiRun: one record/attribute run.

Value: target typed value.

CreditTransaction: debit on success.

Activity: VALUE_UPDATED.

Record.updatedAt/updatedById.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId, source: "CELL" }

GET /api/ai/runs/:aiRunId для async research.

errors: 402, 403, 404, 409, 422, 503.

Acceptance:

Run по одной cell запускает только одну запись.

UI показывает loading.

После success value появляется в cell.

Credit списывается один раз.

Failed run не меняет value.

Запуск недоступен для read-only user.

Edge-cases:

Пользователь запускает повторно до завершения → debounce/disable.

Cell уже имеет значение → ask overwrite или regenerate (уточнить).

Record исчез из view после update → row скрывается с toast.

Research async result приходит после ухода со страницы → обновить при следующем fetch.

Demo-mode без внешнего AI.

S167 — Запуск AI с record page

Экран / меню: Record page → Details → AI attribute → Run AI или Record page → Action menu → Run AI attribute.

Роль / доступ: READ_WRITE к record и permission to spend credits.

Предусловие: record page открыт; AI attribute входит в Details/highlights или доступен через action menu; credits хватает.

UI-элементы:

AI badge рядом с field label.

Field action Run AI.

Regenerate.

Credit cost tooltip.

Loading skeleton внутри field.

Result value.

Activity timeline event after completion.

For Research: status panel / sources (уточнить).

Шаги:

Пользователь открывает record page.

Находит AI field.

Нажимает Run AI.

Backend запускает AI run по текущему record.

UI показывает loading.

Result сохраняется в Value.

Details и Activity обновляются.

Balance обновляется.

Данные(Prisma):

AiRun.source = RECORD_PAGE.

Value update.

CreditTransaction.

Activity: VALUE_UPDATED with AI metadata.

Optional AiRunSource для Research.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId, source: "RECORD_PAGE" }

GET /api/records/:recordId

GET /api/records/:recordId/activities

errors: 402, 403, 404, 422, 503.

Acceptance:

AI можно запустить из record page.

Result появляется в Details.

Header/highlights обновляются, если AI field там показан.

Activity показывает изменение.

Credit списывается согласно типу.

Read-only user видит value, но не run action.

Edge-cases:

Attribute скрыт из layout → запуск возможен через action menu (уточнить).

Record archived → run disabled.

Связанные attributes недоступны по правам → исключить из context.

Run завершился с output validation error → value не обновлять.

Demo-mode без особенностей.

S168 — Запуск AI на карточке Board/Kanban

Экран / меню: Object/List board → card → AI action или card quick actions → Run AI.

Роль / доступ: READ_WRITE к record/list entry и permission to spend credits.

Предусловие: board view открыт; card соответствует record/list entry; AI attribute доступен в card fields или quick actions. Запуск на kanban card указан как поддержанный entrypoint. 


UI-элементы:

Card AI icon.

Quick action menu:

Run <AI attribute>;

Run all AI fields on card (уточнить).

Loading indicator on card.

Updated AI field preview.

Error toast.

Credit cost tooltip.

Шаги:

Пользователь открывает board.

Наводит на card.

Нажимает AI icon.

Выбирает AI attribute, если их несколько.

Backend запускает AI run.

Card показывает loading.

Result сохраняется.

Card обновляется или перемещается, если AI изменил groupBy field.

Данные(Prisma):

AiRun.source = BOARD_CARD.

Value update.

CreditTransaction.

Activity: VALUE_UPDATED.

Если AI field — groupBy status/select, board column может измениться.

API:

POST /api/attributes/:attributeId/ai/run

body: { recordId, source: "BOARD_CARD", viewId }

errors: 402, 403, 404, 409, 422, 503.

Acceptance:

AI запускается с board card.

Card показывает progress.

Result сохраняется как обычное значение.

Если значение влияет на текущую группировку, card перемещается в соответствующую колонку.

Credits списываются корректно.

Ошибка не ломает board.

Edge-cases:

Card исчезает из-за фильтра после update → toast Record no longer matches view.

Несколько AI attributes на card → picker.

Research long-running → card показывает background progress.

Drag card while AI running → разрешить, но AI update не должен перетереть stage (если stage не target attribute).

Demo-mode без особенностей.

S169 — Массовый запуск AI по заголовку колонки / текущему view

Экран / меню: Table view → AI attribute column header → Run AI for all rows или Column menu → Run AI.

Роль / доступ: READ_WRITE к records текущего view; permission to spend credits; для Research может требоваться Admin approval (уточнить).

Предусловие: AI attribute visible as column; текущий view имеет filtered record set; известен estimated count и total credit cost. Источник указывает запуск кликом по заголовку колонки для всех строк view и сохранение результата как обычного значения. 


UI-элементы:

Column header menu.

Action Run AI for all rows in view.

Confirmation modal:

selected view/filter name;

row count;

cost per row;

total estimated credits;

skip rows with existing values toggle (уточнить);

Run.

Bulk progress:

queued/running/succeeded/failed/skipped;

cancel button (уточнить).

Per-cell loading/result/error.

Шаги:

Пользователь открывает AI column menu.

Нажимает Run AI for all rows.

UI показывает preview count и total cost.

Пользователь подтверждает.

Backend создаёт bulk job со snapshot текущего view.

Worker запускает AI по каждой записи.

Значения сохраняются по мере завершения.

Credits списываются per successful row или резервируются заранее (policy уточнить).

UI показывает итог.

Данные(Prisma):

AiBulkRun: orgId, attributeId, viewId, filterSnapshot, status, totalCount, successCount, failedCount, estimatedCost, actualCost.

AiRun[]: по одной записи.

CreditTransaction[]: per run или aggregate debit.

Value[].

Activity[]: VALUE_UPDATED по records.

BullMQ job.

API:

POST /api/attributes/:attributeId/ai/run-view

body:

TypeScript
{
  viewId: string;
  mode: "all_matching" | "loaded_rows" | "selected_rows";
  skipExisting?: boolean;
}
- response: `{ bulkRunId, estimatedCount, estimatedCost }`

GET /api/ai/bulk-runs/:bulkRunId

POST /api/ai/bulk-runs/:bulkRunId/cancel

errors: 402, 403, 409, 422, 429.

Acceptance:

Bulk-run запускается из header AI column.

Перед запуском видно estimated credits.

Запуск применяет текущие filters/search view snapshot.

Progress виден.

Partial failures не отменяют успешные rows.

Credits списываются только по фактическим successful runs или корректно refund при reserve policy.

Demo-mode обрабатывает bulk deterministic.

Edge-cases:

Estimated cost > balance → блокировать.

View меняется после запуска → job использует snapshot.

Row archived during job → skipped.

Provider rate limit → throttling/retry.

Research bulk expensive → дополнительное confirmation.

S170 — AI-значения используются как обычные values

Экран / меню: Object/List view → Filters / Reports / Workflows / Record page.

Роль / доступ: любой пользователь с READ к attribute видит AI value; использование в filters/reports/workflows зависит от прав на эти модули.

Предусловие: AI-run завершён successfully; value сохранён в typed column. Источник прямо указывает: AI-значения используются в фильтрах, отчётах и workflow triggers как обычные значения. 


UI-элементы:

Table cell с AI-generated value.

AI badge/tooltip Generated by AI.

Filter dropdown показывает AI attribute.

Report builder показывает AI attribute как dimension/metric, если тип совместим.

Workflow trigger/action selectors показывают AI attribute.

Activity item показывает source AI.

Шаги:

Пользователь запускает AI.

Backend сохраняет result в Value.

Пользователь открывает Filter.

Выбирает AI attribute.

Фильтр работает как для обычного атрибута.

Пользователь создаёт report или workflow на этом attribute.

Система использует typed value без отдельной AI-логики.

Данные(Prisma):

Value: обычные typed columns.

Attribute.config.ai.enabled=true только metadata.

ViewFilter/ViewSort/ViewColumn используют attributeId.

Report/WorkflowBlock ссылаются на attributeId.

AiRun хранит provenance.

Activity.payload.source = AI.

API:

GET /api/objects/:objectId/records?filters=...

PUT /api/views/:viewId/filters

POST /api/reports

POST /api/workflows

GET /api/attributes/:attributeId/provenance?recordId=... (уточнить)

Acceptance:

AI value отображается как обычное значение.

Filter по AI select/text/number работает.

Report builder использует AI values.

Workflow trigger attribute updated срабатывает при AI update.

Provenance AI сохраняется.

Export CSV включает AI values как обычные columns.

Edge-cases:

AI value удалено вручную → provenance остаётся в history.

AI config удалён, value остаётся.

Attribute archived → value скрывается как обычный archived attribute.

Workflow loop вызывает AI и затем триггерит сам себя → нужна защита от recursion (уточнить).

Demo-mode без особенностей.

S171 — Credits: баланс в Billing

Экран / меню: Settings → Workspace → Plans / Billing → AI credits.

Роль / доступ: Owner/Admin. Member может видеть personal/limited usage только если разрешено (уточнить).

Предусловие: billing module включён; у workspace есть subscription/plan; credit balance и monthly allowance рассчитаны. Источник указывает баланс и разбивку в Workspace Settings → Billing; планы включают месячный пакет + докупка. 


UI-элементы:

AI credits card.

Current balance.

Monthly included credits.

Used this period.

Reset date.

Breakdown by:

Classify;

Summarize;

Research;

Prompt.

Buy more credits.

Transaction history link.

Low balance warning.

Шаги:

Admin открывает Billing.

Система загружает credit balance.

UI показывает included/used/remaining.

Admin открывает breakdown.

Admin может купить credits.

После purchase balance обновляется.

Данные(Prisma):

CreditBalance: orgId, balance, includedMonthly, periodStart, periodEnd, updatedAt.

CreditTransaction: orgId, amount, type=CREDIT|DEBIT|REFUND|ADJUSTMENT, reason, metadata, createdById, createdAt.

Subscription/StripeCustomer (если billing уже есть).

AiRun links to transactions.

API:

GET /api/billing/credits

response:

TypeScript
{
  balance: number;
  includedMonthly: number;
  usedThisPeriod: number;
  periodEnd: string;
  breakdown: Record<string, number>;
}

GET /api/billing/credits/transactions

POST /api/billing/credits/purchase

errors: 401, 403, 404, 503.

Acceptance:

Billing показывает текущий AI credit balance.

Показывается usage breakdown по типам AI.

Баланс уменьшается после AI-run.

Баланс увеличивается после purchase/monthly grant.

Member без прав не видит billing.

Demo-mode показывает fake balance или Unlimited demo credits.

Edge-cases:

Stripe недоступен → показать cached balance + warning.

Negative balance запрещён.

Monthly reset должен быть idempotent.

Multiple purchases одновременно → transactional increment.

Refund/failed payment корректно отражается transaction.

S172 — Credits: списание по типам и транзакции

Экран / меню: AI run confirmation / Billing → Credit transactions.

Роль / доступ: запуск — пользователь с AI-run permission; просмотр всех транзакций — Owner/Admin; просмотр своих runs — Member (уточнить).

Предусловие: AI-run завершён successfully; credit cost известен: Research = 10, остальные = 1. Таблица стоимости указана в источнике. 


UI-элементы:

Run confirmation:

This will use 1 credit;

для Research: This will use 10 credits.

Transaction history:

date/time;

user;

AI type;

record;

attribute;

amount;

status;

run id.

Filters by AI type/user/date.

Export CSV (уточнить).

Шаги:

Пользователь запускает AI.

Backend определяет credit cost по aiType.

Backend проверяет balance.

AI выполняется.

При success backend создаёт CreditTransaction(DEBIT).

Balance уменьшается.

Transaction появляется в Billing.

Если run failed после reserve, создаётся REFUND (policy уточнить).

Данные(Prisma):

CreditTransaction:

orgId;

amount = -1 | -10;

type = DEBIT;

reason = AI_CLASSIFY | AI_SUMMARIZE | AI_RESEARCH | AI_PROMPT;

aiRunId;

recordId;

attributeId;

createdById.

AiRun.creditCost.

CreditBalance.balance.

Transaction must be created in DB transaction with value update.

API:

GET /api/billing/credits/transactions?type=&userId=&from=&to=

Internal service:

debitCredits(orgId, amount, reason, metadata)

AI run endpoint returns { creditTransaction }.

errors:

402 INSUFFICIENT_CREDITS;

409 CREDIT_TRANSACTION_CONFLICT.

Acceptance:

Classify списывает 1.

Summarize списывает 1.

Prompt completion списывает 1.

Research списывает 10.

Каждое списание создаёт transaction.

Transaction связана с aiRun/record/attribute.

Failed run не создаёт DEBIT без результата или создаёт REFUND.

Edge-cases:

Два AI-run одновременно при малом балансе → atomic check-and-debit.

Bulk-run partial success → transactions только по success rows.

Duplicate retry с тем же idempotency key → не списывать дважды.

Admin вручную добавляет adjustment → виден отдельно.

Demo-mode: transactions можно писать как DEMO_DEBIT без уменьшения paid balance (уточнить).

S173 — Credits: лимиты, insufficient credits, rate limits

Экран / меню: AI run button / Bulk run confirmation / Billing → AI credits.

Роль / доступ: Owner/Admin управляет лимитами; пользователь с AI-run permission видит ошибки лимитов при запуске.

Предусловие: workspace имеет credit balance; настроены usage limits: per workspace, per user, per run, per bulk job (уточнить). Research дорогой — 10 credits/run, остальные — 1. 


UI-элементы:

Disabled run button при balance < cost.

Error banner:

Not enough AI credits;

Buy more credits;

Contact admin.

Bulk confirmation total cost.

Admin settings:

monthly cap;

per-user cap;

max bulk rows;

Research allowed toggle (уточнить).

Rate limit warning:

queued;

retrying;

provider busy.

Шаги:

Пользователь нажимает AI run.

Backend проверяет balance и limits.

Если credits хватает — run продолжается.

Если не хватает — endpoint возвращает 402.

UI показывает insufficient credits и ссылку на Billing.

Если превышен лимит пользователя/workspace — 429/403.

Admin пополняет credits или меняет limits.

Пользователь повторяет запуск.

Данные(Prisma):

CreditBalance.

CreditTransaction.

AiUsageLimit (добавить/уточнить):

orgId;

scope=WORKSPACE|USER;

userId?;

period;

limit;

used.

AiRun.status = BLOCKED | FAILED | QUEUED.

Для blocked insufficient credits CreditTransaction не создаётся.

API:

GET /api/billing/credits

POST /api/attributes/:attributeId/ai/run

POST /api/attributes/:attributeId/ai/run-view

GET /api/ai/limits

PATCH /api/ai/limits

errors:

402 INSUFFICIENT_CREDITS;

403 AI_RESEARCH_DISABLED;

429 AI_RATE_LIMITED;

422 BULK_COST_EXCEEDS_BALANCE.

Acceptance:

Если balance меньше cost, run не стартует.

Insufficient credits не создаёт Value и CreditTransaction.

Bulk-run считает total cost до запуска.

Per-user/workspace лимиты блокируют запуск.

Admin может увидеть причину блокировки в usage/transactions.

Provider rate limit ставит job в retry, а не списывает credits до success.

Edge-cases:

Balance хватает на часть bulk-run → предложить run first N или require top-up (уточнить; дефолт — require full estimated cost).

Credits закончились во время bulk-run из-за параллельных запусков → remaining rows skipped with INSUFFICIENT_CREDITS.

Research disabled by admin → hide/disable Research.

Monthly reset во время job → transactional policy должна быть стабильной.

Demo-mode: лимиты можно симулировать тестовым балансом.

[ГОТОВ БАТЧ: S160–S173]


---

План:

Закрываю Batch 8: S180–S190, модуль AI-ассистента Ask AISDR.

Держу единый шаблон: цель → предпосылки → UI/API → шаги → acceptance → edge cases.

Основа: каталог S180–S190 и разбор Academy video 02 Ask Attio; там зафиксированы доступ с homepage/sidebar/topbar, saved prompts, web research и действия update/task/email. 


S180 — Открыть Ask AISDR: homepage / сайдбар / топбар

Модуль: AI-ассистент / Ask AISDR
Статус: ⬜ не начато
Роль: любой авторизованный пользователь workspace.

Цель: пользователь может открыть чат-панель Ask AISDR из трёх точек входа: главная страница, левый сайдбар, верхняя панель большинства CRM-экранов.

Предусловия:

Пользователь залогинен.

Workspace bootstrap выполнен.

Есть хотя бы демо-данные: records, tasks, meetings/calls/emails или пустые состояния для них.

UI:

Homepage-блок с полем Ask anything….

Режим ответа: Auto.

Кнопка отправки.

Быстрые chips/prompts: Prep for next meeting, Recap last call.

Сайдбарный раздел Chats / Ask AISDR.

Топбарная кнопка Ask AISDR на страницах объекта, record page, calls, emails, tasks, reports.

История чатов: recent chats, pinned/saved chats.

API / данные:

GET /api/ai-assistant/chats

POST /api/ai-assistant/chats

GET /api/ai-assistant/chats/:chatId/messages

POST /api/ai-assistant/chats/:chatId/messages

GET /api/ai-assistant/context?route=&recordId=&objectKey=

Модели: AiChat, AiMessage, AiAssistantRun, позже AiToolCall.

Шаги:

Пользователь открывает homepage.

Нажимает поле Ask anything… или кнопку Ask AISDR в сайдбаре.

Открывается чат-панель.

Пользователь закрывает панель.

Открывает object page / record page.

Нажимает topbar Ask AISDR.

Ассистент открывается с контекстом текущей страницы.

Acceptance:

Ask AISDR открывается с homepage.

Ask AISDR открывается из сайдбара без потери текущего route.

Ask AISDR открывается из топбара на object page и record page.

В панели виден список recent chats.

Новый чат создаётся только после первой отправки сообщения или явного New chat.

При открытии с record page в context передаётся recordId.

При открытии с object page в context передаётся objectKey и текущий view/filter.

Пустое состояние не ломается: показывается поле ввода и suggested prompts.

Edge cases:

Нет AI-ключа → demo-AI отвечает детерминированно.

Нет данных workspace → ассистент сообщает, что данных пока нет, и предлагает импорт/создание записей.

Нет прав на текущий record/object → ассистент не раскрывает данные и показывает permission-safe ответ.

S181 — “help me prep for my day” → встречи / сделки / задачи

Модуль: AI-ассистент / Daily prep
Статус: ⬜ не начато
Роль: sales / founder / operator.

Цель: пользователь спрашивает Ask AISDR о подготовке к дню, а система возвращает краткую рабочую сводку: встречи, сделки, просроченные и ближайшие задачи.

Предусловия:

Есть calendar/demo meetings.

Есть tasks.

Есть deals или пустое состояние.

Пользователь имеет права читать эти сущности.

UI:

Пользовательский prompt: help me prep for my day.

Ответ ассистента в виде структурированного summary:

Meetings

Deals needing attention

Overdue tasks

Suggested next actions

Ссылки на записи, задачи и встречи.

Кнопки быстрых действий: Open task, Open record, Draft follow-up, Create task.

API / данные:

POST /api/ai-assistant/chats/:chatId/messages

Tool calls:

searchMeetings(today)

searchTasks(status=open, due<=today)

searchDeals(needingAttention=true)

getRecentActivities(userId)

Источники: Task, Record, Activity, Email, Call, CalendarEvent.

Шаги:

Пользователь открывает Ask AISDR.

Вводит help me prep for my day.

Система собирает встречи на сегодня.

Система собирает просроченные и ближайшие задачи.

Система ищет сделки с последней активностью старше порога, открытыми задачами или upcoming meeting.

Ассистент возвращает сводку.

Acceptance:

Ответ содержит минимум 3 секции: встречи, сделки, задачи.

Каждая сущность в ответе кликабельна.

Встречи сортируются по времени.

Просроченные задачи помечаются отдельно от будущих.

Сделки “needing attention” объясняются причиной: нет активности, overdue task, high value, pending reply.

Если данных нет, показывается корректное empty state summary.

Ассистент не показывает записи, к которым у пользователя нет доступа.

Edge cases:

Нет календаря → показывается demo-calendar или блок “No meetings”.

Много задач → ответ ограничивает список top-N и предлагает открыть полный Tasks view.

Timezone workspace отличается от пользователя → используется timezone пользователя.

S182 — “what objections came up recently?” → сводка по calls / notes / emails + цитаты

Модуль: AI-ассистент / Communication intelligence
Статус: ⬜ не начато
Роль: sales / founder / customer success lead.

Цель: пользователь получает сводку недавних возражений клиентов на основе звонков, заметок и email-переписки, с привязкой к источникам.

Предусловия:

Есть calls с transcript/summary или demo-calls.

Есть notes/emails.

Пользователь имеет права читать коммуникации.

Для MVP можно использовать demo corpus.

UI:

Prompt: what objections came up recently?

Ответ:

top objections grouped by theme;

count/relative frequency;

source snippets;

linked records/calls/emails/notes;

suggested response playbook.

Кнопки: Open call, Open email, Create objection note, Draft response.

API / данные:

POST /api/ai-assistant/chats/:chatId/messages

Tool calls:

searchCalls(query=objections, dateRange=recent)

searchNotes(query=objections)

searchEmails(query=objections)

classifyObjectionThemes(texts[])

Модели: Call, CallTranscript, Note, Email, Activity, Record.

Шаги:

Пользователь задаёт вопрос про recent objections.

Система ищет последние calls/notes/emails за дефолтный период, например 30 дней.

Система извлекает фрагменты с возражениями.

Система группирует темы: pricing, timing, security, migration, budget, missing feature.

Ассистент возвращает summary с источниками.

Acceptance:

Ответ содержит не просто общий текст, а сгруппированные темы.

У каждой темы есть минимум один источник, если источник найден.

Источники кликабельны и ведут в call/email/note/record.

Ассистент показывает период анализа.

Если источников мало, явно пишет, что данных недостаточно.

Для demo-mode возвращается реалистичный фиксированный набор возражений.

Цитаты/сниппеты не превышают безопасный размер и не раскрывают запрещённые записи.

Edge cases:

Нет calls → анализ строится по notes/emails.

Нет emails/notes/calls → пустое состояние с предложением импортировать/синхронизировать коммуникации.

User не имеет доступа к private email → этот email исключается.

S183 — Сохранить prompt: Account settings → Prompts + имя

Модуль: AI-ассистент / Prompt library
Статус: ⬜ не начато
Роль: любой пользователь; admin может управлять team/workspace prompts.

Цель: пользователь сохраняет часто используемый prompt в библиотеку, задаёт имя и затем использует его в Ask AISDR.

Предусловия:

Пользователь авторизован.

Доступен Settings → Account → Prompts.

Есть модель prompt templates.

UI:

Settings sidebar → Account → Prompts.

Список saved prompts.

Кнопка New prompt.

Поля:

Name

Prompt

Visibility: personal / team / workspace, если поддерживается.

Context type: general / record / call / meeting / company research.

Кнопки: Save, Cancel, Delete, Duplicate.

API / данные:

GET /api/ai-prompts

POST /api/ai-prompts

PATCH /api/ai-prompts/:id

DELETE /api/ai-prompts/:id

Модель: AiPromptTemplate

id

orgId

createdById

name

prompt

visibility

contextType

createdAt

updatedAt

Шаги:

Пользователь открывает Account settings.

Переходит в Prompts.

Нажимает New prompt.

Вводит имя, например Detailed call prep.

Вводит текст prompt.

Сохраняет.

Prompt появляется в списке.

Acceptance:

Prompt нельзя сохранить без имени.

Prompt нельзя сохранить без текста.

После сохранения prompt появляется в Settings → Prompts.

Prompt доступен в Ask AISDR prompt picker.

Prompt сохраняет автора и дату обновления.

Personal prompt виден только автору.

Workspace/team prompt учитывает права доступа, если включены permissions.

Edge cases:

Дубликат имени → разрешён, но UI показывает автора/дату; либо предлагает rename.

Prompt слишком длинный → понятная ошибка лимита.

Пользователь без прав workspace prompt → может создать только personal prompt.

S184 — Переиспользовать сохранённый prompt → call-prep сводка

Модуль: AI-ассистент / Prompt library
Статус: ⬜ не начато
Роль: sales / customer success.

Цель: пользователь выбирает сохранённый prompt в Ask AISDR и получает call-prep summary по текущей встрече, компании, сделке или записи.

Предусловия:

Есть сохранённый prompt из S183.

Есть record/call/meeting context.

Пользователь имеет доступ к связанным данным.

UI:

Ask AISDR panel.

Prompt picker: Saved prompts.

Список prompts с поиском.

Выбранный prompt вставляется в input или запускается сразу.

Ответ structured:

company/account overview;

recent interactions;

open questions;

suggested topics;

risks/objections;

next best actions.

API / данные:

GET /api/ai-prompts?contextType=call

POST /api/ai-assistant/chats/:chatId/messages

Tool calls:

getPromptTemplate(promptId)

getRecordContext(recordId)

getRecentInteractions(recordId)

getUpcomingMeeting(recordId|userId)

Шаги:

Пользователь открывает record page компании перед звонком.

Открывает Ask AISDR.

Выбирает saved prompt Detailed call prep.

Система подставляет контекст записи и recent interactions.

Ассистент формирует call-prep summary.

Acceptance:

Saved prompt доступен из Ask AISDR.

Prompt может быть найден поиском.

При запуске из record page используется текущая запись.

Ответ содержит подготовку к звонку, а не общий ответ без контекста.

Источники recent interactions кликабельны.

Prompt не изменяется после использования; создаётся только message/run.

Если контекста недостаточно, ассистент задаёт ограниченный уточняющий вопрос или честно сообщает, какие данные отсутствуют.

Edge cases:

Prompt требует call context, но пользователь находится вне record/call → UI предлагает выбрать запись.

Prompt удалён в другой вкладке → picker обновляется и показывает ошибку “Prompt no longer exists”.

Нет recent interactions → summary строится по record details.

S185 — Веб-ресёрч по компании / рынку

Модуль: AI-ассистент / Research agent
Статус: ⬜ не начато
Роль: sales / founder / analyst.

Цель: Ask AISDR выполняет research по компании, рынку или prospect account, объединяя CRM-контекст с внешней информацией; в demo-mode возвращает детерминированный research brief.

Предусловия:

Есть company/person/deal record или пользователь вводит название компании.

Настроен real AI/web research provider или demo-mode.

Для Research agent применяются кредиты, если включён биллинг AI.

UI:

Prompt examples:

Research this company and tell me if it fits our ICP

What changed recently in this market?

Find reasons to personalize outreach to Cosme

Ответ:

company summary;

market/industry context;

buying signals;

risks;

suggested personalization;

source list / demo-source markers.

Badge стоимости: 10 credits для research-agent, если применимо.

API / данные:

POST /api/ai-assistant/research

POST /api/ai-assistant/chats/:chatId/messages

Tool calls:

getRecordContext(recordId)

runResearchAgent(query, recordContext)

writeResearchResult(optional target)

Модели: AiAssistantRun, CreditTransaction, возможно ResearchReport.

Шаги:

Пользователь открывает company/deal record.

Запрашивает веб-ресёрч.

Система собирает CRM-контекст записи.

Система запускает research-agent.

Ассистент возвращает research brief.

Пользователь может сохранить результат в note, AI-атрибут или activity.

Acceptance:

Research учитывает текущую запись, если запущен из record page.

Research может работать по введённому названию компании без recordId.

В ответе явно разделены CRM facts и external/demo research.

При включённых credits списывается 10 кредитов.

При нехватке кредитов запуск блокируется до подтверждения/пополнения.

Demo-mode не требует внешних ключей и возвращает стабильный осмысленный brief.

Ответ можно сохранить как note или использовать в draft email.

Edge cases:

Компания не найдена → ассистент просит уточнить домен/страницу или создаёт generic market brief.

Нет web provider → demo-mode.

Research вернул противоречивые сведения → ассистент помечает uncertainty.

S186 — Во время звонка: “спрашивали ли про pricing?” → кто / когда / что

Модуль: AI-ассистент / Live call context
Статус: ⬜ не начато
Роль: sales rep во время call.

Цель: во время звонка пользователь спрашивает, обсуждалось ли с этой компанией pricing, и получает короткий ответ с участниками, датой и содержанием прошлых обсуждений.

Предусловия:

Есть текущий call context или открыта company/deal record.

Есть email/call/note history.

Пользователь имеет доступ к communication history.

UI:

Ask AISDR доступен поверх call page / record page.

Prompt: Have we spoken to anyone at this company about pricing?

Ответ:

yes/no;

who;

when;

what was discussed;

source links;

suggested answer to customer.

Кнопки: Open source, Copy answer, Create follow-up.

API / данные:

POST /api/ai-assistant/chats/:chatId/messages

Tool calls:

getActiveCallContext()

searchInteractions(recordId, query=pricing)

summarizePricingHistory(interactions[])

Источники: CallTranscript, Email, Note, Activity.

Шаги:

Пользователь находится на звонке или call record.

Открывает Ask AISDR.

Спрашивает про pricing history.

Система определяет связанную company/deal/person.

Ищет упоминания pricing в calls/notes/emails.

Возвращает краткий ответ.

Acceptance:

Ассистент отвечает по текущей компании, а не по всему workspace.

В ответе есть кто, когда, что обсуждали, если данные найдены.

Ответ содержит ссылки на источники.

Если pricing не обсуждался, ответ явно говорит “не нашёл упоминаний”.

Во время звонка ответ короткий и пригодный для быстрого использования.

Private emails/calls без доступа исключаются.

Edge cases:

Активный call не связан с record → ассистент предлагает выбрать company/person.

Много совпадений → показывает последние 3 и предлагает раскрыть полный список.

Упоминание pricing найдено в заметке без даты → помечается как источник с неполной датой.

S187 — “suggest updates based on call” → ревью → обновить запись

Модуль: AI-ассистент / Controlled actions
Статус: ⬜ не начато
Роль: sales / CS.

Цель: после звонка Ask AISDR предлагает обновления CRM-записи на основе call transcript/summary; пользователь ревьюит изменения и только после подтверждения они применяются.

Предусловия:

Есть call transcript/summary.

Call связан с record/deal/company/person.

У пользователя есть READ_WRITE доступ к записи.

UI:

Prompt: suggest updates based on this call.

Assistant response содержит proposed updates:

field name;

current value;

suggested value;

reason/source snippet;

checkbox apply/skip.

CTA: Apply selected updates.

Confirmation modal перед записью.

Activity после обновления.

API / данные:

POST /api/ai-assistant/suggest-updates

POST /api/ai-assistant/actions/apply-record-updates

Tool calls:

getCallContext(callId)

getRecordValues(recordId)

suggestRecordPatches(callContext, recordSchema)

patchRecord(recordId, values)

Модели: AiSuggestedAction, Activity, Value.

Шаги:

Пользователь открывает завершённый call или record page.

Запрашивает suggested updates.

Система анализирует transcript/summary.

Ассистент показывает список предлагаемых изменений.

Пользователь выбирает, что применить.

Нажимает Apply selected updates.

Backend обновляет значения и пишет activity.

Acceptance:

Никакое поле не обновляется без явного подтверждения пользователя.

Предложение показывает before/after.

Можно применить часть изменений, а часть пропустить.

Обновления валидируются по типам атрибутов.

После применения values реально меняются в record.

В Activity появляется запись об AI-assisted update.

При недостатке прав кнопка apply disabled и показывается причина.

Edge cases:

Предлагаемое значение не проходит валидацию select/currency/date → field-level error.

Запись была изменена другим пользователем до apply → показывается conflict и предлагается refresh.

Transcript пустой → ассистент не предлагает изменения.

S188 — “create a task to follow up” → задача + линк + срок

Модуль: AI-ассистент / Task action
Статус: ⬜ не начато
Роль: любой пользователь с доступом к задачам.

Цель: пользователь просит Ask AISDR создать follow-up task; ассистент определяет связанную запись, assignee и due date, затем создаёт задачу.

Предусловия:

Открыта record/call/email context или пользователь явно указывает entity.

Есть Tasks API.

Пользователь имеет право создавать задачи.

UI:

Prompt examples:

create a task for me to follow up next week

remind me to send pricing tomorrow

Proposed task card:

title;

linked record;

assignee;

due date;

description;

source context.

CTA: Create task.

После создания: toast + ссылка Open task.

API / данные:

POST /api/tasks

POST /api/ai-assistant/actions/create-task

Tool calls:

parseTaskRequest(message)

resolveLinkedRecord(context)

createTask(payload)

Модель: Task.

Шаги:

Пользователь пишет create a task to follow up next week.

Ассистент определяет дату: следующая неделя / конкретный день.

Ассистент определяет linked record из текущего контекста.

Показывает preview задачи.

Пользователь подтверждает.

Система создаёт task и связывает её с record.

Acceptance:

Задача создаётся с title, assignee, dueDate и linkedRecordId.

Если prompt содержит относительную дату, backend сохраняет абсолютную дату.

По умолчанию assignee = текущий пользователь.

Задача отображается на Tasks page.

Задача отображается на вкладке Tasks record page.

После создания есть activity на связанной записи.

Если linked record не определён, ассистент предлагает выбрать запись перед созданием.

Edge cases:

Пользователь написал “next week” без дня → система выбирает дефолтный рабочий день или просит уточнить.

Дата в прошлом → показывает предупреждение.

Нет прав на linked record → задача создаётся без связи или блокируется, в зависимости от политики.

S189 — “draft a follow-up email” → черновик → send

Модуль: AI-ассистент / Email drafting
Статус: ⬜ не начато
Роль: sales / CS.

Цель: Ask AISDR создаёт follow-up email на основе контекста звонка/записи; пользователь ревьюит черновик и отправляет вручную.

Предусловия:

Есть call/email/record context.

Есть recipient: main contact / associated person / явно выбранный email.

Demo email mode работает без SMTP.

У пользователя есть право отправлять или создавать draft.

UI:

Prompt: draft a follow-up email based on this call.

Draft preview:

From;

To;

Subject;

Body;

linked record;

source context.

Actions:

Edit draft

Save draft

Send

Use template

Regenerate

Для demo-mode: badge Demo send.

API / данные:

POST /api/records/:recordId/emails/draft

POST /api/records/:recordId/emails/send

POST /api/ai-assistant/actions/draft-email

Tool calls:

getCallContext(callId)

getRecipient(recordId)

generateFollowUpEmail(context)

createEmailDraft(payload)

sendEmail(draftId|payload)

Модели: Email, Activity.

Шаги:

Пользователь открывает call или record.

Пишет draft a follow-up email based on this call.

Ассистент собирает call summary, next steps, участника и CRM-данные.

Генерирует subject/body.

Пользователь редактирует текст.

Нажимает Send.

Система отправляет письмо или demo-send.

Письмо появляется в Emails tab и Activity.

Acceptance:

Черновик не отправляется автоматически.

Пользователь видит и может редактировать subject/body перед send.

Recipient подставляется из main contact или выбранной person.

Email body отражает call context: решения, next steps, follow-up.

После send появляется email activity.

Demo-mode безопасно имитирует отправку без внешнего SMTP.

Если recipient отсутствует, отправка disabled до выбора получателя.

Edge cases:

Несколько main contacts → UI предлагает выбрать recipient.

Нет call summary → письмо генерируется по record context.

Пользователь не подключил mailbox → доступно Save draft, но send показывает настройку mailbox/demo send.

S190 — Homepage: приветствие + recent chat + Meetings + Tasks

Модуль: AI homepage / Ask AISDR entrypoint
Статус: ⬜ не начато
Роль: любой авторизованный пользователь.

Цель: homepage показывает персонализированное рабочее состояние дня и вход в Ask AISDR: greeting, recent chat, meetings, tasks.

Предусловия:

Пользователь авторизован.

Есть текущий user profile.

Есть tasks/meetings или пустые состояния.

Есть chat history или пустое состояние.

UI:

Greeting: Good morning/afternoon/evening, {Name}.

Recent chat row: Recent chat · {chatTitle}.

Ask input: Ask anything….

Quick prompt chips:

Prep for next meeting

Recap last call

Draft follow-up

Meetings section:

Today / date;

past/upcoming events;

meeting card with time, participants, linked record, meeting link.

Tasks section:

upcoming/overdue tasks;

View all.

Sidebar Chats list.

API / данные:

GET /api/home

GET /api/ai-assistant/chats?limit=5

GET /api/tasks?scope=home

GET /api/calendar/events?date=today

GET /api/notifications/unread-count

Модели: AiChat, Task, CalendarEvent, Record.

Шаги:

Пользователь логинится.

Система открывает homepage.

Backend возвращает greeting context, recent chats, meetings, tasks.

UI отображает homepage sections.

Пользователь нажимает recent chat или quick prompt.

Открывается Ask AISDR с выбранным prompt/chat.

Acceptance:

Greeting зависит от имени пользователя и времени дня.

Recent chat показывается, если есть история; иначе empty state.

Meetings показывают сегодняшние события.

Tasks показывают просроченные и ближайшие задачи.

View all ведёт на Tasks page.

Клик по meeting ведёт к meeting/call/record context, если связь есть.

Quick prompt открывает Ask AISDR и вставляет/запускает prompt.

Homepage работает без календарной интеграции: показывает demo/empty state.

Edge cases:

Новый пользователь без данных → homepage не пустой: показывает suggested prompts и onboarding CTA.

Calendar sync отключён → Meetings section показывает connect/demo state.

Очень много tasks → показываются top-N, остальные через View all.

Recent chat был удалён → row скрывается или обновляется.

[ГОТОВ БАТЧ: S180–S190]


---

План:

Продолжаю каталог acceptance-сценариев по Sequences, строго S200–S212.

Названия S200–S212 беру из SCENARIOS_CATALOG; механику settings/editor/enroll — из Academy 14–16 и storyboard sequence-editor. 


 


 


S200 — Создать sequence: Automations→Sequences→New → title → черновик

Экран/меню · Automations → Sequences → New sequence; после создания — Sequence editor, вкладки Editor / Recipients / Settings.

Роль/доступ · OWNER, ADMIN или MEMBER с FULL/READ_WRITE доступом к Sequences. Пользователь без прав видит список read-only или не видит раздел.

Предусловие · Пользователь авторизован; workspace bootstrap выполнен; есть хотя бы один mailbox/demo-mailbox для будущей отправки; раздел Automations доступен в сайдбаре.

UI-элементы · Список sequences; Sorted by Creation date; Filter; View settings; New sequence; модалка/инлайн-форма Title; кнопки Create, Cancel; статус Draft; пустой editor с первым email-step placeholder; правая панель settings.

Шаги ·

Пользователь открывает Automations → Sequences.

Нажимает New sequence.

Вводит title, например ICP Inbound Leads.

Нажимает Create.

Система создаёт sequence в статусе DRAFT.

Пользователь попадает в editor новой sequence.

Данные(Prisma) ·

Sequence: id, orgId, name, status=DRAFT, createdById, ownerId, version, createdAt, updatedAt.

SequenceVersion: id, sequenceId, version, status=DRAFT, createdById.

Activity: событие SEQUENCE_CREATED.

Для текущей legacy-модели Campaign/Sequence нужен новый слой или миграция в flexible Sequence.

API ·

GET /api/sequences

POST /api/sequences

GET /api/sequences/:sequenceId

PATCH /api/sequences/:sequenceId

Ошибки: 400 TITLE_REQUIRED, 403 SEQUENCE_ACCESS_DENIED, 409 DUPLICATE_SEQUENCE_NAME если включаем уникальность имени в workspace.

Acceptance ·

Sequence создаётся из Automations → Sequences → New.

Без title создать нельзя.

Новая sequence получает статус DRAFT.

После создания открывается editor именно этой sequence.

Sequence появляется в списке sequences.

У sequence есть creator/owner/version.

Пользователь без прав не может создать sequence.

Создание не отправляет email и не создаёт enrollments.

Edge-cases ·

Пустой workspace: список sequences показывает empty state и кнопку New sequence.

Дубликат имени: разрешить с отображением owner/date или блокировать через 409.

Пользователь теряет права во время создания: backend отклоняет POST.

Demo-mode: sequence создаётся без SMTP и помечается как demoSendAvailable=true.

S201 — Settings: sending window

Экран/меню · Sequence editor → Settings panel → Delivery → Sending window.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с FULL/READ_WRITE доступом к sequence.

Предусловие · Sequence существует в статусе DRAFT или редактируемой версии; пользователь открыл editor; timezone workspace или пользователя определён.

UI-элементы · Блок Delivery; toggle Sending window; поля Start time, End time; timezone dropdown, например Europe/London; подсказка: письма вне окна попадут в очередь до начала следующего окна.

Шаги ·

Пользователь открывает sequence.

В правой панели Delivery включает Sending window.

Указывает 09:00–18:00.

Выбирает timezone.

Сохраняет настройки.

Worker учитывает окно при планировании email.

Данные(Prisma) ·

Sequence: sendingWindowEnabled, sendingWindowStart, sendingWindowEnd, timezone.

SequenceStep: не меняется.

SequenceEnrollment: nextSendAt.

Email: scheduledAt, status=QUEUED.

SequenceSendJob: scheduledAt, mailboxId.

API ·

PATCH /api/sequences/:sequenceId/settings

GET /api/sequences/:sequenceId/settings

Worker: sequenceQueue пересчитывает nextSendAt.

Ошибки: 400 INVALID_SENDING_WINDOW, 400 INVALID_TIMEZONE, 403 SEQUENCE_ACCESS_DENIED.

Acceptance ·

Можно включить/выключить sending window.

Start time должен быть раньше end time.

Timezone сохраняется и используется worker-ом.

Если письмо должно уйти вне окна, оно получает scheduledAt на начало следующего окна.

UI показывает сохранённые значения после reload.

Изменение settings не ломает уже созданные enrollments: будущие письма пересчитываются по новым правилам.

В demo-mode outbox показывает планируемое время, но реально не отправляет наружу.

Edge-cases ·

Окно пересекает полночь: либо запрещаем в MVP, либо явно поддерживаем 22:00–02:00.

Неверная timezone: backend отклоняет.

DST-переход: расчёт через timezone-aware библиотеку.

Если окно выключено, worker использует ближайшее допустимое время по лимитам mailbox.

S202 — Settings: лимиты доставляемости

Экран/меню · Sequence editor → Settings panel → Delivery → Deliverability limits; также Emails → Outbox.

Роль/доступ · OWNER, ADMIN, sequence owner; mailbox owner может управлять лимитами своего ящика.

Предусловие · Sequence создана; mailbox/demo-mailbox доступен; worker/BullMQ включён; Redis доступен или demo-queue работает in-memory.

UI-элементы · Поля/подсказки: 12 emails/hour/mailbox, 5 min pause between emails, 200 emails/day/mailbox; read-only дефолты или editable workspace settings; warning при превышении.

Шаги ·

Пользователь открывает delivery settings.

Видит дефолтные лимиты.

Enroll создаёт send jobs.

Worker берёт следующий job.

Worker проверяет hourly/daily counters и минимальную паузу.

Если лимит превышен, job переносится.

Данные(Prisma) ·

Mailbox: id, userId, email, dailyLimit, hourlyLimit, minDelayMinutes, sentTodayCount, lastSentAt.

SequenceSendJob: status, scheduledAt, attempts, blockedReason.

Email: sequenceId, enrollmentId, status=QUEUED/SENT/DEFERRED.

SequenceEnrollment: status, currentStepId, nextSendAt.

API ·

GET /api/sequences/:sequenceId/delivery-limits

PATCH /api/mailboxes/:mailboxId/limits для admin/owner, если разрешаем настройку.

GET /api/emails/outbox

Worker: sequenceQueue.process(sendSequenceEmail).

Ошибки: 429 MAILBOX_HOURLY_LIMIT_REACHED, 429 MAILBOX_DAILY_LIMIT_REACHED, 409 MAILBOX_NOT_CONNECTED.

Acceptance ·

Worker не отправляет больше 12 писем в час на один mailbox.

Между письмами одного mailbox выдерживается минимум 5 минут.

Worker не отправляет больше 200 писем в день на один mailbox.

Deferred письма остаются в Outbox с причиной переноса.

Лимиты применяются ко всем sequences, использующим один mailbox.

При demo-send лимиты всё равно симулируются.

UI показывает, что delivery time зависит от outbox limits.

Edge-cases ·

Несколько sequences используют один mailbox: общий rate-limit.

Делегированная отправка использует лимиты sender mailbox, а не пользователя, который enroll сделал.

Сбой worker после отправки: нужен идемпотентный providerMessageId или demo-send id.

Смена лимитов пересчитывает только будущие queued jobs.

S203 — Settings: business days only / включить выходные

Экран/меню · Sequence editor → Settings panel → Delivery → Business days only.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE.

Предусловие · Sequence создана; timezone задан; sending window может быть включён или выключен.

UI-элементы · Toggle Business days only; пояснение Send only Monday–Friday; опция включить отправку в выходные; preview следующего send time.

Шаги ·

Пользователь открывает delivery settings.

Включает Business days only.

Сохраняет.

Enroll или worker рассчитывает nextSendAt.

Если дата попадает на субботу/воскресенье, письмо переносится на ближайший рабочий день.

Данные(Prisma) ·

Sequence: businessDaysOnly: Boolean.

SequenceEnrollment: nextSendAt.

SequenceSendJob: scheduledAt, deferredReason=WEEKEND.

Опционально WorkspaceCalendar: holidays/custom business days позже.

API ·

PATCH /api/sequences/:sequenceId/settings

POST /api/sequences/:sequenceId/recalculate-schedule

Worker helper: calculateNextBusinessSendAt(sequence, baseDate).

Ошибки: 400 INVALID_DELIVERY_SETTINGS.

Acceptance ·

При businessDaysOnly=true письма не планируются на субботу/воскресенье.

При businessDaysOnly=false письма могут планироваться на выходные при соблюдении лимитов.

UI после reload показывает выбранный режим.

Изменение настройки пересчитывает будущие queued jobs.

Timezone учитывается при определении дня недели.

Wait N business days в шагах использует эту настройку или собственный флаг step-level.

Edge-cases ·

Пятница вечер + wait 1 business day → понедельник в delivery window.

Пользователь меняет timezone: будущие даты пересчитываются.

Holidays не поддержаны в MVP: явно считаем только Mon–Fri.

Если weekend sending включён, unsubscribe/exit criteria всё равно работают.

S204 — Settings: unsubscribe-ссылка

Экран/меню · Sequence editor → Settings panel → Email → Unsubscribe link.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE.

Предусловие · Sequence создана; есть email step; workspace имеет base URL для unsubscribe; sender mailbox определён.

UI-элементы · Dropdown Unsubscribe link; поле текста, например Not interested? Let me know; preview ссылки; warning если unsubscribe отсутствует; footer preview в email editor.

Шаги ·

Пользователь открывает Email settings.

Включает unsubscribe link.

Задаёт текст ссылки.

Видит preview в письме.

Сохраняет settings.

При отправке worker вставляет уникальную unsubscribe-ссылку в email body.

Данные(Prisma) ·

Sequence: unsubscribeEnabled, unsubscribeText.

Email: unsubscribeToken, bodyHtml, bodyText.

Unsubscribe: orgId, email, senderMailboxId, sequenceId, reason, createdAt.

SequenceEnrollment: status=UNSUBSCRIBED/EXITED.

API ·

PATCH /api/sequences/:sequenceId/settings

GET /api/sequences/:sequenceId/unsubscribe-preview

GET /api/unsubscribe/:token

POST /api/unsubscribe/:token

Ошибки: 400 UNSUBSCRIBE_TEXT_REQUIRED, 409 RECIPIENT_UNSUBSCRIBED.

Acceptance ·

Unsubscribe link можно включить и настроить текст.

Preview показывает ссылку в email body.

Каждое письмо получает уникальный token.

Клик по unsubscribe переводит enrollment в EXITED/UNSUBSCRIBED.

Email попадает в suppression list для того же sender/workspace policy.

Повторный enroll заблокирован для unsubscribed recipient.

Текст unsubscribe сохраняется в settings и переживает reload.

Edge-cases ·

Пользователь удаляет unsubscribe из body вручную: worker всё равно добавляет footer, если setting включён.

Recipient уже unsubscribed: enroll блокируется до отправки.

Token истёк/не найден: страница показывает безопасную ошибку.

Несколько senders: suppression policy должна явно определить scope — workspace-wide или per-sender; для MVP per-workspace безопаснее.

S205 — Settings: subsequent emails — тот же тред или новый

Экран/меню · Sequence editor → Settings panel → Email → Thread emails.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE.

Предусловие · Sequence создана; есть минимум два email step; mailbox/demo-mailbox поддерживает thread metadata.

UI-элементы · Toggle Thread emails; подпись Send subsequent emails in the same thread; preview subject для follow-up; warning при выключении.

Шаги ·

Пользователь открывает Email settings.

Включает Thread emails.

Создаёт step 1 и step 2.

Enroll запускает step 1.

При step 2 worker отправляет письмо с inReplyTo/threadId или subject Re:.

Если toggle выключен, step 2 уходит новым письмом.

Данные(Prisma) ·

Sequence: threadMode=SAME_THREAD|NEW_THREAD.

Email: threadId, inReplyToEmailId, providerThreadId, subject.

SequenceEnrollment: lastSentEmailId, threadRootEmailId.

API ·

PATCH /api/sequences/:sequenceId/settings

POST /api/sequences/:sequenceId/enroll

Worker: buildThreadHeaders(enrollment, step).

Ошибки: 409 THREAD_ROOT_NOT_FOUND, fallback на new thread с warning.

Acceptance ·

Toggle сохраняется.

При SAME_THREAD follow-up связан с первым письмом.

При NEW_THREAD follow-up создаёт отдельный thread.

В Outbox видно, какой режим будет применён.

Если provider threadId отсутствует в demo-mode, система симулирует threadId.

Reply на любой email из thread приводит к exit по S207, если критерий включён.

Edge-cases ·

Step 1 был удалён после publish: enrolled version сохраняет thread-root.

Provider не поддерживает thread headers: fallback и лог warning.

Пользователь меняет режим после enroll: новые recipients получают новую версию, active recipients остаются на версии enroll.

Subject пустой в follow-up: блокировать publish.

S206 — Settings: включить подпись из mailbox settings

Экран/меню · Sequence editor → Settings panel → Email → Include sender signature.

Роль/доступ · OWNER, ADMIN, sequence owner; sender mailbox owner управляет своей подписью.

Предусловие · У sender mailbox есть подпись или demo-signature; sequence имеет email steps; sender выбран при enroll или delegated sending.

UI-элементы · Toggle Include sender signature; placeholder в editor Sender signature will appear here; preview для выбранного sender; ссылка Mailbox settings.

Шаги ·

Пользователь открывает sequence editor.

Включает Include sender signature.

В email body видит placeholder подписи.

При enroll выбирается sender.

Worker подставляет подпись sender mailbox при отправке.

Данные(Prisma) ·

Mailbox: signatureHtml, signatureText, signatureEnabled.

Sequence: includeSenderSignature.

SequenceEnrollment: senderUserId, senderMailboxId.

Email: bodyHtml, bodyText, renderedSignature.

API ·

PATCH /api/sequences/:sequenceId/settings

GET /api/mailboxes/:mailboxId/signature

Worker: renderEmailWithSignature(stepBody, mailboxSignature).

Ошибки: 409 SENDER_SIGNATURE_MISSING как warning, не hard fail.

Acceptance ·

Toggle сохраняется.

Editor показывает placeholder, а не чужую подпись без выбранного sender.

При отправке используется подпись фактического sender.

Если delegated sending включён, используется подпись delegated sender mailbox.

Если подписи нет, письмо отправляется без подписи и с warning в preview.

Demo-mode добавляет демо-подпись.

Edge-cases ·

Sender меняется после enroll: active enrollment сохраняет исходного sender.

Signature содержит небезопасный HTML: sanitizer очищает.

Plain-text email получает text signature.

Пользователь отключил подпись в mailbox settings после queue: worker берёт актуальное состояние или snapshot; MVP — snapshot при постановке в очередь.

S207 — Exit criteria: reply received

Экран/меню · Sequence editor → Settings panel → Exit criteria → Reply received; также Recipients tab.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE.

Предусловие · Sequence опубликована или в draft; inbound email tracking/demo-reply включён; enrollment active.

UI-элементы · Checkbox/toggle Reply received; tooltip: получатель выйдет из sequence после ответа; Recipients status Exited — replied; Activity event на record.

Шаги ·

Пользователь включает exit criteria Reply received.

Enroll получает step 1.

Recipient отвечает.

Email sync/webhook/demo-reply классифицирует входящее письмо как reply.

Enrollment переводится в EXITED.

Будущие queued jobs отменяются.

Данные(Prisma) ·

Sequence: exitOnReply: Boolean.

SequenceEnrollment: status=ACTIVE/EXITED, exitReason=REPLIED, exitedAt.

Email: direction=INBOUND, replyToEmailId, sequenceId, enrollmentId.

SequenceSendJob: status=CANCELLED, cancelReason=RECIPIENT_REPLIED.

Activity: SEQUENCE_RECIPIENT_EXITED.

API ·

PATCH /api/sequences/:sequenceId/settings

POST /api/email/inbound-webhook

POST /api/sequences/:sequenceId/enrollments/:enrollmentId/simulate-reply для demo/test.

GET /api/sequences/:sequenceId/recipients

Ошибки: 404 ENROLLMENT_NOT_FOUND.

Acceptance ·

Reply переводит active enrollment в EXITED.

Будущие письма этому recipient в этой enrollment не отправляются.

Recipients tab показывает Exited и reason Reply received.

Activity появляется на linked record.

Reply на follow-up тоже вызывает exit.

Если setting выключен, reply сохраняется, но enrollment не выходит автоматически.

OOO reply не считается обычным reply, если S218 будет включён позже.

Edge-cases ·

Reply пришёл после manual exit: статус не меняется, сохраняется activity.

Один recipient enrolled в несколько sequences: exit применяется только к текущей sequence, если policy не workspace-wide.

Reply пришёл с alias email: matching по threadId/messageId/email aliases.

Bounce не считается reply.

S208 — Exit criteria: meeting booked

Экран/меню · Sequence editor → Settings panel → Exit criteria → Meeting booked; также Calendar sync, Recipients.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE.

Предусловие · Calendar/demo-calendar доступен; recipient связан с person record; meeting booking event можно сопоставить с recipient или linked company/deal.

UI-элементы · Checkbox/toggle Meeting booked; tooltip; Recipients status Exited — meeting booked; link на calendar event.

Шаги ·

Пользователь включает Meeting booked.

Recipient enrolled и получает письмо.

Система получает calendar event или demo booking.

Matching определяет, что recipient/person/company участвует во встрече.

Enrollment переводится в EXITED.

Future jobs отменяются.

Данные(Prisma) ·

Sequence: exitOnMeetingBooked.

CalendarEvent: id, orgId, startsAt, participants, linkedRecordId.

SequenceEnrollment: status=EXITED, exitReason=MEETING_BOOKED, exitedAt.

SequenceSendJob: status=CANCELLED.

Activity: SEQUENCE_EXIT_MEETING_BOOKED.

API ·

PATCH /api/sequences/:sequenceId/settings

POST /api/calendar/webhook

POST /api/sequences/:sequenceId/enrollments/:enrollmentId/simulate-meeting-booked

GET /api/sequences/:sequenceId/recipients

Ошибки: 409 CALENDAR_NOT_CONNECTED как warning, если включаем без calendar.

Acceptance ·

Meeting booked переводит enrollment в EXITED.

Будущие письма отменяются.

Recipients tab показывает reason Meeting booked.

Activity содержит ссылку на meeting/calendar event.

Если calendar sync отключён, demo-mode позволяет симулировать booking.

Если setting выключен, booking не выводит recipient из sequence.

Edge-cases ·

Meeting booked другим человеком из той же компании: MVP применяет exit только при совпадении person email; расширение — account-level exit.

Встреча отменена после exit: автоматически не возвращаем recipient в sequence.

Несколько meetings: первый валидный booking завершает enrollment.

Booking пришёл до первого письма: enrollment выходит до отправки.

S209 — Доступ к sequence

Экран/меню · Sequence editor → Share / Settings → Permissions; Workspace settings → Automations → Sequences.

Роль/доступ · OWNER/ADMIN управляет всеми permissions; creator/owner может управлять доступом, если имеет FULL.

Предусловие · Sequence существует; есть пользователи/teams; RBAC-модель включена или MVP-level share policy.

UI-элементы · Кнопка Share; секции Workspace access, Teams, Individual members; уровни No access, Read only, Read and write, Full access; owner badge; список участников.

Шаги ·

Создатель открывает Share.

Видит default workspace visibility.

Меняет workspace access или добавляет team/user.

Сохраняет permissions.

Другой пользователь видит/редактирует sequence согласно effective access.

Данные(Prisma) ·

Sequence: ownerId, visibility, createdById.

PermissionGrant: entityType=SEQUENCE, entityId, scope=WORKSPACE|TEAM|USER, subjectId, level.

Team, TeamMember.

Activity: SEQUENCE_PERMISSION_UPDATED.

API ·

GET /api/sequences/:sequenceId/permissions

PUT /api/sequences/:sequenceId/permissions

GET /api/sequences?respectPermissions=true

Ошибки: 403 PERMISSION_MANAGE_DENIED, 400 INVALID_PERMISSION_LEVEL.

Acceptance ·

По умолчанию sequence видна workspace или только creator — выбранное правило должно быть явным.

Пользователь с READ может открыть sequence, но не редактировать.

Пользователь с READ_WRITE может редактировать content/settings, но не permissions.

Пользователь с FULL может управлять permissions.

NO_ACCESS скрывает sequence из списка.

Permissions применяются к editor, recipients и settings.

Backend проверяет права, не только UI.

Edge-cases ·

Пользователь потерял доступ во время редактирования: save отклоняется.

Owner удалён из workspace: ownership передаётся admin или sequence блокируется для редактирования.

Team и individual конфликтуют: individual override выше team/workspace.

Workflow enroll в sequence требует отдельного access/grant.

S210 — Delegated sending

Экран/меню · Sequence editor → Settings → Email / Sending; Enroll recipients modal → Sender; Mailbox settings → Delegated sending.

Роль/доступ · Sender должен разрешить delegated sending; enrolling user должен иметь доступ к sequence и право enroll. Admin может видеть состояние, но не должен отправлять от чужого ящика без разрешения.

Предусловие · У sender подключён mailbox/demo-mailbox; sender включил delegated sending; sequence поддерживает выбор sender при enroll.

UI-элементы · Toggle Delegated sending; sender dropdown в enroll modal; badge Delegated; предупреждение “emails will be sent from {sender}”; список доступных senders.

Шаги ·

Sender включает delegated sending в mailbox/sequence settings.

Другой пользователь открывает sequence.

Нажимает Enroll recipients.

Выбирает sender, например Heather.

Система проверяет delegated permission.

Письма ставятся в очередь от mailbox Heather.

Данные(Prisma) ·

Mailbox: userId, delegatedSendingEnabled.

MailboxDelegate: mailboxId, delegateUserId или scope=WORKSPACE/TEAM.

SequenceEnrollment: enrolledById, senderUserId, senderMailboxId.

Email: fromUserId, fromMailboxId, createdById.

Activity: SEQUENCE_ENROLLED_DELEGATED.

API ·

GET /api/sequences/:sequenceId/available-senders

POST /api/sequences/:sequenceId/enroll

PATCH /api/mailboxes/:mailboxId/delegation

Ошибки: 403 DELEGATED_SENDING_NOT_ALLOWED, 409 SENDER_MAILBOX_NOT_CONNECTED.

Acceptance ·

Enrolling user может выбрать только разрешённых senders.

Email From соответствует выбранному sender.

Лимиты S202 применяются к sender mailbox.

Подпись S206 берётся у sender.

В enrollment сохраняются enrolledBy и sender.

Если delegated sending отключён, sender исчезает из dropdown.

Audit trail показывает, кто enroll сделал и от чьего имени ушло письмо.

Edge-cases ·

Sender отключил mailbox после enroll: будущие jobs paused/blocked.

Sender отключил delegated sending после enroll: новые enroll запрещены; существующие — по policy, MVP ставит future jobs на hold.

Несколько mailbox у sender: пользователь выбирает конкретный mailbox или дефолтный.

Sender достиг daily limit: jobs переносятся.

S211 — Шаг 1: первое письмо в очередь сразу при энролле или wait N дней

Экран/меню · Sequence editor → Editor → Step 1 Automated email; wait control перед Step 1; Enroll recipients.

Роль/доступ · Sequence editor: READ_WRITE; enroll: пользователь с правом enroll и доступом к recipients.

Предусловие · Sequence создана; step 1 имеет subject/body; recipient выбран; sender выбран; sequence published или draft preview для теста.

UI-элементы · Карточка Step 1 Automated email; optional Wait N days/business days; fields Subject, Body; кнопки Add wait, Remove wait; preview queued immediately или send after N days; Outbox preview.

Шаги ·

Пользователь создаёт/редактирует Step 1.

Оставляет отправку сразу или добавляет wait N дней.

Публикует sequence.

Enroll recipient.

Система создаёт enrollment.

Worker создаёт первый send job: сразу или на дату после wait.

Job попадает в Outbox.

Данные(Prisma) ·

SequenceStep: id, sequenceVersionId, order=1, type=EMAIL, waitDays, waitMode=CALENDAR_DAYS|BUSINESS_DAYS, subject, body.

SequenceEnrollment: currentStepOrder=1, status=ACTIVE, nextSendAt.

SequenceSendJob: stepId, scheduledAt, status=QUEUED.

API ·

POST /api/sequences/:sequenceId/steps

PATCH /api/sequence-steps/:stepId

POST /api/sequences/:sequenceId/enroll

GET /api/emails/outbox?sequenceId=

Ошибки: 400 STEP_SUBJECT_REQUIRED, 400 STEP_BODY_REQUIRED, 400 INVALID_WAIT_DAYS.

Acceptance ·

Step 1 можно настроить на immediate send.

Step 1 можно настроить на wait N days.

При enroll создаётся send job.

nextSendAt соответствует immediate/wait + delivery settings.

Job виден в Outbox.

Без subject/body publish или enroll блокируется.

Wait business days учитывает S203.

Edge-cases ·

Wait 0 days = immediate.

Recipient unsubscribed до scheduledAt: job отменяется.

Recipient reply/meeting до scheduledAt: job отменяется по exit criteria.

Изменение step после enroll не меняет active enrollment, если используем version snapshot.

S212 — Переменные в письме: персонализация атрибутами person

Экран/меню · Sequence editor → Editor → Email body/subject → Variables picker.

Роль/доступ · Пользователь с READ_WRITE к sequence; данные recipients подставляются только из записей, доступных sender/enrolling user по policy.

Предусловие · Есть объект people; у person есть атрибуты firstName/name, email, company или relationship к company; sequence имеет email step.

UI-элементы · Variables picker; tokens типа {{Person first}}, {Name | First}, {{Company name}}; preview на выбранном recipient; fallback input; warning для отсутствующих значений; subject/body editor.

Шаги ·

Пользователь открывает email step.

Вставляет variable в subject/body.

Выбирает атрибут person или связанной company.

Открывает preview на тестовом recipient.

Система рендерит письмо с реальными значениями.

При отправке worker подставляет значения для каждого recipient.

Данные(Prisma) ·

SequenceStep: subjectTemplate, bodyTemplate, variablesConfig.

Attribute: person/company attributes.

Record, Value, RelationshipValue: источник merge-полей.

SequenceEnrollment: recipientRecordId.

Email: renderedSubject, renderedBody, renderContext.

Для A/B-совместимости позже: SequenceStepVariant, variantKey, weight, subjectTemplate, bodyTemplate.

API ·

GET /api/sequences/:sequenceId/variables?objectKey=people

POST /api/sequences/:sequenceId/render-preview

PATCH /api/sequence-steps/:stepId

Worker: renderSequenceEmail(stepTemplate, recipientRecordId).

Ошибки: 400 UNKNOWN_VARIABLE, 409 VARIABLE_VALUE_MISSING, 403 VARIABLE_ACCESS_DENIED.

Acceptance ·

Пользователь может вставить person variable в subject/body.

Preview показывает подставленное значение для выбранного recipient.

Worker рендерит персональный subject/body для каждого recipient.

Missing value не ломает отправку: используется fallback или job получает blocked warning, согласно настройке.

Relationship variable, например company name, подтягивается через связь person→company.

Rendered email сохраняется отдельно от template.

В логах видно, какие variables были использованы без раскрытия лишних приватных данных.

Edge-cases ·

У recipient нет first name: fallback there / пусто / блокировка по настройке.

Variable переименованного атрибута хранится по attributeId, не по label.

У person несколько companies: UI требует выбрать primary или показывает ambiguity warning.

A/B-варианты не являются отдельным сценарием S200–S212 в текущем каталоге; для совместимости в модели нужно предусмотреть SequenceStepVariant, но полноценный A/B-test acceptance лучше вынести в следующий sequence-блок.

[ГОТОВ БАТЧ: S200–S212]


---

S213 — Письмо из шаблона / с нуля

Экран/меню · Automations → Sequences → Sequence editor → Editor → Step Automated email; также Email composer → Templates.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE доступом к sequence. Для workspace/team templates — доступ по RBAC; personal templates доступны автору.

Предусловие · Sequence создана в статусе DRAFT; есть хотя бы один email step; есть mailbox/demo-mailbox; для шаблона — создан EmailTemplate или доступна пустая форма письма.

UI-элементы · Карточка Step N Automated email; поля Subject, Body; ссылка/кнопка Start from scratch; кнопка Use template; список Favorite templates; View all templates; Create new template; variables picker; preview; footer unsubscribe/signature; Save step.

Шаги ·

Пользователь открывает sequence editor.

Открывает Step 1 или добавляет новый email step.

Выбирает Use template или пишет письмо с нуля.

Если выбран шаблон — subject/body подставляются в step.

Пользователь редактирует текст, добавляет variables, unsubscribe/signature placeholders.

Сохраняет step.

Данные(Prisma) ·

SequenceStep: id, sequenceVersionId, order, type=EMAIL, subjectTemplate, bodyTemplate, templateId, createdAt, updatedAt.

EmailTemplate: id, orgId, createdById, name, subject, body, visibility, isArchived.

SequenceVersion: snapshot draft/published версии.

Activity: SEQUENCE_STEP_UPDATED.

API ·

GET /api/email-templates

POST /api/email-templates

GET /api/sequences/:sequenceId/steps/:stepId

PATCH /api/sequence-steps/:stepId

POST /api/sequences/:sequenceId/render-preview

Ошибки: 400 SUBJECT_REQUIRED, 400 BODY_REQUIRED, 404 TEMPLATE_NOT_FOUND, 403 TEMPLATE_ACCESS_DENIED.

Acceptance ·

Письмо можно создать с нуля.

Письмо можно создать из шаблона.

После выбора шаблона subject/body копируются в sequence step, а не зависят от будущих изменений шаблона.

Пользователь может отредактировать subject/body после применения шаблона.

Step нельзя опубликовать без subject/body.

Variables остаются в template-синтаксисе до render-preview/send.

Preview показывает финальный вид письма с unsubscribe/signature placeholders.

Edge-cases ·

Шаблон удалён после применения: step продолжает хранить скопированный текст.

У пользователя нет доступа к workspace template: шаблон не показывается.

Template содержит неизвестные variables: save разрешён, publish/render блокирует с field-level ошибкой.

Пустой body из шаблона блокирует publish.

S214 — Add step: доп. письмо + сколько дней ждать

Экран/меню · Sequence editor → Editor → Add step to sequence.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с READ_WRITE.

Предусловие · Sequence существует; открыта draft-версия; Step 1 уже создан или пользователь добавляет первый шаг; delivery settings настроены.

UI-элементы · Кнопка Add step to sequence; блок Wait N days; dropdown calendar days / business days; карточка Step N Automated email; Subject; body editor; menu …; reorder controls; delete step; preview planned schedule.

Шаги ·

Пользователь нажимает Add step to sequence.

Выбирает задержку перед шагом: например Wait 3 business days.

Создаёт follow-up email.

Сохраняет step.

Sequence preview показывает порядок: Step 1 → Wait → Step 2.

При enroll follow-up планируется только для активных recipients, которые не вышли по exit criteria.

Данные(Prisma) ·

SequenceStep: order, waitDays, waitMode=CALENDAR_DAYS|BUSINESS_DAYS, subjectTemplate, bodyTemplate.

SequenceEnrollment: currentStepId, nextSendAt, status.

SequenceSendJob: stepId, scheduledAt, status=QUEUED.

SequenceVersion: immutable snapshot для enrolled recipients.

API ·

POST /api/sequences/:sequenceId/steps

PATCH /api/sequence-steps/:stepId

DELETE /api/sequence-steps/:stepId

POST /api/sequences/:sequenceId/reorder-steps

Ошибки: 400 INVALID_WAIT_DAYS, 400 STEP_ORDER_CONFLICT, 409 PUBLISHED_VERSION_LOCKED.

Acceptance ·

Можно добавить второй и последующие email steps.

Каждый дополнительный step имеет задержку перед отправкой.

business days учитывает delivery setting.

Follow-up отправляется только тем, кто не ответил, не забукал встречу, не отписался и не был manually exited.

Reorder step пересчитывает порядок draft-версии.

У active enrollments сохраняется версия, действовавшая на момент enroll.

Удаление step из draft не удаляет уже поставленные jobs published-версии.

Edge-cases ·

Wait 0 для follow-up разрешён только если не нарушает mailbox limits.

Удалён step, на котором есть active recipients: для published sequence нужно создать новую version, а не менять текущую.

Задержка попадает на выходные: перенос по S203.

Нет subject/body — publish блокируется.

S215 — Publish sequence → черновик становится живым

Экран/меню · Sequence editor → Editor / Settings → Publish sequence или toggle Enable sequence.

Роль/доступ · OWNER, ADMIN, sequence owner или пользователь с FULL/READ_WRITE; publish может требовать FULL, если включена строгая политика.

Предусловие · Sequence в статусе DRAFT; есть минимум один валидный email step; settings валидны; sender/mailbox или delegated sender доступен; unsubscribe/exit criteria настроены по policy.

UI-элементы · Кнопка Publish sequence; toggle Enable sequence; validation checklist; warnings по missing subject/body/variables/mailbox/unsubscribe; status badge Draft / Running / Paused / Archived.

Шаги ·

Пользователь нажимает Publish sequence.

Backend валидирует steps, settings, permissions, variables.

Создаётся immutable published version.

Sequence получает статус RUNNING или PUBLISHED.

UI показывает, что sequence можно enroll.

Новые recipients получают последнюю published version.

Данные(Prisma) ·

Sequence: status=RUNNING, publishedVersionId, publishedAt, enabledAt.

SequenceVersion: status=PUBLISHED, version, snapshotJson.

SequenceStep: draft/published relation или snapshot.

Activity: SEQUENCE_PUBLISHED.

API ·

POST /api/sequences/:sequenceId/publish

POST /api/sequences/:sequenceId/enable

POST /api/sequences/:sequenceId/disable

GET /api/sequences/:sequenceId/validation

Ошибки: 400 SEQUENCE_INVALID, 400 NO_STEPS, 400 INVALID_VARIABLES, 409 ALREADY_PUBLISHED, 403 PUBLISH_DENIED.

Acceptance ·

Draft sequence становится live/published только после явного publish.

Publish невозможен без валидных email steps.

Publish создаёт version snapshot.

Новые recipients используют последнюю published version.

Уже enrolled recipients продолжают version, активную на момент enroll.

После publish sequence появляется как Running в списке.

Disable/paused sequence не принимает новые automatic sends, если policy так задана.

Edge-cases ·

Publish нажали дважды: второй вызов идемпотентен или возвращает 409.

Draft изменён после publish: изменения требуют нового publish.

Mailbox отключён после publish: enroll/send блокируется warning-ом.

Неизвестная variable в одном step блокирует весь publish.

S216 — Enroll одного получателя (person) в sequence

Экран/меню · Sequence editor → Enroll recipients; также Person record page → Enroll to sequence.

Роль/доступ · Пользователь с доступом к sequence и правом читать person record; sender должен иметь mailbox или delegated sending.

Предусловие · Sequence published/running; person record имеет email; recipient не unsubscribed; не active в той же sequence; sender выбран.

UI-элементы · Кнопка Enroll recipients; recipient picker; person search; sender dropdown; delegated sender badge; preview first email; schedule preview; CTA Enroll 1 recipient.

Шаги ·

Пользователь открывает sequence editor или person record.

Нажимает Enroll recipients / Enroll to sequence.

Выбирает person.

Выбирает sender.

Проверяет preview и расписание.

Подтверждает enroll.

Система создаёт enrollment и первый send job.

Данные(Prisma) ·

SequenceEnrollment: id, sequenceId, sequenceVersionId, recipientRecordId, recipientEmail, senderUserId, senderMailboxId, enrolledById, status=ACTIVE, currentStepId, nextSendAt.

SequenceSendJob: first email job.

Email: queued draft/send record.

Activity: SEQUENCE_ENROLLED.

API ·

POST /api/sequences/:sequenceId/enroll

GET /api/sequences/:sequenceId/available-senders

POST /api/sequences/:sequenceId/render-preview

Ошибки: 400 RECIPIENT_EMAIL_REQUIRED, 409 RECIPIENT_ALREADY_ACTIVE, 409 RECIPIENT_UNSUBSCRIBED, 403 SENDER_NOT_ALLOWED.

Acceptance ·

Одного person можно enroll в published sequence.

Recipient должен иметь email.

Нельзя enroll unsubscribed recipient.

Нельзя создать duplicate active enrollment в той же sequence.

Sender сохраняется на enrollment.

Создаётся first send job с учётом delivery settings.

На person/record появляется activity о sequence enrollment.

Edge-cases ·

У person несколько email: UI требует выбрать primary или конкретный email.

Person без email: CTA disabled.

Sequence archived: enroll запрещён.

Sender mailbox disconnected: enroll блокируется или ставится BLOCKED, если разрешён deferred setup.

S217 — Enroll массово из people-списка с фильтрами

Экран/меню · People object view / People list → bulk footer → Enroll to sequence; также list page с фильтрами.

Роль/доступ · Пользователь должен иметь доступ к selected people/list и sequence; sender/delegated sender доступен.

Предусловие · Есть filtered People view/list; выбран один или несколько recipients; sequence published; recipients имеют email; suppression/duplicate checks включены.

UI-элементы · Чекбоксы строк; Select all; bulk footer: Add to list, Send email, Run workflow, Enroll in sequence, More; modal Enroll recipients; count selected; skipped recipients list; sender dropdown; schedule preview.

Шаги ·

Пользователь открывает People view или people-list.

Применяет фильтры, например city is London, associated user status is active.

Выбирает строки или Select all filtered.

Нажимает Enroll in sequence.

Выбирает sequence и sender.

Система проверяет email, unsubscribe, duplicate active enrollment.

Пользователь подтверждает массовый enroll.

Backend создаёт enrollments и send jobs.

Данные(Prisma) ·

SequenceEnrollment batch records.

SequenceEnrollmentImport или BulkActionRun: selectedCount, createdCount, skippedCount, errorsJson.

SequenceSendJob для каждого recipient.

Activity: bulk enrollment events.

API ·

POST /api/sequences/:sequenceId/enroll/bulk

POST /api/records/bulk/enroll-sequence

GET /api/bulk-actions/:runId

Ошибки: 400 NO_RECIPIENTS_SELECTED, 207 PARTIAL_SUCCESS, 409 ALL_RECIPIENTS_SKIPPED.

Acceptance ·

Можно enroll выбранные people из filtered view/list.

Select all filtered enroll-ит именно текущую filtered выборку, а не весь объект.

Backend возвращает created/skipped counts.

Recipients без email пропускаются с причиной.

Unsubscribed и already active recipients пропускаются.

Для каждого созданного enrollment создаётся send job.

UI показывает итог bulk-run и ссылку на Recipients tab.

Edge-cases ·

Очень большая выборка: backend создаёт async bulk job.

Фильтр изменился между preview и confirm: используется snapshot selected IDs или server-side query hash.

Частичный успех не откатывает успешные enrollments.

Sender не имеет delegated permission: весь bulk блокируется до выбора валидного sender.

S218 — OOO-детект (auto-reply «отсутствую») → не считать ответом, не выходить

Экран/меню · Emails → Inbox / Sequence Recipients → recipient activity; настройки sequence exit criteria.

Роль/доступ · Sequence owner/admin видит OOO state; sender видит inbound reply; обычный пользователь — по правам email visibility.

Предусловие · Email sync/inbound webhook или demo-inbound включён; exit criteria reply received может быть включён; active enrollment существует.

UI-элементы · Recipient row badge Out of office; tooltip Paused until {date}; activity item OOO detected; resume date; manual override Resume now; email viewer with auto-reply.

Шаги ·

Recipient получает sequence email.

Входящее письмо приходит как auto-reply/OOO.

Система классифицирует его как OOO, а не human reply.

Enrollment не получает exitReason=REPLIED.

Если в OOO есть дата возврата, future jobs переносятся на день после возврата.

Если даты нет, enrollment ставится на short hold/manual review.

Данные(Prisma) ·

Email: direction=INBOUND, isAutoReply, autoReplyType=OOO, detectedReturnAt, rawHeaders.

SequenceEnrollment: status=ACTIVE|PAUSED, pauseReason=OUT_OF_OFFICE, resumeAt.

SequenceSendJob: scheduledAt пересчитан, deferredReason=OUT_OF_OFFICE.

Activity: OOO_DETECTED.

API ·

POST /api/email/inbound-webhook

POST /api/sequences/:sequenceId/enrollments/:enrollmentId/simulate-ooo

PATCH /api/sequence-enrollments/:enrollmentId/resume

Ошибки: 400 INBOUND_EMAIL_UNMATCHED.

Acceptance ·

OOO auto-reply не считается обычным reply.

Enrollment не выходит по reply received.

Если return date распознана, future jobs переносятся на день после return date.

Recipients tab показывает OOO badge/status.

Sender может вручную resume/exit recipient.

Demo-mode умеет симулировать OOO.

Обычный human reply продолжает вызывать exit по S207.

Edge-cases ·

OOO без даты: enrollment ставится на hold с дефолтной паузой или manual review.

OOO пришёл после manual exit: статус не меняется, activity сохраняется.

Auto-reply от security gateway/bounce не считается OOO.

Несколько OOO подряд обновляют resumeAt только если новая дата позже текущей.

S219 — Pause / resume / exit получателя вручную

Экран/меню · Sequence editor → Recipients tab → recipient row actions.

Роль/доступ · Sequence owner, ADMIN, OWNER или пользователь с READ_WRITE к sequence; для чужого sender может требоваться FULL.

Предусловие · Recipient enrolled; enrollment status ACTIVE, PAUSED или BLOCKED; есть future jobs или step progress.

UI-элементы · Вкладка Recipients; columns Recipient, Sender, Status, Progress, Next send, Last activity; row menu Pause, Resume, Exit; confirmation modal; status badges Active / Paused / Exited.

Шаги ·

Пользователь открывает Recipients tab.

Открывает row actions у active recipient.

Нажимает Pause.

Система замораживает future jobs и delay countdown.

Пользователь нажимает Resume.

Countdown продолжается с остатка.

Пользователь может нажать Exit, чтобы окончательно вывести recipient.

Данные(Prisma) ·

SequenceEnrollment: status=ACTIVE|PAUSED|EXITED, pausedAt, pauseRemainingSeconds, resumedAt, exitedAt, exitReason=MANUAL.

SequenceSendJob: status=PAUSED|QUEUED|CANCELLED.

Activity: SEQUENCE_RECIPIENT_PAUSED, RESUMED, EXITED.

API ·

PATCH /api/sequence-enrollments/:enrollmentId/pause

PATCH /api/sequence-enrollments/:enrollmentId/resume

PATCH /api/sequence-enrollments/:enrollmentId/exit

Ошибки: 409 ENROLLMENT_ALREADY_EXITED, 409 ENROLLMENT_NOT_PAUSED, 403 ENROLLMENT_MANAGE_DENIED.

Acceptance ·

Active recipient можно pause.

Pause останавливает future sends.

Delay countdown замораживается и после resume продолжается с остатка.

Paused recipient можно resume.

Active/paused recipient можно manual exit.

Exited recipient больше не получает писем этой enrollment.

Все действия пишутся в activity/audit.

Edge-cases ·

Pause во время job processing: worker должен проверить статус перед отправкой.

Resume после изменения delivery settings: новый scheduledAt учитывает остаток + текущие settings.

Exit необратим для данной enrollment; повторный запуск требует нового enroll, если suppression не запрещает.

Уже sent email не отзывается.

S220 — Outbox: очередь sequence-писем (превью, расписание)

Экран/меню · Emails → Outbox; также Sequence editor → Recipients / Delivery preview.

Роль/доступ · Пользователь видит свои queued emails; admin может видеть workspace outbox; sender видит письма своего mailbox.

Предусловие · Есть queued sequence jobs; worker активен или demo queue включена; delivery settings/limits настроены.

UI-элементы · Emails → Outbox; фильтры Sequence, Sender, Scheduled time, Status; строки queued emails; preview subject/body/recipient; badge sequence name; View sequence; Reschedule; Cancel; причина defer/block.

Шаги ·

Enroll создаёт send jobs.

Пользователь открывает Emails → Outbox.

Видит запланированные sequence emails.

Открывает preview письма.

При необходимости отменяет/переносит письмо, если имеет права.

Worker отправляет письмо в scheduled time с учётом limits.

Данные(Prisma) ·

SequenceSendJob: id, sequenceId, enrollmentId, stepId, recipientEmail, senderMailboxId, scheduledAt, status, blockedReason.

Email: status=QUEUED|DEFERRED|SENT|CANCELLED, scheduledAt, renderedSubject, renderedBody.

Mailbox: rate-limit counters.

API ·

GET /api/emails/outbox

GET /api/emails/outbox/:jobId

PATCH /api/emails/outbox/:jobId/reschedule

DELETE /api/emails/outbox/:jobId

Ошибки: 403 OUTBOX_ACCESS_DENIED, 409 JOB_ALREADY_SENT.

Acceptance ·

Outbox показывает queued sequence emails.

Каждая строка содержит recipient, sender, sequence, step, scheduled time и status.

Preview показывает rendered subject/body.

Deferred jobs показывают причину: limit/window/weekend/OOO.

Отмена job не удаляет enrollment целиком, если это не manual exit.

Worker не отправляет cancelled/paused/exited jobs.

Demo-mode показывает outbox без реальной отправки наружу.

Edge-cases ·

ScheduledAt в прошлом: worker отправляет при ближайшем допустимом окне.

Job отменили в момент отправки: worker должен делать final status check.

Missing variable обнаружена на render: job получает BLOCKED.

У sender отключился mailbox: job получает BLOCKED_MAILBOX.

S221 — Unsubscribe-список workspace (глобальный suppress)

Экран/меню · Workspace Settings → Sequences → Unsubscribed; unsubscribe landing page.

Роль/доступ · OWNER/ADMIN видит полный suppression list; sender/sequence owner видит релевантные entries по политике.

Предусловие · В письмах включён unsubscribe link; recipient перешёл по ссылке или email добавлен вручную/admin import; workspace suppression policy определена.

UI-элементы · Settings sidebar → Workspace → Sequences; вкладка/секция Unsubscribed; таблица Email, Reason, Sequence, Sender, Created at; search/filter; details drawer; disabled remove для user unsubscribe; manual add для admin; export.

Шаги ·

Recipient кликает unsubscribe link в sequence email.

Система показывает landing page и подтверждение unsubscribe.

Backend создаёт suppression entry.

Active enrollments по policy завершаются.

При следующем enroll backend блокирует recipient.

Admin видит запись в workspace unsubscribe list.

Данные(Prisma) ·

SuppressionListEntry или Unsubscribe: id, orgId, email, scope=WORKSPACE|SENDER, senderMailboxId, sequenceId, reason, source=LINK|ADMIN|BOUNCE, createdAt.

SequenceEnrollment: status=EXITED, exitReason=UNSUBSCRIBED.

SequenceSendJob: status=CANCELLED, cancelReason=UNSUBSCRIBED.

API ·

GET /api/settings/sequences/unsubscribed

POST /api/settings/sequences/unsubscribed

GET /api/unsubscribe/:token

POST /api/unsubscribe/:token

POST /api/sequences/:sequenceId/enroll блокирует suppressed email.

Ошибки: 409 RECIPIENT_UNSUBSCRIBED, 403 SUPPRESSION_ACCESS_DENIED.

Acceptance ·

Unsubscribe link создаёт suppression entry.

Suppressed recipient нельзя enroll в sequence по той же suppression policy.

Active enrollment завершается с exitReason=UNSUBSCRIBED.

Будущие queued jobs cancelled.

Admin видит email, reason, sequence/sender и дату.

User-initiated unsubscribe нельзя тихо удалить обычным пользователем.

Manual/admin suppression тоже блокирует enroll.

Edge-cases ·

Email case-insensitive: Lisa@Cosme.pt = lisa@cosme.pt.

Несколько aliases: suppress применяется к конкретному email, account-level suppression — отдельное расширение.

Token повторно открыт: страница показывает “already unsubscribed”.

Bounce suppression можно снять admin-ом, если policy разрешает.

S222 — Метрики sequence: sent / opened / replied / booked

Экран/меню · Sequence editor → Recipients / Insights; Automations → Sequences list; reports/dashboard позже.

Роль/доступ · Sequence owner и пользователи с READ видят aggregate metrics; private recipient details зависят от email visibility.

Предусловие · Sequence published; есть sent emails или demo data; tracking open/reply/booking включён; click tracking желательно включить как расширение метрик.

UI-элементы · Metrics cards: Enrolled, Active, Exited, Sent, Opened, Clicked, Replied, Booked; conversion percentages; step-level metrics; recipient table; chart over time; filters by sender/step/status.

Шаги ·

Sequence отправляет emails.

Tracking events приходят через pixel/link redirect/inbound/calendar webhook.

Backend агрегирует события на enrollment/step/sequence.

Пользователь открывает Recipients/Insights.

UI показывает sent/opened/clicked/replied/booked и rates.

Пользователь фильтрует по sender или step.

Данные(Prisma) ·

EmailEvent: id, emailId, sequenceId, enrollmentId, type=SENT|OPENED|CLICKED|REPLIED|BOOKED, url, userAgent, ipHash, createdAt.

SequenceMetricSnapshot: sequenceId, sent, opened, clicked, replied, booked, active, exited, date.

SequenceEnrollment: counters/status fields.

Email: sentAt, openedAt, clickedAt, repliedAt.

API ·

GET /api/sequences/:sequenceId/metrics

GET /api/sequences/:sequenceId/recipients

GET /api/track/open/:token

GET /api/track/click/:token?url=

POST /api/email/inbound-webhook

POST /api/calendar/webhook

Ошибки: 404 TRACKING_TOKEN_NOT_FOUND.

Acceptance ·

Sent считается после успешной отправки.

Opened считается по tracking pixel, если tracking включён.

Clicked считается через redirect tracking link.

Replied считается по inbound reply matching.

Booked считается по calendar/booking matching.

Metrics показывают count и rate.

Bot/self-open можно фильтровать или помечать как suspected bot/self event.

Edge-cases ·

Open tracking отключён: opened metric показывает tracking disabled, а не 0.

Email client блокирует pixel: open может быть unknown.

Link clicked несколько раз: считать unique и total отдельно.

Reply после unsubscribe: reply event сохраняется, enrollment уже exited.

Meeting booked без reply: booked count растёт отдельно.

S223 — Warm-up отправки нового ящика (ramp-лимиты)

Экран/меню · Mailbox settings → Warm-up; Sequence delivery settings; Emails → Outbox.

Роль/доступ · Mailbox owner управляет warm-up своего ящика; ADMIN видит workspace policy; sequence owner видит ограничения sender.

Предусловие · Новый mailbox подключён или demo-mailbox создан; warm-up policy включена; sequences используют этот mailbox.

UI-элементы · Badge New mailbox warm-up; ramp schedule; daily limit today; hourly cap; warning в enroll modal; outbox defer reason WARMUP_LIMIT; admin policy panel.

Шаги ·

Пользователь подключает новый mailbox.

Система включает warm-up policy.

При enroll worker проверяет возраст mailbox и текущий ramp stage.

Send jobs распределяются по лимитам warm-up.

Каждый день лимит увеличивается до normal limits.

UI показывает текущий дневной лимит и expected send date.

Данные(Prisma) ·

Mailbox: connectedAt, warmupEnabled, warmupStartedAt, warmupStage, warmupDailyLimit, dailyLimit.

MailboxWarmupPolicy: orgId, startLimit, incrementPerDay, maxLimit, minDelayMinutes.

SequenceSendJob: deferredReason=WARMUP_LIMIT.

EmailEvent: sent/fail events для deliverability health.

API ·

GET /api/mailboxes/:mailboxId/warmup

PATCH /api/mailboxes/:mailboxId/warmup

GET /api/sequences/:sequenceId/delivery-preview

Worker helper: resolveMailboxEffectiveLimits(mailboxId, date).

Ошибки: 409 WARMUP_LIMIT_REACHED.

Acceptance ·

Новый mailbox получает ramp-limits ниже normal limits.

Worker не превышает warm-up daily/hourly cap.

Outbox показывает jobs, перенесённые из-за warm-up.

Warm-up лимит увеличивается по policy.

Когда max reached, mailbox переходит на normal deliverability limits.

Sequence enroll modal предупреждает о задержках из-за warm-up.

Demo-mode симулирует warm-up без внешней отправки.

Edge-cases ·

Mailbox отключили/подключили заново: policy решает, сбрасывать warm-up или продолжить.

Высокий bounce/reply spam rate: ramp можно заморозить или понизить.

Несколько sequences перегружают новый mailbox: общий effective limit.

Admin отключает warm-up: используется normal limit, но audit фиксирует действие.

S224 — Импорт получателей CSV прямо в enroll

Экран/меню · Sequence editor → Enroll recipients → Import CSV; также People/List import → Enroll to sequence.

Роль/доступ · Пользователь с правом enroll в sequence и create/update people records; import может требовать READ_WRITE к object people.

Предусловие · Sequence published; CSV содержит email и опциональные поля person/company; import mapping доступен; dedupe по email включён; suppression checks включены.

UI-элементы · Modal Enroll recipients; tab/source Import CSV; file picker; mapping screen; columns preview; Create/update people; Match by email; validation warnings; skipped rows; sender dropdown; Confirm enroll.

Шаги ·

Пользователь открывает sequence editor.

Нажимает Enroll recipients.

Выбирает Import CSV.

Загружает файл.

Сопоставляет CSV columns с person attributes.

Система валидирует email, required fields, duplicates, unsubscribed.

Пользователь подтверждает import + enroll.

Backend creates/updates people и enroll-ит валидных recipients.

Данные(Prisma) ·

ImportJob: id, orgId, type=SEQUENCE_RECIPIENTS, status, fileName, mappingJson, createdById.

ImportRowResult: rowNumber, status=CREATED|UPDATED|SKIPPED|ERROR, recordId, error.

Record/Value: person records and attributes.

SequenceEnrollment: created for valid rows.

BulkActionRun: summary counts.

API ·

POST /api/sequences/:sequenceId/enroll/import

POST /api/imports/:importId/mapping

POST /api/imports/:importId/confirm

GET /api/imports/:importId

Ошибки: 400 CSV_REQUIRED, 400 EMAIL_COLUMN_REQUIRED, 207 PARTIAL_SUCCESS, 409 ALL_ROWS_SUPPRESSED.

Acceptance ·

CSV можно загрузить прямо из enroll flow.

Email column обязателен.

Существующие people находятся по email и обновляются/используются без дублей.

Новые people создаются, если policy разрешает.

Unsubscribed rows пропускаются.

Rows без валидного email пропускаются с ошибкой.

После confirm валидные recipients получают enrollments и send jobs.

Import status доступен в import history.

Edge-cases ·

CSV большой: import идёт async через worker.

CSV содержит duplicate email: первая строка применяется, остальные skipped или merged по policy.

Mapping создаёт новые attributes: только если пользователь имеет права на object schema.

Частичный импорт: успешные rows не откатываются из-за ошибок других rows.

[ГОТОВ БАТЧ: S213–S224]


---

План:

Разворачиваю Workflows S230–S247 строго в заданных полях.

Основа: Academy workflow-видео 17–18/26 и UI-инвентарь builder/canvas: список триггеров Records/Lists/Data/Tasks/Utilities, вкладки Editor / Runs / Settings, Draft/Live, Publish workflow, canvas и right inspector. 


 


S230 — Открыть список Workflows

Экран/меню · Automations → Workflows.

Роль/доступ · OWNER, ADMIN видят все workflows workspace; MEMBER видит workflows по PermissionGrant (READ, READ_WRITE, FULL). Без доступа пункт скрыт или показывает empty/no-access state.

Предусловие · Пользователь авторизован; workspace bootstrap выполнен; раздел Automations доступен в левом сайдбаре; есть ноль или больше workflows.

UI-элементы · Левый сайдбар Automations → Sequences / Workflows; заголовок Workflows; сортировка Sorted by Last published; кнопка Filter; View settings; поиск; синяя кнопка New workflow; строки/карточки workflows со статусами Draft / Live / Paused / Archived, owner, last updated/last published; empty state; loading state.

Шаги ·

Пользователь открывает Automations.

Выбирает Workflows.

Система загружает список workflows с учётом прав.

Пользователь сортирует, фильтрует, ищет workflow.

Пользователь открывает существующий workflow или нажимает New workflow.

Данные(Prisma) ·

Workflow: id, orgId, name, description, status, createdById, ownerId, publishedVersionId, lastPublishedAt, archivedAt, createdAt, updatedAt.

WorkflowVersion: id, workflowId, version, status=DRAFT|PUBLISHED, createdAt.

WorkflowRun: агрегаты для last run/status.

PermissionGrant: entityType=WORKFLOW.

API ·

GET /api/workflows?status=&q=&sort=&cursor=&limit=

POST /api/workflows

GET /api/workflows/:workflowId

Ошибки: 403 WORKFLOW_ACCESS_DENIED.

Acceptance ·

Список открывается из Automations → Workflows.

Пользователь видит только workflows, к которым имеет доступ.

Кнопка New workflow доступна только пользователю с правом создания.

Loading state и empty state отображаются корректно.

Сортировка Last published работает.

Фильтр по статусу Draft / Live / Archived работает.

Клик по workflow открывает builder.

Edge-cases ·

Нет workflows → показывается empty state и CTA New workflow.

Все workflows скрыты правами → показывается no-access/empty state без раскрытия чужих workflow names.

Archived workflows скрыты по умолчанию, доступны через view settings/filter.

Ошибка API → показывается retry state.

S231 — Создать новый workflow

Экран/меню · Automations → Workflows → New workflow.

Роль/доступ · OWNER, ADMIN или MEMBER с правом создавать workflows. Для MVP можно ограничить OWNER/ADMIN.

Предусловие · Пользователь находится на списке workflows; workspace поддерживает workflow builder; worker/queue может быть выключен в demo-mode, но workflow draft всё равно создаётся.

UI-элементы · Кнопка New workflow; editor с названием Untitled Workflow; иконка избранного; вкладки Editor, Runs, Settings; кнопка Share; toggle/status Draft; баннер This workflow has not yet been published; кнопка Publish workflow; dotted canvas; центральная CTA Set a trigger in the sidebar; кнопка Start with a template; правая панель Select trigger.

Шаги ·

Пользователь нажимает New workflow.

Backend создаёт workflow в DRAFT.

UI открывает builder.

Workflow получает имя Untitled Workflow.

Пользователь может переименовать workflow, выбрать trigger или начать с шаблона.

Данные(Prisma) ·

Workflow: status=DRAFT, name='Untitled Workflow', createdById, ownerId.

WorkflowVersion: version=1, status=DRAFT, graphJson={ nodes: [], edges: [] }.

WorkflowNode: пока не создан или создаётся при выборе trigger.

Activity: WORKFLOW_CREATED.

API ·

POST /api/workflows

PATCH /api/workflows/:workflowId

GET /api/workflows/:workflowId

Ошибки: 403 WORKFLOW_CREATE_DENIED, 400 WORKFLOW_NAME_INVALID.

Acceptance ·

Новый workflow создаётся из списка workflows.

Workflow открывается в builder.

Начальный статус — Draft.

До выбора trigger publish недоступен или показывает validation error.

Draft сохраняется в БД.

Workflow появляется в списке после возврата.

Создание workflow не запускает никаких automation runs.

Edge-cases ·

Пользователь нажал New workflow дважды → создаются два draft или UI блокирует повторный клик.

Нет прав на создание → кнопка скрыта или disabled.

Сетевая ошибка → draft не должен появиться фантомно.

Пустое имя после rename → backend возвращает validation error.

S232 — Builder/canvas: выбрать trigger из правой панели

Экран/меню · Workflow builder → Editor → Select trigger.

Роль/доступ · Пользователь с READ_WRITE или FULL к workflow.

Предусловие · Workflow создан; открыт draft; trigger ещё не выбран или пользователь нажал Change у trigger.

UI-элементы · Canvas с dotted grid; центральный блок Add a trigger to start; правая панель Select trigger; поле Search triggers...; категории Records, Lists, Data, Tasks, Utilities; карточки trigger; tooltip при hover; Documentation; Templates; canvas controls 100%, zoom, pan/cursor.

Шаги ·

Пользователь открывает builder.

Нажимает Set a trigger in the sidebar или выбирает карточку trigger справа.

Использует поиск по trigger.

Выбирает trigger.

На canvas появляется node Trigger.

Правая панель переключается на настройки выбранного trigger.

Данные(Prisma) ·

WorkflowNode: type=TRIGGER, triggerType, positionX, positionY, configJson.

WorkflowVersion: graphJson, updatedAt.

WorkflowEdge: пока нет, если trigger один.

API ·

GET /api/workflows/trigger-catalog

POST /api/workflows/:workflowId/nodes

PATCH /api/workflow-nodes/:nodeId

GET /api/workflows/:workflowId/validation

Ошибки: 400 TRIGGER_REQUIRED, 400 INVALID_TRIGGER_TYPE, 403 WORKFLOW_EDIT_DENIED.

Acceptance ·

Right panel показывает trigger catalog.

Поиск фильтрует triggers.

Выбор trigger создаёт trigger-node на canvas.

В workflow может быть только один стартовый trigger в MVP.

После выбора trigger UI показывает inspector настроек.

Draft auto-save сохраняет выбранный trigger.

Publish остаётся заблокирован, пока обязательные inputs trigger не заполнены.

Edge-cases ·

Пользователь меняет trigger после настройки steps → UI предупреждает о возможной потере variables.

Trigger catalog пуст из-за ошибки API → показывается retry.

У пользователя read-only доступ → catalog виден, но selection disabled.

Trigger требует объект/список, но объектов/списков нет → показывается setup CTA.

S233 — Trigger: Record command

Экран/меню · Workflow builder → Select trigger → Records → Record command; запуск из record page / object view / bulk footer → Run workflow.

Роль/доступ · Создание trigger: READ_WRITE/FULL к workflow. Запуск: пользователь должен иметь доступ к workflow и record; workflow должен иметь permission grant на действие с target object, если дальше есть write-actions.

Предусловие · Workflow draft создан; есть object, например Companies; command trigger настроен; workflow published/live для запуска пользователем.

UI-элементы · Trigger card Record command; tooltip; canvas node Trigger — Record command; inspector Record command; Change; Inputs; dropdown Object; command name; Next step; на object/record UI — кнопка Run workflow.

Шаги ·

Пользователь выбирает trigger Record command.

Выбирает object, например Companies.

Задаёт command label, например Create deal from company.

Публикует workflow.

На company record появляется Run workflow.

Пользователь запускает command на конкретной company.

Создаётся WorkflowRun с переменными record, triggeredBy.

Данные(Prisma) ·

WorkflowNode: triggerType=RECORD_COMMAND, configJson={ objectId, commandLabel }.

WorkflowRun: triggeredById, triggerRecordId, status=RUNNING|SUCCEEDED|FAILED.

WorkflowRunStep: запись выполнения trigger.

Activity: WORKFLOW_COMMAND_RUN.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/workflows/:workflowId/publish

GET /api/records/:recordId/available-workflows

POST /api/workflows/:workflowId/run-command

Ошибки: 403 WORKFLOW_RUN_DENIED, 400 RECORD_OBJECT_MISMATCH.

Acceptance ·

Trigger можно настроить на конкретный object.

Published workflow появляется в Run workflow для записей этого object.

Запуск создаёт WorkflowRun.

Run получает переменные record values и triggeredBy.

Если workflow disabled/draft, command не показывается.

Пользователь без доступа к record не может запустить command.

Runs tab показывает manual command run.

Edge-cases ·

Record archived → command не запускается.

Workflow изменён после publish → command использует published version.

Bulk run нескольких records → создаются отдельные runs или один bulk run с child runs.

Workflow не имеет прав на write-action → publish или run показывает permission prompt.

S234 — Trigger: Record created

Экран/меню · Workflow builder → Select trigger → Records → Record created.

Роль/доступ · READ_WRITE/FULL к workflow; workflow должен иметь read permission на выбранный object и write grants для downstream actions.

Предусловие · Есть object, например Deals; workflow draft открыт; event dispatcher пишет событие при создании Record.

UI-элементы · Trigger card Record created; inspector: Object; optional filters; Next step; node subtitle Record created in Deals.

Шаги ·

Пользователь выбирает Record created.

Выбирает object Deals.

Публикует workflow.

Пользователь или API создаёт новую deal record.

Event dispatcher создаёт workflow run.

Run получает переменные created record, object, createdBy, createdAt.

Данные(Prisma) ·

WorkflowNode: triggerType=RECORD_CREATED, configJson={ objectId }.

Record: новая запись.

Activity: RECORD_CREATED.

WorkflowEvent: type=RECORD_CREATED, payloadJson.

WorkflowRun: triggerEventId, triggerRecordId.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/objects/:objectId/records или текущий CRM create endpoint

POST /api/workflows/:workflowId/publish

Worker/internal: workflowQueue.add(event).

Acceptance ·

Workflow запускается при создании record выбранного object.

Workflow не запускается для других objects.

Run содержит created record values.

CreatedBy доступен как variable.

Draft workflow не запускается.

Disabled workflow не запускается.

Runs tab показывает trigger event и payload.

Edge-cases ·

Record создан import job-ом: workflow запускается, если setting не исключает imports.

Bulk import создаёт много events → queue rate-limit/batching.

Record создан workflow-ом → нужна защита от бесконечных циклов.

Record создан, но затем сразу archived → run всё равно видит snapshot trigger payload.

S235 — Trigger: Record updated

Экран/меню · Workflow builder → Select trigger → Records → Record updated.

Роль/доступ · READ_WRITE/FULL к workflow; workflow read grant на object; downstream write grants при необходимости.

Предусловие · Есть object и attributes; value update events сохраняют before/after; workflow draft открыт.

UI-элементы · Trigger card Record updated; inspector: Object, optional Attribute, Any attribute / Specific attribute, before/after variable preview; Next step.

Шаги ·

Пользователь выбирает Record updated.

Выбирает object Deals.

Опционально выбирает attribute Deal stage.

Публикует workflow.

Пользователь меняет stage у deal.

Система создаёт run с oldValue и newValue.

Данные(Prisma) ·

WorkflowNode: triggerType=RECORD_UPDATED, configJson={ objectId, attributeId? }.

Value: обновлённое значение.

ValueHistory или Activity: before/after snapshot.

WorkflowEvent: type=RECORD_UPDATED, oldValues, newValues.

WorkflowRun.

API ·

PATCH /api/workflow-nodes/:nodeId

PATCH /api/records/:recordId

PATCH /api/records/:recordId/values/:attributeId

Worker/internal event dispatch.

Acceptance ·

Workflow запускается при обновлении record выбранного object.

При specific attribute запускается только при изменении этого attribute.

Run содержит before/after values.

Если значение не изменилось фактически, workflow не запускается.

Draft/disabled workflow не запускается.

Runs tab показывает, какой attribute изменился.

Variables доступны последующим blocks.

Edge-cases ·

Bulk update создаёт отдельные runs по record или batched runs по policy.

Несколько attributes изменены одним PATCH: event содержит все before/after.

Workflow сам обновляет этот же attribute: loop guard по run depth / source workflow.

Attribute archived после publish: workflow получает validation warning.

S236 — Trigger: List entry command

Экран/меню · Workflow builder → Select trigger → Lists → List entry command; запуск из List page / list entry row → Run workflow.

Роль/доступ · Edit workflow: READ_WRITE/FULL; run command: пользователь должен иметь доступ к list и entry.

Предусловие · Есть list с entries; workflow published/live; trigger настроен на конкретный list или list object type.

UI-элементы · Trigger card List entry command; inspector: List; command label; Next step; в list row/bulk footer — Run workflow; entry context preview.

Шаги ·

Пользователь выбирает trigger List entry command.

Выбирает list, например Event Invitees.

Задаёт command label.

Публикует workflow.

На list entry пользователь запускает workflow.

Run получает variables listEntry, parentRecord, triggeredBy.

Данные(Prisma) ·

WorkflowNode: triggerType=LIST_ENTRY_COMMAND, configJson={ listId, commandLabel }.

ListEntry: выбранная entry.

WorkflowRun: triggerListEntryId, triggerRecordId, triggeredById.

API ·

GET /api/lists/:listId/entries/:entryId/available-workflows

POST /api/workflows/:workflowId/run-list-entry-command

PATCH /api/workflow-nodes/:nodeId

Ошибки: 400 LIST_ENTRY_MISMATCH, 403 LIST_WORKFLOW_RUN_DENIED.

Acceptance ·

Command workflow показывается только в выбранном list.

Запуск на entry создаёт workflow run.

Run получает list-specific attributes и parent record.

Пользователь без доступа к list не видит command.

Archived entry не запускает command.

Runs tab показывает list entry trigger.

Bulk запуск создаёт runs для выбранных entries.

Edge-cases ·

Entry удалена после открытия меню → запуск возвращает 404.

Workflow published version ссылается на archived list → command скрывается.

Parent record archived → run блокируется или запускается с warning.

Несколько lists с одинаковым именем → хранить listId, не name.

S237 — Trigger: Record added to list

Экран/меню · Workflow builder → Select trigger → Lists → Record added to list.

Роль/доступ · READ_WRITE/FULL к workflow; workflow должен иметь read access к list и parent object.

Предусловие · Есть list, например Event Invitees; list поддерживает entries; event создаётся при добавлении record в list.

UI-элементы · Trigger card Record added to list; inspector: List; node subtitle Record added to Event Invitees; Next step; refresh trigger.

Шаги ·

Пользователь выбирает trigger Record added to list.

В inputs выбирает list Event Invitees.

Добавляет следующие steps, например Enroll in sequence, Update list entry.

Публикует workflow.

Пользователь добавляет record в list.

Workflow автоматически запускается.

Данные(Prisma) ·

WorkflowNode: triggerType=RECORD_ADDED_TO_LIST, configJson={ listId }.

ListEntry: новая entry.

WorkflowEvent: type=LIST_ENTRY_CREATED.

WorkflowRun: triggerListEntryId, triggerRecordId.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/lists/:listId/entries

POST /api/lists/:listId/entries/bulk

Worker/internal: enqueue workflow event.

Acceptance ·

Workflow запускается при добавлении record в выбранный list.

Workflow не запускается при добавлении в другой list.

Run получает list entry, parent record и addedBy.

Bulk add создаёт runs для каждой добавленной entry.

Duplicate existing entry не должен повторно запускать workflow, если entry не создана заново.

Runs tab показывает событие Record added to list.

Downstream steps могут читать list attributes.

Edge-cases ·

Import CSV в list создаёт много entries → queue throttling.

Add-to-list action внутри этого же workflow может вызвать цикл: нужен loop guard.

Entry уже существует и обновляется — должен сработать S238/S239, не S237.

List archived → trigger не активируется.

S238 — Trigger: List entry updated

Экран/меню · Workflow builder → Select trigger → Lists → List entry updated.

Роль/доступ · READ_WRITE/FULL к workflow; workflow read access к list.

Предусловие · Есть list-specific attributes/stage; update events содержат before/after.

UI-элементы · Trigger card List entry updated; inspector: List, optional List attribute / Stage; before/after variables; Next step.

Шаги ·

Пользователь выбирает List entry updated.

Выбирает list Event Invitees.

Опционально выбирает stage или list attribute.

Публикует workflow.

Пользователь меняет stage entry, например Shortlisted → Invited.

Система создаёт run с before/after.

Данные(Prisma) ·

WorkflowNode: triggerType=LIST_ENTRY_UPDATED, configJson={ listId, listAttributeId? }.

ListEntry: stage, position, updatedAt.

ListEntryValue: list-specific values.

WorkflowEvent: before/after entry snapshot.

WorkflowRun.

API ·

PATCH /api/workflow-nodes/:nodeId

PATCH /api/list-entries/:entryId

PATCH /api/list-entry-values/:valueId

Worker/internal event dispatch.

Acceptance ·

Workflow запускается при update entry выбранного list.

При specific stage/attribute запускается только при изменении этого поля.

Run содержит old/new values.

Обновления позиции drag-drop можно исключить, если trigger настроен только на stage/attribute.

Draft/disabled workflow не запускается.

Runs tab показывает changed field.

Downstream blocks видят parent record и list entry.

Edge-cases ·

Drag-drop в той же колонке меняет position: не запускать stage workflow.

Bulk stage update создаёт несколько runs.

Entry удалили после event, до run — использовать snapshot, но write-actions блокировать.

List attribute archived после publish → validation warning.

S239 — Trigger: Attribute updated

Экран/меню · Workflow builder → Select trigger → Data → Attribute updated.

Роль/доступ · READ_WRITE/FULL к workflow; read access к object/attribute.

Предусловие · Есть object и attribute; система пишет events при создании record и при обновлении attribute; отличие: trigger срабатывает и при первом создании записи, если attribute получил значение.

UI-элементы · Trigger card Attribute updated; inspector: Object, Attribute; checkbox/описание fires on create; before/after values; variable list.

Шаги ·

Пользователь выбирает Attribute updated.

Выбирает object Deals.

Выбирает attribute Deal stage.

Публикует workflow.

Создаётся новый deal со stage или обновляется stage существующего deal.

Workflow запускается.

Данные(Prisma) ·

WorkflowNode: triggerType=ATTRIBUTE_UPDATED, configJson={ objectId, attributeId }.

Value: target value.

WorkflowEvent: type=ATTRIBUTE_UPDATED, isInitialValue, oldValue, newValue.

WorkflowRun.

API ·

PATCH /api/workflow-nodes/:nodeId

CRM create/update endpoints.

Worker/internal event dispatcher.

Acceptance ·

Trigger запускается при изменении выбранного attribute.

Trigger запускается при создании record, если attribute задан впервые.

Trigger не запускается при изменении других attributes.

Run содержит isInitialValue.

Before value может быть null при create.

Variables доступны filter/if-else blocks.

Runs tab показывает old/new value.

Edge-cases ·

Значение очистили до null → это тоже update.

Значение записали тем же значением → не запускать.

Multi-select order изменился без semantic change → не запускать.

Attribute archived → workflow paused/invalid или продолжает по id с warning.

S240 — Trigger: Task created

Экран/меню · Workflow builder → Select trigger → Tasks → Task created.

Роль/доступ · READ_WRITE/FULL к workflow; workflow read access к task scope; downstream actions по permissions.

Предусловие · Модуль Tasks включён; задачи создаются через task page, record page, AI assistant или workflow.

UI-элементы · Trigger card Task created; inspector: filters Assignee, Linked record object, Due date, Created by; node subtitle; Next step.

Шаги ·

Пользователь выбирает Task created.

Опционально ограничивает trigger задачами по assignee/object.

Публикует workflow.

Пользователь создаёт задачу.

Workflow запускается с task payload.

Данные(Prisma) ·

WorkflowNode: triggerType=TASK_CREATED, configJson.

Task: id, orgId, title, assigneeId, createdById, dueDate, recordId.

WorkflowEvent: type=TASK_CREATED.

WorkflowRun: triggerTaskId.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/tasks

Worker/internal event dispatch.

Acceptance ·

Workflow запускается при создании task.

Run содержит task, assignee, creator, linked record.

Optional filters ограничивают запуск.

Task, созданная workflow-ом, может запускать другой workflow, но loop guard предотвращает self-loop.

Draft/disabled workflow не запускается.

Runs tab показывает task trigger.

Пользователь без task visibility не видит подробности run.

Edge-cases ·

Task создана без linked record → variables linkedRecord = null.

Task создана в bulk → events по каждой task.

Task deleted до обработки → run использует snapshot.

Assignee removed from workspace → run сохраняет historical user reference.

S241 — Trigger: Manually run

Экран/меню · Workflow builder → Select trigger → Utilities → Manually run; запуск: Editor → Trigger manual workflow.

Роль/доступ · READ_WRITE/FULL к workflow; manual run обычно доступен editor/admin для теста.

Предусловие · Workflow draft или published открыт; trigger Manually run настроен; обязательные test inputs заполнены.

UI-элементы · Trigger card Manually run; inspector с test input fields; кнопка Trigger manual workflow; run preview; переход на run page; status badge Running/Succeeded/Failed.

Шаги ·

Пользователь выбирает utility trigger Manually run.

Настраивает input schema или выбирает test record/list entry.

Нажимает Trigger manual workflow.

Система создаёт manual run.

UI открывает run detail page.

Пользователь видит пошаговое выполнение.

Данные(Prisma) ·

WorkflowNode: triggerType=MANUAL_RUN, configJson={ inputSchema }.

WorkflowRun: triggerType=MANUAL, triggeredById, inputJson, status.

WorkflowRunStep: logs per node.

API ·

POST /api/workflows/:workflowId/manual-run

GET /api/workflow-runs/:runId

PATCH /api/workflow-nodes/:nodeId

Ошибки: 400 MANUAL_INPUT_INVALID, 403 MANUAL_RUN_DENIED.

Acceptance ·

Manual trigger можно выбрать из Utilities.

Пользователь может вручную запустить workflow из editor.

Manual run создаёт запись во вкладке Runs.

Run detail показывает execution по блокам.

Manual run работает для draft как test-run, если policy разрешает.

В actions не применяются destructive changes без явного test/live режима или warning.

Ошибки отображаются на конкретном block.

Edge-cases ·

Manual run без обязательных inputs → validation error.

Workflow содержит live-only integration block → test mode мокает или блокирует.

Пользователь read-only → не может manual run.

Повторный запуск manual run создаёт новый run, не перезаписывает старый.

S242 — Trigger: Recurring schedule

Экран/меню · Workflow builder → Select trigger → Utilities → Recurring schedule.

Роль/доступ · READ_WRITE/FULL к workflow; ADMIN может ограничивать scheduled automation.

Предусловие · Worker/cron scheduler доступен; timezone workspace задан; workflow будет published/live.

UI-элементы · Trigger card Recurring schedule; inspector: frequency hourly/daily/weekly/monthly, time of day, timezone, start date, optional end date; preview next runs; Next step.

Шаги ·

Пользователь выбирает Recurring schedule.

Настраивает frequency, например daily at 09:00.

Выбирает timezone.

Публикует workflow.

Scheduler создаёт runs по расписанию.

Runs tab показывает scheduled runs.

Данные(Prisma) ·

WorkflowNode: triggerType=RECURRING_SCHEDULE, configJson={ rrule, timezone, startAt }.

WorkflowSchedule: workflowId, nodeId, rrule, timezone, nextRunAt, enabled.

WorkflowRun: triggerType=SCHEDULE, scheduledFor.

API ·

PATCH /api/workflow-nodes/:nodeId

GET /api/workflows/:workflowId/schedule-preview

Scheduler/worker internal: enqueue due schedules.

Ошибки: 400 INVALID_RRULE, 400 INVALID_TIMEZONE.

Acceptance ·

Schedule trigger можно настроить daily/weekly/monthly.

Preview показывает следующие run times.

Published workflow запускается по расписанию.

Draft workflow не запускается.

Timezone учитывается.

Disable workflow останавливает future scheduled runs.

Runs tab показывает scheduled trigger source.

Edge-cases ·

DST transition → run создаётся по local timezone.

Scheduler downtime → missed runs обрабатываются по policy: skip или catch-up.

Частота слишком частая → backend блокирует.

Workflow archived → schedule disabled.

S243 — Trigger: Webhook received

Экран/меню · Workflow builder → Select trigger → Utilities → Webhook received.

Роль/доступ · READ_WRITE/FULL к workflow; webhook secret/token виден только пользователям с FULL или owner/admin.

Предусловие · Workflow draft создан; webhook endpoint service доступен; external system может отправить HTTP POST.

UI-элементы · Trigger card Webhook received; inspector: generated webhook URL; secret/token; method POST; payload sample; Copy URL; Regenerate secret; test webhook button; recent requests.

Шаги ·

Пользователь выбирает Webhook received.

Система генерирует URL и secret.

Пользователь копирует URL во внешний сервис.

Публикует workflow.

Внешний сервис отправляет POST.

Backend валидирует token/signature.

Workflow run создаётся с payload variables.

Данные(Prisma) ·

WorkflowNode: triggerType=WEBHOOK_RECEIVED, configJson={ secretRef, schema? }.

WorkflowWebhookEndpoint: id, workflowId, nodeId, tokenHash, enabled, lastReceivedAt.

WorkflowRun: triggerType=WEBHOOK, inputJson.

WorkflowWebhookRequestLog: status, payload preview, error.

API ·

POST /api/workflows/:workflowId/webhook-endpoint

POST /api/workflow-webhooks/:token

POST /api/workflow-webhooks/:endpointId/regenerate-secret

Ошибки: 401 WEBHOOK_INVALID_TOKEN, 400 WEBHOOK_PAYLOAD_INVALID, 404 WEBHOOK_NOT_FOUND.

Acceptance ·

Выбор trigger создаёт webhook URL.

External POST запускает published workflow.

Payload доступен как variables в следующих blocks.

Invalid token не запускает workflow.

Draft workflow не запускается, но test mode может принять sample.

Recent requests показывают success/failure.

Secret можно regenerate.

Edge-cases ·

Payload слишком большой → reject с 413.

Повторный одинаковый webhook → idempotency key, если header предоставлен.

Malformed JSON → request log с error, run не создаётся.

Workflow archived/disabled → endpoint возвращает disabled status.

S244 — Logic block: Filter

Экран/меню · Workflow builder → Add step → Logic → Filter.

Роль/доступ · READ_WRITE/FULL к workflow.

Предусловие · Trigger уже настроен; variables от предыдущих blocks доступны; workflow draft открыт.

UI-элементы · Add step; категория Logic; block Filter; inspector: condition builder; variable picker; operator dropdown; value input; output path continue / stop; validation status.

Шаги ·

Пользователь нажимает + после trigger/block.

Выбирает Filter.

Настраивает условие, например new value of stage = Won.

Сохраняет block.

При run filter оценивает условие.

Если true — run идёт дальше; если false — run завершается как filtered/skipped.

Данные(Prisma) ·

WorkflowNode: type=LOGIC, logicType=FILTER, configJson={ conditions }.

WorkflowEdge: path pass.

WorkflowRunStep: status=PASSED|FILTERED_OUT, outputJson.

API ·

POST /api/workflows/:workflowId/nodes

PATCH /api/workflow-nodes/:nodeId

GET /api/workflows/:workflowId/variables?beforeNodeId=

Ошибки: 400 FILTER_CONDITION_INVALID, 400 VARIABLE_NOT_FOUND.

Acceptance ·

Filter можно добавить после trigger.

Condition builder поддерживает variables из предыдущих blocks.

При true workflow продолжает выполнение.

При false workflow корректно останавливается как filtered out.

Runs tab показывает результат filter.

Ошибочный variable блокирует publish.

Filter не изменяет данные.

Edge-cases ·

Variable отсутствует/null → оператор обрабатывает null явно.

Тип variable не подходит оператору → validation error.

Несколько условий в MVP: AND; advanced AND/OR в следующем блоке.

Изменение trigger ломает variable reference → node получает invalid state.

S245 — Logic block: If/else

Экран/меню · Workflow builder → Add step → Logic → If/else.

Роль/доступ · READ_WRITE/FULL к workflow.

Предусловие · Trigger/previous block настроен; variables доступны; canvas поддерживает ветвление.

UI-элементы · Block If/else; inspector: condition builder; branches True path и False path; labels; canvas forks; add step buttons на каждой ветке.

Шаги ·

Пользователь добавляет block If/else.

Настраивает условие, например ICP is true.

На canvas появляются две ветки.

Пользователь добавляет actions в true/false paths.

При run система выбирает одну ветку.

Runs tab показывает выбранный path.

Данные(Prisma) ·

WorkflowNode: logicType=IF_ELSE, configJson={ condition }.

WorkflowEdge: sourceNodeId, targetNodeId, branchKey=TRUE|FALSE.

WorkflowRunStep: outputJson={ selectedBranch }.

API ·

POST /api/workflows/:workflowId/nodes

POST /api/workflows/:workflowId/edges

PATCH /api/workflow-nodes/:nodeId

Ошибки: 400 IF_CONDITION_INVALID, 409 BRANCH_EDGE_CONFLICT.

Acceptance ·

If/else block создаёт две ветки.

Условие может использовать variables из предыдущих blocks.

При run выполняется только выбранная ветка.

Runs tab показывает True или False.

Publish блокируется, если одна обязательная ветка некорректна по graph validation.

Можно добавлять разные actions в каждую ветку.

Branch labels видны на canvas.

Edge-cases ·

Condition returns unknown/null → false path по умолчанию или explicit fallback.

Пользователь удалил node в одной ветке → graph revalidates.

Merge веток не поддержан в MVP: каждая ветка завершается отдельно.

Переменная из true branch не доступна в false branch.

S246 — Logic block: Switch / Round robin

Экран/меню · Workflow builder → Add step → Logic → Switch и Workflow builder → Add step → Logic → Round robin.

Роль/доступ · READ_WRITE/FULL к workflow.

Предусловие · Trigger/previous block настроен; для Switch есть variable; для Round robin есть список users/team; workflow draft открыт.

UI-элементы ·

Switch: cases list, condition groups, default path, add case, branch labels.

Round robin: user/team picker, distribution mode, skip unavailable toggle, output variable selected user, assignment preview.

Canvas branches, inspector, variable picker.

Шаги ·

Пользователь добавляет Switch для выбора одной из N веток по значению variable.

Настраивает cases, например growth / contraction / cancellation.

Добавляет default path.

Или добавляет Round robin.

Выбирает команду/пользователей.

При run switch выбирает case, round robin выбирает следующего пользователя и отдаёт variable.

Данные(Prisma) ·

WorkflowNode: logicType=SWITCH|ROUND_ROBIN, configJson.

WorkflowEdge: branchKey=caseId|DEFAULT.

WorkflowRoundRobinState: nodeId, lastAssignedUserId, cursor, updatedAt.

WorkflowRunStep: selected branch/user output.

API ·

POST /api/workflows/:workflowId/nodes

PATCH /api/workflow-nodes/:nodeId

GET /api/workflows/:workflowId/variables

GET /api/teams/:teamId/members

Ошибки: 400 SWITCH_CASE_INVALID, 400 ROUND_ROBIN_USERS_REQUIRED.

Acceptance ·

Switch поддерживает N веток и default path.

Switch выбирает ровно одну ветку.

Round robin выбирает пользователя из заданного списка/team.

Round robin сохраняет state между runs.

Output selectedUser доступен downstream blocks, например create deal owner / sequence sender.

Runs tab показывает выбранный case или selected user.

Publish блокируется, если нет cases/default или users.

Edge-cases ·

Значение не совпало ни с одним case → default path.

User удалён/deactivated → round robin пропускает или падает с controlled error.

Одновременные runs → round robin state обновляется атомарно.

Все users unavailable → run step fails или идёт fallback owner по policy.

S247 — Delay / Delay until + Draft/Publish/Runs

Экран/меню · Workflow builder → Add step → Logic → Delay / Delay until; Workflow builder → Editor / Runs / Settings; Publish workflow.

Роль/доступ · READ_WRITE/FULL для редактирования и publish; READ может смотреть Runs; FULL управляет settings/permissions.

Предусловие · Workflow draft имеет trigger; worker/BullMQ доступен или demo scheduler; graph валиден для publish.

UI-элементы · Delay; Delay until; duration input; date/time variable picker; timezone; canvas node; status Draft / Live; баннер This workflow has not yet been published; кнопка Publish workflow; toggle Live; вкладка Runs; run list; run detail с блоками и статусами.

Шаги ·

Пользователь добавляет Delay после trigger/action.

Настраивает duration, например 5 minutes, или Delay until с date variable.

Публикует workflow через Publish workflow.

Trigger создаёт run.

Run доходит до delay и ставится в waiting state.

Worker продолжает run после due time.

Пользователь открывает Runs и видит историю выполнения по блокам.

Данные(Prisma) ·

WorkflowNode: logicType=DELAY|DELAY_UNTIL, configJson={ durationMs|untilVariable, timezone }.

Workflow: status=DRAFT|LIVE|PAUSED|ARCHIVED, publishedVersionId.

WorkflowVersion: immutable published graph.

WorkflowRun: status=RUNNING|WAITING|SUCCEEDED|FAILED|CANCELLED, workflowVersionId.

WorkflowRunStep: nodeId, status, startedAt, finishedAt, waitingUntil, inputJson, outputJson, errorJson.

API ·

POST /api/workflows/:workflowId/publish

POST /api/workflows/:workflowId/enable

POST /api/workflows/:workflowId/disable

GET /api/workflows/:workflowId/runs

GET /api/workflow-runs/:runId

PATCH /api/workflow-nodes/:nodeId

Worker: workflowQueue resumes delayed runs.

Ошибки: 400 DELAY_INVALID, 400 WORKFLOW_GRAPH_INVALID, 409 WORKFLOW_ALREADY_LIVE.

Acceptance ·

Delay block откладывает выполнение на заданную длительность.

Delay until ждёт до конкретной даты/переменной.

Run получает status WAITING на время delay.

После времени delay run продолжается автоматически.

Draft workflow не запускается от live triggers.

Publish создаёт immutable version и переводит workflow в Live.

Runs tab показывает каждый run, выбранный path, waiting state, success/failure.

Ошибка в block фиксируется в run detail без потери истории.

Edge-cases ·

Delay duration 0 → block проходит сразу или validation warning.

Delay until в прошлом → run продолжается сразу.

Workflow disabled пока run waiting: policy — active runs продолжаются или ставятся на pause; MVP лучше ставить future resumes на pause.

Worker downtime: delayed run возобновляется после восстановления.

Draft изменён после publish: active runs продолжают published version.

[ГОТОВ БАТЧ: S230–S247]


---

Основа для батча: Workflows в базе описаны как builder с trigger → logic/action/calculation/integration blocks; для действий зафиксированы create/update/find records/list entries, add record to list, task actions, AI blocks, Formula, Adjust time, Aggregate/Random, Loop/Find и runs-log. 


S255 — Create record

Экран/меню · Automations → Workflows → Workflow builder → Add step → Records → Create record.

Роль/доступ · OWNER, ADMIN или пользователь с READ_WRITE/FULL к workflow. Дополнительно workflow должен иметь automations-grant на создание записей в целевом object.

Предусловие · Workflow draft создан; trigger уже настроен; в workspace есть целевой object, например Deals; у пользователя есть права редактировать workflow; required attributes объекта известны.

UI-элементы · Canvas node Create record; right inspector Records / Create record; dropdown Object; список атрибутов объекта; value inputs; variable picker из предыдущих blocks; required-field markers; Next step; Refresh block; Delete block; validation panel.

Шаги ·

Пользователь нажимает + после trigger или предыдущего block.

Выбирает Records → Create record.

В inspector выбирает object, например Deals.

Заполняет required attributes: deal name, stage, owner, associated company.

Для значений использует static values или variables из trigger, например Triggered record → Company name.

Публикует workflow.

При run block создаёт record и отдаёт созданную запись как output variable.

Данные(Prisma) ·

WorkflowNode: type=ACTION, actionType=CREATE_RECORD, configJson={ objectId, attributeMappings }.

WorkflowRunStep: inputJson, outputJson={ recordId, values }, status.

Record: новая запись с orgId, objectId, createdById.

Value: значения атрибутов.

RelationshipValue: если mapping создаёт relationship.

Activity: RECORD_CREATED_BY_WORKFLOW.

API ·

POST /api/workflows/:workflowId/nodes

PATCH /api/workflow-nodes/:nodeId

POST /api/workflows/:workflowId/publish

Runtime/internal: recordService.createRecordFromWorkflow(runContext, config)

Ошибки: 400 REQUIRED_ATTRIBUTE_MISSING, 400 VALUE_TYPE_INVALID, 403 WORKFLOW_OBJECT_WRITE_DENIED, 404 OBJECT_NOT_FOUND.

Acceptance ·

Block Create record можно добавить из Records.

Пользователь выбирает object и задаёт значения его attributes.

Required attributes валидируются до publish.

При выполнении создаётся новая Record и связанные Value.

Output созданной записи доступен следующим blocks.

Activity показывает, что запись создана workflow-ом.

Workflow не может создать record в object без automations-grant.

Edge-cases ·

Required attribute получает пустую variable → run step fails с понятной ошибкой.

Select option не существует → publish блокируется или run fails по policy.

Relationship target record не найден → field-level error.

Workflow создаёт запись, которая снова триггерит тот же workflow → loop guard по workflowRunId/sourceWorkflowId.

S256 — Create-or-update record

Экран/меню · Workflow builder → Add step → Records → Create or update record.

Роль/доступ · READ_WRITE/FULL к workflow; automations-grant на create/update целевого object.

Предусловие · У целевого object есть unique/matching attribute, например Email для People или Domain для Companies; workflow draft открыт; доступны variables для matching value.

UI-элементы · Node Create or update record; inspector: Object; секция Matching attribute; поле Match value; секция If found: update; секция If not found: create; attribute mappings; conflict warnings; preview.

Шаги ·

Пользователь добавляет block Create or update record.

Выбирает object People.

Выбирает matching attribute Email.

Вставляет variable Webhook payload → email.

Настраивает create/update mappings.

Публикует workflow.

Runtime ищет record по matching attribute: если найден — обновляет, иначе создаёт.

Данные(Prisma) ·

WorkflowNode: actionType=CREATE_OR_UPDATE_RECORD, configJson={ objectId, matchingAttributeId, matchValueExpression, createMappings, updateMappings }.

Record, Value: найденная/созданная запись.

WorkflowRunStep: outputJson={ mode: CREATED|UPDATED, recordId }.

Activity: RECORD_CREATED_BY_WORKFLOW или RECORD_UPDATED_BY_WORKFLOW.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: recordService.findByAttribute, recordService.create, recordService.update

Ошибки: 400 MATCHING_ATTRIBUTE_REQUIRED, 400 MATCH_VALUE_EMPTY, 409 MULTIPLE_RECORDS_MATCHED, 403 WORKFLOW_OBJECT_WRITE_DENIED.

Acceptance ·

Matching attribute обязателен.

Если record найден по unique value, он обновляется.

Если record не найден, создаётся новый.

Output содержит mode и recordId.

Duplicate matches обрабатываются как controlled error.

Create и update mappings можно настроить отдельно.

Runs tab показывает, был ли create или update.

Edge-cases ·

Matching attribute не unique → publish показывает warning или блокирует.

Matching value normalizes email/domain case-insensitive.

Update mapping не должен очищать поля, если variable отсутствует, если не включён explicit clear.

Несколько параллельных runs создают дубль → нужна транзакция/unique constraint.

S257 — Find records

Экран/меню · Workflow builder → Add step → Records → Find records.

Роль/доступ · READ_WRITE/FULL к workflow; workflow должен иметь read access к target object.

Предусловие · Есть object и attributes для поиска; trigger/previous blocks дают variables; workflow draft открыт.

UI-элементы · Node Find records; inspector: Object; filter builder; variable picker; limit; sort; output mode first record / list of records; empty result behavior; preview query.

Шаги ·

Пользователь добавляет Find records.

Выбирает object, например Companies.

Настраивает filter: Domain equals {{emailDomain}}.

Задаёт limit, например 1 или 100.

Публикует workflow.

Runtime выполняет query и отдаёт найденные records в output.

Данные(Prisma) ·

WorkflowNode: actionType=FIND_RECORDS, configJson={ objectId, filters, sorts, limit, outputMode }.

WorkflowRunStep: outputJson={ records, count, firstRecordId }.

Record, Value: источники поиска.

Индексы Value(attributeId + typed value) для производительности.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: recordQueryService.findRecordsForWorkflow(config, context)

Ошибки: 400 FIND_FILTER_INVALID, 400 LIMIT_TOO_HIGH, 403 WORKFLOW_OBJECT_READ_DENIED.

Acceptance ·

Block ищет records по object и filters.

Можно использовать variables в фильтрах.

Output доступен downstream blocks.

Limit ограничивает максимум результатов.

Empty result не падает, если выбран режим continue with empty.

Runs tab показывает count найденных records.

Поиск соблюдает org scope и permissions.

Edge-cases ·

Limit выше 100 в MVP → backend блокирует.

Filter использует archived attribute → validation warning.

Найдено 0 records → downstream loop получает пустой массив.

Фильтр по relationship требует join через RelationshipValue.

S258 — Update record

Экран/меню · Workflow builder → Add step → Records → Update record.

Роль/доступ · READ_WRITE/FULL к workflow; automations-grant на update выбранного object/record.

Предусловие · Есть record variable из trigger/find/create block; целевой object и attributes доступны; workflow draft открыт.

UI-элементы · Node Update record; inspector: Record picker/variable; attribute mappings; current/new value preview; variable picker; validation warnings; Next step.

Шаги ·

Пользователь добавляет Update record.

Выбирает record source: Triggered record или Find records → first record.

Выбирает attributes для обновления.

Задаёт новые значения static/variables.

Публикует workflow.

Runtime обновляет Value и пишет activity.

Данные(Prisma) ·

WorkflowNode: actionType=UPDATE_RECORD, configJson={ recordExpression, attributeMappings }.

Record: updatedById = workflow actor/system.

Value: изменённые значения.

Activity: RECORD_UPDATED_BY_WORKFLOW, before/after.

WorkflowRunStep: output updated record snapshot.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: recordService.updateRecordFromWorkflow

Ошибки: 400 RECORD_VARIABLE_REQUIRED, 400 VALUE_TYPE_INVALID, 404 RECORD_NOT_FOUND, 403 WORKFLOW_RECORD_WRITE_DENIED.

Acceptance ·

Можно выбрать record из previous variables.

Можно обновить один или несколько attributes.

Значения валидируются по типам Attribute.

После run значения реально меняются в БД.

Activity фиксирует workflow update и before/after.

Output обновлённой записи доступен следующим blocks.

Archived record не обновляется.

Edge-cases ·

Record variable пустой → step fails.

Update на select option, которого нет → error или create option только если явно разрешено.

Одновременное изменение пользователем и workflow → last-write wins или optimistic conflict; MVP — activity before/after.

Workflow обновляет attribute, который является trigger текущего workflow → loop guard.

S259 — Add record to list / Create list entry

Экран/меню · Workflow builder → Add step → Lists → Add record to list.

Роль/доступ · READ_WRITE/FULL к workflow; workflow должен иметь permission на выбранный list и read access к parent record.

Предусловие · Есть list; есть record variable совместимого parent object; list может иметь list-specific attributes; workflow draft открыт.

UI-элементы · Node Add record to list; inspector: List; Record; list attribute mappings; duplicate policy skip/update existing/add separate; stage selector; output variable Created entry.

Шаги ·

Пользователь добавляет Add record to list.

Выбирает list, например Event Invitees.

В поле Record выбирает variable Triggered record или Created record.

Заполняет list-specific attributes: stage, source, owner, RSVP status.

Настраивает duplicate policy.

Runtime создаёт ListEntry или обновляет existing entry по policy.

Данные(Prisma) ·

WorkflowNode: actionType=ADD_RECORD_TO_LIST, configJson={ listId, recordExpression, listValueMappings, duplicatePolicy }.

ListEntry: listId, recordId, stage, position, addedById.

ListEntryValue: list-specific values.

WorkflowRunStep: outputJson={ listEntryId, mode }.

Activity: LIST_ENTRY_CREATED_BY_WORKFLOW.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: listService.addRecordToListFromWorkflow

Ошибки: 400 RECORD_OBJECT_MISMATCH, 409 LIST_ENTRY_ALREADY_EXISTS, 403 WORKFLOW_LIST_WRITE_DENIED.

Acceptance ·

Workflow может добавить record в выбранный list.

Parent object record должен соответствовать list object.

Можно заполнить list-specific attributes.

Duplicate policy работает: skip/update/add separate.

Output содержит созданную/найденную list entry.

Activity появляется на record/list entry.

Событие add-to-list может триггерить другие workflows, но loop guard предотвращает self-loop.

Edge-cases ·

Record уже в list и policy skip → step success с mode=SKIPPED.

List archived → publish/run блокируется.

Record archived → step fails.

Required list attribute не заполнен → validation error.

S260 — Update list entry / Delete list entry

Экран/меню · Workflow builder → Add step → Lists → Update list entry; дополнительно Lists → Delete list entry.

Роль/доступ · READ_WRITE/FULL к workflow; workflow write-grant на list.

Предусловие · Есть ListEntry variable из trigger Record added to list, List entry updated, Find list entries или Add record to list; list-specific schema доступна.

UI-элементы · Node Update list entry; inspector: Entry; Stage; list attribute mappings; Delete list entry action; confirmation/warning для delete; output preview.

Шаги ·

Пользователь добавляет Update list entry.

Выбирает entry variable, например Created entry.

Обновляет stage, например Invited.

Заполняет list attributes, например Invited at = Now.

Публикует workflow.

Runtime обновляет entry.

Для Delete list entry runtime удаляет/архивирует entry, но не parent record.

Данные(Prisma) ·

WorkflowNode: actionType=UPDATE_LIST_ENTRY|DELETE_LIST_ENTRY, configJson={ entryExpression, mappings }.

ListEntry: stage, position, archivedAt или delete.

ListEntryValue: значения list attributes.

Activity: LIST_ENTRY_UPDATED_BY_WORKFLOW / LIST_ENTRY_DELETED_BY_WORKFLOW.

WorkflowRunStep.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: listService.updateEntryFromWorkflow, listService.deleteEntryFromWorkflow

Ошибки: 400 ENTRY_VARIABLE_REQUIRED, 404 LIST_ENTRY_NOT_FOUND, 403 WORKFLOW_LIST_WRITE_DENIED.

Acceptance ·

Workflow может обновить stage list entry.

Workflow может обновить list-specific values.

Delete list entry удаляет entry из list, но не удаляет parent record.

Activity фиксирует before/after.

Output содержит обновлённую entry или delete result.

Required list attributes валидируются.

Runs tab показывает изменённые поля.

Edge-cases ·

Entry уже удалена → step fails или success skipped по policy.

Update только position от drag-drop не должен случайно менять stage.

Stage option удалена после publish → validation warning.

Delete в workflow, который triggered by same entry, должен завершить дальнейшие entry-dependent blocks с snapshot или error.

S261 — Create task

Экран/меню · Workflow builder → Add step → Tasks → Create task.

Роль/доступ · READ_WRITE/FULL к workflow; workflow должен иметь grant на создание tasks; assignee должен быть активным user.

Предусловие · Модуль Tasks включён; есть assignee variable/static user; есть linked record variable или task без связи разрешён; workflow draft открыт.

UI-элементы · Node Create task; inspector: Title; Description; Assignee; Due date; Linked record; variable picker; date helper; priority/status fields; preview task.

Шаги ·

Пользователь добавляет Create task.

Вводит title, например Follow up with {{Company name}}.

Выбирает assignee: static user, triggered by, round robin output.

Задаёт due date через static date или output Adjust time.

Выбирает linked record.

Runtime создаёт task.

Данные(Prisma) ·

WorkflowNode: actionType=CREATE_TASK, configJson={ titleTemplate, descriptionTemplate, assigneeExpression, dueDateExpression, linkedRecordExpression }.

Task: title, description, assigneeId, createdById, recordId, dueDate, status=OPEN.

Activity: TASK_CREATED_BY_WORKFLOW.

WorkflowRunStep: outputJson={ taskId }.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: taskService.createTaskFromWorkflow

Ошибки: 400 TASK_TITLE_REQUIRED, 400 ASSIGNEE_REQUIRED, 404 ASSIGNEE_NOT_FOUND, 403 TASK_CREATE_DENIED.

Acceptance ·

Workflow создаёт задачу с title, assignee и due date.

Title/description поддерживают variables.

Linked record отображает задачу на record page.

Task появляется в глобальном Tasks page.

Output task доступен downstream blocks.

Activity появляется на linked record.

Неактивный assignee блокирует run или выбирает fallback по policy.

Edge-cases ·

Due date в прошлом → warning или разрешить.

Assignee variable пустая → step fails.

Linked record archived → task создаётся без связи или fails по policy; MVP — fails.

Round robin output user removed before run → fallback/error.

S262 — Send email

Экран/меню · Workflow builder → Add step → Emails → Send email или Actions → Send email.

Роль/доступ · READ_WRITE/FULL к workflow; sender mailbox должен быть подключён или demo-mailbox; workflow должен иметь permission на email-send action.

Предусловие · Есть recipient email variable; есть sender mailbox/delegated sender; subject/body настроены; demo-send включён для безопасного MVP.

UI-элементы · Node Send email; inspector: From; To; Subject; body editor; templates; variables; tracking toggles; unsubscribe/signature options; preview; demo-mode badge.

Шаги ·

Пользователь добавляет Send email.

Выбирает sender: current user, triggered by, fixed mailbox.

Задаёт recipient email variable.

Заполняет subject/body с variables.

Публикует workflow.

Runtime создаёт email и отправляет через provider или demo-send.

Activity появляется на linked record.

Данные(Prisma) ·

WorkflowNode: actionType=SEND_EMAIL, configJson={ senderExpression, recipientExpression, subjectTemplate, bodyTemplate, trackingConfig }.

Email: direction=OUTBOUND, status=QUEUED|SENT|FAILED|DEMO_SENT, recordId, senderUserId, recipientEmail, subject, body.

Activity: EMAIL_SENT_BY_WORKFLOW.

WorkflowRunStep: output email id/status.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: emailService.sendWorkflowEmail

Existing/demo endpoints can reuse: POST /api/records/:recordId/emails/send internally.

Ошибки: 400 RECIPIENT_EMAIL_REQUIRED, 409 MAILBOX_NOT_CONNECTED, 403 EMAIL_SEND_DENIED.

Acceptance ·

Workflow может отправить email на recipient variable.

Subject/body render-ятся с variables.

Demo-mode не отправляет наружу, но создаёт email activity.

Отправленное письмо видно в Emails tab linked record.

Missing recipient блокирует step.

Sender permission/delegated sending проверяется backend-ом.

Runs tab показывает email status.

Edge-cases ·

Recipient unsubscribed/suppressed → send блокируется.

Provider временно недоступен → retry через queue.

Body содержит неизвестную variable → publish validation error.

Несколько recipients → MVP требует loop block, прямой send block принимает один email.

S263 — AI-блок: Classify / Summarize / Research / Prompt

Экран/меню · Workflow builder → Add step → AI → Classify record / Summarize record / Research agent / Prompt completion.

Роль/доступ · READ_WRITE/FULL к workflow; workspace должен иметь AI credits или demo-AI; workflow должен иметь read access к input record и write access, если результат сохраняется в record/list entry.

Предусловие · AI service настроен или включён demo-mode; есть input record/text variables; выбран output type; для Research agent доступна кредитная модель.

UI-элементы · AI node; inspector: AI action type; input record/text; guidance prompt; output schema; result destination; credit cost badge 1 или 10; test run; preview result; safety warning.

Шаги ·

Пользователь добавляет AI block.

Выбирает тип: Classify record, Summarize record, Research agent, Prompt completion.

Выбирает input: record или variables.

Пишет guidance/prompt.

Выбирает output destination: workflow variable или attribute update.

Runtime запускает AI/demo-AI.

Result сохраняется в run output и опционально в record value.

Данные(Prisma) ·

WorkflowNode: actionType=AI_CLASSIFY|AI_SUMMARIZE|AI_RESEARCH|AI_PROMPT, configJson={ inputExpression, prompt, outputSchema, destination }.

AiRun: orgId, workflowRunId, nodeId, type, inputJson, outputJson, status.

CreditTransaction: списание credits.

Value: если результат пишется в attribute.

WorkflowRunStep: output AI result.

API ·

PATCH /api/workflow-nodes/:nodeId

Runtime/internal: aiService.runWorkflowAiBlock

GET /api/workflows/:workflowId/ai-preview

Ошибки: 402 AI_CREDITS_INSUFFICIENT, 400 AI_OUTPUT_SCHEMA_INVALID, 503 AI_PROVIDER_UNAVAILABLE.

Acceptance ·

Доступны 4 AI action types.

Demo-mode работает без внешнего AI ключа.

Classify возвращает select/multi-select compatible output.

Summarize возвращает text.

Research agent списывает 10 credits, остальные базово 1 credit.

Output доступен downstream blocks.

При записи результата в attribute тип значения валидируется.

Edge-cases ·

Недостаточно credits → run блокируется до пополнения или demo override.

AI вернул invalid JSON/output → retry/repair или step fails.

Input record недоступен по permissions → step fails.

Research provider недоступен → demo fallback только если workspace в demo-mode.

S264 — Formula / вычисления

Экран/меню · Workflow builder → Add step → Calculation → Formula.

Роль/доступ · READ_WRITE/FULL к workflow.

Предусловие · Есть numeric/date/text variables из trigger или previous blocks; workflow draft открыт; formula engine включён.

UI-элементы · Node Formula; inspector: formula editor; variable picker; operator list; output type dropdown number/text/boolean/currency; test values; result preview; validation errors.

Шаги ·

Пользователь добавляет Formula.

Вставляет variables, например new MRR - old MRR.

Выбирает output name MRR delta.

Выбирает output type number/currency.

Тестирует формулу на sample input.

Runtime вычисляет result и отдаёт downstream variable.

Данные(Prisma) ·

WorkflowNode: actionType=FORMULA, configJson={ expression, outputName, outputType }.

WorkflowRunStep: inputJson, outputJson={ outputName: value }.

WorkflowVariableDefinition: derived variable metadata.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/workflows/:workflowId/formula-preview

Runtime/internal: workflowFormulaService.evaluate

Ошибки: 400 FORMULA_PARSE_ERROR, 400 VARIABLE_TYPE_MISMATCH, 400 DIVISION_BY_ZERO.

Acceptance ·

Formula block вычисляет значение из previous variables.

Поддерживаются number/currency/date-safe операции MVP.

Output variable доступна следующим blocks.

Preview показывает результат на sample values.

Publish блокируется при parse error.

Runtime errors фиксируются в run step.

Formula не изменяет CRM-данные сама по себе.

Edge-cases ·

Variable null → formula использует explicit null behavior.

Деление на ноль → controlled error.

Currency разных codes → block требует conversion policy или fails.

Изменение имени variable upstream не ломает формулу, если references хранятся по id/path.

S265 — Adjust time / Aggregate

Экран/меню · Workflow builder → Add step → Calculation → Adjust time и Calculation → Aggregate.

Роль/доступ · READ_WRITE/FULL к workflow.

Предусловие · Для Adjust time есть date/datetime variable или static base date; для Aggregate есть array/list output из Find records, Find list entries или loop context.

UI-элементы ·
Adjust time: base date picker, operation add/subtract, units minutes/hours/days/business days/weeks/months, timezone, output name.
Aggregate: input collection, operation count/sum/avg/min/max, field selector, output name, preview.

Шаги ·

Пользователь добавляет Adjust time.

Выбирает base date, например Trigger time.

Добавляет +2 business days.

Использует output как due date для Create task.

Или добавляет Aggregate.

Выбирает collection Find records → records.

Считает sum Amount или count records.

Использует result в filter/switch/task/email.

Данные(Prisma) ·

WorkflowNode: actionType=ADJUST_TIME|AGGREGATE, configJson.

WorkflowRunStep: output adjusted date или aggregate value.

WorkflowVariableDefinition: derived variable metadata.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/workflows/:workflowId/calculation-preview

Runtime/internal: workflowCalculationService.adjustTime, workflowCalculationService.aggregate

Ошибки: 400 DATE_VARIABLE_REQUIRED, 400 AGGREGATE_INPUT_NOT_COLLECTION, 400 AGGREGATE_FIELD_INVALID.

Acceptance ·

Adjust time создаёт новый date/datetime output.

Можно прибавить/вычесть duration.

Business days учитывают Mon–Fri в MVP.

Aggregate считает count/sum/avg/min/max по collection.

Aggregate output доступен downstream blocks.

Preview показывает результат на sample data.

Invalid input type блокирует publish.

Edge-cases ·

Base date отсутствует → step fails.

DST/timezone → использовать timezone-aware расчёт.

Aggregate по пустой collection: count=0, sum=0, avg/min/max=null.

Sum по currency разных codes → fails или требует conversion policy.

S266 — Loop / Find: массовая обработка найденных записей

Экран/меню · Workflow builder → Add step → Records → Find records + Add step → Loop; также Lists → Find list entries.

Роль/доступ · READ_WRITE/FULL к workflow; read/write grants на объекты/списки, которые обрабатываются внутри loop.

Предусловие · Есть collection output из Find records или Find list entries; workflow draft открыт; limit в MVP не выше 100; downstream action поддерживает per-item context.

UI-элементы · Node Find records; node Loop; inspector Collection; Current item variable; Max items; body/canvas внутри loop; End loop; warning limit 100; run progress per item.

Шаги ·

Пользователь добавляет Find records или Find list entries.

Настраивает фильтр и limit.

Добавляет Loop по найденной collection.

Внутри loop добавляет action: update record, add to sequence, create task, send email, update list entry.

Публикует workflow.

Runtime выполняет body для каждого item.

Runs tab показывает item-level progress и ошибки.

Данные(Prisma) ·

WorkflowNode: actionType=FIND_RECORDS|FIND_LIST_ENTRIES|LOOP, configJson={ collectionExpression, maxItems }.

WorkflowEdge: loop body edges.

WorkflowRunStep: loop parent output total/succeeded/failed/skipped.

WorkflowRunLoopItem: runStepId, index, itemJson, status, errorJson.

WorkflowRunStep: child steps per item.

API ·

PATCH /api/workflow-nodes/:nodeId

POST /api/workflows/:workflowId/edges

Runtime/internal: workflowRuntime.executeLoop

Ошибки: 400 LOOP_COLLECTION_REQUIRED, 400 LOOP_LIMIT_EXCEEDED, 409 LOOP_BODY_INVALID.

Acceptance ·

Loop принимает collection из find block.

Внутри loop доступна variable Current item.

MVP ограничивает loop максимум 100 items.

Для каждого item выполняются вложенные blocks.

Ошибка одного item не обязана валить весь loop, если включён continue on error.

Runs tab показывает total/succeeded/failed/skipped.

Loop защищён от бесконечной рекурсии.

Edge-cases ·

Collection пустая → loop завершается success с 0 items.

Item archived между find и action → item fails/skips.

Loop содержит send email → применяются email limits/outbox.

Loop вызывает add-to-list trigger, который запускает этот же workflow → loop guard/source workflow protection.

Collection больше 100 → block fails или требует pagination/bulk job в следующей версии.

[ГОТОВ БАТЧ: S255–S266]


---

Основа: workflow-модуль покрывает integration blocks Slack/HTTP/Webhooks, переменные между блоками, runs-историю и пример связки record added to list → enroll in sequence → update status (Academy/Research/Storyboard).

### S267 — Slack: отправить сообщение в канал
- **Экран/меню:** Automations → Workflows → Workflow builder → Add step → Integrations → Slack → Send channel message.
- **Роль/доступ:** OWNER, ADMIN или пользователь с READ_WRITE/FULL к workflow. Slack app установлен workspace-admin-ом; workflow имеет permission использовать Slack connection.
- **Предусловие:** Workflow draft создан; trigger/previous blocks настроены; Slack integration подключена или включён demo-integration mode; есть Slack workspace/channel; доступны variables из предыдущих blocks.
- **UI-элементы:** Node Slack — Send message; right inspector: Connection, Channel, Message, variable picker, preview, Test step, Next step, warning при неподключённом Slack; badge Demo Slack в demo-mode.
- **Шаги:** 1) Добавить step Slack → Send channel message. 2) Выбрать Slack connection. 3) Выбрать канал (#sales-alerts). 4) Написать message template с variables (`New high-value deal: {{Deal name}} — {{Deal value}}`). 5) Publish. 6) При run рендер message и отправка в Slack; run step сохраняет Slack/demo response.
- **Данные (Prisma):** WorkflowNode `actionType=SLACK_SEND_MESSAGE, configJson={connectionId, channelId, messageTemplate}`; IntegrationConnection `provider=SLACK`; WorkflowRunStep input/output `{providerMessageId, channelId, status}`; IntegrationEventLog; Activity `WORKFLOW_SLACK_MESSAGE_SENT` (optional).
- **API:** `GET /api/integrations/slack/connections`; `GET /api/integrations/slack/channels?connectionId=`; `PATCH /api/workflow-nodes/:nodeId`; runtime `workflowIntegrationService.sendSlackMessage`. Ошибки: 409 SLACK_NOT_CONNECTED, 400 SLACK_CHANNEL_REQUIRED, 400 MESSAGE_TEMPLATE_INVALID, 403 INTEGRATION_ACCESS_DENIED.
- **Acceptance:** Slack block в категории Integrations; выбор connection/channel; message с variables; Test step preview/тест-сообщение; runtime отправляет или создаёт demo-send log; Runs показывает status; без connection publish блокируется/warning.
- **Edge-cases:** канал удалён после publish → controlled error; пустая variable → fallback/fail; rate-limit → retry с backoff; потеря доступа к connection → редактирование блокируется, published работает по сохранённому service connection.

### S268 — Slack: сообщение с action-кнопками и ожиданием выбора
- **Экран/меню:** Workflow builder → Add step → Integrations → Slack → Send message with actions.
- **Роль/доступ:** READ_WRITE/FULL к workflow; Slack integration установлена; право создавать interactive Slack messages.
- **Предусловие:** Workflow draft открыт; Slack app поддерживает interactive callbacks; есть downstream branches/variables, зависящие от выбранной кнопки.
- **UI-элементы:** Node Slack — Send action message; inspector: Channel, Message, секция Actions; Add button; Label/Value/Style; toggle Wait for response; timeout; output variable selectedAction; canvas branches по выбранной action.
- **Шаги:** 1) Добавить Slack action block. 2) Настроить channel и текст. 3) Добавить кнопки (Approve/Reject/Needs review). 4) Включить Wait for response. 5) Добавить downstream switch/branches по selectedAction. 6) При run workflow отправляет message и переходит в WAITING; после клика callback продолжает run.
- **Данные (Prisma):** WorkflowNode `actionType=SLACK_SEND_ACTION_MESSAGE, configJson={channelId, messageTemplate, actions, waitForResponse, timeoutMs}`; WorkflowRunStep `status=WAITING|SUCCEEDED|TIMED_OUT, waitingUntil, outputJson={selectedAction, clickedBy}`; SlackInteraction `{runStepId, providerMessageId, actionValue, clickedByExternalId, receivedAt}`; WorkflowRun.status может быть WAITING.
- **API:** `PATCH /api/workflow-nodes/:nodeId`; `POST /api/integrations/slack/interactions`; runtime `slackActionMessageService.sendAndWait`. Ошибки: 400 SLACK_ACTIONS_REQUIRED, 400 ACTION_VALUE_DUPLICATE, 408 SLACK_ACTION_TIMEOUT.
- **Acceptance:** несколько кнопок; Wait=true → run WAITING; клик продолжает run; выбранная action доступна downstream; timeout → отдельный status/path; Runs показывает кто/когда нажал; повторный клик не запускает повторно.
- **Edge-cases:** callback после timeout → late interaction, run не продолжается; два клика (Approve, затем Reject) → первый валидный wins; message удалён → run waiting до timeout; Slack app переустановлен → старые callbacks invalid.

### S269 — HTTP request: отправить запрос во внешнюю систему
- **Экран/меню:** Workflow builder → Add step → Integrations → HTTP / JSON → Send HTTP request.
- **Роль/доступ:** READ_WRITE/FULL к workflow. Для production endpoints может требоваться ADMIN или allowlist domain policy.
- **Предусловие:** Workflow draft открыт; endpoint известен; variables доступны; secrets/API keys в integration secrets/workspace settings.
- **UI-элементы:** Node Send HTTP request; inspector: method GET/POST/PUT/PATCH/DELETE/HEAD; URL; headers editor; auth selector; body JSON; variable picker; timeout; retry policy; Test request; response preview.
- **Шаги:** 1) Добавить Send HTTP request. 2) Выбрать method (POST). 3) URL внешней системы. 4) headers/auth. 5) JSON body с variables. 6) Test. 7) Publish. Runtime отправляет request и сохраняет status/response.
- **Данные (Prisma):** WorkflowNode `actionType=HTTP_REQUEST, configJson={method, urlTemplate, headers, bodyTemplate, authRef, timeoutMs, retryPolicy}`; IntegrationSecret (encrypted ref); WorkflowRunStep `outputJson={statusCode, headers, body, durationMs}, errorJson`; HttpRequestLog.
- **API:** `PATCH /api/workflow-nodes/:nodeId`; `POST /api/workflows/:workflowId/http-test`; runtime `workflowHttpService.executeRequest`. Ошибки: 400 HTTP_URL_INVALID, 400 HTTP_BODY_INVALID_JSON, 403 HTTP_DOMAIN_NOT_ALLOWED, 504 HTTP_REQUEST_TIMEOUT.
- **Acceptance:** основные methods; URL/headers/body с variables; JSON валидируется до publish; secrets не показываются после сохранения; runtime сохраняет response; non-2xx = fail/success по treatNon2xxAsError; Runs показывает sanitized request/response.
- **Edge-cases:** timeout → retry; URL → private/internal IP → SSRF protection блокирует; огромный response → truncate с metadata; secret удалён → SECRET_NOT_FOUND.

### S270 — HTTP response: распарсить JSON и использовать поля дальше
- **Экран/меню:** Workflow builder → Add step → Integrations → HTTP / JSON → Parse JSON (или HTTP request → Response mapping).
- **Роль/доступ:** READ_WRITE/FULL к workflow.
- **Предусловие:** Есть previous HTTP request step или webhook payload; response body содержит JSON; известны нужные downstream поля.
- **UI-элементы:** Node Parse JSON; inspector: Input JSON; schema/sample editor; field picker; output variables; JSON path editor; validation preview; Use response from previous HTTP request.
- **Шаги:** 1) Добавить Parse JSON после HTTP request. 2) Выбрать input = response body. 3) Вставить sample response. 4) Выбрать поля (`company.id, status, score`). 5) Сохранить output variables. 6) Downstream blocks используют parsed variables.
- **Данные (Prisma):** WorkflowNode `actionType=PARSE_JSON, configJson={inputExpression, jsonPaths, outputSchema}`; WorkflowRunStep `inputJson, outputJson={parsedFields}`; WorkflowVariableDefinition.
- **API:** `PATCH /api/workflow-nodes/:nodeId`; `POST /api/workflows/:workflowId/json-parse-preview`; runtime `workflowJsonService.parse`. Ошибки: 400 JSON_INPUT_REQUIRED, 400 JSON_PATH_INVALID, 400 JSON_PARSE_FAILED.
- **Acceptance:** input из previous HTTP/webhook; задание JSON paths; preview extracted fields; output доступен следующим blocks; invalid JSON блокирует; missing optional → null, required → failure; Runs без раскрытия secrets.
- **Edge-cases:** body не JSON → controlled error; массив вместо объекта → indexes/loop; большой JSON → truncation preview, parsing по path работает; type mismatch → fail/cast по policy.

### S271 — Outbound webhook: отправить событие из workflow
- **Экран/меню:** Workflow builder → Add step → Integrations → Webhooks → Send webhook.
- **Роль/доступ:** READ_WRITE/FULL к workflow; external webhook domains могут требовать admin allowlist.
- **Предусловие:** Workflow draft открыт; есть external webhook URL; payload schema определена; secrets/header auth настроены.
- **UI-элементы:** Node Send webhook; inspector: Webhook URL, method POST, headers, payload JSON, signing secret, variable picker, Test webhook, delivery retry policy, response preview.
- **Шаги:** 1) Добавить Send webhook. 2) URL внешней системы. 3) payload (`{"recordId":"{{record.id}}","stage":"{{newStage}}"}`). 4) Включить signature header. 5) Test. 6) Publish. Runtime отправляет webhook и сохраняет delivery result.
- **Данные (Prisma):** WorkflowNode `actionType=SEND_WEBHOOK, configJson={urlTemplate, headers, payloadTemplate, signingSecretRef, retryPolicy}`; WebhookDelivery `{runStepId, urlHost, statusCode, attempts, status, lastError, sentAt}`; WorkflowRunStep output; IntegrationSecret.
- **API:** `PATCH /api/workflow-nodes/:nodeId`; `POST /api/workflows/:workflowId/webhook-test`; runtime `workflowWebhookDeliveryService.send`. Ошибки: 400 WEBHOOK_URL_INVALID, 403 WEBHOOK_DOMAIN_NOT_ALLOWED, 504 WEBHOOK_TIMEOUT.
- **Acceptance:** outbound webhook; payload с variables; signing secret безопасно и скрыт; delivery result в Runs; failed retry по policy; non-2xx сохраняется в delivery log; demo-mode создаёт delivery log без внешнего вызова.
- **Edge-cases:** 429 → retry backoff; 410/404 → retry ограничен/disabled; PII в payload → warning при внешнем домене; URL после render меняет host → SSRF/allowlist после render.

### S272 — Incoming webhook: принять внешний webhook и запустить workflow
- **Экран/меню:** Workflow builder → Select trigger → Utilities / Webhooks → Webhook received; Workflow settings → Webhook endpoint.
- **Роль/доступ:** READ_WRITE/FULL к workflow для настройки; webhook secret виден только FULL/admin; внешний отправитель не авторизован в UI, проходит token/signature validation.
- **Предусловие:** Workflow имеет trigger Webhook received; endpoint опубликован; workflow live; внешний сервис знает URL/token.
- **UI-элементы:** Trigger node Webhook received; inspector: generated URL, Copy URL, Regenerate secret, sample payload, recent requests table, signature validation toggle, Test payload.
- **Шаги:** 1) Выбрать trigger Webhook received. 2) Система генерирует endpoint URL/token. 3) Скопировать URL во внешнюю систему. 4) Publish. 5) Внешний сервис отправляет POST. 6) Backend валидирует token/signature и payload. 7) Создаётся WorkflowRun с webhook payload variables.
- **Данные (Prisma):** WorkflowWebhookEndpoint `{id, workflowId, nodeId, tokenHash, secretRef, enabled, lastReceivedAt}`; WorkflowWebhookRequestLog; WorkflowRun `triggerType=WEBHOOK, inputJson`; WorkflowRunStep trigger output.
- **API:** `POST /api/workflow-webhooks/:token`; `POST /api/workflows/:workflowId/webhook-endpoint/regenerate`; `GET /api/workflows/:workflowId/webhook-requests`. Ошибки: 401 WEBHOOK_INVALID_TOKEN, 400 WEBHOOK_PAYLOAD_INVALID, 413 WEBHOOK_PAYLOAD_TOO_LARGE, 409 WORKFLOW_DISABLED.
- **Acceptance:** endpoint создаётся при настройке trigger; valid POST запускает workflow; payload доступен downstream; invalid token не создаёт run; recent requests показывают success/failure; regenerate инвалидирует старый token; draft/disabled не запускается.
- **Edge-cases:** malformed JSON → log создаётся, run нет; повтор с idempotency key → duplicate ignored/linked; payload больше лимита → reject без полного body; endpoint отключён → disabled status.

### S273 — Runs: история запусков workflow
- **Экран/меню:** Workflow builder → Runs.
- **Роль/доступ:** READ к workflow — aggregate runs; подробные payload/outputs зависят от permissions на records/emails/integrations. READ_WRITE/FULL может retry/rerun (S275).
- **Предусловие:** Workflow существует; есть ≥0 runs; runtime пишет WorkflowRun и WorkflowRunStep.
- **UI-элементы:** Вкладки Editor/Runs/Settings; table runs; columns Started at, Trigger, Status, Duration, Triggered by, Version; filters Succeeded/Failed/Waiting/Running; search; empty state; click row → run detail.
- **Шаги:** 1) Открыть workflow. 2) Вкладка Runs. 3) Загрузка истории. 4) Фильтр по status/date/trigger. 5) Открыть конкретный run. 6) Run detail с execution path.
- **Данные (Prisma):** WorkflowRun `{id, orgId, workflowId, workflowVersionId, triggerType, triggeredById, status, startedAt, finishedAt, durationMs, errorSummary}`; WorkflowRunStep; WorkflowVersion; ссылки на Record/Task/Email в input/output.
- **API:** `GET /api/workflows/:workflowId/runs?status=&cursor=&limit=&dateFrom=&dateTo=`; `GET /api/workflow-runs/:runId`. Ошибки: 403 WORKFLOW_RUNS_ACCESS_DENIED, 404 WORKFLOW_RUN_NOT_FOUND.
- **Acceptance:** Runs показывает историю; status RUNNING/WAITING/SUCCEEDED/FAILED/CANCELLED; фильтр по status/date; run связан с version; клик → detail; empty state; без доступа sensitive payload скрыт.
- **Edge-cases:** много runs → pagination/cursor; run по archived workflow доступен через archived view; секреты маскируются; record удалён → historical snapshot + disabled ссылка.

### S274 — Run detail: просмотр конкретного шага выполнения
- **Экран/меню:** Workflow builder → Runs → Run detail → Step detail.
- **Роль/доступ:** READ к workflow и разрешение видеть данные конкретного step. Integration secrets всегда masked.
- **Предусловие:** Run существует; есть WorkflowRunStep records; graph version сохранён.
- **UI-элементы:** Canvas replay или vertical timeline; node statuses; step inspector; tabs Input/Output/Logs/Error; timestamps; duration; retry badge; links to created/updated records/tasks/emails; copy JSON; masked secrets.
- **Шаги:** 1) Открыть run. 2) Клик по step node. 3) Inspector показывает input/output. 4) Если step создал record/task/email — ссылка. 5) Если упал — error summary и retry options. 6) Копировать sanitized payload.
- **Данные (Prisma):** WorkflowRunStep `{id, runId, nodeId, nodeType, status, startedAt, finishedAt, inputJson, outputJson, errorJson, attempt}`; WorkflowNodeSnapshot (optional); IntegrationEventLog/WebhookDelivery/Email links.
- **API:** `GET /api/workflow-runs/:runId/steps/:stepRunId`; `GET /api/workflow-runs/:runId/graph`; `GET /api/workflow-runs/:runId/logs`. Ошибки: 403 STEP_PAYLOAD_ACCESS_DENIED, 404 STEP_RUN_NOT_FOUND.
- **Acceptance:** открыть step detail из run; input/output/status/timestamps; error step показывает message/code; secrets masked везде; links открываются при доступе; graph replay = version на момент run; long JSON раскрыть/скопировать sanitized.
- **Edge-cases:** большой output → truncate + download sanitized; record archived → archived badge; workflow read без record read → values masked; старые runs после schema change открываются по snapshot.

### S275 — Ошибки, retry и повторный запуск workflow
- **Экран/меню:** Workflow builder → Runs → Failed run → Retry step / Retry run / Rerun from start.
- **Роль/доступ:** READ_WRITE/FULL к workflow для retry/rerun; READ — просмотр. Retry integration/action steps требует тех же permissions, что исходный action.
- **Предусловие:** Есть failed/partially failed run; run сохранён с version snapshot; runtime поддерживает idempotency keys для side-effect actions.
- **UI-элементы:** Failed run detail; error banner; buttons Retry failed step, Retry from this step, Rerun from start, Cancel waiting run; confirmation modal; side-effect warning; retry attempt count; status timeline.
- **Шаги:** 1) Открыть failed run. 2) Просмотреть step error. 3) Retry failed step / Rerun from start. 4) Confirmation + side-effect warning. 5) Backend проверяет permissions/idempotency. 6) Runtime создаёт retry attempt или новый run linked to original. 7) Runs показывает retry status и связь.
- **Данные (Prisma):** WorkflowRun `retryOfRunId, rerunOfRunId, attempt, status`; WorkflowRunStep `attempt, retryOfStepRunId, idempotencyKey, status`; WorkflowActionIdempotency; AuditLog.
- **API:** `POST /api/workflow-runs/:runId/retry`; `POST /api/workflow-runs/:runId/steps/:stepRunId/retry`; `POST /api/workflow-runs/:runId/rerun`; `POST /api/workflow-runs/:runId/cancel`. Ошибки: 409 RUN_NOT_RETRYABLE, 409 SIDE_EFFECT_ALREADY_APPLIED, 403 WORKFLOW_RETRY_DENIED, 429 RETRY_LIMIT_REACHED.
- **Acceptance:** retry/rerun при наличии прав; retry использует ту же version (если не выбрана latest); UI предупреждает о side effects; идемпотентные steps не создают дубли; retry attempt в Runs; нельзя retry succeeded без rerun; ошибка retry = отдельный attempt.
- **Edge-cases:** input record удалён/archived → retry блокируется или только read-only blocks; HTTP/webhook уже успешно выполнился, следующий упал → retry from failed не повторяет успешный external call; send email retry требует confirm; permissions изменились → retry проверяет текущие.

### S276 — Enroll in sequence из workflow
- **Экран/меню:** Workflow builder → Add step → Sequences → Enroll in sequence.
- **Роль/доступ:** READ_WRITE/FULL к workflow; access к выбранной sequence и permission enroll recipients; sender/delegated sender допустим.
- **Предусловие:** Sequence published/running; есть recipient record variable (person/list entry person) с email; suppression/duplicate checks включены; sender configured.
- **UI-элементы:** Node Enroll in sequence; inspector: Sequence, Record, Sender; variable picker; preview recipient email; skipped policy; Next step; downstream Update list entry; warning если sequence draft/paused.
- **Шаги:** 1) Добавить Sequences → Enroll in sequence. 2) Выбрать sequence (Event Invite). 3) Record = variable (Created entry / Person / Triggered record). 4) Sender = Added by / fixed / delegated. 5) Publish. 6) При run проверка eligibility. 7) Создаётся SequenceEnrollment и first send job; output используется следующим block (Update list entry).
- **Данные (Prisma):** WorkflowNode `actionType=ENROLL_IN_SEQUENCE, configJson={sequenceId, recipientRecordExpression, senderExpression, duplicatePolicy}`; SequenceEnrollment `{sequenceId, recipientRecordId, recipientEmail, senderUserId, senderMailboxId, enrolledByWorkflowRunId, status=ACTIVE|SKIPPED|BLOCKED}`; SequenceSendJob; WorkflowRunStep `outputJson={enrollmentId, status, skippedReason}`; Activity `SEQUENCE_ENROLLED_BY_WORKFLOW`.
- **API:** `PATCH /api/workflow-nodes/:nodeId`; runtime `sequenceService.enrollFromWorkflow`; `GET /api/workflows/:workflowId/sequence-options`. Ошибки: 400 RECIPIENT_RECORD_REQUIRED, 400 RECIPIENT_EMAIL_REQUIRED, 409 SEQUENCE_NOT_PUBLISHED, 409 RECIPIENT_ALREADY_ACTIVE, 409 RECIPIENT_UNSUBSCRIBED, 403 SEQUENCE_ENROLL_DENIED.
- **Acceptance:** enroll в published sequence; dropdown только доступные sequences; recipient email обязателен; suppression/unsubscribe до enrollment; нет дубля active enrollment; sender сохраняется; output = status/id или skipped reason; сценарий «Record added to list → Enroll in sequence → Update list entry» end-to-end.
- **Edge-cases:** sequence paused → blocked/skipped; recipient уже active → SKIPPED или fail по policy; sender mailbox disconnected → blocked/fail; person без email → skipped; loop массово enroll → sequence delivery limits и outbox scheduling.

[ГОТОВ БАТЧ: S267–S276]



---

Основа: каталог фиксирует S285–S297 как блок Reports, а Academy 07–09 описывает 5 типов отчётов: Insight, Historical, Funnel, Time in stage, Stage change; report builder выбирает тип, data source, group/segment/filter и визуализацию. 


 


S285 — Создать отчёт: тип Insight (pivot по атрибутам)

Экран/меню · Reports → Revenue Dashboard / Dashboard → New report → Insight.

Роль/доступ · OWNER, ADMIN или MEMBER с READ_WRITE/FULL доступом к dashboard. Для просмотра данных нужен READ к object/list-источнику.

Предусловие · Есть dashboard или пользователь создаёт report из Reports; есть object/list с records; metadata Object, Attribute, Value, View доступна; пользователь имеет права читать выбранные данные.

UI-элементы · Панель What do you want to report on?; карточка Insight; placeholder Input needed to display chart; селектор Data source; Metric; Group by; Segment by; Filter; chart preview; кнопки Save report, Cancel, Add to dashboard.

Шаги ·

Пользователь открывает dashboard.

Нажимает New report.

Выбирает тип Insight.

Выбирает data source, например Deals.

Выбирает metric, например Count records или Sum Deal value.

Настраивает Group by = Deal stage.

Опционально настраивает Segment by = Deal owner.

Сохраняет report в dashboard.

Данные(Prisma) ·

Report: id, orgId, dashboardId, type=INSIGHT, name, sourceType, sourceObjectId, sourceListId, metricJson, groupByAttributeId, segmentByAttributeId, filtersJson, visualization.

ReportQuerySnapshot: кеш результата для ускорения.

DashboardWidget: размещение report на dashboard.

Object, Attribute, Record, Value: источник данных.

PermissionGrant: доступ к dashboard/report.

API ·

POST /api/reports

PATCH /api/reports/:reportId

POST /api/reports/:reportId/query-preview

POST /api/dashboards/:dashboardId/widgets

Ошибки: 400 REPORT_SOURCE_REQUIRED, 400 REPORT_METRIC_INVALID, 403 REPORT_CREATE_DENIED, 403 REPORT_SOURCE_ACCESS_DENIED.

Acceptance ·

Пользователь может выбрать Insight в report builder.

Report нельзя сохранить без data source.

Report строит текущий срез данных, а не исторические snapshots.

Group by по stage показывает распределение records по стадиям.

Segment by разбивает серии, например по owner.

Preview обновляется после смены metric/group/segment/filter.

Сохранённый report появляется как widget на dashboard.

Edge-cases ·

Источник пустой → chart показывает empty state, report можно сохранить.

Attribute удалён/archived после сохранения → report показывает validation warning.

Metric sum выбран для text attribute → backend возвращает METRIC_TYPE_INVALID.

Пользователь потерял доступ к source object → widget виден, но данные скрыты.

S286 — Тип Historical (анализ воронки во времени)

Экран/меню · Reports → New report → Historical values.

Роль/доступ · OWNER, ADMIN или пользователь с READ_WRITE к dashboard; READ к source object/list; для historical snapshots может требоваться доступ к history/audit data.

Предусловие · В системе сохраняется история изменений values/status или есть daily/weekly snapshots; выбран object/list с временными данными; report builder открыт.

UI-элементы · Карточка Historical values; селектор Data source; Metric; Snapshot cadence; Date range; Group by historical attribute; chart preview line/stacked area/bar; фильтры.

Шаги ·

Пользователь выбирает тип Historical values.

Выбирает source Deals.

Выбирает metric Count records или Sum Deal value.

Задаёт cadence, например weekly.

Выбирает historical grouping, например Deal stage.

Указывает date range.

Сохраняет report.

Данные(Prisma) ·

Report: type=HISTORICAL, metricJson, snapshotCadence, dateRangeJson, groupByAttributeId.

ReportSnapshot: reportId, snapshotAt, bucketKey, metricValue.

ValueHistory или Activity: raw history для построения snapshots.

Record, Value, Attribute: текущая и историческая модель.

DashboardWidget.

API ·

POST /api/reports

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/data

Worker/internal: analyticsQueue.buildHistoricalSnapshots

Ошибки: 400 HISTORICAL_SOURCE_UNSUPPORTED, 400 DATE_RANGE_INVALID, 400 SNAPSHOT_CADENCE_INVALID.

Acceptance ·

Historical report доступен как отдельный тип.

X-axis строится по snapshot date, а не по date-атрибуту записи.

Weekly snapshot показывает состояние на конец каждой недели.

Можно группировать исторические значения по status/stage.

Report показывает изменение состава pipeline во времени.

Если history недостаточно, UI честно показывает “not enough historical data”.

Сохранённый report добавляется в dashboard.

Edge-cases ·

Historical tracking включили сегодня → прошлые даты недоступны.

Attribute history очищена/архивирована → report показывает gap.

Snapshot job ещё строится → widget status Calculating.

Большой date range → backend ограничивает granularity или требует async query.

S287 — Тип Funnel (конверсии по стадиям)

Экран/меню · Reports → New report → Pipeline reports → Funnel.

Роль/доступ · Пользователь с READ_WRITE к dashboard и READ к source object/list; source должен иметь status/stage attribute.

Предусловие · Есть object/list с status attribute, например Deals → Deal stage; stages упорядочены; есть records с переходами или текущими стадиями.

UI-элементы · Карточка Funnel; селектор Pipeline source; селектор Stage attribute; stage order; metric Count records / Sum value; date range; conversion/loss labels; funnel chart preview.

Шаги ·

Пользователь выбирает Funnel.

Выбирает source Deals.

Выбирает status attribute Deal stage.

Подтверждает порядок стадий: Prospecting → Qualification → Meeting → Proposal → Won.

Выбирает metric Count records.

Сохраняет report на dashboard.

Данные(Prisma) ·

Report: type=FUNNEL, sourceObjectId, statusAttributeId, stageOrderJson, metricJson, dateRangeJson.

AttributeOption: стадии pipeline и порядок.

ValueHistory/Activity: переходы между стадиями.

ReportQuerySnapshot: рассчитанные conversion rates.

DashboardWidget.

API ·

POST /api/reports

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/data

Ошибки: 400 STATUS_ATTRIBUTE_REQUIRED, 400 STAGE_ORDER_INVALID, 400 FUNNEL_NEEDS_AT_LEAST_TWO_STAGES.

Acceptance ·

Funnel доступен только для status/stage attributes.

Funnel показывает стадии в правильном порядке.

Для каждой стадии видны count/value и conversion percentage.

Можно выбрать metric count records.

Можно ограничить report date range.

Empty stages отображаются как 0, а не ломают chart.

Drill-in по stage открывает записи этой стадии или перехода.

Edge-cases ·

Stage option удалена после сохранения → report сохраняет historical label и warning.

Нет records в первой стадии → conversion rates не делят на ноль.

Records пропускают стадии → funnel считает по выбранной policy: first entered или current stage.

У status attribute нет порядка → UI требует задать order.

S288 — Тип Time in stage (сколько в каждой стадии)

Экран/меню · Reports → New report → Pipeline reports → Time in stage.

Роль/доступ · READ_WRITE к dashboard/report; READ к source object/list и history stage changes.

Предусловие · Есть status/stage attribute; система сохраняет timestamps входа/выхода из стадий; есть stage transition history.

UI-элементы · Карточка Time in stage; source selector; stage attribute selector; metric Average / Median / Min / Max; date range; chart type bar/table; stage list; preview.

Шаги ·

Пользователь выбирает Time in stage.

Выбирает source Deals.

Выбирает Deal stage.

Выбирает aggregation Average.

Указывает date range.

Сохраняет report.

Данные(Prisma) ·

Report: type=TIME_IN_STAGE, statusAttributeId, aggregation, dateRangeJson.

StageTransition: recordId, attributeId, fromOptionId, toOptionId, enteredAt, leftAt, durationSeconds.

ValueHistory/Activity: источник transition data.

DashboardWidget.

API ·

POST /api/reports

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/data

Ошибки: 400 STAGE_HISTORY_REQUIRED, 400 TIME_IN_STAGE_AGGREGATION_INVALID.

Acceptance ·

Report показывает время, проведённое records в каждой стадии.

Поддерживаются average/min/max; median можно добавить позже, но UI должен явно показывать доступные aggregations.

Records, которые ещё находятся в стадии, считаются до текущего времени или исключаются по выбранной policy.

Chart показывает stage labels и duration.

Drill-in по стадии открывает records, участвующие в расчёте.

При отсутствии history показывается empty/not enough data.

Date range влияет на расчёт.

Edge-cases ·

Record вернулся в ту же stage несколько раз → durations суммируются или считаются отдельными visits по policy.

Stage transition без leftAt → active duration рассчитывается до now.

Timezone влияет только на bucket/date range, не на duration.

Смена stage order не ломает исторические durations.

S289 — Тип Stage change (переходы между стадиями)

Экран/меню · Reports → New report → Pipeline reports → Stage changed.

Роль/доступ · READ_WRITE к dashboard/report; READ к source и stage transition history.

Предусловие · Есть status/stage attribute; stage changes пишутся в history; есть target stages или все stages.

UI-элементы · Карточка Stage changed; source selector; status attribute selector; metric toggle Count records / Sum value; target stage selector; date range; cadence; chart preview bar/line/table.

Шаги ·

Пользователь выбирает Stage changed.

Выбирает source Deals.

Выбирает status attribute Deal stage.

Выбирает target stage, например Won.

Выбирает metric Count records или Sum Deal value.

Сохраняет report.

Данные(Prisma) ·

Report: type=STAGE_CHANGE, statusAttributeId, targetStageIds, metricJson, dateRangeJson, cadence.

StageTransition: transitions with from/to/changedAt.

Value: value metric, например ARR/deal value на момент перехода.

ReportQuerySnapshot.

API ·

POST /api/reports

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/data

Ошибки: 400 TARGET_STAGE_REQUIRED, 400 VALUE_METRIC_TYPE_INVALID, 400 STAGE_CHANGE_HISTORY_REQUIRED.

Acceptance ·

Stage change report показывает переходы records в выбранные stages.

Можно переключить metric count records ↔ value.

Value metric принимает только number/currency attributes.

Report группирует изменения по date range/cadence.

Drill-in по bucket/stage открывает records, которые совершили переход.

Historical transition data используется, а не только current value.

Empty result показывает корректный empty state.

Edge-cases ·

Record перешёл в Won дважды → count по unique record или transitions по policy.

Value изменился после перехода → report использует snapshot на момент перехода или current value; policy фиксируется в config.

Target stage удалена → label сохраняется historical, UI warning.

Нет date range → default last 90 days или all time.

S290 — Group by (атрибут строк)

Экран/меню · Report builder → Insight / Historical / compatible reports → Group by.

Роль/доступ · Пользователь с edit-доступом к report; READ к attribute source.

Предусловие · Report source выбран; у source есть attributes; выбранный report type поддерживает grouping.

UI-элементы · Dropdown Group by; searchable attribute list; type icons; system/custom badges; date cadence selector для date/datetime; option hide/show; reorder groups; preview chart.

Шаги ·

Пользователь открывает report builder.

Выбирает Group by.

Выбирает attribute, например Deal stage.

Для date attribute выбирает cadence: day/week/month/quarter.

Preview перестраивается по группам.

Пользователь сохраняет report.

Данные(Prisma) ·

Report: groupByAttributeId, groupByConfigJson.

Attribute: grouping attribute metadata.

AttributeOption: labels/colors for select/status.

ReportQuerySnapshot: grouped rows.

API ·

PATCH /api/reports/:reportId

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/groupable-attributes

Ошибки: 400 GROUP_BY_UNSUPPORTED_ATTRIBUTE, 400 DATE_CADENCE_REQUIRED.

Acceptance ·

Group by показывает доступные attributes source object/list.

Select/status groups отображаются по options и цветам.

Date/datetime group требует cadence.

Group by меняет X-axis/rows report.

Report сохраняет выбранный attribute по attributeId, не по label.

Archived attribute вызывает warning.

User без доступа к attribute не видит его в dropdown.

Edge-cases ·

Group by по multi-select: record может попадать в несколько groups или в комбинированный group по policy.

Empty value group отображается как No value.

Option label переименован → report обновляет label, сохраняя optionId.

Очень много distinct text values → UI показывает top-N + Other или блокирует grouping.

S291 — Segment by (атрибут колонок/серий)

Экран/меню · Report builder → Insight / compatible reports → Segment by.

Роль/доступ · Edit-доступ к report; read-доступ к source и выбранному segment attribute.

Предусловие · Report source и primary grouping выбраны; visualization поддерживает multiple series; есть segmentable attributes.

UI-элементы · Dropdown Segment by; attribute list; series legend; color mapping; hide/show series; stacked/grouped toggle для bar chart; preview.

Шаги ·

Пользователь выбирает или редактирует Insight report.

В Segment by выбирает attribute, например Deal owner.

Chart разбивается на серии по owner.

Пользователь скрывает ненужные series или переключает stacked/grouped.

Сохраняет report.

Данные(Prisma) ·

Report: segmentByAttributeId, segmentByConfigJson.

Attribute, AttributeOption, User: segment labels/colors.

ReportSeriesConfig: optional per-series visibility/color/order.

ReportQuerySnapshot.

API ·

PATCH /api/reports/:reportId

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/segmentable-attributes

Ошибки: 400 SEGMENT_BY_UNSUPPORTED, 400 SEGMENT_CARDINALITY_TOO_HIGH.

Acceptance ·

Segment by разбивает report на серии.

User/select attributes отображают readable labels.

Legend показывает все active series.

Пользователь может скрывать/показывать series.

High-cardinality text attributes не ломают UI.

Segment by сохраняется в report config.

Preview пересчитывается сразу после выбора.

Edge-cases ·

Segment attribute пустой → серия No value.

User удалён из workspace → label сохраняется как archived user.

Multi-select segment создаёт multiple membership или блокируется по policy.

Слишком много series → backend возвращает top-N + Other.

S292 — Filter отчёта (по любым атрибутам, вкл. AI-атрибуты)

Экран/меню · Report builder → Filters.

Роль/доступ · Edit-доступ к report; read-доступ к attributes, по которым строится filter.

Предусловие · Report source выбран; filterable attributes известны; AI-атрибуты уже сохранены как обычные values.

UI-элементы · Filter; Add filter; attribute picker; operator dropdown; value input; chips; AND/OR group позже; clear filter; preview count; support AI attribute badge.

Шаги ·

Пользователь открывает report builder.

Нажимает Filter.

Выбирает attribute, например ICP AI-classification.

Выбирает operator is / contains / greater than.

Вводит value.

Preview перестраивает report.

Пользователь сохраняет report.

Данные(Prisma) ·

Report: filtersJson или ReportFilter[].

ReportFilter: reportId, attributeId, operator, valueJson, order.

Attribute: including AI attribute config.

Value: typed values for filtering.

API ·

PUT /api/reports/:reportId/filters

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/filterable-attributes

Ошибки: 400 FILTER_OPERATOR_INVALID, 400 FILTER_VALUE_TYPE_INVALID, 403 FILTER_ATTRIBUTE_ACCESS_DENIED.

Acceptance ·

Можно добавить filter по любому filterable attribute.

Operators зависят от type attribute.

AI-атрибуты используются как обычные attributes в filters.

Preview обновляет chart и count.

Empty result показывает “No records match filters”.

Filter сохраняется вместе с report.

User без доступа к attribute не может использовать его в filter.

Edge-cases ·

AI attribute ещё не рассчитан у части records → они попадают в No value/excluded по operator.

Filter по archived attribute показывает warning.

Date filter учитывает timezone.

Некорректный filter после изменения attribute type блокирует query.

S293 — Источник: объект / список

Экран/меню · Report builder → Data source.

Роль/доступ · Пользователь с edit-доступом к report; READ к выбранному object или list. Для private list/dashboard применяются PermissionGrant.

Предусловие · Report builder открыт; есть objects и/или lists; user имеет хотя бы один readable source.

UI-элементы · Select a data source; tabs/sections Objects, Lists; search; object/list icons; record counts; source preview; warning при смене source; Change source.

Шаги ·

Пользователь открывает New report.

Выбирает report type.

Открывает Data source.

Выбирает object Deals или list Event Invitees.

Builder загружает attributes source.

Пользователь настраивает metrics/group/filter.

Данные(Prisma) ·

Report: sourceType=OBJECT|LIST, sourceObjectId, sourceListId.

Object, List: metadata source.

Attribute: object attributes.

ListAttribute: list-specific attributes.

Record, ListEntry, Value, ListEntryValue.

API ·

GET /api/reports/data-sources

PATCH /api/reports/:reportId/source

GET /api/reports/:reportId/source-schema

Ошибки: 403 SOURCE_ACCESS_DENIED, 404 SOURCE_NOT_FOUND, 409 SOURCE_CHANGE_RESETS_CONFIG.

Acceptance ·

Report может строиться по object.

Report может строиться по list.

При выборе list доступны parent object attributes и list-specific attributes.

User видит только sources с доступом.

Смена source сбрасывает несовместимые metrics/group/filter с confirmation.

Report сохраняет source по id.

Empty source остаётся валидным, если schema доступна.

Edge-cases ·

Source archived → widget показывает warning и не обновляет данные.

List parent object изменён невозможно; report должен считать list schema stable.

User потерял доступ к source после сохранения → report data hidden.

Source содержит records разных типов — для MVP запрещено, list должен иметь parent object.

S294 — Визуализация: bar / line / table / funnel

Экран/меню · Report builder → Visualization.

Роль/доступ · Edit-доступ к report/dashboard.

Предусловие · Report source и metric выбраны; report type поддерживает одну или несколько visualizations.

UI-элементы · Visualization picker: Bar, Line, Table, Funnel; возможно Pie, Map позже; chart preview; axis settings; stacked/grouped toggle; table columns; funnel stage labels.

Шаги ·

Пользователь настраивает report.

Открывает visualization picker.

Выбирает Bar, Line, Table или Funnel.

UI проверяет совместимость с report type.

Preview перестраивается.

Пользователь сохраняет report.

Данные(Prisma) ·

Report: visualization=BAR|LINE|TABLE|FUNNEL, visualizationConfigJson.

DashboardWidget: width, height, configJson.

ReportQuerySnapshot: data series independent from visual type.

API ·

PATCH /api/reports/:reportId

POST /api/reports/:reportId/query-preview

Ошибки: 400 VISUALIZATION_UNSUPPORTED_FOR_REPORT_TYPE, 400 VISUALIZATION_CONFIG_INVALID.

Acceptance ·

Insight поддерживает bar/line/table при совместимой group/date config.

Funnel report поддерживает funnel visualization.

Line chart требует date/cadence или time-series compatible X-axis.

Table visualization показывает rows/columns с sortable values.

Visualization setting сохраняется.

Dashboard widget рендерит выбранный chart после reload.

Unsupported комбинация блокируется с понятной подсказкой.

Edge-cases ·

Funnel visualization выбран для non-stage report → validation error.

Line chart с categorical group → блокировать или переключить на bar.

Table с большим result → pagination/limit.

Chart не помещается в widget → responsive resize.

S295 — Pipeline-отчёт по status-атрибуту (сумма ARR по стадиям)

Экран/меню · Reports → New report → Pipeline report / Insight → Data source Deals → Stage attribute → Metric Sum ARR.

Роль/доступ · Edit-доступ к dashboard/report; read-доступ к Deals, status attribute и currency/number attribute ARR/deal value.

Предусловие · Object Deals содержит status attribute Deal stage; есть currency/number attribute ARR или Deal value; records имеют значения.

UI-элементы · Source selector Deals; metric selector Sum; value attribute dropdown ARR / Deal value; Group by = Deal stage; chart preview bar/funnel; stage colors; total row; filter open pipeline.

Шаги ·

Пользователь создаёт report.

Выбирает source Deals.

Выбирает metric Sum Deal value или Sum ARR.

Выбирает Group by = Deal stage.

Исключает closed lost/won или оставляет все stages.

Выбирает bar/funnel visualization.

Сохраняет report.

Данные(Prisma) ·

Report: type=INSIGHT|FUNNEL|STAGE_CHANGE, metricJson={ aggregation: SUM, attributeId: dealValueAttrId }, groupByAttributeId=stageAttrId.

Attribute: type=STATUS, type=CURRENCY|NUMBER.

Value: currencyAmount, currencyCode, numberValue.

ReportQuerySnapshot: sum per stage.

API ·

POST /api/reports

POST /api/reports/:reportId/query-preview

GET /api/reports/:reportId/data

Ошибки: 400 STATUS_ATTRIBUTE_REQUIRED, 400 SUM_ATTRIBUTE_MUST_BE_NUMBER_OR_CURRENCY, 400 CURRENCY_MIX_UNSUPPORTED.

Acceptance ·

Report суммирует ARR/deal value по стадиям pipeline.

Stage colors/labels берутся из status options.

Итоговая сумма совпадает с суммой stage buckets.

Можно фильтровать только open pipeline.

Currency format отображается корректно.

Drill-in по stage открывает deals этой стадии.

Empty stages показывают 0.

Edge-cases ·

Разные currency codes → MVP блокирует или группирует по currency; не смешивать молча.

Deal без value → исключается из sum или считается 0 по policy.

Stage option archived → historical label сохраняется.

ARR хранится как text → metric sum недоступен.

S296 — Дашборд: разместить виджеты-отчёты

Экран/меню · Reports → Dashboard → New dashboard / Revenue Dashboard → New report / Add widget.

Роль/доступ · OWNER, ADMIN; MEMBER с READ_WRITE/FULL к dashboard. READ может смотреть dashboard, но не менять layout. Sharing/permissions управляются на уровне dashboard.

Предусловие · Есть один или несколько reports; dashboard создан; пользователь имеет право редактировать dashboard; frontend поддерживает grid layout.

UI-элементы · Список dashboards; New dashboard; dashboard header; breadcrumb Reports / Revenue Dashboard; Share; New report; widget grid; widget menu ⋮; resize handles; drag handles; empty widget state; favorite star; dashboard permissions/share modal.

Шаги ·

Пользователь открывает Reports.

Создаёт новый dashboard или открывает существующий.

Нажимает New report или Add widget.

Создаёт/выбирает report.

Widget появляется на dashboard grid.

Пользователь перетаскивает и меняет размер widget.

Нажимает Share и настраивает доступ.

Данные(Prisma) ·

Dashboard: id, orgId, name, createdById, visibility, createdAt, updatedAt.

DashboardWidget: dashboardId, reportId, x, y, w, h, order, configJson.

Report: source/query config.

PermissionGrant: entityType=DASHBOARD, workspace/team/user levels.

DashboardFavorite: user favorites.

API ·

GET /api/dashboards

POST /api/dashboards

GET /api/dashboards/:dashboardId

POST /api/dashboards/:dashboardId/widgets

PATCH /api/dashboard-widgets/:widgetId

PUT /api/dashboards/:dashboardId/layout

GET/PUT /api/dashboards/:dashboardId/permissions

Ошибки: 403 DASHBOARD_EDIT_DENIED, 404 REPORT_NOT_FOUND, 400 WIDGET_LAYOUT_INVALID.

Acceptance ·

Пользователь может создать dashboard.

Пользователь может добавить report widget на dashboard.

Widget можно перемещать и resize-ить.

Dashboard сохраняет layout после reload.

Share открывает управление доступом.

Dashboard permissions применяются ко всем reports внутри, но source-data permissions всё равно проверяются.

Список Reports показывает dashboards, favorites и созданные даты.

Edge-cases ·

Report удалён → widget показывает missing report state.

Пользователь имеет доступ к dashboard, но не к source object → widget скрывает данные.

Два пользователя редактируют layout одновременно → last-write wins или version conflict; MVP — version conflict.

Dashboard без widgets показывает empty state и CTA New report.

S297 — Drill-in из отчёта в записи

Экран/меню · Dashboard widget / Report preview → click chart segment/bar/funnel stage/table row → Drill-in drawer/table.

Роль/доступ · READ к dashboard/report и READ к underlying records. Без доступа drill-in показывает counts без record details или блокируется.

Предусловие · Report построен по object/list source; query result содержит bucket filters; chart segment связан с набором record IDs или воспроизводимым query.

UI-элементы · Clickable bar/line point/funnel stage/table cell; hover tooltip; drill-in drawer; title bucket, count, metric value; records table; columns from source view; Open record; Open in view; export/copy disabled по правам; breadcrumbs back to report.

Шаги ·

Пользователь открывает dashboard.

Кликает на segment, например Qualification stage или Owner = Marisa.

Система строит drill-in query из report filters + bucket condition.

Открывается drawer/table со списком records.

Пользователь открывает конкретную record page или переходит в source view с применёнными фильтрами.

Данные(Prisma) ·

Report: query config, filters/group/segment.

ReportQueryResult: bucket metadata или generated query.

Record, Value, ListEntry: underlying rows.

DrillInQueryLog: optional audit.

PermissionGrant: проверка доступа к records/source.

API ·

POST /api/reports/:reportId/drill-in

GET /api/reports/:reportId/drill-in?bucketKey=&cursor=&limit=

GET /api/records/:recordId

POST /api/views/from-report-drill-in optional

Ошибки: 403 DRILL_IN_ACCESS_DENIED, 400 DRILL_IN_BUCKET_INVALID, 404 REPORT_BUCKET_NOT_FOUND.

Acceptance ·

Chart segment кликабелен, если report поддерживает drill-in.

Drill-in показывает records, которые формируют выбранный bucket.

Count в drill-in совпадает с count bucket.

Пользователь может открыть record page из drill-in.

Permissions применяются к каждой record.

Drill-in учитывает все report filters/group/segment/date range.

Empty bucket показывает empty state.

Edge-cases ·

Bucket рассчитан по historical snapshot, а текущие records изменились → UI помечает current records may differ; historical drill-in требует snapshot record set.

Пользователь потерял доступ к части records → count может отличаться от visible rows, UI показывает masked count.

Report source archived → drill-in read-only или unavailable.

Large bucket → pagination/cursor.

[ГОТОВ БАТЧ: S285–S297]


---

S310 — Рекордер авто-джойнит Zoom / Google Meet / MS Teams

Модуль: Call Intelligence
Источник: Academy video 12 / Call Intelligence; каталог S310. 



Роль: SDR / AE / менеджер команды
Предусловия: подключён email/calendar sync; включены настройки Call Recorder; встреча создана в календаре с Zoom / Google Meet / Microsoft Teams.
UI/вход: Account Settings → Call recording; Calendar/Meeting details; Calls page; record page → Calls.
Данные/модель: Call, CallParticipant, CallRecordingSettings, CallTranscriptSegment, CallAssociatedRecord.
API/логика: система определяет upcoming meeting, проверяет policy авто-джойна, создаёт Call в статусе SCHEDULED, затем RECORDING, сохраняет provider, meeting URL, participants, owner, orgId.
Шаги:

Пользователь включает авто-джойн рекордера для нужных типов встреч.

В календаре появляется встреча с supported provider.

Перед началом встречи система создаёт call-запись и планирует join.

В момент старта рекордер подключается к meeting room.

После допуска из waiting room начинает запись и live-транскрипт.
Acceptance:

Рекордер автоматически подключается к Zoom / Google Meet / Microsoft Teams.

Для звонка появляется запись в Calls page.

Статус меняется SCHEDULED → JOINING → RECORDING.

Участники и meeting provider сохраняются.

Если provider не поддержан, создаётся понятная ошибка без падения.
Ошибки/edge cases: рекордер не допущен из waiting room; calendar sync выключен; встреча без URL; provider unknown; пользователь отключил авто-джойн для внешних встреч.
Демо-режим: имитировать авто-джойн через demo meeting fixture и статусный таймер без реального Zoom/Meet/Teams.

S311 — Account Settings → Call recording: авто-джойн и логотип рекордера

Модуль: Call Intelligence
Источник: Academy video 12 / Call recording settings. 



Роль: пользователь workspace / admin
Предусловия: пользователь авторизован; есть доступ к account settings.
UI/вход: Account Settings → Call recording.
Данные/модель: CallRecordingSettings { userId, orgId, autoJoinInternal, autoJoinExternal, autoJoinOwnedMeetings, manualRecorderEnabled, recorderLogoUrl }.
API/логика: GET /api/call-recording/settings, PATCH /api/call-recording/settings, POST /api/call-recording/logo.
Шаги:

Пользователь открывает Account Settings.

Переходит в Call recording.

Выбирает, какие звонки рекордер должен автоматически посещать.

Загружает кастомный логотип/изображение рекордера.

Сохраняет настройки.
Acceptance:

Настройки авто-джойна сохраняются и применяются к новым встречам.

Логотип загружается, отображается в preview и сохраняется в настройках.

Некорректный файл логотипа отклоняется с понятной ошибкой.

При выключении авто-джойна рекордер больше не создаёт scheduled calls автоматически.
Ошибки/edge cases: файл слишком большой; unsupported image MIME; пользователь без прав; конфликт personal/workspace defaults.
Демо-режим: логотип хранить локально/как mock URL; настройки работают без внешних календарных API.

S312 — Ручной добавляемый рекордер на встречу

Модуль: Call Intelligence
Источник: Academy video 12: recorder можно вручную добавить из meeting details. 



Роль: SDR / AE
Предусловия: существует calendar meeting; пользователь видит meeting details.
UI/вход: Meeting details → Start Recording / Add Call Recorder.
Данные/модель: Call, Meeting, CallJoinRequest, CallRecordingSettings.
API/логика: POST /api/meetings/:meetingId/call-recorder/start, POST /api/calls/:callId/stop.
Шаги:

Пользователь открывает meeting details.

Нажимает Start Recording / Add Call Recorder.

Система создаёт Call или использует существующий scheduled call.

Рекордер подключается к встрече.

Пользователь допускает рекордер из waiting room.

При необходимости пользователь удаляет рекордер, чтобы остановить запись.
Acceptance:

Ручной запуск работает независимо от auto-join setting.

Call появляется в Calls page и на связанных record pages.

Статус записи корректно меняется.

Stop/remove завершает запись и запускает post-processing.
Ошибки/edge cases: meeting уже записывается; встреча завершена; нет meeting URL; пользователь не host; provider требует дополнительной настройки.
Демо-режим: кнопка Start Recording создаёт demo-call и симулирует transcript streaming.

S313 — Insight-шаблон: секции-промпты и вывод text/bullets

Модуль: Call Intelligence
Источник: Academy video 12: insight templates состоят из секций с prompt и форматом text/bullets. 



Роль: SDR lead / AE / менеджер
Предусловия: включён Call Intelligence; пользователь имеет право создавать шаблоны.
UI/вход: Calls → Insight templates → New template; либо Call detail → Template dropdown → Manage templates.
Данные/модель: InsightTemplate, InsightTemplateSection { title, prompt, outputFormat, order }.
API/логика: POST /api/call-insight-templates, PATCH /api/call-insight-templates/:id, POST /api/calls/:callId/insights/run.
Шаги:

Пользователь создаёт новый insight-шаблон.

Добавляет секцию, например Current tool.

Вводит prompt: что извлечь, проанализировать или суммировать.

Выбирает формат ответа: text или bullet points.

Сохраняет шаблон.
Acceptance:

Шаблон сохраняется с набором секций.

Каждая секция имеет свой prompt и формат вывода.

При применении к звонку AI генерирует структурированный результат по секциям.

Порядок секций сохраняется.
Ошибки/edge cases: пустой prompt; дубликаты названий секций; unsupported output format; нет transcript для запуска.
Демо-режим: AI-результат генерировать детерминированно из demo transcript.

S314 — Неограниченные секции; персональные и командные шаблоны

Модуль: Call Intelligence
Источник: Academy video 12: можно создать сколько угодно секций; шаблоны бывают индивидуальные и командные. 



Роль: пользователь / team manager
Предусловия: есть доступ к Call Intelligence templates.
UI/вход: Insight template editor → Add section; Visibility: Personal / Team / Workspace.
Данные/модель: InsightTemplate { scope: PERSONAL | TEAM | WORKSPACE, ownerId, teamId }, InsightTemplateSection.
API/логика: права видимости фильтруют список доступных шаблонов; team templates доступны членам команды.
Шаги:

Пользователь создаёт template.

Добавляет несколько секций: current tool, needed features, budget, timeline, blockers.

Выбирает видимость: personal или team.

Сохраняет template.

Другой член команды видит team template, но не personal template автора.
Acceptance:

Количество секций не ограничено искусственным лимитом UI.

Personal template виден только владельцу.

Team template виден членам команды.

Workspace/admin может управлять командными шаблонами согласно правам.
Ошибки/edge cases: пользователь не состоит в team; удаление team; шаблон используется в существующих calls; попытка редактировать чужой personal template.
Демо-режим: использовать seeded personal/team templates.

S315 — Применить любой шаблон к любому звонку; переключение ракурсов

Модуль: Call Intelligence
Источник: Academy video 12: любой insight template можно применить к любому call recording и переключаться между templates. 



Роль: SDR / AE / manager
Предусловия: есть завершённый или записываемый звонок; есть минимум один insight template.
UI/вход: Call detail → Insights → Template dropdown.
Данные/модель: CallInsightRun { callId, templateId, status, sectionsResult, generatedAt }.
API/логика: POST /api/calls/:callId/insights/run; GET /api/calls/:callId/insights?templateId=.
Шаги:

Пользователь открывает call detail.

Выбирает insight template из dropdown.

Система запускает анализ transcript по секциям шаблона.

Результат сохраняется.

Пользователь переключает template и видит другой структурный ракурс того же звонка.
Acceptance:

Один звонок поддерживает несколько insight runs по разным templates.

Переключение шаблона не уничтожает предыдущий результат.

Повторный запуск обновляет результат и timestamp.

UI показывает loading/error/success.
Ошибки/edge cases: transcript ещё неполный; AI unavailable; template удалён; нет прав на template.
Демо-режим: переключение между шаблонами возвращает разные demo summaries для одного transcript.

S316 — Live-транскрипт в реальном времени

Модуль: Call Intelligence
Источник: Academy video 12: Calls tab показывает transcript, обновляющийся real-time во время записи. 



Роль: участник звонка / observer
Предусловия: call находится в статусе RECORDING; есть аудио поток или demo stream.
UI/вход: Calls page → active call; record page → Calls → active call.
Данные/модель: CallTranscriptSegment { callId, speakerName, text, startMs, endMs, isFinal }.
API/логика: websocket/SSE GET /api/calls/:callId/transcript/stream; fallback polling GET /api/calls/:callId/transcript.
Шаги:

Пользователь открывает активный call.

Система показывает live transcript panel.

Во время разговора появляются новые transcript segments.

Speaker labels и timestamps обновляются.

После завершения live segments фиксируются как final transcript.
Acceptance:

Transcript обновляется без ручного refresh.

Новые фразы появляются в правильном порядке.

Видны speaker, timestamp, text.

При reconnect UI догружает пропущенные segments.
Ошибки/edge cases: нет speaker diarization; временная потеря stream; segment исправлен после finalization; пользователь без доступа к call.
Демо-режим: отдавать transcript segments по таймеру из fixture.

S317 — После звонка: summary, meeting chapters, info, speaker stats

Модуль: Call Intelligence
Источник: Academy video 12: после завершения доступны finalized insights, call summary, meeting chapters, meeting info и speaker stats. 



Роль: SDR / AE / manager
Предусловия: call завершён; transcript финализирован.
UI/вход: Call detail → Summary / Chapters / Info / Speaker stats.
Данные/модель: CallSummary, CallChapter, CallInfo, CallSpeakerStats.
API/логика: worker запускает post-processing после Call.status=COMPLETED; сохраняет summary, chapters, stats.
Шаги:

Звонок завершается.

Система финализирует transcript.

Worker генерирует summary.

Worker выделяет chapters по таймкодам.

Система рассчитывает speaker stats.

UI показывает все блоки на call detail.
Acceptance:

После завершения call виден summary.

Chapters кликабельны и ведут к нужному месту записи.

Meeting info содержит дату, длительность, provider, участников.

Speaker stats показывают talk time / долю речи / количество реплик.
Ошибки/edge cases: transcript слишком короткий; один speaker; AI summary failed; запись без видео.
Демо-режим: summary/chapters/stats генерируются из заранее заданного transcript.

S318 — Привязка звонка к company/person record + activity timeline

Модуль: Call Intelligence
Источник: Academy video 12: call history доступна на company/person record page, meeting details, activity timeline; demo storyboard показывает Calls tab на record page. 


 



Роль: SDR / AE
Предусловия: есть CRM records: company/person/deal; call содержит participants или manual association.
UI/вход: Call detail → Associated records; Record page → Activity / Calls.
Данные/модель: CallAssociatedRecord { callId, recordId, associationType }, Activity { type: CALL_RECORDED }.
API/логика: auto-link по email participants → people → companies; manual link/unlink; activity создаётся на всех связанных records.
Шаги:

Call создаётся или импортируется.

Система сопоставляет участников с Person records.

Через relationship находит Company records.

Пользователь может вручную добавить Deal/Company/Person.

На record page появляется call card в Calls tab и событие в Activity timeline.
Acceptance:

Call отображается на связанных person/company records.

На activity timeline есть событие звонка.

Manual association сохраняется.

Удаление association убирает call из record tab, но не удаляет сам call.
Ошибки/edge cases: участник без person record; несколько people с одним email; company не найдена; call связан с несколькими deals.
Демо-режим: auto-link по seeded participants: Lisa Cosme → Cosme company.

S319 — Calls page: все звонки workspace, фильтры и favorites

Модуль: Call Intelligence
Источник: Academy video 12: Calls page показывает все звонки workspace, фильтры по participants/associated records и favorites; AE фильтрует свои звонки, manager — team calls. 



Роль: SDR / AE / manager
Предусловия: в workspace есть calls; пользователь имеет доступ к Calls page.
UI/вход: Sidebar → Calls.
Данные/модель: Call, CallParticipant, CallAssociatedRecord, CallFavorite.
API/логика: GET /api/calls?participantId=&recordId=&teamId=&favorite=&sort=, POST /api/calls/:id/favorite.
Шаги:

Пользователь открывает Calls page.

Видит список всех доступных звонков workspace.

Фильтрует по участнику.

Фильтрует по associated record/company/deal.

Добавляет важный звонок в favorites.

Менеджер использует view по звонкам команды.
Acceptance:

Calls page отображает calls с названием, датой, участниками, summary/status.

Фильтр по participant работает.

Фильтр по associated record работает.

Favorite сохраняется на пользователя.

Сортировка по дате/длительности работает.
Ошибки/edge cases: нет звонков; фильтр дал пустой результат; пользователь не имеет прав на call; удалённый participant.
Демо-режим: seeded calls + фильтры без внешних сервисов.

S320 — Playback: pinned mode

Модуль: Call Intelligence
Источник: Academy video 12: pinned mode показывает видео, transcript и insights при навигации внутри Attio. 



Роль: SDR / AE / manager
Предусловия: есть call recording с playback URL или demo video.
UI/вход: Call detail → Play → Pin.
Данные/модель: client UI state + CallPlaybackSession; backend отдаёт recording/transcript/insights.
API/логика: GET /api/calls/:callId/playback, GET /api/calls/:callId/transcript, GET /api/calls/:callId/insights.
Шаги:

Пользователь открывает call recording.

Нажимает pinned mode.

Плеер закрепляется в интерфейсе.

Пользователь переходит на company/deal/person page.

Видео, transcript и insights остаются доступными.
Acceptance:

Pinned player не исчезает при внутренней навигации.

Можно свернуть/развернуть/закрыть pinned mode.

Transcript синхронизирован с текущим playback time.

Insights доступны рядом с плеером.
Ошибки/edge cases: запись недоступна; пользователь открыл другой call; мобильный viewport; навигация за пределы dashboard layout.
Демо-режим: использовать demo video placeholder и transcript timeline.

S321 — Playback: picture-in-picture

Модуль: Call Intelligence
Источник: Academy video 12: picture-in-picture mode показывает видео поверх всех окон. 



Роль: SDR / AE / manager
Предусловия: browser поддерживает Picture-in-Picture API; есть playable recording.
UI/вход: Call detail → Playback controls → Picture-in-picture.
Данные/модель: client-side playback state; backend unchanged.
API/логика: UI вызывает browser PiP API; fallback показывает pinned mode.
Шаги:

Пользователь запускает playback.

Нажимает Picture-in-picture.

Видео открывается в системном PiP-окне.

Пользователь работает в других окнах, не теряя видео.

При закрытии PiP playback возвращается в call detail.
Acceptance:

PiP запускается, если browser поддерживает API.

При unsupported browser показывается fallback/подсказка.

Playback position сохраняется.

Закрытие PiP не ломает transcript/insights.
Ошибки/edge cases: browser запретил PiP; autoplay restriction; запись audio-only; mobile browser без поддержки.
Демо-режим: если PiP API недоступен, показывать mock state и fallback pinned mode.

S322 — Демо: загрузка транскрипта + AI-саммари по шаблону без реального рекордера

Модуль: Call Intelligence
Источник: требования ТЗ для демо: загрузка/вставка transcript → AI summary по template → привязка к записи; каталог S322. 



Роль: пользователь demo workspace / разработчик / sales demo operator
Предусловия: нет реального рекордера; есть текст transcript или файл .txt/.vtt/.srt; есть CRM record для привязки.
UI/вход: Calls page → Upload transcript / New demo call; Record page → Calls → Add transcript.
Данные/модель: Call { source: UPLOADED_TRANSCRIPT | DEMO }, CallTranscriptSegment, InsightTemplate, CallInsightRun, CallAssociatedRecord.
API/логика: POST /api/calls/upload-transcript, parser для txt/vtt/srt, demo AI summary service, association to records.
Шаги:

Пользователь нажимает Upload transcript.

Загружает файл или вставляет transcript вручную.

Выбирает linked company/person/deal.

Выбирает insight template.

Система парсит transcript и создаёт call.

Demo AI генерирует summary/sections/next steps.

Call появляется на Calls page и record page.
Acceptance:

Работает без Zoom/Meet/Teams и без внешнего AI-ключа.

Transcript сохраняется и отображается как call transcript.

Summary генерируется по выбранному шаблону.

Call можно привязать к company/person/deal.

Результат доступен в Calls page, record Calls tab и Activity timeline.
Ошибки/edge cases: пустой transcript; неподдерживаемый формат; слишком большой файл; выбран record из другой org; template без секций.
Демо-режим: основной путь MVP: deterministic summary + seeded templates + local transcript upload.

[ГОТОВ БАТЧ: S310–S322]


---

S330 — Импорт CSV в объект

Модуль: Import / миграция данных
Источник: каталог сценариев S330–S338; архитектура выделяет отдельные imports.ts, importService.ts, importQueue, endpoints POST /api/imports, GET /api/imports/:id, POST /api/imports/:id/confirm. 


 



Роль: Admin / Owner / пользователь с READ_WRITE или FULL на объект.
Предусловия: объект существует; у пользователя есть право создавать записи в этом объекте; CSV-файл валиден по размеру и кодировке; объект имеет набор атрибутов.
UI/вход: Object page → Import / Export → Import CSV; Settings → Data → Import; пустой объект → Import records.
Данные/модель: ImportJob, ImportFile, ImportMapping, ImportRowPreview, ImportRowResult, ImportError, Object, Attribute, Record, Value, Activity.
API/логика:

POST /api/imports — создать import job, загрузить CSV, распарсить заголовки и первые строки.

GET /api/imports/:importId — получить статус, preview, mapping, ошибки.

PATCH /api/imports/:importId/mapping — сохранить выбор колонок.

POST /api/imports/:importId/confirm — подтвердить mapping и поставить job в worker.

Worker читает CSV построчно, валидирует значения, создаёт Record и Value, пишет Activity и статистику.
Шаги:

Пользователь открывает объект, например Companies.

Нажимает Import / Export → Import CSV.

Загружает CSV-файл.

Система создаёт import job в статусе UPLOADED.

Система парсит заголовки, разделитель, кодировку, первые N строк.

Пользователь переходит к mapping-экрану.

После подтверждения импорт запускается в worker.

По завершении пользователь видит количество созданных, обновлённых, пропущенных и ошибочных строк.
Acceptance:

CSV импортируется в выбранный объект, а не в legacy Lead-модель.

Каждая строка CSV создаёт или обновляет запись объекта через гибкую модель Record + Value.

Импорт запускается асинхронно, не блокирует UI.

Статусы минимум: UPLOADED, MAPPING_REQUIRED, READY, RUNNING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED, CANCELED.

UI показывает progress: обработано строк / всего строк.

Ошибки по строкам доступны после завершения.

Org scope соблюдён: нельзя импортировать в объект другой организации.
Ошибки/edge cases: пустой файл; нет заголовков; CSV слишком большой; неверная кодировка; дублирующиеся имена колонок; слишком много строк; пользователь потерял права между upload и confirm; worker упал в середине job.
Демо-режим: поддержать локальный CSV без внешних интеграций; seed-файл companies_demo.csv импортируется в Companies и показывает весь wizard.

S331 — Маппинг колонок CSV → атрибуты объекта

Модуль: Import / миграция данных
Источник: каталог фиксирует S331 как маппинг колонок CSV в атрибуты объекта; MASTER_TZ задаёт гибкие Object, Attribute, Record, Value как основу данных. 


 



Роль: Admin / Owner / пользователь с правом импорта в объект.
Предусловия: import job создан; CSV распарсен; объект и его атрибуты загружены.
UI/вход: Import wizard → Mapping step.
Данные/модель: ImportMapping { csvColumn, targetAttributeId, targetType, transform, defaultValue, requiredStrategy }, Attribute, AttributeOption.
API/логика: backend предлагает auto-map по нормализованному имени колонки, alias-словарю и типу данных; пользователь может изменить target attribute, пропустить колонку или создать новый attribute.
Шаги:

Система показывает список CSV-колонок.

Для каждой колонки показывает sample values из первых строк.

Система предлагает target attribute: Company name → Name, Domain → Domains, Email → Email.

Пользователь выбирает существующий attribute или Create new attribute.

Для select/multi-select пользователь выбирает стратегию: создать отсутствующие опции или отклонять неизвестные значения.

Для currency пользователь выбирает currency code или колонку с валютой.

Для date/datetime выбирает формат даты, если auto-detect не уверен.

Пользователь сохраняет mapping.
Acceptance:

Каждая CSV-колонка может быть mapped / skipped / used for relationship lookup.

Auto-map не должен молча выбирать сомнительное поле с низкой уверенностью.

UI показывает тип целевого атрибута и sample values.

Несовместимые типы подсвечиваются до запуска.

Новый attribute можно создать прямо из mapping-step.

Mapping сохраняется и восстанавливается при перезагрузке страницы.
Ошибки/edge cases: две CSV-колонки mapped в один single-value attribute; тип NUMBER получает текст; date format ambiguous; select option отсутствует; пользователь удалил attribute во время импорта.
Демо-режим: sample CSV автоматически маппится минимум на Name, Domain, Employee range, LinkedIn, Country.

S332 — Дедуп по unique-атрибуту

Модуль: Import / миграция данных
Источник: S332: дедуп по уник-атрибуту, пример companies = domain; атрибуты поддерживают isUnique, а архитектура legacy migration задаёт dedupe по domain / normalized company name. 


 



Роль: Admin / Owner / импортирующий пользователь.
Предусловия: у объекта есть хотя бы один unique attribute; в mapping выбран dedupe key.
UI/вход: Import wizard → Deduplication step.
Данные/модель: Attribute.isUnique, ImportDedupRule, Record, Value, ImportRowResult.
API/логика: для каждой строки нормализуется значение unique-атрибута; backend ищет существующий Record в org/object по typed Value; затем применяет стратегию CREATE_ONLY, UPDATE_EXISTING, SKIP_EXISTING, CREATE_DUPLICATE_IF_ALLOWED.
Шаги:

Пользователь выбирает dedupe key: например Domain.

Система показывает, сколько строк имеют пустой dedupe key.

Система делает preview: new records / matched records / duplicate rows in CSV.

Пользователь выбирает стратегию при совпадении.

Worker при импорте сначала ищет record по unique value.

При совпадении обновляет существующую запись или пропускает строку согласно стратегии.
Acceptance:

Unique match ищется только внутри текущей org и текущего object.

Domain нормализуется: lower-case, без protocol, без trailing slash, без www. при выбранной настройке.

Email нормализуется lower-case + trim.

Дубли внутри самого CSV показываются до confirm.

При UPDATE_EXISTING values обновляются, а activity пишет IMPORT_UPDATED_RECORD.

При SKIP_EXISTING строка помечается skipped с причиной.
Ошибки/edge cases: пустой unique value; несколько существующих записей нарушают unique-инвариант; CSV содержит конфликтующие значения для одного unique key; пользователь выбрал не-unique attribute как dedupe key.
Демо-режим: Companies импортируются с dedupe по Domains; повторный запуск demo CSV не создаёт дубли.

S333 — Relationship по unique-id при импорте

Модуль: Import / relationship import
Источник: S333: relationship по unique-id при импорте; MASTER_TZ и архитектура описывают RelationshipDefinition, RelationshipValue и relationship-связи между records. 


 



Роль: Admin / Owner / пользователь с правом READ_WRITE на source object и READ на target object.
Предусловия: у source object есть relationship attribute; у target object есть unique attribute для lookup; CSV содержит колонку с внешним ключом.
UI/вход: Import wizard → Mapping step → Relationship column mapping.
Данные/модель: RelationshipDefinition, RelationshipValue, Attribute(type=RELATIONSHIP), ImportRelationshipMapping.
API/логика: mapping указывает: CSV column → relationship attribute → target object → target lookup attribute. Worker ищет target record по unique value и создаёт RelationshipValue.
Шаги:

Пользователь маппит колонку Company domain в relationship Person → Company.

Выбирает target lookup: Companies.Domain.

Система показывает preview: сколько строк найдут existing company, сколько не найдут.

Пользователь выбирает стратегию для missing target: error / skip relationship / create target record.

Worker создаёт source record.

Worker ищет target record.

Worker создаёт relationship value и обратную связь, если relationship bidirectional.
Acceptance:

Relationship создаётся после создания или обновления source record.

Lookup target record выполняется по unique attribute.

Ошибка missing target сохраняется на конкретной строке, не валит весь job.

Для cardinality one-to-one/one-to-many backend проверяет конфликт cardinality.

Reverse relationship видна на target record page.

Повторный импорт не создаёт дубликаты relationship values.
Ошибки/edge cases: target not found; target duplicate; relationship cardinality conflict; CSV содержит несколько target IDs для single relationship; нет прав читать target object; target из другой org.
Демо-режим: People CSV связывает людей с Companies по company domain.

S334 — Required-валидация при импорте

Модуль: Import / validation
Источник: S334: required-валидация при импорте; каталог также фиксирует required attribute как отдельное поведение, а архитектура требует value validation by AttributeType. 


 


 



Роль: Admin / Owner / импортирующий пользователь.
Предусловия: объект содержит required attributes; mapping сохранён.
UI/вход: Import wizard → Validation step.
Данные/модель: Attribute.isRequired, ImportValidationResult, ImportRowError, Value.
API/логика: до confirm система валидирует preview; при worker-run валидирует каждую строку полностью. Required считается выполненным, если значение присутствует в CSV, default value задан, либо при update existing record уже есть непустое значение.
Шаги:

Система определяет required attributes объекта.

Проверяет, замаплены ли required columns.

Показывает missing required mappings.

Пользователь добавляет mapping или задаёт default value.

Worker проверяет каждую строку.

Строки с нарушениями помечаются error и не создают record.
Acceptance:

Нельзя подтвердить импорт, если required attribute не mapped и не имеет default.

Пустое значение в конкретной строке создаёт row-level validation error.

Для update existing record допускается не передавать required value, если оно уже есть в record.

Ошибки показывают row number, column, attribute, reason.

Импорт может завершиться COMPLETED_WITH_ERRORS, если часть строк прошла.
Ошибки/edge cases: строка состоит из пробелов; 0 для number не должен считаться пустым; false для boolean не должен считаться пустым; required relationship target missing; required select option unknown.
Демо-режим: demo CSV с пустым Name показывает ошибку строки и не создаёт record.

S335 — Импорт CSV в список

Модуль: Import / Lists
Источник: S335: импорт CSV в список с parent + list-атрибутами; MASTER_TZ определяет Lists как подмножество records с list-level attributes и entries. 


 



Роль: Admin / Owner / пользователь с READ_WRITE на список и parent object.
Предусловия: список существует или создаётся в wizard; указан parent object; list attributes заданы.
UI/вход: List page → Import CSV; Object page → Import → Add to list; Sequence enroll → Import recipients CSV.
Данные/модель: List, ListEntry, ListAttribute, ListEntryValue, Record, Value, ImportJob.
API/логика: импорт делится на две группы mapping: object attributes для parent record и list attributes для list entry. Worker создаёт/обновляет parent record, затем создаёт/обновляет ListEntry и list-specific values.
Шаги:

Пользователь открывает список, например Event Invitees.

Нажимает Import CSV.

Загружает файл с колонками person/company и list-specific полями, например RSVP, Dietary requirements.

На mapping-step выбирает, какие колонки идут в parent object, а какие — в list attributes.

Настраивает dedupe parent record.

Подтверждает импорт.

Worker создаёт records и добавляет их в list.
Acceptance:

CSV может создать parent records и одновременно добавить их в list.

List-specific columns не создаются как object attributes.

ListEntry создаётся для каждой успешно импортированной parent record.

List stage может быть задан из CSV или default stage.

На list page после импорта видны parent fields и list fields.
Ошибки/edge cases: parent record найден, но уже есть в list; list attribute required missing; stage option missing; пользователь имеет право на list, но не на parent object; CSV содержит parent fields нескольких object types.
Демо-режим: Event Invitees import создаёт People и заполняет RSVP / Dietary requirements как list attributes.

S336 — Коллизия entry: update existing / add separate

Модуль: Import / Lists
Источник: S336: коллизия list entry при импорте — update existing / add separate. 



Роль: Admin / Owner / владелец списка.
Предусловия: список уже содержит entries; CSV содержит записи, совпадающие с existing parent records или existing list entries.
UI/вход: List import wizard → Collision handling step.
Данные/модель: ListEntry, ListEntryValue, ImportCollisionPolicy, ImportRowResult.
API/логика: backend проверяет уникальность (listId, recordId) для обычных списков. Если список допускает повторные entries, используется отдельный режим allowDuplicateEntries.
Шаги:

Система preview-сканом находит строки, где parent record уже состоит в list.

Пользователь выбирает стратегию:

update existing entry;

skip existing entry;

add separate entry, если list type допускает повторы;

fail on collision.

Worker применяет стратегию для каждой строки.

UI показывает результат: updated entries / skipped entries / duplicate entries / errors.
Acceptance:

При update existing обновляются только list-entry fields и stage/position, если mapped.

Parent record values обновляются отдельно по object-level dedupe strategy.

При skip existing строка не меняет list entry.

При add separate создаётся новая entry только если список допускает повторные entries.

Все коллизии отражены в import result.
Ошибки/edge cases: уникальный индекс не допускает duplicate entry; CSV содержит две строки для одного record/list; race condition между двумя import jobs; entry был удалён после preview.
Демо-режим: повторный импорт Event Invitees предлагает update existing RSVP вместо создания дубля.

S337 — Import history: журнал импортов и откат

Модуль: Import / аудит / миграция
Источник: S337: Import history с журналом и откатом; Settings-навигация включает Data → Import History. 


 



Роль: Owner / Admin / пользователь с правом просматривать историю импорта.
Предусловия: в workspace был хотя бы один import job.
UI/вход: Settings → Data → Import History; Object page → Import / Export → Import history.
Данные/модель: ImportJob, ImportRun, ImportCreatedRecord, ImportUpdatedValue, ImportCreatedRelationship, ImportCreatedListEntry, ImportRollback.
API/логика: каждый import сохраняет created/updated entity IDs и previous values для rollback. POST /api/imports/:id/rollback создаёт rollback job и выполняет обратные операции.
Шаги:

Пользователь открывает Import History.

Видит таблицу импортов: файл, объект/список, статус, автор, дата, created/updated/errors.

Открывает detail конкретного import.

Скачивает error report или original file, если разрешено.

Нажимает Rollback.

Система показывает preview rollback.

Пользователь подтверждает откат.

Worker удаляет созданные записи/entries/relationships и возвращает изменённые values.
Acceptance:

История импортов фильтруется по объекту, списку, автору, статусу и дате.

Detail показывает mapping, статистику, ошибки по строкам.

Rollback доступен только пользователям с достаточными правами.

Rollback не удаляет запись, если она была изменена вручную после импорта, без явного подтверждения.

Все rollback-действия пишутся в audit/activity.
Ошибки/edge cases: часть записей уже удалена; значения изменены после импорта; original file истёк по retention; rollback уже запускался; rollback частично завершился с ошибками.
Демо-режим: demo import можно откатить; после rollback счётчики Companies/People/List entries возвращаются к исходным.

S338 — Предпросмотр перед импортом

Модуль: Import / UX validation
Источник: S338: предпросмотр первых строк и типов; import в списки и объекты строится поверх mapping и validation wizard. 


 



Роль: пользователь, запускающий импорт.
Предусловия: CSV загружен и распарсен; mapping частично или полностью определён.
UI/вход: Import wizard → Preview step.
Данные/модель: ImportRowPreview, DetectedColumnType, ImportValidationSummary, ImportSampleValue.
API/логика: backend возвращает первые N строк, detected data types, mapping confidence, validation summary и estimated changes.
Шаги:

После загрузки CSV система показывает первые 10–50 строк.

Для каждой колонки показывает detected type: text, number, date, email, URL, currency, select candidate.

Для mapped columns показывает target attribute и conversion preview.

Для каждой preview row показывает статус: valid / warning / error.

Система показывает агрегированную оценку: created, updated, skipped, errors.

Пользователь исправляет mapping или подтверждает import.
Acceptance:

Preview доступен до запуска worker.

Значения показываются в том виде, в котором будут записаны в Value typed columns.

Ошибки required/type/relationship видны до confirm для preview rows.

Warning не блокирует import, error блокирует конкретную строку или confirm — по типу ошибки.

Preview обновляется после изменения mapping.
Ошибки/edge cases: файл слишком большой для полного preview; CSV streaming parser нашёл ошибку после первых строк; auto-detected type меняется между preview и full run; delimiter определён неверно.
Демо-режим: preview для demo CSV показывает auto-map confidence и typed conversion.

S345 — Роли Owner / Admin / Member

Модуль: Permissions / RBAC
Источник: S345 фиксирует Admin / Member, а архитектура требует roleMiddleware для OWNER/ADMIN/MEMBER; Settings включает Members & permissions. 


 


 



Роль: Owner / Admin.
Предусловия: workspace создан; есть минимум один Owner; пользователь открывает Settings → Members & permissions.
UI/вход: Settings → Workspace → Members; member row → Role dropdown.
Данные/модель: User, Organization, Membership, Role { OWNER, ADMIN, MEMBER }, AuditLog.
API/логика:

Owner — полный контроль workspace, billing, security, members, ownership transfer, deletion.

Admin — управление settings, objects, members, permissions, workflows/sequences/dashboards по workspace policy, но без удаления последнего owner.

Member — рабочий пользователь без доступа к workspace settings по умолчанию; видит и редактирует только сущности, где есть grants.
Шаги:

Owner открывает Members.

Видит список участников и их роли.

Меняет роль пользователя с Member на Admin.

Система проверяет, что не удаляется последний Owner.

Роль сохраняется.

Новый Admin получает доступ к settings согласно роли.
Acceptance:

В workspace всегда есть минимум один Owner.

Member не видит workspace settings, если нет отдельного grant.

Admin может управлять большинством workspace settings.

Owner может назначать/снимать Admin и передавать ownership.

Все изменения ролей пишутся в audit log.
Ошибки/edge cases: попытка понизить последнего Owner; Member пытается назначить роль; приглашённый пользователь ещё не принял invite; пользователь удалён из org.
Демо-режим: seeded users: Olivia Owner, Marisa Admin, Cassandra Member.

S346 — 4 уровня доступа: NO_ACCESS / READ / READ_WRITE / FULL

Модуль: Permissions / RBAC
Источник: каталог S346 задаёт четыре уровня доступа: No access / Read only / Read and write / Full access. 



Роль: Owner / Admin / entity owner.
Предусловия: существует сущность, на которую можно настроить доступ: Object/List/Dashboard/Workflow/Sequence.
UI/вход: Entity settings → Permissions → access level dropdown.
Данные/модель: PermissionGrant { entityType, entityId, scope, subjectId, level }, AccessLevel { NO_ACCESS, READ, READ_WRITE, FULL }.
API/логика: access resolver возвращает effective level для текущего user + entity. Проверки применяются в API и UI.
Шаги:

Admin открывает настройки объекта Deals.

Открывает Permissions.

Для workspace выбирает уровень, например READ.

Для Sales team выбирает READ_WRITE.

Для отдельного пользователя выбирает FULL.

Система сохраняет grants и пересчитывает effective permissions.
Acceptance:

NO_ACCESS: сущность скрыта из навигации и API возвращает 404 или 403 без утечки данных.

READ: можно просматривать, нельзя изменять записи/настройки.

READ_WRITE: можно читать и менять данные, но нельзя менять структуру/permissions.

FULL: можно менять структуру, настройки и grants этой сущности.

UI блокирует действия согласно effective level.

Backend enforce обязателен, UI-enforce недостаточен.
Ошибки/edge cases: конфликт grants; неизвестный level; пользователь пытается вызвать API напрямую; entity archived; inherited access stale cache.
Демо-режим: переключатель access levels сразу меняет видимость кнопок + New, View settings, Permissions.

S347 — 3 области: Workspace / Team / Individual

Модуль: Permissions / RBAC
Источник: S347: Workspace дефолт, Team и Individual overrides; более точный уровень перекрывает более широкий. 



Роль: Owner / Admin / entity owner.
Предусловия: есть workspace members; может быть создана хотя бы одна team.
UI/вход: Entity settings → Permissions → секции Workspace access / Teams / Individual members.
Данные/модель: PermissionScope { WORKSPACE, TEAM, INDIVIDUAL }, Team, TeamMember, PermissionGrant.
API/логика: resolver применяет приоритет: INDIVIDUAL > TEAM > WORKSPACE. Если пользователь в нескольких team, выбирается максимальный уровень либо явно заданное правило precedence; для MVP — максимальный уровень.
Шаги:

Admin ставит Workspace access = READ.

Добавляет Team Sales = READ_WRITE.

Добавляет Individual contractor = READ_WRITE.

Пользователь из Sales получает READ_WRITE.

Пользователь не из Sales получает READ.

Contractor получает individual override независимо от team.
Acceptance:

Workspace grant применяется ко всем members.

Team grant применяется только членам team.

Individual grant перекрывает workspace и team.

Effective level отображается в UI рядом с пользователем.

Изменение team membership пересчитывает доступ.
Ошибки/edge cases: пользователь состоит в двух team с разными уровнями; team удалена; grant указывает на несуществующий subject; individual override ниже team level — поведение должно быть явно определено и протестировано.
Демо-режим: Sales-EU/US/UK teams показывают разные effective levels на Deals.

S348 — Права на Objects / Lists / Dashboards / Workflows / Sequences

Модуль: Permissions / RBAC
Источник: S348 требует права на Objects, Lists, Dashboards, Workflows, Sequences; MASTER_TZ Settings включает members & permissions, а Workflows/Sequences/Dashboards заданы как отдельные сущности продукта. 


 



Роль: Owner / Admin / entity owner.
Предусловия: в workspace существуют сущности разных типов.
UI/вход: Settings → Objects/Lists/Dashboards/Sequences/Workflows → конкретная сущность → Permissions.
Данные/модель: PermissionGrant.entityType { OBJECT, LIST, DASHBOARD, WORKFLOW, SEQUENCE }.
API/логика: единый permission resolver принимает entityType + entityId + userId, используется middleware в routes объектов, списков, dashboard/report, workflow, sequence.
Шаги:

Admin открывает Permissions объекта Deals.

Настраивает доступ к object data и metadata.

Открывает Permissions списка Recruiting.

Скрывает список от workspace, выдаёт FULL Head of Talent.

Открывает Dashboard permissions и даёт RevOps READ_WRITE.

Открывает Workflow/Sequence permissions и ограничивает редактирование.
Acceptance:

Все пять entity types поддерживают одинаковую модель grants.

Object permissions защищают records, views, attributes и object settings.

List permissions защищают entries и list attributes.

Dashboard permissions применяются ко всем widgets/reports внутри dashboard.

Workflow permissions защищают editor/settings/runs visibility.

Sequence permissions защищают editor/recipients/settings/enroll actions.
Ошибки/edge cases: report внутри dashboard имеет собственный owner; workflow действует на object, к которому у него нет automation grant; sequence видна, но mailbox owner не доступен; archived entity.
Демо-режим: Recruiting list скрывается у обычного Member; Dashboard остаётся read-only.

S349 — Workspace access: дефолт для всех членов

Модуль: Permissions / RBAC
Источник: S349: Workspace access — дефолт для всех членов. 



Роль: Owner / Admin / entity owner.
Предусловия: открыты permissions конкретной сущности.
UI/вход: Entity settings → Permissions → Workspace access dropdown.
Данные/модель: PermissionGrant { scope: WORKSPACE, subjectId: null, level }.
API/логика: если нет team/individual override, effective access берётся из workspace grant; если workspace grant отсутствует, используется product default: обычно READ для стандартных объектов, NO_ACCESS для новых dashboards/private lists.
Шаги:

Admin открывает список Customer Success.

В секции Workspace access выбирает READ.

Все workspace members получают read-only доступ.

Пользователь без team/individual grants открывает список и видит данные.

Кнопки редактирования заблокированы.
Acceptance:

Workspace grant применяется ко всем active members org.

Изменение workspace level сразу влияет на навигацию и API.

Новый участник получает workspace-level доступ автоматически.

Default value явно отображается в UI, не скрывается.
Ошибки/edge cases: нет workspace grant; user invited but not accepted; guest/expert исключён из общего workspace access; кеш навигации устарел.
Демо-режим: изменение Workspace access для Deals с READ на NO_ACCESS скрывает Deals у Member.

S350 — Team override: уровень для команды

Модуль: Permissions / RBAC
Источник: S350: Team override, пример Sales-EU/US/UK. 



Роль: Owner / Admin / entity owner.
Предусловия: созданы teams; users добавлены в teams.
UI/вход: Entity settings → Permissions → Teams → Add team.
Данные/модель: Team, TeamMember, PermissionGrant { scope: TEAM, subjectId: teamId }.
API/логика: team grants применяются ко всем текущим и будущим членам team; при удалении пользователя из team доступ пересчитывается.
Шаги:

Admin открывает Object settings → Deals → Permissions.

В секции Teams нажимает Add.

Выбирает Sales-EU.

Устанавливает READ_WRITE.

Добавляет Sales-US с READ.

Сохраняет.

Члены Sales-EU могут редактировать deals; Sales-US только читать.
Acceptance:

Team override виден отдельной строкой с названием team и количеством участников.

Уровень team можно изменить или удалить.

Новые члены team автоматически наследуют grant.

Team grant перекрывает workspace grant.

Effective access показывается в member detail.
Ошибки/edge cases: team пустая; team удалена; пользователь состоит в Sales-EU и Sales-US; попытка выдать FULL team без права manage permissions.
Демо-режим: Sales-EU получает READ_WRITE на Deals при workspace READ.

S351 — Individual override: уровень для конкретного члена

Модуль: Permissions / RBAC
Источник: S351: individual override для конкретного члена. 



Роль: Owner / Admin / entity owner.
Предусловия: пользователь состоит в workspace.
UI/вход: Entity settings → Permissions → Individual members → Add member.
Данные/модель: PermissionGrant { scope: INDIVIDUAL, subjectId: userId }.
API/логика: individual grant имеет highest precedence и применяется независимо от workspace/team grants.
Шаги:

Admin открывает Permissions объекта Deals.

В Individual members нажимает Add.

Выбирает конкретного пользователя, например contractor.

Устанавливает READ_WRITE.

Система сохраняет grant.

Contractor получает доступ, даже если не состоит в Sales team.
Acceptance:

Individual override перекрывает workspace и team.

Можно выдать уровень выше или ниже inherited level.

UI показывает inherited level и override level.

Удаление individual override возвращает пользователя к team/workspace access.

Все изменения пишутся в audit log.
Ошибки/edge cases: пользователь удалён из workspace; invite pending; попытка добавить одного пользователя дважды; override конфликтует с global role restrictions.
Демо-режим: Member без team получает edit-доступ к одному списку через individual grant.

S352 — Automations-грант: доступ воркфлоу к сущности

Модуль: Permissions / RBAC / Workflows
Источник: S352: Automations grant — доступ workflow к сущности; Workflows — отдельный модуль с actions над records/lists. 


 



Роль: Owner / Admin / workflow creator с правом grant.
Предусловия: workflow создан; workflow action требует доступа к object/list.
UI/вход: Entity settings → Permissions → Automations; Workflow editor → publish prompt.
Данные/модель: AutomationPermissionGrant { workflowId, entityType, entityId, level } или общий PermissionGrant с subjectType=WORKFLOW.
API/логика: workflow runtime проверяет automation grant отдельно от прав пользователя, который создал workflow. Для update/create/delete нужен минимум READ_WRITE; для read/find нужен READ.
Шаги:

Пользователь настраивает workflow: when Deal stage changes → update Deal field / create Task.

При publish система проверяет, есть ли у workflow grant на Deals.

Если grant отсутствует, UI показывает prompt.

Admin выдаёт workflow READ_WRITE на Deals.

Workflow запускается и может обновлять records.

Все действия workflow пишутся как automation actor.
Acceptance:

Workflow без нужного grant не может менять object/list data.

Prompt появляется при publish или save, если action требует grant.

Grant ограничен конкретной сущностью и уровнем.

Runtime проверяет grant на каждом run, а не только при publish.

Activity показывает actor = workflow, а не случайный user.
Ошибки/edge cases: workflow grant отозван после publish; workflow пытается изменить archived object; action затрагивает несколько entities; creator потерял права, но workflow остаётся live.
Демо-режим: workflow Record added to list → update list entry требует automation grant на list.

S353 — Members and teams: создать команду, добавить участников

Модуль: Permissions / Members & teams
Источник: S353: создать команду и добавить участников; Settings включает Members & permissions. 


 



Роль: Owner / Admin.
Предусловия: workspace активен; пользователь имеет право manage members/teams.
UI/вход: Settings → Workspace → Members and teams → Teams → New team / Add members.
Данные/модель: Team, TeamMember, User, AuditLog.
API/логика:

POST /api/teams создать team.

PATCH /api/teams/:id изменить имя/описание.

POST /api/teams/:id/members добавить участников.

DELETE /api/teams/:id/members/:userId удалить участника.
Шаги:

Admin открывает Members and teams.

Переходит во вкладку Teams.

Нажимает New team.

Вводит имя: Sales EU.

Добавляет участников.

Сохраняет team.

Team становится доступна в permission overrides.
Acceptance:

Team создаётся с уникальным именем внутри org.

Участников можно добавить и удалить.

Удаление участника из team пересчитывает его effective permissions.

Team можно выбрать в permissions любой поддерживаемой сущности.

Audit log фиксирует создание team и изменение membership.
Ошибки/edge cases: duplicate team name; пользователь из другой org; попытка удалить последнего admin из management team без замены; team используется в grants.
Демо-режим: seed teams Sales-EU, Sales-US, RevOps, Customer Success.

S354 — Пригласить участника в workspace

Модуль: Permissions / Members & invites
Источник: S354: invite участника в workspace; Settings включает Members & permissions и роли. 


 



Роль: Owner / Admin.
Предусловия: пользователь имеет право приглашать; workspace не превысил лимит плана.
UI/вход: Settings → Members → Invite member.
Данные/модель: Invitation { email, role, status, tokenHash, expiresAt, invitedById }, User, Membership, TeamMember.
API/логика:

POST /api/invitations создаёт invite, отправляет email или demo notification.

GET /api/invitations/:token валидирует invite.

POST /api/invitations/:token/accept создаёт user/membership или связывает existing user.
Шаги:

Admin нажимает Invite member.

Вводит email.

Выбирает роль: Member или Admin.

Опционально выбирает teams.

Система отправляет приглашение.

Invite появляется в Pending.

Получатель принимает invite и попадает в workspace.
Acceptance:

Нельзя пригласить email, который уже активен в workspace.

Pending invite можно resend/cancel.

Invite token имеет срок действия.

Новый участник получает роль и team membership из invite.

Workspace access defaults начинают применяться сразу после accept.
Ошибки/edge cases: email invalid; SMTP недоступен; invite expired; пользователь уже состоит в org; plan user limit exceeded; приглашение отменено до accept.
Демо-режим: email не отправляется реально; invite link показывается в UI/dev toast.

S355 — Применение прав: скрыть/заблокировать UI по уровню

Модуль: Permissions / enforcement
Источник: S355: No access не виден; access levels защищают UI и API. 



Роль: любой пользователь workspace.
Предусловия: для пользователя рассчитан effective access по сущностям.
UI/вход: Sidebar, object/list pages, settings pages, workflow/sequence/dashboard pages.
Данные/модель: EffectivePermission, PermissionGrant, client NavigationDTO.
API/логика: backend возвращает navigation уже с учётом permissions; каждый route дополнительно проверяет permission middleware.
Шаги:

Пользователь логинится.

Sidebar запрашивает navigation.

Backend исключает entities с NO_ACCESS.

Пользователь открывает object с READ.

UI скрывает + New, inline edit, import, settings write-actions.

Пользователь пробует прямой PATCH API.

Backend возвращает FORBIDDEN.
Acceptance:

NO_ACCESS entity не показывается в sidebar/search/quick actions.

READ показывает данные, но блокирует create/update/delete/import.

READ_WRITE разрешает data actions, но блокирует structure/settings/permissions.

FULL разрешает manage settings и permissions.

Backend enforcement покрывает все write endpoints.

UI показывает понятное состояние disabled/tooltip, если действие недоступно.
Ошибки/edge cases: stale frontend permissions; direct URL к скрытой entity; cached records после revoke; optimistic update после потери прав; bulk action на смешанном наборе records.
Демо-режим: переключение роли/permission в Settings сразу меняет sidebar и кнопки без перезапуска.

S356 — Expert access groups: внешние эксперты с ограниченным доступом

Модуль: Permissions / external access
Источник: S356: Expert access groups; Settings-сайдбар в исследовании включает expert access groups как часть permission/settings поверхности. 



Роль: Owner / Admin.
Предусловия: workspace поддерживает external/expert users; есть сущности, к которым нужно дать ограниченный доступ.
UI/вход: Settings → Security / Expert access groups; Entity permissions → Add expert group.
Данные/модель: ExpertAccessGroup, ExpertAccessMember, PermissionGrant, Invitation, User.
API/логика: expert group — специальная team-like группа с ограниченными глобальными возможностями: нет workspace-wide navigation по умолчанию, нет billing/security/members, доступ только через явные grants.
Шаги:

Owner открывает Expert access groups.

Создаёт группу, например External RevOps Consultant.

Добавляет внешние email-адреса.

Выдаёт группе READ на Dashboard и READ_WRITE на конкретный List.

Эксперт принимает invite.

Эксперт видит только разрешённые сущности.
Acceptance:

Expert users не получают workspace default access автоматически.

Expert group можно использовать в permission grants как subject.

Эксперт не видит Members, Billing, Security, Developers.

Эксперт видит только явно разрешённые Objects/Lists/Dashboards/Workflows/Sequences.

Доступ можно отозвать удалением из group или удалением grant.
Ошибки/edge cases: expert email совпадает с active member; expert group удалена, grants остались; эксперт пытается открыть прямой URL; external user должен быть повышен до normal member; audit/history должны сохранить автора действий.
Демо-режим: External Consultant видит только Sales Performance Dashboard и не видит Companies/Deals без grants.

[ГОТОВ БАТЧ: S330–S356]


---

S362 — Каталог приложений (Settings → Apps)

Модуль: Apps & Integrations
Источник: каталог сценариев S362–S367; Academy video 06 описывает Apps page как каталог интеграций в workspace settings с поиском, категориями, карточкой приложения, overview/resources/developer и кнопкой Install. 


 



Роль: Owner / Admin / пользователь с правом управлять интеграциями.
Предусловия: пользователь авторизован; workspace создан; роль пользователя разрешает доступ к Settings → Apps.
UI/вход: Settings → Workspace → Apps; глобальный sidebar → Settings → Apps.
Данные/модель: AppDefinition, AppCategory, IntegrationConnection, InstalledApp, AppResourceLink, AppCapability.
API/логика: GET /api/apps/catalog, GET /api/apps/categories, GET /api/apps/:appKey, GET /api/integrations/installed. Каталог должен работать в demo-mode из локального seed-списка без внешнего marketplace API.
Шаги:

Пользователь открывает Settings.

В левом settings-sidebar выбирает Apps.

Система показывает каталог приложений.

Пользователь фильтрует приложения по категории: Email, Calendar, Communication, Forms, Documents, Data, Automation, Developer.

Пользователь ищет приложение по имени, например Slack, Gmail, PandaDoc, Linear.

Пользователь открывает карточку приложения.

Карточка показывает описание, capabilities, developer, ресурсы, статус установки и кнопку Install / Configure / Disconnect.
Acceptance:

Apps page показывает полный каталог доступных интеграций.

Поиск по имени работает без перезагрузки страницы.

Категории фильтруют список приложений.

У каждого приложения есть карточка detail-view.

Карточка содержит минимум: название, иконку, developer, тип приложения, описание, capabilities, resource links, статус подключения.

Установленные приложения помечены как Installed / Connected.

Неустановленные приложения показывают Install.

Пользователь без прав видит read-only или не видит Apps page — согласно RBAC.
Ошибки/edge cases: пустой каталог; неизвестная категория; приложение отключено админом; app definition есть, но connector недоступен; пользователь открыл прямой URL приложения без прав.
Демо-режим: seed-каталог: Gmail, Google Calendar, Slack, Linear, PandaDoc, Typeform, Mailchimp, Mixmax, Outreach, Segment, Webhooks, Custom app.

S363 — 3 типа приложений: нативные / OAuth-интеграции / кастомные

Модуль: Apps & Integrations
Источник: Academy video 06 выделяет типы приложений: партнёрские, first-party и developer community; для AISDR нормализуем это в нативные, OAuth-интеграции и кастомные приложения. 



Роль: Owner / Admin / разработчик workspace.
Предусловия: каталог приложений доступен; AppDefinition содержит appType.
UI/вход: Settings → Apps → filters/type tabs; App detail page.
Данные/модель: AppDefinition { key, name, appType, developerName, installMode, capabilities }, CustomApp, OAuthProvider, IntegrationConnection.
API/логика:

NATIVE: встроенная интеграция AISDR, установка и конфигурация полностью внутри продукта.

OAUTH: подключение через внешний OAuth provider, token storage, refresh flow.

CUSTOM: пользовательское приложение с API key/webhook scopes и SDK-style настройками.
Шаги:

Пользователь открывает Apps.

Выбирает фильтр Type.

Видит три группы: Native, OAuth integrations, Custom apps.

Открывает Native app, например PandaDoc/Linear widget.

Открывает OAuth app, например Gmail/Slack.

Открывает Custom app и видит настройки developer-created integration.

Система показывает разные install/configure flows в зависимости от типа.
Acceptance:

У каждого app definition есть один явный тип.

UI показывает тип приложения на карточке.

Native app запускает внутренний install-flow.

OAuth app запускает OAuth authorization.

Custom app открывает developer settings: scopes, webhook URL, API credentials, callback URLs.

Каталог можно фильтровать по типу.

Тип приложения влияет на доступные actions: Install, Connect, Configure, Generate key, Open external setup.
Ошибки/edge cases: app type unknown; OAuth provider отсутствует; custom app без scopes; приложение меняет тип после установки; backward compatibility для уже установленных connections.
Демо-режим: OAuth не вызывает реальный provider, но показывает mocked consent и создаёт demo connection.

S364 — Подключить интеграцию (Slack / Gmail / Calendar / Linear / PandaDoc)

Модуль: Apps & Integrations
Источник: каталог S364; Academy video 06 описывает установку приложений через Install → connect account → finish setup, а Workflows integration blocks используют Slack connection, настраиваемый в settings. 


 


 



Роль: Owner / Admin / пользователь, которому разрешено подключать personal account.
Предусловия: приложение есть в каталоге; пользователь имеет permission на установку; для OAuth задан redirect URL.
UI/вход: Settings → Apps → App detail → Install / Connect.
Данные/модель: IntegrationConnection, OAuthAccount, OAuthToken, IntegrationScope, IntegrationSyncState, InstalledApp.
API/логика: POST /api/integrations/:appKey/install, GET /api/integrations/:appKey/oauth/start, GET /api/integrations/oauth/callback, PATCH /api/integrations/:connectionId/settings, DELETE /api/integrations/:connectionId.
Шаги:

Пользователь открывает карточку Slack/Gmail/Calendar/Linear/PandaDoc.

Нажимает Install или Connect.

Система показывает список запрашиваемых scopes.

Пользователь подтверждает OAuth consent или demo consent.

Backend создаёт IntegrationConnection.

Система сохраняет access/refresh token в зашифрованном виде.

Пользователь выбирает workspace/team/channel/mailbox/calendar-specific settings.

Интеграция получает статус Connected.
Acceptance:

Slack connection доступен в workflow Slack message/actions blocks.

Gmail connection доступен для email sync и отправки писем.

Calendar connection доступен для meeting sync и call recorder.

Linear/PandaDoc connection может предоставить record-page widget.

Подключение имеет статус: PENDING, CONNECTED, NEEDS_REAUTH, ERROR, DISCONNECTED.

Reconnect обновляет токены без создания дубля.

Disconnect отзывает локальный доступ и выключает зависящие функции.
Ошибки/edge cases: OAuth denied; invalid callback state; token refresh failed; scope недостаточен; provider rate limit; пользователь подключил тот же аккаунт дважды; интеграция используется workflow/sequence и её нельзя удалить без предупреждения.
Демо-режим: mocked OAuth создаёт connection с fake external account и готовыми Slack channels / Gmail mailbox / Calendar list.

S365 — Виджет приложения на record-странице (Highlights)

Модуль: Apps & Integrations / Record page
Источник: S365 ссылается на S124; Academy video 06 указывает, что некоторые приложения дают виджет на record page и могут настраиваться с app page или с record page; Record page configure mode поддерживает highlights и integration widgets. 


 


 



Роль: Owner / Admin / пользователь с FULL на object layout.
Предусловия: приложение установлено; оно объявляет capability RECORD_WIDGET; объект поддерживает configure page; пользователь имеет право менять layout.
UI/вход: Record page → ⋮ → Configure page → Highlights → Add widget; Settings → Apps → App detail → Add to record page.
Данные/модель: RecordPageLayout, RecordHighlightWidget, InstalledApp, AppWidgetDefinition, AppWidgetInstance.
API/логика: GET /api/apps/:appKey/widgets, POST /api/record-layouts/:objectId/widgets, PATCH /api/record-layouts/widgets/:id, DELETE /api/record-layouts/widgets/:id.
Шаги:

Пользователь устанавливает приложение, например PandaDoc или Linear.

Открывает запись Deal/Company.

Заходит в Configure page.

В зоне Highlights нажимает Add widget.

Выбирает виджет установленного приложения.

Настраивает параметры: объект, matching field, document/project source, отображаемые поля.

Сохраняет layout.

На record page появляется app widget рядом с обычными highlights/action buttons.
Acceptance:

Виджет доступен только после установки соответствующего приложения.

Виджет можно добавить в highlights, если не превышен лимит layout.

Виджет сохраняется на уровне object layout и виден на всех record pages этого объекта.

Виджет может показывать loading/error/empty state.

Виджет не должен ломать record page, если external API недоступен.

Удаление приложения скрывает или деактивирует widget instance с понятным состоянием.
Ошибки/edge cases: app disconnected; widget definition удалён; record не имеет нужного external ID; превышен лимит highlights; пользователь без FULL пытается менять layout.
Демо-режим: Linear показывает demo customer requests, PandaDoc — demo documents/statuses.

S366 — Email-аккаунты: подключить ящик (Settings → Email and calendar accounts)

Модуль: Apps & Integrations / Email sync
Источник: S366; Settings sidebar содержит Email and calendar accounts; стандартные объекты People/Companies автоматически наполняются после подключения mailbox, а email-sync вынесен в отдельные сценарии S386–S392. 


 



Роль: пользователь workspace; Admin для workspace-level policies.
Предусловия: пользователь авторизован; OAuth app Gmail/Outlook доступен; email sync feature включена планом.
UI/вход: Settings → Personal → Email and calendar accounts → Connect account.
Данные/модель: MailboxAccount, CalendarAccount, OAuthToken, EmailSyncState, EmailSharingSettings, SyncJob.
API/логика: POST /api/email-accounts/oauth/start, GET /api/email-accounts/oauth/callback, GET /api/email-accounts, PATCH /api/email-accounts/:id/settings, DELETE /api/email-accounts/:id. После подключения создаётся sync job для historical sync и ongoing sync.
Шаги:

Пользователь открывает Personal Settings.

Переходит в Email and calendar accounts.

Нажимает Connect Gmail / Connect Outlook.

Подтверждает OAuth scopes.

Выбирает sync settings: emails, calendar, sharing mode, historical period.

Система создаёт mailbox account.

Worker запускает sync.

People/Companies начинают пополняться по email participants.
Acceptance:

Подключённый ящик отображается в списке accounts.

Статус sync виден пользователю: idle/syncing/error/needs reauth.

Пользователь может изменить sharing settings.

Disconnect останавливает sync и future sending через этот mailbox.

Неуспешная авторизация не создаёт активный account.

Подключение calendar может быть включено отдельно от mailbox.
Ошибки/edge cases: OAuth denied; provider не отдаёт refresh token; mailbox уже подключён другим пользователем; доменная policy запрещает sync; reauth required; rate limit; пользователь отключает account во время активного sync.
Демо-режим: Connect Gmail создаёт demo mailbox, seeded email threads и calendar events без внешнего OAuth.

S367 — Developers: API-ключи / webhooks

Модуль: Apps & Integrations / Developers
Источник: S367; Settings sidebar содержит Developers, а архитектура включает API keys, webhooks, workflow webhook/HTTP integration paths. 


 


 



Роль: Owner / Admin / developer с правом manage developers.
Предусловия: пользователь имеет доступ к Settings → Developers; workspace активен.
UI/вход: Settings → Workspace → Developers.
Данные/модель: ApiKey, ApiKeyScope, WebhookEndpoint, WebhookSubscription, WebhookDelivery, DeveloperApp.
API/логика: POST /api/developer/api-keys, GET /api/developer/api-keys, DELETE /api/developer/api-keys/:id, POST /api/developer/webhooks, PATCH /api/developer/webhooks/:id, POST /api/developer/webhooks/:id/test.
Шаги:

Admin открывает Settings → Developers.

Переходит во вкладку API keys.

Создаёт ключ с именем, scopes и expiry.

Система показывает секрет один раз.

Admin переходит во вкладку Webhooks.

Создаёт endpoint URL.

Выбирает events: record.created, record.updated, list.entry.created, email.replied, workflow.run.failed.

Отправляет test event.
Acceptance:

API key имеет имя, scopes, createdBy, createdAt, lastUsedAt, expiresAt.

Secret key показывается только один раз.

В списке ключей виден только masked prefix.

Webhook endpoint хранит URL, secret, enabled flag, subscribed events.

Test delivery показывает response code/body/error.

Webhook deliveries логируются с retry status.
Ошибки/edge cases: invalid URL; scope не поддержан; попытка создать ключ без expiry на restricted plan; webhook endpoint возвращает 500; secret утёк — можно rotate; пользователь без прав открывает Developers.
Демо-режим: API key создаётся локально, webhook test не делает внешний HTTP по умолчанию, а пишет mocked delivery.

S372 — Settings-навигация: Personal / Workspace / Data / Reports / Automations

Модуль: Settings / Workspace
Источник: каталог S372; Settings sidebar в материалах содержит Personal, Workspace, Data, Reports, Automations и пункты Profile, Appearance, Email and calendar accounts, Storage accounts, Notifications, General, Members, Plans, Billing, Developers, Security, Migrate CRM, Apps, Objects, Lists, Import History, Dashboards, Sequences, Workflows. 


 



Роль: любой пользователь; доступ к конкретным разделам зависит от роли и permissions.
Предусловия: пользователь авторизован; Settings route доступен.
UI/вход: Avatar/user menu → Settings; /settings.
Данные/модель: SettingsNavigationItem, UserRole, PermissionGrant, FeatureFlag, Plan.
API/логика: GET /api/settings/navigation возвращает доступные разделы с учётом role/plan/feature flags.
Шаги:

Пользователь открывает Settings.

Система показывает левый settings-sidebar.

Personal-раздел показывает Profile, Appearance, Email and calendar accounts, Storage accounts, Notifications, Call recording.

Workspace-раздел показывает General, Members, Plans, Billing, Developers, Security, Email and calendar, Support, Migrate CRM, Apps.

Data-раздел показывает Objects, Lists, Import History.

Reports-раздел показывает Dashboards.

Automations-раздел показывает Sequences, Workflows.

Пользователь кликает пункт — открывается соответствующий settings page.
Acceptance:

Settings navigation стабильна и не зависит от текущего CRM object route.

Недоступные разделы скрыты или read-only согласно role/permission.

Активный раздел подсвечен.

Deep-link /settings/billing открывается напрямую при наличии прав.

Member без workspace settings прав не видит admin-only pages.

Settings sidebar не ломается при пустых данных.
Ошибки/edge cases: пользователь потерял роль во время сессии; раздел отключён планом; direct URL к forbidden page; feature flag выключен; mobile layout.
Демо-режим: Owner видит все пункты; Member видит только Personal и разрешённые разделы.

S373 — Workspace General: имя, логотип, домен

Модуль: Settings / Workspace General
Источник: S373 из каталога Settings; Settings sidebar содержит Workspace → General. 


 



Роль: Owner / Admin.
Предусловия: workspace существует; пользователь имеет право manage workspace settings.
UI/вход: Settings → Workspace → General.
Данные/модель: Organization { name, slug, logoUrl, domain, timezone, locale }, AuditLog.
API/логика: GET /api/workspace/current, PATCH /api/workspace/current, POST /api/workspace/logo, DELETE /api/workspace/logo.
Шаги:

Admin открывает Settings → General.

Видит текущие workspace name, logo, domain/slug, timezone.

Меняет имя workspace.

Загружает логотип.

Настраивает workspace domain/slug.

Сохраняет изменения.

Система обновляет sidebar/workspace switcher.
Acceptance:

Workspace name обновляется в workspace switcher и sidebar.

Logo отображается в workspace switcher и settings preview.

Domain/slug валидируется на уникальность.

Изменения пишутся в audit log.

Неверный файл логотипа отклоняется.

Пользователь без прав не может сохранять изменения.
Ошибки/edge cases: пустое имя; slug занят; logo слишком большой; unsupported MIME; concurrent update; попытка сменить системный домен на restricted plan.
Демо-режим: логотип хранится как local/mock URL, domain меняется только внутри demo workspace.

S374 — Appearance: тема light/dark

Модуль: Settings / Personal / Appearance
Источник: S374 из каталога; Settings sidebar содержит Appearance. 



Роль: любой пользователь.
Предусловия: пользователь авторизован.
UI/вход: Settings → Personal → Appearance.
Данные/модель: UserPreference { theme, density, accentColor }.
API/логика: GET /api/me/preferences, PATCH /api/me/preferences. Тема применяется на frontend через root class/local storage/server preference.
Шаги:

Пользователь открывает Appearance.

Видит варианты темы: Light, Dark, System.

Выбирает Dark или Light.

UI мгновенно применяет тему.

Система сохраняет preference.

При следующем входе тема восстанавливается.
Acceptance:

Тема применяется без перезагрузки страницы.

Preference сохраняется на пользователя, а не на workspace.

System следует настройке ОС.

Все ключевые CRM-экраны читаемы в light/dark.

Смена темы не сбрасывает текущий route.
Ошибки/edge cases: preference API недоступен; local storage conflict; SSR hydration mismatch; пользователь в нескольких workspace.
Демо-режим: default может быть dark, но пользователь может переключить light/dark.

S375 — Plans: тарифы Free / Plus / Pro / Enterprise + лимиты

Модуль: Billing / Plans
Источник: S375; MASTER_TZ включает Stripe и billing, а каталог фиксирует Plans с тарифами и лимитами. 



Роль: Owner / Admin с billing access.
Предусловия: workspace создан; billing module включён; Stripe может быть в demo/mock mode.
UI/вход: Settings → Workspace → Plans.
Данные/модель: Plan, PlanFeature, Subscription, UsageLimit, Organization.plan.
API/логика: GET /api/billing/plans, GET /api/billing/subscription, POST /api/billing/checkout, POST /api/billing/change-plan.
Шаги:

Owner открывает Settings → Plans.

Видит текущий план.

Видит таблицу Free / Plus / Pro / Enterprise.

Для каждого плана видит лимиты: users, records, AI credits, sequences, workflows, integrations, support.

Нажимает Upgrade/Downgrade.

Система открывает Stripe checkout или demo upgrade modal.

После оплаты/подтверждения workspace plan обновляется.
Acceptance:

Current plan выделен.

Планы показывают цену, billing interval, лимиты и ключевые features.

Upgrade ведёт в Stripe checkout.

Enterprise показывает Contact sales / manual flow.

После успешного checkout webhook обновляет subscription.

Plan limits применяются в продукте: credits, records, users, integrations.
Ошибки/edge cases: Stripe unavailable; checkout canceled; webhook не пришёл; downgrade ниже текущего usage; пользователь без billing прав; trial expired.
Демо-режим: Upgrade меняет plan через mock endpoint без реального Stripe.

S376 — Billing: кредиты AI — баланс, разбивка по типам и времени

Модуль: Billing / AI credits
Источник: S376; AI Attributes specification задаёт, что баланс и разбивка кредитов видны в Workspace Settings → Billing, планы включают месячный пакет и докупку. 


 



Роль: Owner / Admin / пользователь с правом видеть usage.
Предусловия: AI credits feature включена; есть monthly credit allowance или credit transactions.
UI/вход: Settings → Workspace → Billing → AI credits.
Данные/модель: CreditBalance, CreditTransaction, CreditPackage, AiRun, PlanAllowance.
API/логика: GET /api/billing/credits/balance, GET /api/billing/credits/transactions, GET /api/billing/credits/usage?from=&to=&groupBy=type.
Шаги:

User/Admin открывает Billing.

Переходит в секцию AI credits.

Видит текущий баланс.

Видит monthly included credits и дату следующего reset.

Видит usage breakdown по AI типам: Classify, Summarize, Research, Prompt.

Фильтрует транзакции по дате, пользователю, объекту, типу AI run.

Открывает transaction detail и видит связанную запись/атрибут/run.
Acceptance:

Баланс отображается числом и прогрессом usage.

Транзакции показывают debit/credit, amount, reason, actor, timestamp.

Research runs учитываются отдельно.

Можно отфильтровать по периоду.

Billing usage не раскрывает данные записей пользователям без прав на эти записи; показывает безопасный summary.

Экспорт CSV usage доступен Owner/Admin.
Ошибки/edge cases: отрицательный баланс; transaction без связанного record; reset произошёл во время active runs; timezone period boundary; пользователь без billing access.
Демо-режим: seeded ledger показывает расход по AI-атрибутам и пополнение monthly package.

S377 — Списание кредитов: Research = 10, остальные = 1

Модуль: Billing / AI credits / AI attributes
Источник: S377 связан с S170; AI Attributes specification фиксирует стоимость: Research agent = 10 кредитов, остальные AI-типы = 1 кредит. 


 



Роль: любой пользователь, запускающий AI; Owner/Admin для контроля лимитов.
Предусловия: AI run инициирован; у workspace достаточно кредитов или включён overage policy.
UI/вход: AI attribute cell/run button; workflow AI block; record page AI action.
Данные/модель: AiRun, CreditTransaction, CreditBalance, AttributeAiType.
API/логика: перед запуском AI backend делает reserve или atomic debit: RESEARCH=10, CLASSIFY=1, SUMMARIZE=1, PROMPT=1. При fail возможно refund или transaction status VOIDED.
Шаги:

Пользователь запускает AI attribute.

Backend определяет AI type.

Backend рассчитывает стоимость.

Backend проверяет баланс.

Backend создаёт pending transaction.

AI service выполняет run.

При успехе transaction фиксируется как debit.

При ошибке transaction отменяется или помечается failed без списания.
Acceptance:

Research agent всегда списывает 10 кредитов за один record/run.

Classify/Summarize/Prompt списывают 1 кредит.

Массовый запуск по колонке списывает сумму за каждую строку.

Workflow AI block использует те же правила списания.

При недостатке кредитов run не стартует и показывает ошибку.

Все списания видны в Billing → Credits history.
Ошибки/edge cases: параллельные массовые AI runs; credit race condition; run отменён пользователем; AI provider timeout; retry не должен списывать дважды за один successful run без явного повторного запуска.
Демо-режим: demo AI тоже списывает demo credits, чтобы acceptance по billing проверялся end-to-end.

S378 — Докупка кредитов / месячный пакет в плане

Модуль: Billing / AI credit packages
Источник: S378; AI Attributes specification указывает, что планы включают месячный пакет кредитов и поддерживают докупку. 


 



Роль: Owner / Admin с billing permission.
Предусловия: workspace имеет billing account; Stripe customer создан или может быть создан.
UI/вход: Settings → Billing → AI credits → Buy credits / Manage plan.
Данные/модель: CreditPackage, CreditPurchase, StripeCheckoutSession, PlanAllowance, CreditLedgerEntry.
API/логика: GET /api/billing/credit-packages, POST /api/billing/credits/checkout, POST /api/stripe/webhook. Monthly allowance начисляется scheduled job или subscription webhook.
Шаги:

Owner открывает Billing → AI credits.

Видит included monthly credits по текущему плану.

Нажимает Buy credits.

Выбирает пакет: 1k / 5k / 10k credits.

Система создаёт Stripe checkout session.

После успешной оплаты webhook начисляет credits.

Ledger показывает purchase transaction.

Monthly reset добавляет plan allowance в начале периода.
Acceptance:

Credit packages показывают цену и количество кредитов.

Checkout создаётся только для billing-authorized users.

После оплаты баланс увеличивается.

Monthly allowance начисляется отдельно от purchased credits.

История показывает источник: monthly_package / purchased_package / manual_adjustment.

Нельзя купить credits на plan, где feature выключена, без upgrade flow.
Ошибки/edge cases: Stripe checkout canceled; webhook duplicate; payment failed; пользователь купил пакет, но workspace удалён; refund; monthly reset уже начислен.
Демо-режим: Buy credits через mock checkout сразу создаёт CreditTransaction(type=CREDIT_PURCHASE).

S379 — Storage accounts (хранилища файлов)

Модуль: Settings / Storage / Files
Источник: S379; Settings sidebar содержит Storage accounts, а Record page включает Files tab. 


 



Роль: Owner / Admin / пользователь, подключающий personal storage.
Предусловия: storage integrations включены; пользователь имеет доступ к Personal Settings или Workspace storage settings.
UI/вход: Settings → Personal → Storage accounts; Record page → Files → Attach from storage.
Данные/модель: StorageAccount, FileAttachment, OAuthToken, FileProvider, RecordFileLink.
API/логика: POST /api/storage-accounts/oauth/start, GET /api/storage-accounts/oauth/callback, GET /api/storage-accounts, DELETE /api/storage-accounts/:id, POST /api/records/:recordId/files.
Шаги:

Пользователь открывает Storage accounts.

Нажимает Connect Google Drive / OneDrive / Dropbox.

Подтверждает OAuth scopes.

Система сохраняет storage connection.

На record page пользователь открывает Files.

Выбирает Attach from storage.

Выбирает файл.

Система создаёт link attachment на record.
Acceptance:

Storage account отображается в settings.

Disconnect удаляет возможность attach new files.

Attach file создаёт запись в Files tab.

Файл связан с record, но не копируется без необходимости.

Доступ к file link соблюдает record permissions.

Ошибка provider отображается как recoverable state.
Ошибки/edge cases: provider revoked token; файл удалён во внешнем storage; insufficient scope; duplicate attachment; пользователь без доступа к record files.
Демо-режим: mock storage provider возвращает seeded files и attachments.

S380 — Security: 2FA, SSO, сессии

Модуль: Security / Workspace settings
Источник: S380; Settings sidebar включает Security, а stack уже содержит JWT auth. 


 



Роль: Owner / Admin; обычный пользователь для личной 2FA и сессий.
Предусловия: пользователь авторизован; security settings доступны планом.
UI/вход: Settings → Workspace → Security; Settings → Personal → Security/Sessions.
Данные/модель: TwoFactorSecret, UserSession, SsoConfiguration, AuditLog, SecurityPolicy.
API/логика:

2FA: setup TOTP, verify code, recovery codes.

SSO: SAML/OIDC config, domain verification, enforce SSO policy.

Sessions: list active sessions, revoke session, revoke all except current.
Шаги:

Пользователь открывает Security.

Включает 2FA: сканирует QR, вводит код, сохраняет recovery codes.

Owner настраивает SSO: provider type, issuer/client ID, certificate/secret, callback URL.

Owner включает require SSO for domain.

Пользователь открывает Sessions.

Видит активные устройства/IP/last active.

Отзывает подозрительную сессию.
Acceptance:

2FA нельзя включить без успешной проверки TOTP.

Recovery codes показываются один раз.

Login требует 2FA после включения.

SSO config можно сохранить в draft/tested/enforced states.

Sessions list показывает current session и другие active sessions.

Revoke session инвалидирует JWT/refresh token.

Security changes пишутся в audit log.
Ошибки/edge cases: потеря 2FA; неверный TOTP; clock skew; SSO misconfiguration; enforced SSO заблокировал всех Owner; session already revoked; token theft.
Демо-режим: 2FA setup использует deterministic mock secret; SSO test возвращает mocked success/failure без внешнего IdP.

S381 — Migrate CRM (импорт из другой CRM)

Модуль: Settings / Migrate CRM / legacy migration
Источник: S381; Settings sidebar содержит Migrate CRM, а каталог дополнительно фиксирует S402 как миграцию legacy Lead/Campaign → People/Companies/Sequences. Архитектура требует legacyMigrationService.ts и постепенный переход от legacy Lead/Campaign к flexible CRM. 


 


 



Роль: Owner / Admin.
Предусловия: workspace существует; flexible CRM bootstrap выполнен; есть legacy Lead/Campaign data или внешний CRM export.
UI/вход: Settings → Workspace → Migrate CRM.
Данные/модель: LegacyMigrationJob, MigrationMapping, MigrationRunResult, legacy Lead, Campaign, Sequence, target Object, Record, Value, List, Sequence.
API/логика: POST /api/migrations/legacy/start, GET /api/migrations/legacy/:id, POST /api/migrations/legacy/:id/confirm, POST /api/migrations/legacy/:id/rollback. Для external CRM: CSV/API adapter later; для MVP — legacy Lead/Campaign adapter.
Шаги:

Owner открывает Migrate CRM.

Выбирает источник: AISDR legacy Lead/Campaign или external CRM export.

Система сканирует источник и показывает preview.

Пользователь подтверждает mapping:

Lead → Person + Company;

Campaign → Sequence/Campaign list;

CampaignLead → Sequence enrollment/List entry;

Message → Email/Activity.

Система показывает dedupe: email для People, domain/company для Companies.

Пользователь запускает migration.

Worker создаёт target records/values/sequences.

После завершения UI показывает migration report.

При необходимости Owner запускает rollback.
Acceptance:

Legacy Lead не переносится как плоская новая таблица, а раскладывается в People/Companies flexible CRM.

Campaign/Sequence legacy данные конвертируются в новые Sequences или migration-compatible objects.

Messages сохраняются как email/activity history, если возможно.

Дедуп по email/domain предотвращает дубли.

Migration job имеет progress, errors, report.

Rollback удаляет созданные target entities или помечает их migration-created.

После миграции пользователи могут открыть People/Companies/Sequences в новом UI.
Ошибки/edge cases: Lead без email и company; Campaign без sequence steps; конфликт existing records; legacy data уже мигрирована; partial migration failed; rollback после ручных изменений; внешняя CRM export с неизвестными колонками.
Демо-режим: кнопка “Migrate demo legacy data” переносит seeded Leads/Campaigns в People/Companies/Sequences без внешних API.

[ГОТОВ БАТЧ: S362–S381]


---

S386 — Подключить ящик → авто-синк писем в Attio

Модуль: Email sync & enrichment
Источник: каталог S386; demo/Academy: подключение mailbox автоматически наполняет People/Companies и создаёт коммуникационный контекст.
Роль: пользователь workspace / SDR / AE; Admin управляет workspace-level sync policy.
Предусловия: пользователь авторизован; OAuth-интеграция Gmail/Outlook доступна; workspace bootstrap выполнен; объекты People и Companies существуют; у пользователя есть право подключать личный mailbox.
UI/вход: Settings → Personal → Email and calendar accounts → Connect account; onboarding wizard первого входа; Apps → Gmail/Outlook → Connect.
Данные/модель: MailboxAccount, OAuthToken, EmailSyncState, EmailMessage, EmailThread, EmailParticipant, Record, Value, Activity, SyncJob.
API/логика:

POST /api/email-accounts/oauth/start — старт OAuth.

GET /api/email-accounts/oauth/callback — callback и сохранение connection.

PATCH /api/email-accounts/:id/settings — sync/sharing settings.

POST /api/email-sync/:accountId/start — старт initial sync.

Worker создаёт SyncJob, подтягивает threads/messages, нормализует participants, пишет связи с People/Companies.
Шаги:

Пользователь открывает Email and calendar accounts.

Нажимает Connect Gmail или Connect Outlook.

Система показывает scopes: read mailbox, send email, read calendar, profile/email.

Пользователь подтверждает OAuth.

Backend создаёт mailbox account в статусе CONNECTED.

Пользователь выбирает sync depth: historical period, sync only contacts, sync future emails.

Worker запускает initial sync.

UI показывает progress: indexing emails / matching contacts / creating records.

После завершения mailbox отображается как synced.
Acceptance:

Подключённый ящик появляется в settings.

Initial sync запускается автоматически или по явной кнопке Start sync.

Система не падает при большом mailbox: синхронизация идёт батчами.

Email threads сохраняются с org/user scope.

People/Companies matching запускается как отдельный этап.

Статусы видны: CONNECTED, SYNCING, SYNCED, NEEDS_REAUTH, ERROR, DISCONNECTED.

Disconnect останавливает future sync и запрещает отправку из этого mailbox.
Ошибки/edge cases: OAuth denied; refresh token не выдан; provider rate limit; mailbox уже подключён; пользователь отозвал доступ у провайдера; sync прерван; письма без участников; доменная политика запрещает sync.
Демо-режим: Connect Gmail создаёт demo mailbox, seeded threads и fake sync progress без внешнего OAuth.

S387 — Email-sync наполняет People/Company автоматически

Модуль: Email sync & enrichment
Источник: каталог S387; требование: новые контакты из переписки автоматически создают People/Company records.
Роль: SDR / AE / RevOps.
Предусловия: mailbox подключён; People и Companies существуют; у объектов есть primary attributes: person name/email, company name/domain.
UI/вход: Email sync worker; People table; Companies table; record page → Emails / Activity.
Данные/модель: EmailParticipant, EmailDomain, Record, Value, RelationshipValue, Activity, DedupRule.
API/логика: worker извлекает участников писем, нормализует email, вычисляет домен, ищет существующего Person по email и Company по domain, затем создаёт недостающие records и relationship Person → Company.
Шаги:

Worker получает synced email thread.

Извлекает From/To/Cc/Bcc participants.

Исключает internal domains workspace.

Нормализует email-адреса.

Для каждого внешнего email ищет Person record.

Если Person не найден — создаёт Person.

По домену email ищет Company record.

Если Company не найдена и домен не generic — создаёт Company.

Создаёт relationship Person → Company.

Пишет activity: EMAIL_SYNC_CREATED_PERSON, EMAIL_SYNC_CREATED_COMPANY, EMAIL_LINKED_TO_RECORD.
Acceptance:

Новый внешний email participant создаёт Person.

Новый корпоративный домен создаёт Company.

Gmail/Outlook sync не создаёт компании для generic domains: gmail.com, outlook.com, yahoo.com и т.п., если нет отдельной настройки.

Повторный sync не создаёт дубли.

Person связывается с Company по домену.

Email thread отображается на Person и Company record pages.

Created records имеют source=EMAIL_SYNC.
Ошибки/edge cases: общий inbox с множеством внутренних доменов; alias emails; несколько компаний с одним доменом; participant без имени; bounced/system emails; mailing lists; email domain сменился после enrichment.
Демо-режим: seeded thread lisa@cosme.com ↔ user@basepoint.com создаёт Person Lisa и Company Cosme.

S388 — Enrichment записи: домен → данные компании

Модуль: Enrichment
Источник: каталог S388; enrichment-атрибуты: LinkedIn, employee range, job title, revenue, location, firmographics, company details.
Роль: SDR / AE / RevOps / Admin.
Предусловия: Company record имеет домен или website; enrichment включён планом; есть demo enrichment provider или внешний provider.
UI/вход: Company record → Details / Enrichment section; table column enrichment attributes; workflow action → enrich record.
Данные/модель: EnrichmentJob, EnrichmentSource, Attribute, Value, Record, Activity, AiRun при AI pre-analysis.
API/логика:

POST /api/records/:recordId/enrich — enrich одной записи.

POST /api/objects/:objectKey/enrich — bulk enrich view/list.

Worker берёт domain, вызывает provider/demo provider, маппит результат в enrichment attributes.
Шаги:

Пользователь открывает Company record.

Видит пустые enrichment-поля: LinkedIn, Employee range, Description, Industry, Country, Funding raised.

Нажимает Enrich.

Система валидирует домен.

Worker запускает enrichment job.

Provider возвращает firmographic payload.

Backend нормализует данные и пишет values.

Activity timeline получает событие enrichment.

UI обновляет enrichment section и table columns.
Acceptance:

Enrichment работает по domain/website.

Результаты записываются в typed Value по атрибутам.

Система показывает источник и время обновления.

Existing manual values не перезаписываются без policy overwrite=true.

Bulk enrichment показывает progress и row-level errors.

Enrichment attributes доступны в views, filters, reports, workflows.
Ошибки/edge cases: домен пустой; provider не нашёл компанию; conflicting provider values; rate limit; manual value vs provider value; разные компании на одном домене; enrichment отключён планом.
Демо-режим: demo provider возвращает фиксированные данные для cosme.com, apollo.io, andersen.com, basepoint.ai.

S389 — Communication intelligence: частота / последний контакт по записи

Модуль: Communication Intelligence
Источник: каталог S389; требования: connection strength, last interaction, next calendar interaction, mutual contacts, activity from mailbox/calendar.
Роль: SDR / AE / manager.
Предусловия: email/calendar sync включён; records связаны с email participants и meetings.
UI/вход: People/Company table columns; record page → Details / Activity / Emails / Calls; Deals views with connection strength sort.
Данные/модель: Interaction, EmailMessage, CalendarEvent, Call, CommunicationScore, MutualContact, RecordInteractionSummary.
API/логика: aggregation service считает communication metrics по record и связанным records: last email, last meeting, next meeting, interaction count, reply ratio, connection strength, strongest connection, mutual contacts.
Шаги:

Sync сохраняет email/calendar/call interactions.

Aggregator группирует interactions по Person.

Для Company агрегирует interactions всех связанных People.

Система рассчитывает last interaction date.

Система рассчитывает next calendar interaction.

Система определяет strongest connection — внутренний пользователь с максимальной активностью по записи.

Система формирует mutual contacts.

Значения доступны как computed/enrichment attributes в table и record page.
Acceptance:

Last interaction обновляется после нового email, call или meeting.

Connection strength пересчитывается после sync.

Strongest connection показывает внутреннего пользователя workspace.

Mutual contacts отображаются на Company/Person record.

Значения можно использовать в фильтрах и сортировках.

При отсутствии interactions UI показывает empty state, а не 0 без контекста.
Ошибки/edge cases: дубликаты emails из нескольких mailbox; internal-only письма; calendar event без attendees; deleted emails; private sharing settings; несколько people связаны с одной company.
Демо-режим: seeded interactions дают разные уровни connection strength: Strong / Medium / Weak / No connection.

S390 — Sharing settings: какие письма видны команде

Модуль: Email sync / Privacy / Permissions
Источник: каталог S390; record page Emails tab должен учитывать sharing settings.
Роль: любой пользователь с mailbox; Admin управляет workspace policy.
Предусловия: mailbox подключён; email threads синхронизированы; пользователь открыл sharing settings.
UI/вход: Settings → Email and calendar accounts → Sharing settings; Record page → Emails tab.
Данные/модель: EmailSharingSettings, EmailMessage.visibility, EmailThreadVisibility, MailboxAccount, RecordEmailLink.
API/логика: backend фильтрует email threads/messages по visibility: PRIVATE, METADATA_ONLY, SHARED, TEAM_SHARED, DOMAIN_SHARED. Access check учитывает владельца mailbox, participants, record permissions и workspace policy.
Шаги:

Пользователь открывает mailbox settings.

Выбирает sharing mode:

private;

share metadata only;

share emails linked to records;

share with team/workspace.

Сохраняет settings.

Открывает Company record → Emails.

Другой пользователь открывает тот же record.

UI показывает только разрешённые emails или metadata placeholders.
Acceptance:

Private emails видны только владельцу mailbox.

Shared emails видны пользователям с доступом к record.

Metadata-only показывает subject/date/participants без body.

Изменение sharing settings пересчитывает доступ к существующим synced emails.

UI явно помечает hidden/private email placeholders.

Backend не отдаёт body private emails через API.
Ошибки/edge cases: email thread содержит private и shared messages; пользователь изменил sharing после sync; email был переслан в общий тред; legal/privacy blocklist domains; direct API request на private message.
Демо-режим: один thread виден полностью владельцу, другому user — как “Private email”.

S391 — Emails tab записи: общий тред переписки

Модуль: Record page / Email sync
Источник: каталог S391; связано с S131: Emails tab — общий вид всех email touchpoints.
Роль: SDR / AE / manager.
Предусловия: record существует; emails synced или отправлены из AISDR; user имеет READ на record и достаточные email sharing permissions.
UI/вход: Record page → Emails tab.
Данные/модель: EmailThread, EmailMessage, RecordEmailLink, MailboxAccount, EmailAttachment, Activity.
API/логика: GET /api/records/:recordId/emails возвращает threads с применением sharing settings; GET /api/emails/:emailId возвращает body/attachments при наличии права.
Шаги:

Пользователь открывает Person/Company/Deal record.

Переходит на Emails tab.

Система загружает все email threads, связанные с record.

UI группирует messages по thread.

Пользователь раскрывает thread.

Видит body, participants, timestamps, attachments, tracking info.

Пользователь нажимает Reply/Compose email.

Новый email сохраняется в том же thread и activity timeline.
Acceptance:

Emails tab показывает synced и отправленные из продукта письма.

Threads отсортированы по последней активности.

Body виден только при разрешённом sharing.

Attachments отображаются, если доступны.

Reply создаёт draft/send flow с linked record.

Email sent/replied/opened events синхронизируются с Activity.
Ошибки/edge cases: thread связан с несколькими records; body недоступен из-за private sharing; message удалён у provider; attachment слишком большой; duplicate message ID из разных accounts.
Демо-режим: Cosme record содержит seeded thread с несколькими messages и private/shared состояниями.

S392 — Calendar-синк: встречи на activity timeline

Модуль: Calendar sync / Activity timeline
Источник: каталог S392; email/calendar sync даёт next calendar interaction и meetings на record timeline.
Роль: SDR / AE / Customer Success.
Предусловия: calendar account подключён; calendar events содержат attendees; People/Companies records существуют или создаются sync-ом.
UI/вход: Settings → Email and calendar accounts → Calendar sync; Record page → Activity; Home → Meetings.
Данные/модель: CalendarAccount, CalendarEvent, CalendarParticipant, Activity, RecordCalendarLink, RecordInteractionSummary.
API/логика: worker синхронизирует calendar events, сопоставляет attendees с People records, связывает event с People/Companies/Deals, пишет activity event и обновляет next/last calendar interaction.
Шаги:

Пользователь подключает Google Calendar/Outlook Calendar.

Worker получает historical и upcoming events.

Attendees нормализуются по email.

Система создаёт/обновляет Person records.

Система связывает event с Person/Company records.

На record activity timeline появляется event: meeting booked/held.

Next calendar interaction обновляется.

Home dashboard показывает upcoming meetings.
Acceptance:

Calendar events отображаются в Activity timeline связанных records.

Upcoming meeting обновляет next calendar interaction.

Past meeting обновляет last calendar interaction.

Event содержит title, time, attendees, provider link, host.

Private calendar events скрывают title/body согласно privacy settings.

Duplicate events не создаются при повторном sync.
Ошибки/edge cases: recurring events; event canceled/rescheduled; private event; attendee без email; timezone mismatch; calendar disconnected; user declined meeting.
Демо-режим: seeded meeting Basepoint <> Picoma отображается на Home и record timeline.

S396 — Comment на записи + @mention → уведомление

Модуль: Notifications / Collaboration / Record page
Источник: каталог S396; связано с S136: comment + @mention создаёт уведомление web/email.
Роль: любой пользователь с READ_WRITE на record; упомянутый пользователь получает notification.
Предусловия: record существует; comments tab/ composer доступен; users состоят в workspace.
UI/вход: Record page → Comments tab / Activity composer → Add comment.
Данные/модель: Comment, Mention, Notification, EmailDigestItem, Activity, Record.
API/логика: POST /api/records/:recordId/comments парсит mentions @user, создаёт comment, activity и notifications для упомянутых пользователей. Email notification отправляется сразу или попадает в digest согласно настройкам.
Шаги:

Пользователь открывает record.

Переходит на Comments или Activity composer.

Пишет комментарий с @Marisa.

Нажимает Send.

Backend создаёт Comment.

Mention parser создаёт Mention.

Notification service создаёт web notification для Marisa.

Если включены email notifications — создаёт email/send job.

Упомянутый пользователь открывает notification и переходит к record/comment.
Acceptance:

Comment сохраняется и отображается на record.

@mention предлагает autocomplete пользователей workspace.

Упомянутый пользователь получает notification.

Notification deep-link ведёт к конкретному record/comment.

Автор comment не получает notification на собственное mention, если он сам себя отметил.

Пользователь без доступа к record не должен получать раскрывающий данные notification; нужен safe текст или запрет mention.
Ошибки/edge cases: mention пользователя без доступа; пользователь удалён; comment edited после mention; duplicate mentions; notification delivery failed; record archived.
Демо-режим: @Cassandra создаёт notification в seeded notification center.

S397 — Ответ на comment → уведомление автору

Модуль: Notifications / Collaboration
Источник: каталог S397; связано с S137: ответ на comment уведомляет автора.
Роль: пользователь с доступом к record; автор исходного comment получает notification.
Предусловия: существует comment thread; пользователь имеет право комментировать.
UI/вход: Record page → Comments → Reply.
Данные/модель: Comment { parentCommentId }, CommentThread, Notification, Activity.
API/логика: reply создаётся как nested comment; notification recipients: parent author, mentioned users, subscribed participants thread, исключая автора reply.
Шаги:

Пользователь открывает comment thread.

Нажимает Reply.

Пишет ответ.

Backend сохраняет reply с parentCommentId.

Notification service определяет автора исходного comment.

Автор исходного comment получает web notification.

При включённых email alerts создаётся email notification/digest item.
Acceptance:

Reply отображается вложенным или в thread.

Автор исходного comment получает notification.

Если reply содержит @mention, mention notification тоже создаётся.

Notification deep-link раскрывает thread и подсвечивает reply.

Пользователь не получает duplicate notification за один reply.

Удаление parent comment корректно сохраняет/скрывает thread согласно policy.
Ошибки/edge cases: parent comment удалён; author no longer has access; reply на archived record; notification preferences disabled; user replies to own comment.
Демо-режим: reply в demo record создаёт notification для автора seeded comment.

S398 — Центр уведомлений: упоминания, задачи, назначения

Модуль: Notifications / Topbar
Источник: каталог S398; sidebar/topbar содержит Notifications, Tasks, assignment-related activity.
Роль: любой пользователь workspace.
Предусловия: notification service включён; есть хотя бы одно событие: mention, task assigned, record assigned, workflow error, sequence event.
UI/вход: Topbar bell / Sidebar → Notifications.
Данные/модель: Notification { type, actorId, recipientId, entityType, entityId, readAt, archivedAt }, Task, Comment, WorkflowRun, SequenceEnrollment.
API/логика: GET /api/notifications, GET /api/notifications/unread-count, PATCH /api/notifications/:id/read, POST /api/notifications/mark-all-read.
Шаги:

Пользователь открывает topbar notification bell.

Система показывает unread count.

Пользователь открывает notification center.

Видит группы: Mentions, Tasks, Assignments, Workflow errors, Sequence events.

Кликает notification.

Система открывает linked entity: record/comment/task/workflow run.

Notification помечается read.

Пользователь может mark all as read или archive.
Acceptance:

Unread count обновляется после создания notification.

Notification center фильтруется по read/unread/type.

Deep-links работают для всех supported entity types.

Mark as read изменяет unread count.

Пользователь видит только свои notifications.

Notification payload не раскрывает данные forbidden records.
Ошибки/edge cases: linked entity deleted/archived; permission revoked after notification created; duplicate events; realtime connection lost; notification storm.
Демо-режим: seeded notifications: mention, assigned task, workflow failed, sequence reply.

S399 — Email-дайджест уведомлений

Модуль: Notifications / Email digest
Источник: каталог S399.
Роль: любой пользователь; Admin может управлять workspace defaults.
Предусловия: у пользователя есть email; notification preferences настроены; email sending работает или включён demo SMTP.
UI/вход: Settings → Personal → Notifications; Notification center → Email preferences.
Данные/модель: NotificationPreference, EmailDigest, EmailDigestItem, Notification, EmailSendJob.
API/логика: digest scheduler выбирает unread/unemailed notifications по preference: instant, hourly, daily, weekly, disabled. Создаёт email digest с grouped items и safe links.
Шаги:

Пользователь открывает notification preferences.

Выбирает email digest frequency.

В течение дня получает mentions/tasks/assignments.

Scheduler собирает unread notifications.

Формирует email digest.

Отправляет через SMTP/demo email service.

Помечает included notifications как emailed.

Пользователь кликает link из digest и открывает нужный экран.
Acceptance:

Можно отключить email digest.

Frequency применяется на пользователя.

Digest группирует notifications по типам.

Digest не включает private/forbidden content.

Повторный digest не дублирует уже отправленные items.

Unsubscribe/manage preferences link ведёт в settings.
Ошибки/edge cases: SMTP недоступен; пользователь изменил frequency перед отправкой; notification стала read до digest; linked entity удалена; timezone daily boundary.
Демо-режим: digest не отправляет внешний email, а создаёт preview в Outbox/Email log.

S400 — Demo-режим: всё работает без внешних ключей

Модуль: Demo mode / Platform reliability
Источник: каталог S400; core-требование AISDR: демо-данные, демо-SMTP, демо-AI, без внешних ключей.
Роль: разработчик / demo operator / пользователь trial workspace.
Предусловия: .env может не содержать Anthropic/SMTP/Stripe/OAuth/provider keys; приложение запущено локально.
UI/вход: global app; onboarding; AI actions; email send; billing; integrations; calls; workflows.
Данные/модель: DemoModeConfig, DemoProviderState, seeded CRM records, demo messages, demo calls, demo workflows.
API/логика: все внешние сервисы имеют provider abstraction: RealProvider и DemoProvider. При отсутствии ключа или DEMO_MODE=true используется deterministic demo provider.
Шаги:

Backend стартует без внешних API keys.

Config определяет demo mode.

Пользователь проходит onboarding.

Запускает AI attribute.

Отправляет demo email.

Подключает demo Gmail/Slack.

Открывает Billing/Stripe upgrade.

Открывает Calls и Reports.

Все действия возвращают правдоподобный результат без внешнего API.
Acceptance:

Приложение стартует без Anthropic key.

AI actions работают через demo AI.

Email send не отправляет реальные письма, но создаёт Email/Activity.

Stripe checkout заменяется mock checkout.

OAuth integrations используют mock consent.

Call recording/transcript работают на fixtures.

UI явно показывает demo-safe режим там, где важна безопасность.
Ошибки/edge cases: часть ключей есть, часть отсутствует; production случайно запущен в demo; demo provider не должен писать реальные внешние эффекты; тесты не должны зависеть от сети.
Демо-режим: это сам основной режим; acceptance проверяет end-to-end без внешних secrets.

S401 — Seed demo-workspace: объекты + записи + списки + воркфлоу + звонки

Модуль: Demo seed / Onboarding / QA
Источник: каталог S401.
Роль: developer / QA / demo operator / новый пользователь.
Предусловия: пустая организация или test org; database доступна; bootstrap service включён.
UI/вход: Onboarding wizard → Create demo workspace; Admin dev endpoint; seed script.
Данные/модель: Organization, User, Object, Attribute, Record, Value, RelationshipValue, List, Workflow, Sequence, Call, Report, Dashboard, Notification.
API/логика: POST /api/bootstrap/demo-workspace создаёт полный набор demo entities идемпотентно. Seed должен быть повторяемым и не плодить дубли.
Шаги:

Пользователь или QA запускает demo bootstrap.

Система создаёт стандартные объекты: Companies, People, Deals, Workspaces, Users, Invoices.

Создаёт атрибуты и views.

Создаёт sample records и relationships.

Создаёт списки: Inbound Leads, Recruiting, Event Invitees, Customer Success, PQL.

Создаёт sequences и workflow templates.

Создаёт calls с transcript/summary.

Создаёт reports/dashboard.

Создаёт notifications/tasks/comments.

UI готов к прохождению всех acceptance scenarios.
Acceptance:

Seed создаёт реалистичный workspace за один action.

Seed идемпотентен: повторный запуск не создаёт дубли.

Данные покрывают table, kanban, record page, emails, calls, workflows, reports, billing demo.

Все relationships валидны.

Все demo users/teams/permissions создаются.

После seed можно пройти основные сценарии без ручного ввода.
Ошибки/edge cases: частично созданный seed; миграции БД не применены; schema изменилась; user уже имеет свои данные; seed должен не затирать production данные.
Демо-режим: seed — базовый способ наполнить demo workspace.

S402 — Миграция legacy Lead/Campaign → People/Companies/Sequences

Модуль: Legacy migration / Migrate CRM
Источник: каталог S402; финальная миграция legacy Lead/Campaign в новую flexible CRM.
Роль: Owner / Admin / developer migration operator.
Предусловия: legacy таблицы Lead, Campaign, Sequence, Message, CampaignLead содержат данные; flexible CRM bootstrap выполнен; target objects и sequences доступны.
UI/вход: Settings → Migrate CRM → Legacy AISDR migration; dev migration endpoint/CLI.
Данные/модель: legacy Lead, Campaign, CampaignLead, Sequence, Message; target Record, Value, RelationshipValue, List, Sequence, SequenceStep, Email, Activity, MigrationJob.
API/логика: migration service читает legacy данные, применяет mapping:

Lead → Person + Company;

Lead.status/source/score → attributes/list fields;

Campaign → Sequence или campaign list;

Sequence legacy steps → SequenceStep;

CampaignLead → Enrollment/ListEntry;

Message → Email/Activity history.
Шаги:

Admin открывает Migrate CRM.

Выбирает Legacy Lead/Campaign migration.

Система сканирует legacy records.

Показывает preview: leads count, campaigns count, messages count, conflicts.

Admin подтверждает mapping и dedupe rules.

Worker создаёт People по email.

Worker создаёт Companies по company/domain.

Worker связывает Person → Company.

Worker переносит campaigns в Sequences.

Worker переносит messages в timeline/emails.

Migration report показывает migrated/skipped/errored.

Старые legacy routes остаются read-only или скрываются.
Acceptance:

После миграции leads доступны в People/Companies.

Campaign sequences доступны в новом Sequences UI.

CampaignLead statuses сохраняются как enrollment/list status.

Messages сохраняются в Email/Activity timeline.

Dedupe по email/domain предотвращает дубли.

Migration можно безопасно повторить: already migrated items не дублируются.

Report содержит errors по каждой проблемной legacy entity.
Ошибки/edge cases: Lead без email; Lead без company/domain; несколько leads с одним email; Campaign без steps; Message без lead; archived legacy data; partial failure; rollback после ручных изменений.
Демо-режим: seeded legacy Lead/Campaign переносится в flexible CRM, чтобы показать переход старого AISDR слоя в Attio-like модель.

S403 — Onboarding-визард первого входа: bootstrap 5 объектов

Модуль: Onboarding / Bootstrap
Источник: каталог S403; связано с S005: bootstrap 5 стандартных объектов.
Роль: новый Owner / первый пользователь workspace.
Предусловия: пользователь зарегистрирован; org создана; bootstrap ещё не выполнен или выполнен частично.
UI/вход: первый login после register; /onboarding; dashboard empty state → Set up workspace.
Данные/модель: OnboardingState, Organization, User, Object, Attribute, View, List, BootstrapJob.
API/логика: GET /api/bootstrap/status, POST /api/bootstrap/default-crm, POST /api/bootstrap/demo-workspace, PATCH /api/onboarding/state. Bootstrap создаёт Companies, People, Deals, Workspaces, Users; опционально Invoices как custom/demo object.
Шаги:

Новый пользователь входит после регистрации.

Система проверяет bootstrap status.

Если CRM не создана — открывает onboarding wizard.

Wizard спрашивает workspace name, role/use-case, импортировать данные или использовать demo.

Пользователь выбирает Quick start.

Backend создаёт 5 стандартных objects.

Создаёт базовые attributes, select options, relationships, views.

Создаёт default sidebar navigation.

Опционально запускает demo seed.

Пользователь попадает на Companies или Home dashboard.
Acceptance:

Первый вход не показывает пустой сломанный dashboard.

Bootstrap создаёт Companies, People, Deals, Workspaces, Users.

Objects появляются в sidebar.

Companies/People/Deals открываются в table view.

Deals имеет stage options и board view.

Onboarding нельзя случайно выполнить дважды с дублями.

Пользователь может пропустить demo seed и получить чистую CRM.
Ошибки/edge cases: bootstrap частично упал; user refresh во время wizard; object key conflict; org уже имеет custom objects; seed выбран без demo mode; permissions не созданы.
Демо-режим: wizard предлагает “Use demo workspace” и создаёт полный seed из S401.

ИТОГ ДЕТАЛЬНОЙ СПЕКИ

Всего разобрано по всем батчам: 270 сценариев из каталога AISDR — все реально существующие Sxxx в диапазоне S001–S403.

Покрытые модули:

Objects

Attributes

Relationships

Records

Views

Lists

Record page

Email / productivity

AI-атрибуты

Ask Attio / AI assistant

Sequences

Workflows: triggers, logic, actions, AI, integrations, runs

Reports & Dashboards

Call Intelligence

Import / migration

Permissions / RBAC

Apps & Integrations

Settings / Workspace / Billing / Security / Developers

Email sync & Enrichment

Communication Intelligence

Notifications / Collaboration / Demo mode / Onboarding / Legacy migration

Подтверждение: пройдены все сценарии каталога S001–S403 без пропуска существующих Sxxx-номеров; диапазон содержит разреженную нумерацию, поэтому закрытие считается по 270 сценариям из SCENARIOS_CATALOG.md, а не по 403 последовательным числам.

[ГОТОВ БАТЧ: S386–S403]


---

S175 — Enroll to sequence из people-списка с применёнными фильтрами

Экран/меню:
Automations → Sequences → выбранная Sequence → Recipients → Enroll recipients;
или People/List page → сохранённый view / list view с применёнными фильтрами → bulk footer → Enroll in sequence;
или List page, например Inbound Leads, Event Invitees, Recruiting, PQL → Table view → Filter chips → bulk action Enroll in sequence.

Роль/доступ:
Пользователь должен иметь:

READ на people object или list, из которого выбирается аудитория;

READ_WRITE на sequence, чтобы добавлять recipients;

доступ к выбранному sender mailbox;

право отправлять sequence-письма от выбранного отправителя, включая delegated sending, если sender не текущий пользователь;

доступ к видимым полям people records, которые используются в merge variables sequence.

Admin/Owner может enroll от имени любого разрешённого mailbox при включённой политике delegated sending. Member может enroll только в те sequences и records, где есть соответствующие grants.

Предусловие:

Есть опубликованная sequence со статусом PUBLISHED или ACTIVE.

В sequence есть минимум один email step.

Настроены delivery settings: sending window, timezone, business days only, hourly/daily limits.

У sequence заданы exit criteria: reply received / meeting booked / manual exit.

Есть список или people-view с применёнными фильтрами, например:

Company ICP is ICP;

Primary location City is London;

Associated users > User Type is Admin;

Lead source is Event;

Status is Shortlisted.

У выбранных people есть email-адрес или fallback-правило для поиска primary email.

Suppression/unsubscribe списки доступны backend-у.

Outbox/sequence worker включён.

UI-элементы:

People/List table или board/list view.

View selector.

Filter chips.

Sort control.

Checkbox выбора строк.

Select all visible.

Select all matching filter.

Bulk action bar.

Кнопка Enroll in sequence.

Модалка Enroll recipients to sequence:

Sequence dropdown.

Sender dropdown.

Mailbox status indicator.

Delegated sending notice.

Audience source summary: selected rows / all filtered results.

Recipient preview table.

Validation summary.

Suppression/unsubscribe/duplicate counters.

Missing email counter.

Merge-variable readiness indicator.

Delivery estimate.

Outbox limit warning.

Кнопки Cancel, Preview recipients, Enroll recipients.

Preview table columns:

Person;

Email;

Company;

Source list/view;

Sequence status;

Eligibility;

Suppression reason;

Duplicate reason;

First scheduled send time.

Toast/result drawer after enrollment.

Шаги:

Пользователь открывает People object или конкретный list, например Event Invitees.

Применяет фильтры в view/list: стадия, компания, ICP, location, owner, custom/list attributes.

Выбирает строки вручную или нажимает Select all matching filter, чтобы выбрать весь отфильтрованный набор, а не только текущую страницу.

В bulk footer нажимает Enroll in sequence.

Система открывает модалку массового enrollment.

Пользователь выбирает sequence.

Пользователь выбирает sender mailbox:

текущий пользователь;

shared mailbox;

delegated sender, если разрешено.

Backend рассчитывает candidate set:

records из текущего list/view;

только matching filters;

с учётом search/sort не для membership, а только фильтров;

без записей вне текущей org.

Backend валидирует каждого кандидата:

есть primary email;

email не bounced;

recipient не unsubscribed;

recipient не suppressed;

recipient ещё не активен в этой sequence;

recipient не находится в другой mutually exclusive sequence, если включено ограничение;

user имеет доступ к record;

merge variables можно подставить или есть fallback.

UI показывает preview:

eligible;

skipped suppressed;

skipped unsubscribed;

skipped duplicates;

skipped missing email;

skipped no permission;

warnings по missing variables.

Пользователь подтверждает enrollment.

Backend создаёт enrollment batch.

Для каждого eligible person создаётся SequenceEnrollment.

Для первого email step создаётся outbox item / scheduled message с учётом:

sending window;

timezone;

12 писем/час на mailbox;

5 минут между письмами;

200 писем/день на mailbox;

business days only;

paused sequence/mailbox state.

Backend пишет activity на Person record и, если есть relationship, на Company record.

UI показывает результат:

enrolled count;

skipped count by reason;

first send time;

link to sequence recipients;

link to outbox.

Sequence worker дальше отправляет письма по расписанию и применяет exit criteria.

Данные(Prisma):
Минимальный набор моделей/сущностей для реализации:

Object

key = people;

source object для recipients.

Record

person records;

orgId;

objectId;

displayName;

archivedAt.

Attribute

email attribute;

name/company/owner/custom filter attributes.

Value

email values;

filterable values;

merge-variable values.

List

source list, если enrollment идёт из list page.

ListEntry

membership person record в list;

stage/position.

ListAttribute / ListEntryValue
Нужны, если фильтры применяются по list-specific полям.

View

saved table/list view;

source filters/sorts/columns.

ViewFilter

applied filters;

может быть stored view filter или runtime filter payload.

ViewSort

влияет на порядок preview, но не на eligibility.

Sequence

id;

orgId;

status;

name;

access;

deliverySettings;

exitCriteria;

senderPolicy.

SequenceStep

email steps;

delay/wait;

subject/body;

variables.

SequenceEnrollment

id;

orgId;

sequenceId;

personRecordId;

sourceType = VIEW | LIST | MANUAL_BULK;

sourceViewId;

sourceListId;

senderMailboxId;

status = ACTIVE | PAUSED | EXITED | SKIPPED | FAILED;

currentStepId;

enrolledById;

enrolledAt;

exitReason.

SequenceEnrollmentBatch

id;

sequenceId;

sourceType;

sourceFilterSnapshot;

selectedRecordIdsSnapshot;

createdById;

statsJson;

createdAt.

SequenceRecipientValidation

либо отдельная таблица, либо JSON в batch result;

recordId;

email;

eligible;

skipReason.

MailboxAccount

sender mailbox;

userId;

status;

dailyLimit;

hourlyLimit;

minDelayMinutes.

SuppressionEntry

global/workspace/email-level suppression;

reasons: unsubscribe, bounce, manual suppression, domain blocklist.

UnsubscribeEntry

sequence/global unsubscribe.

OutboxMessage

scheduled sequence emails;

sequenceEnrollmentId;

stepId;

senderMailboxId;

recipientEmail;

scheduledAt;

status = QUEUED | SCHEDULED | SENT | FAILED | CANCELED.

Email

sent message history.

Activity

SEQUENCE_ENROLLED;

SEQUENCE_SKIPPED;

SEQUENCE_EMAIL_SCHEDULED;

linked to person/company/deal if applicable.

PermissionGrant

доступ пользователя к source list/view/object и sequence.

API:

POST /api/sequences/:sequenceId/enroll/preview
Создаёт dry-run preview перед enrollment.

Request:
{
"sourceType": "LIST_VIEW",
"listId": "list_123",
"viewId": "view_123",
"selectionMode": "ALL_FILTERED",
"selectedRecordIds": [],
"runtimeFilters": [],
"senderMailboxId": "mailbox_123"
}

Response:
{
"sequenceId": "seq_123",
"sourceCount": 248,
"eligibleCount": 191,
"skippedCount": 57,
"skippedByReason": {
"MISSING_EMAIL": 11,
"UNSUBSCRIBED": 9,
"SUPPRESSED": 13,
"DUPLICATE_ACTIVE_ENROLLMENT": 18,
"NO_RECORD_ACCESS": 2,
"MAILBOX_NOT_ALLOWED": 4
},
"deliveryEstimate": {
"firstSendAt": "2026-06-12T09:00:00.000Z",
"lastFirstStepSendAt": "2026-06-13T16:45:00.000Z",
"hourlyLimit": 12,
"dailyLimit": 200,
"minDelayMinutes": 5
},
"recipients": [
{
"recordId": "rec_123",
"displayName": "Lisa Wong",
"email": "lisa@cosme.com
",
"eligible": true,
"warnings": [],
"skipReason": null,
"scheduledAt": "2026-06-12T09:00:00.000Z"
}
]
}

POST /api/sequences/:sequenceId/enroll
Подтверждает массовый enroll.

Request:
{
"sourceType": "LIST_VIEW",
"listId": "list_123",
"viewId": "view_123",
"selectionMode": "ALL_FILTERED",
"selectedRecordIds": [],
"runtimeFilters": [],
"senderMailboxId": "mailbox_123",
"skipSuppressed": true,
"skipUnsubscribed": true,
"skipDuplicates": true,
"respectOutboxLimits": true
}

Response:
{
"batchId": "batch_123",
"sequenceId": "seq_123",
"enrolledCount": 191,
"skippedCount": 57,
"outboxCreatedCount": 191,
"firstSendAt": "2026-06-12T09:00:00.000Z",
"status": "COMPLETED_WITH_SKIPS"
}

GET /api/sequences/:sequenceId/enrollment-batches/:batchId
Возвращает итог batch enrollment.

GET /api/sequences/:sequenceId/recipients?batchId=...
Показывает recipients после enroll.

GET /api/outbox?sequenceId=...&batchId=...
Показывает созданную очередь отправки.

Внутренние service-методы:

resolveFilteredPeopleSet(sourceType, listId, viewId, filters, selectionMode);

validateSequenceRecipient(recordId, sequenceId, senderMailboxId);

createSequenceEnrollmentBatch(...);

scheduleFirstSequenceStep(...);

applyMailboxDeliveryLimits(...).

Acceptance:

Bulk enroll доступен из People view и из List view.

При выборе Select all matching filter enroll применяется ко всему отфильтрованному набору, а не только к текущей странице таблицы.

Source filter snapshot сохраняется в SequenceEnrollmentBatch, чтобы batch был воспроизводим и аудируем.

Preview обязателен перед подтверждением массового enroll.

Suppressed recipients не enroll-ятся.

Unsubscribed recipients не enroll-ятся.

Recipients без email не enroll-ятся.

Recipients с active enrollment в той же sequence не дублируются.

Если recipient ранее завершил sequence, поведение управляется policy:

default: skip;

optional: allow re-enroll after manual confirmation.

Sender mailbox выбирается явно.

Если sender mailbox disconnected / needs reauth / over limit, enrollment блокируется или создаётся paused enrollment без outbox — согласно policy.

Outbox создаётся с учётом delivery limits:

не больше 12 писем/час на mailbox;

минимум 5 минут между письмами;

не больше 200 писем/день на mailbox;

только business days, если включено;

только sending window.

Merge variables проверяются до enroll.

Missing non-critical variables показываются warning.

Missing critical variables блокируют конкретного recipient.

После enroll на Person record появляется activity Sequence enrolled.

Если Person связан с Company, activity summary компании обновляется.

UI показывает итог: enrolled, skipped by reason, scheduled first send window.

Пользователь может перейти в Sequence → Recipients и Outbox.

Backend проверяет права независимо от UI.

Повторный запрос enroll с тем же idempotency key не создаёт дубли.

Edge-cases:

Фильтр изменился между preview и confirm: backend должен использовать snapshot preview или потребовать refresh preview.

Записи удалены/архивированы между preview и confirm: такие recipients skipped с reason RECORD_ARCHIVED.

Email изменился между preview и confirm: backend повторно валидирует email.

Recipient попал в suppression list между preview и confirm: skipped.

Recipient отписался после enroll, но до отправки первого письма: enrollment exited, outbox item canceled.

Sender mailbox потерял OAuth refresh token после enroll: outbox items paused с reason MAILBOX_NEEDS_REAUTH.

Sender daily limit исчерпан другими sequences: scheduledAt сдвигается на следующий доступный слот.

Несколько пользователей одновременно enroll-ят один и тот же filtered set в одну sequence: unique constraint предотвращает duplicate active enrollment.

Один recipient выбран дважды через list и manual selected rows: dedupe по sequenceId + personRecordId + active status.

У recipient несколько email-адресов: используется primary email; если нет primary — UI требует выбор strategy.

Suppression по домену блокирует весь домен, даже если конкретный email не в unsubscribe.

Sequence в статусе Draft: enroll запрещён, доступен только preview.

Sequence paused: enrollment создаётся paused или запрещается — policy должна быть явной; default: разрешить enrollment, но не создавать active outbox до resume.

Пользователь имеет доступ к list, но не имеет доступа к некоторым people records из-за object permissions: такие rows skipped NO_RECORD_ACCESS.

Пользователь имеет доступ к sequence, но не к sender mailbox: confirm заблокирован.

Delegated sender отключил delegated sending после preview: confirm повторно проверяет mailbox permission.

List содержит non-people records: action скрыт или backend возвращает INVALID_SOURCE_OBJECT.

View содержит relationship-фильтр по Company/ICP, а часть relationship records недоступна пользователю: фильтр применяется backend-ом с permission-safe semantics.

Большой filtered set: backend создаёт batch job и возвращает async status вместо синхронного enroll.

Worker упал после части enrollments: batch status PARTIAL_FAILED, повтор запуска идемпотентно продолжает незавершённые rows.
