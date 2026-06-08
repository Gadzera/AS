# Эталон (видео Attio «Platform Demo») — наблюдения по экранам

Воркспейс «Basepoint». Светлая тема, плотные таблицы, быстро, ⌘K. Логотип/бренд можно свой.

## Глобальная навигация (левый сайдбар)
- Верх: переключатель воркспейса; Quick actions (⌘K), Поиск.
- Блок: Notifications, Tasks, Notes, Emails, Calls, Reports, Automations.
- Favorites.
- **Records** (объекты): Companies, People, Deals, Users, Workspaces, Invoices.
- **Lists**: Inbound Leads, Recruiting, Customer Success, Onboarding Pipeline, PQL, Event Invitees, All lists.

## Объекты и атрибуты (гибкая модель данных)
- У объекта набор атрибутов разных типов: text, number, select/multi-select (цветные теги), relationship (связь с другим объектом, двусторонняя), date, currency (Estimated ARR, Deal value), location (City/State/Country), social links (LinkedIn/Facebook/Twitter/AngelList), enrichment-фирмографика (Domains, Categories, Employee range, Funding raised, Foundation date, Twitter followers, Connection strength, First/Last/Next interaction, Strongest connection, Associated deals/workspaces).
- «View settings → Add column» открывает список атрибутов + «Create new attribute».
- «Create attribute»: выбор типа (напр. Relationship) и конфигурация связи между объектами (двусторонняя).

## Виды (Views)
- На каждый объект — несколько сохранённых видов; дропдаун-переключатель (напр. у Deals: «Deals overview», «All Deals», «Cassandra's Pipeline», «Enterprise Deal Board», «New inbound leads», «Marisa: inbound leads», «Create new view»).
- Тип вида: **Table** и **Board/Kanban** (группировка по select-атрибуту-стадии).
- У вида свои: фильтры (мультиусловные: «Deal owner is Marisa», «Deal type is Inbound», «Deal stage is Lead», и т.п.), сортировка («Sorted by Connection strength / Created at»), набор и порядок колонок, пустое состояние «No Deals match that filter → Clear Filter».
- Футер колонок: «Add calculation» (сумма/счёт/среднее по колонке), общий счётчик записей («804 count»).
- Import / Export, кнопка «+ New <Object>».

## Deals (пример пайплайна)
- Kanban по стадиям: No stage, Lead, Contacted, Prospecting, Qualification, Meeting, Proposal (+счётчики в колонках). Карточка: компания, Deal value (валюта), associated people (аватары), задачи/иконки, возраст.
- Table: Deal value, Associated company, Deal stage, Deal owner.

## Record-страница (детальная)
- Хедер: иконка+имя, хлебные крошки (Companies / Cosme), «Compose email».
- Вкладки: Activity, Emails, Calls, Comments (счётчики). Лента писем; просмотр письма (View email) + «Compose email».
- Правая панель «Details»: все атрибуты, Firmographics, Location (City/State/Country), Social/Media Links (Set LinkedIn/Facebook/Twitter/AngelList), блок Lists (членство записи в списках, «Add to list»).

## People + булк-операции
- Объект People: Person, Email addresses, Company (связь), LinkedIn. Виды/фильтры («Associated users > User Type is Admin», «Primary location City is London», «Company ICP is ICP»).
- Множественный выбор строк → нижняя панель: **Add to list, Send email, Run workflow, Enroll in sequence, More**. Тосты («Checking for duplicate entries»).

## Списки (Lists) как канбан
- Напр. «Event Invitees»: колонки No stage / Shortlisted / Invited (23) / Accepted (2) / Declined (1). У записи в списке — атрибуты списка (напр. Dietary requirements). Карточки людей.

## Sequences (последовательности писем)
- Редактор последовательности (вкладки Editor / Recipients). Шаги: «Wait 5 business days», «Step N Automated email» (Subject, тело с merge-тегами {Name>First}), «Add step to sequence».
- Правая панель: Delivery (Sending window 09:00–17:00, таймзона, Business days only), Email (Unsubscribe link, Thread emails, Include sender signature), Exit criteria (Reply received). Кнопки «Enable sequence», «Enroll recipients».

## Automations → Workflows (визуальный билдер)
- Холст с нодами: Trigger («Record added to list» = Event Invitees) → «Enroll in sequence» → «Update list entry». Правая панель конфигурации шага (Inputs, Next step). Тумблер «Live». Вкладки Editor / Runs / Settings. Подменю слева: Sequences, Workflows.

## Reports / Dashboards
- «What do you want to report on?»: Insight, Historical values; Pipeline reports: Funnel, Time in stage, Stage changed.
- Дашборд «Revenue Dashboard»: funnel, «Monthly inbound leads by owner» (stacked bar), «Pipeline stage changed» (bar), Workspaces created (line), Workspaces by plan (pie), Cancellation reasons (bar), First Contract Start Date (line), Total paid invoices YTD (bar). Шеринг, «New report».

## Прочее
- Tasks, Notes, Calls, Emails как отдельные разделы. Notifications. Quick actions ⌘K (командная палитра).

## ДОПОЛНЕНИЕ (полный проход 45 уникальных кадров)

### AI-функции (ключевое для нас)
- **AI autofill атрибута**: при создании атрибута (тип Text и др.) есть «Set up AI autofill» — значение заполняет ИИ по описанию/контексту записи.
- **AI в Workflows**: среди воркфлоу — «Research Agent for New …», «Classify and Summarise Record», «Prompt completion». То есть шаги-агенты: исследование записи, классификация, суммаризация, произвольный prompt → запись результата в атрибут.
- **Calls с AI-резюме**: на вкладке Calls запись звонка с авто-summary разговора (длительность, участники, краткое содержание).

### Settings (полноценный раздел настроек)
- Account: Profile, Appearance, Email and calendar accounts, Storage accounts, Refer, Notifications, Call recording.
- Workspace: General, Members, Plans, Billing, Developers (API-ключи), Security, Email and calendar, Support, **Migrate CRM**, Apps.
- Data: **Objects** (список объектов Standard/Custom + «Create custom object»), Lists, **Import History**.
- Reports: Dashboards. Automations: Sequences, Workflows.

### Workflows (визуальный билдер) — триггеры и шаги
- Триггеры: Record command/created/updated; List entry command/updated; Record added to list; Attribute updated; Task created; **Manually run**; **Recurring schedule**; **Webhook received**.
- Шаги (из примеров воркфлоу): Enroll in sequence, Update list entry, Condition/Switch, **Send HTTP request**, Prompt completion (AI), Classify and Summarise (AI), Create deal from company, Add team members, Notify team. Тумблер Live, «Publish workflow», вкладка Runs (история запусков, кол-во Runs). Список воркфлоу со статусами Live/Paused, Runs, Created by, Last published. Шаблоны воркфлоу.

### Record-страница — полный набор вкладок
Activity, Emails, Calls, Team, Associated deals, Notes, Tasks, Comments, Files. Правая панель: Record Details, Enriched Firmographics, Location, Social Media Links, Lists (членство + Add to list). Кнопка Compose email (с шаблонами, «Send individually»).

### People — трекинг взаимодействий
Колонки: Connection strength, Last email interaction, Last calendar interaction (синхронизация с почтой/календарём). Виды: Recently Contacted People, London locals, Admin users.

### Invoices (объект со статусом)
Поля: Invoice №, Status (Paid/Sent — цветной dot), Company, Billing Admin, Workspace, Due Date, Amount (валюта).

### Reports/Dashboards
Список дашбордов (Revenue Dashboard, Sales Overview, Business Metrics, Sales - Pipeline Reports, Companies by Country). На дашборде — много отчётов. Типы визуализаций: funnel с конверсией по стадиям (100%→Won %), pie (Employee ranges, plan distribution), bar/stacked bar, line, **гео-карта** (Locations in active pipeline), числовые. «New dashboard», «New report», шеринг.

### Шаблоны
Галерея шаблонов по категориям (Sales, Investing, Recruiting, Marketing, Customer Success, Fundraising, Finance, HR, Operations, PR, Startups, Venture Capital, Content): напр. Employee onboarding, Outsourcing, Press outreach, Recruiting. «Start from Scratch», «Preview template».
