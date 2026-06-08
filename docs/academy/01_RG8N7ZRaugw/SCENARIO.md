# Реверс-инжиниринг — Видео 01: «Manage team access and permissions» (5:40)

Источник: транскрипт (звук, дословно) + разбор кадров (2/сек). Спикер — Marisa.
Тема: фреймворк прав доступа Attio. Для нашего ТЗ — модуль Settings → Permissions (RBAC).

## Экраны (по кадрам)
**f_00370 — Settings → Objects → Deals → вкладка Permissions** (ключевой экран):
- Слева сайдбар настроек: **Personal** (Profile, Appearance, Email and calendar accounts, Call intelligence, Storage accounts, Refer and earn, Notifications); **Workspace** (General, Members and teams, Call recorder, Plans, Billing, Developers, Support requests, Migrate CRM, Apps, Security, Email…, Expert access groups, **Objects**, **Lists**, Import history, **Dashboards**, **Sequences**, **Workflows**).
- Шапка объекта: иконка + **Deals** + бейдж **Standard** + «Manage object attributes and other relevant settings».
- Вкладки объекта: **Configuration · Permissions · Appearance · Attributes(31) · Templates · +2 more**.
- Секция **Members**: строка «Workspace access — Set default access for all workspace members» → дропдаун уровня (**Read only**).
- Секция **Teams** («Overrides workspace access») + кнопка **Add**: строки команд **Sales - EU (2)**, **Sales - US (4)**, **Sales - UK (3)**, у каждой дропдаун уровня.
- Секция **Individual members** («Overrides team and workspace access») + **Add**: **Fred Amstutz (fred@attio.com)** → Read only.
- Секция **Automations** («Set access rules for automations») + **Add**: воркфлоу **«Add Customer Success Record on Deal Stage Change»** → Read and write.

**f_00490 — список Recruiting в виде kanban** (Candidate Pipeline): колонки **Outreach · New(7) · Screening(8) · Interviewing(6) · Offered(2) · Hired(4) · Rejected**; карточки кандидатов (имя, тег роли — Account Executive/Manager/Product Designer, источник — Open Application/External Referral/Employee Referral, статус — Applied/Scouted, иконки задач, дни). Подтверждает: Lists поддерживают kanban-группировку по stage.

**f_00110 — список Onboarding Pipeline (table)**: колонки Workspace · Company · Owner · Onboarding Status (New/Session offered/Session booked/Onboarding complete) · Plan (Enterprise/Pro/Plus) · Onboarding Package · Parent Record > ARR. Сайдбар содержит раздел **Chats** (Draft follow up email, Create follow-up task…) — AI-ассистент Ask Attio.

## Модель прав (из звука — дословная механика)
**Роли:** **Admin** (управляет настройками workspace: объекты, инвайты, доступы, биллинг; видит/правит все dashboards/workflows/sequences) и **Member** (нет доступа к настройкам workspace; не управляет доступами/инвайтами; видит/правит только то, что выдали; по умолчанию НЕ может создавать/править объекты).

**4 уровня доступа** (на сущность):
1. **No access** — не видит сущность (список/воркфлоу).
2. **Read only** — видит, не меняет (для стейкхолдеров).
3. **Read and write** — видит и правит данные, но не структуру и не права (типично для sales/GTM).
4. **Full access** — полное управление сущностью: создавать/править атрибуты, настройки, права (admin-уровень на конкретную сущность, БЕЗ доступа к биллингу/безопасности).

**3 области применения (иерархия, более точная перекрывает широкую):**
- **Workspace** — дефолт для всех.
- **Team** — для групп (Sales, RevOps), перекрывает workspace.
- **Individual** — исключения на пользователя, перекрывает team и workspace.

**Где задаются права (одинаково для всех сущностей):**
- **Objects** (people/companies/deals): object settings → Permissions → Workspace/Teams/Individual (уровни read only / read+write / full access). Пример: Deals = workspace read only + Sales team read+write + контрактор (individual) read+write.
- **Automations в правах объекта**: воркфлоу должен иметь явное разрешение действовать на записи (update attributes/create tasks). При создании воркфлоу без нужных прав — показывается prompt с предложением выдать разрешение (если у тебя есть права).
- **Lists**: list settings → workspace=no access + individual (head of talent)=full access (пример скрытого recruitment-списка).
- **Dashboards**: права на уровне дашборда применяются ко всем отчётам внутри; пример workspace=read only + RevOps=read+write. Новый дашборд по умолчанию виден только создателю (остальные no access).
- **Workflows**: права «кто видит/правит шаги и блоки» (отдельно от прав воркфлоу действовать на объекты); пример workspace=read only + Cassandra=read+write.
- **Sequences**: те же права.

## Требования для нашего ТЗ (что строить)
- Роли **Admin/Member** на уровне Organization (membership).
- Сущности с правами: Object, List, Dashboard, Workflow, Sequence (+ Automations-грант для воркфлоу на объект).
- **4 уровня** (NO_ACCESS, READ, READ_WRITE, FULL) × **3 области** (workspace/team/individual) с приоритетом individual > team > workspace.
- Модель данных: Team (группа юзеров), PermissionGrant {entityType, entityId, scope: workspace|team|individual, subjectId(team/user)|null, level}. Резолвер эффективного уровня.
- UI: object/list/dashboard/workflow settings → вкладка **Permissions** с секциями Members(Workspace access)/Teams/Individual members/Automations + дропдаун уровня + Add.
- Settings-сайдбар как на f_00370 (Personal + Workspace разделы).
- Prompt при нехватке прав у воркфлоу.

## Сценарии (acceptance)
1. Admin заходит Settings → Objects → Deals → Permissions, ставит Workspace=Read only, добавляет Team Sales=Read+write, Individual=Read+write → эффективный уровень для члена Sales = read+write, для прочих = read only.
2. List recruitment: Workspace=No access + Individual(head of talent)=Full access → список скрыт у всех, кроме одного.
3. Новый dashboard виден только создателю по умолчанию.
4. Воркфлоу без прав на объект при сохранении показывает prompt «выдать разрешение».
