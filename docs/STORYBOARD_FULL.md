# Сториборд эталона (Attio) — покадровый разбор

Полный проход по плотной нарезке видео (2 кадра/сек → уникальные состояния). GPT описывает каждый кадр по приложённым изображениям.


## Кадры 1-12

**Кадр 1:** Intro-слайд Attio; состояние — старт демо. Видимые элементы: текст **Intros**, заголовок **Platform Demo**, логотип **attio**, декоративная схема из 3 слоёв; кнопок/полей нет.

**Кадр 2:** Переходный тёмный экран; состояние — пауза/фейд между intro и продуктом. Видимых кнопок, меню, полей и интерактивных элементов нет.

**Кадр 3:** Intro-тезис; состояние — слайд ценностного сообщения. Видимый текст: **Quick to setup.**, **Easily adapt to you.**; кнопок/меню/полей нет. Новый элемент: продуктовый тезис перед показом интерфейса.

**Кадр 4:** Переход в интерфейс Companies; состояние — верх экрана перекрыт тёмным transition-overlay, снизу частично видна таблица компаний и видео-оверлей спикера. Видимые элементы: часть левого сайдбара со списками **Customer Success**, **Onboarding Pipe…**, **PQL**, **All lists**; часть строк таблицы с тегами категорий, LinkedIn-ссылками, ARR и локациями; новых рабочих контролов пока нет.

**Кадр 5:** Экран **Companies / All Companies**; состояние — табличный вид компаний открыт. Видимые кнопки/контролы: workspace **Basepoint** dropdown, иконка сворачивания сайдбара, **Quick actions**, поиск, **Notifications**, **Tasks**, **Notes**, **Emails**, **Calls**, **Reports**, **Automations**, разделы **Favorites**, **Records**, **Lists**, объекты **Companies**, **People**, **Deals**, **Users**, **Workspaces**, **Invoices**, списки **Inbound Leads**, **Recruiting**, **Event Invitees**, **Customer Success**, **Onboarding Pipe…**, **PQL**, **All lists**; сверху **Companies**, view dropdown **All Companies**, **View settings**, чипы **Sorted by Connection strength**, **Filter**, справа **Import / Export** dropdown, синяя кнопка **+ New Company**, аватар/иконки аккаунта. Поля/колонки: **Company**, **Domains**, **Categories**, **Description**, **LinkedIn**, **Employee range**, **Estimated ARR**, **Primary lo…**, иконки сортировки/настроек в заголовках, **+** добавления колонки, снизу **804 count** и **+ Add calculation** под колонками.

**Кадр 6:** Тот же экран **Companies / All Companies**; состояние — таблица стабильно открыта без оверлея перехода. Контролы и поля как в кадре 5: **All Companies**, **View settings**, **Sorted by Connection strength**, **Filter**, **Import / Export**, **+ New Company**, сайдбар Records/Lists, колонки **Company / Domains / Categories / Description / LinkedIn / Employee range / Estimated ARR / Primary location**. Новых элементов нет.

**Кадр 7:** Таблица Companies; состояние — ховер по иконке/индикатору custom attribute в районе заголовка **Description**. Все базовые контролы как в кадре 5; новый элемент — чёрный tooltip с пояснением, что это custom attribute и Attio автоматически обогащает компании данными из внешних источников вроде Clearbit/Crunchbase/LinkedIn.

**Кадр 8:** Таблица Companies; состояние — tooltip закрыт, курсор в верхней зоне таблицы. Видимые контролы остаются: **All Companies**, **View settings**, **Sorted by Connection strength**, **Filter**, **Import / Export**, **+ New Company**, сайдбар, колонки таблицы, **+ Add calculation**. Новых элементов нет; это возврат к обычному табличному состоянию.

**Кадр 9:** Таблица Companies с открытой модалкой **Create attribute**; состояние — создание нового атрибута поверх таблицы. Новые элементы модалки: заголовок **Create attribute**, крестик закрытия, dropdown **Attribute Type** со значением **Text**, поле **Name**, поле **Description (optional)** с подсказкой добавления описания, секция **Set as title field**, опция **AI autofill**, кнопки **Cancel** и синяя **Create attribute**; фоновые контролы таблицы остаются видимы, но неактивны.

**Кадр 10:** Модалка **Create attribute**; состояние — открыт dropdown **Attribute Type**. Новые видимые пункты меню типов: AI-варианты **Classify record**, **Summarize record**, **Research agent**, **Recent companies**; базовые типы **Text**, **Number**, **Checkbox**, **Date**, **Rating**, **Timestamp**, **Status**, **Multi-select**, **Currency**, **Record**, **User**, **Select**, **Relationship**, **Location**, **Phone Number**; справа виден скролл dropdown. Кнопки модалки остаются **Cancel** и **Create attribute**.

**Кадр 11:** Модалка **Create attribute** после выбора типа **Select**; состояние — dropdown закрыт, форма перестроена под select-атрибут. Видимые поля/контролы: **Attribute Type: Select**, поле **Name**, **Description (optional)**, секция **Options** со значением **No Options**, секция **Set up AI autofill** с пунктом **AI autofill**, кнопки **Cancel** и **Create attribute**, крестик закрытия. Новый элемент относительно кадра 9 — блок **Options / No Options** для select.

**Кадр 12:** Модалка **Create attribute** с заполнением имени; состояние — в поле **Name** введено **Segment**, раскрыта/прокручена AI-настройка. Видимые элементы: **Attribute Type: Select**, **Name: Segment**, **Description (optional)**, **Options: No Options**, **Set up AI autofill**, пункт **AI autofill**, новый блок **Autofill type** с выбранным **Classify record**, ниже поля/настройки для инструкции/описания классификации, внутренний скролл модалки, кнопки **Cancel** и **Create attribute**. Новый элемент — расширенная конфигурация AI autofill для автоматической классификации записи.


## Кадры 13-24

**Кадр 1:** Companies → вид **All Companies**; табличный список компаний, горизонтальная прокрутка в левой части таблицы. Видимы: **View settings**, **Import / Export**, **New Company**, колонки **Company, Domains, Categories, Description, LinkedIn, Employee range, Estimated ARR, Primary location**; слева навигация **Quick actions, Inbox, Tasks, Emails, Calls, Reports, Automations**, объекты **Companies/People/Deals/Users/Workspaces/Invoices**, workspace-списки.

**Кадр 2:** Companies → тот же вид после горизонтальной прокрутки вправо. Видимы колонки **Company, type range, Estimated ARR, Primary location, Country, Team, Segment, Attachment**, справа пустая область под дальнейшие колонки; сверху остаются **View settings**, **Import / Export**, **New Company**.

**Кадр 3:** Companies → открыт выпадающий список добавления/настройки колонок. НОВОЕ: меню атрибутов с пунктами **Business model, Record ID, Domains, Name, Description, Team, Categories, Primary location, Facebook, Instagram, LinkedIn, Twitter, Twitter follower count, Create new attribute**.

**Кадр 4:** Companies → открыта модалка **Create attribute** поверх таблицы. НОВОЕ: поля **Attribute Type = Text**, **Name** с активным инпутом, секция **Generated formula / AI autofill**, переключатель/опция **AI autofill**, кнопки **Cancel** и **Create attribute**, крестик закрытия.

**Кадр 5:** В модалке **Create attribute** открыт dropdown **Attribute Type**. НОВОЕ: список типов атрибутов, включая AI-типы **Company research, Summarize record, Research agent**, базовые типы **Text, Number, Checkbox, Date, Rating, Timestamp, Status, Multi-select, Currency, Record, User, Email, Domain, Location, Phone number**.

**Кадр 6:** В модалке выбран тип **Relationship**. НОВОЕ: текст-подсказка про связь записей и ссылка **Learn more about attributes**, блок настройки relationship: объект-источник **Companies**, поля имени связи, выбор связанного объекта/стороны связи, кнопки **Cancel** и **Create attribute**.

**Кадр 7:** Модалка **Create attribute → Relationship**; открыт dropdown кардинальности связи и tooltip. НОВОЕ: варианты **One to many, One to one, Many to one, Many to many**; справа чёрная подсказка с примерами **User Manager**, **Lead A/B/C** и объяснением выбранного типа связи.

**Кадр 8:** Модалка relationship заполнена. НОВОЕ: выбран связанный объект **People**, кардинальность **One to one**, поле обратной связи с названием **Company**; видимы поля обеих сторон связи **Companies ↔ People**, кнопки **Cancel** и активная **Create attribute**.

**Кадр 9:** Возврат в таблицу Companies после создания атрибута. НОВОЕ: справа появилась новая колонка **POC**; таблица остаётся в правой прокрутке с колонками **Estimated ARR, Country, Team, Segment, POC**, сверху **View settings**, **Import / Export**, **New Company**.

**Кадр 10:** Companies → снова открыт dropdown добавления колонок/атрибутов. Видимы пункты **Business model, Record ID, Domains, Name, Description, Team, Categories, Primary location, Facebook, Instagram, LinkedIn, Twitter, Twitter follower count, Create new attribute**; НОВОЕ состояние — меню открыто уже после появления колонки **POC**.

**Кадр 11:** Переход в **Settings → Objects**. НОВОЕ: экран настроек с левым меню **Profile, Appearance, Email and calendar accounts, Storage accounts, Invite another team, Notification, Call recording, General, Members, Plans, Billing, Developers, Security, Email and calendar, Support requests, Migrate CRM, Apps, Objects, Lists, Import history, Dashboards, Sequences, Workflows**; в центре таблица **Objects**, поиск, кнопка **Create custom object**, колонки **Name, Type, Records**, строки **Companies, Deals, Invoices, People, Users, Workspaces**.

**Кадр 12:** Переход в объект **Deals**, сохранённый вид **Marius inbound leads**; пустой результат фильтра. Видимы **View settings**, **Import / Export**, **New Deal**, табы/фильтры вида **Journey Created, Deal created, Marius Mc…, Deal type, Open, Deal Name, All**, колонки **Deal, ICP, Typeform: What would you like to talk about?, Categories, Funding raised, Employees, Co…, Priority, Deal st…, Add column**; в центре пустое состояние **No Deals match that filter** и кнопка **Clear filter**.


## Кадры 25-39

**Кадр 1:** Deals → kanban-view «Deals overview»; пустая доска по стадиям. Видны: View settings, Filter, Created at, меню вида, Import / Export, синяя кнопка + New Deal; колонки No stage, Lead, Contacted, Prospecting, Qualification, Meeting, Proposal; снизу в колонках — + Add record. Слева навигация: Quick actions, Mailboxes, Tasks, Notes, Emails, Calls, Reports, Automations, Companies, People, Deals, Users, Workspaces, Invoices, списки Inbound Leads/Recruiting/Event Invites/Customer Success/Onboarding/POC.

**Кадр 2:** тот же kanban; появились карточки сделок в Contacted, частично в других колонках. НОВОЕ: карточки с названиями компаний/сделок, суммами, владельцами/иконками активности, строками быстрых действий внутри карточек; колонки остаются No stage, Lead, Contacted, Prospecting, Qualification, Meeting, Proposal.

**Кадр 3:** kanban «Deals overview» заполнен сильнее; добавлены карточки в Lead и Qualification. НОВОЕ: в Lead видны карточки с value и owner; в Qualification — несколько Enterprise Deal-* карточек; stage-колонки показывают реальные записи, внизу каждой колонки остаётся + Add record.

**Кадр 4:** переключение в табличный view «All Deals». Видны: View settings, Filter, Created at, Import / Export, + New Deal; таблица с колонками Title, Created at, Deal value, Associated company, Deal stage, Deal owner, Add column; строки сделок с company, суммами, стадиями Lead/Contacted/Qualification/Negotiation/Won и владельцами.

**Кадр 5:** в «All Deals» открыт дропдаун/меню настройки колонок из области заголовков. НОВОЕ: всплывающее меню со списком полей/колонок: Record ID, Deal name, Deal stage, List Entries, Deal owner, Deal value, Associated people, Associated company, Created at, Created by, Projected Close Date, Deal Confidence; справа у пунктов — иконки/чекбоксы видимости.

**Кадр 6:** таблица «All Deals» после изменения набора колонок; меню закрыто. Видны: Filter, Created at, View settings, Import / Export, + New Deal; колонки теперь компактнее: Title, Deal value, Associated company, Deal stage, Deal owner, Add column. НОВОЕ: колонка Created at скрыта/смещена, таблица перестроена.

**Кадр 7:** переход в saved view «Maria’s inbound leads»; состояние загрузки. Видны: View settings, Filter, Created at, вкладки/пилюли фильтров Deal name, Maria McCall, Deal type, Inbound, Deal stage, Lead; колонки Title, ICP, Typeform — “What would you like to talk about?”, Categories, Funding raised, Employee…, Co…, Priority, Deal st…, Add column. В центре — Loading.

**Кадр 8:** открыт модальный экран настройки/обогащения поля ICP для «Maria’s inbound leads». НОВОЕ: модалка с полем Name: ICP, секцией Suggested values, включателем AI autofill, блоком Research prompt с инструкцией ICP, кнопками Cancel и синей Start enrichment; фон — таблица inbound leads.

**Кадр 9:** модалка закрыта; строка Curio заполнена AI-данными. Видны колонки Title, ICP, Typeform answer, Categories, Funding raised, Employees, Country, Priority, Deal stage, Add column. НОВОЕ: значения ICP, теги Categories, Funding raised US$10,000,000.00, Employees High, Country Portugal, Deal stage Lead.

**Кадр 10:** выбрана строка Curio; строка подсвечена. НОВОЕ: чекбокс строки активен, внизу появилась bulk-панель действий: Add to list, Send email, Run workflow, More, закрытие X; сверху сохраняются View settings, фильтры, Import / Export, + New Deal.

**Кадр 11:** из bulk-панели открыт поповер Add to list/выбора списка. НОВОЕ: центральный dropdown с поисковой строкой и пунктами Associated people, Associated company, Workspace; строка Curio остаётся выделенной, снизу bulk-панель Add to list / Send email / Run workflow / More.

**Кадр 12:** открыт modal «Compose email» поверх затемнённой таблицы. НОВОЕ: поля From, To/recipient справа Lisa Cohen, Subject, тело письма; опции View all templates, Create new template; нижняя панель с иконками, toggle Send emails individually и синяя кнопка Send email.

**Кадр 13:** в Compose email сгенерирован/вставлен текст письма. НОВОЕ: заполненные subject/body с персонализированным outreach-текстом, справа recipient Lisa Cohen, снизу активная синяя кнопка Send email; поверх модалки видна строка toolbar/вариантов генерации, фон остаётся затемнённым.

**Кадр 14:** модалка закрыта после отправки; таблица снова активна, строка Curio выделена. НОВОЕ: в правом нижнем углу toast/status «Sending email…»; bulk-панель снизу всё ещё видна: Add to list, Send email, Run workflow, More.

**Кадр 15:** отправка/обновление завершены; строка Curio в «Maria’s inbound leads» обновлена. НОВОЕ: в колонке Priority появился тег High Priority, Deal stage изменён на Contacted; bulk-панель и toast исчезли, видны стандартные controls View settings, фильтры, Import / Export, + New Deal и Add column.


## Кадры 40-54

**Кадр 1:** Companies → All Companies, табличный список компаний; обычное состояние. Видимы: левый сайдбар Basepoint, Quick actions, Mailboxes, Tasks, Notes, Emails, Calls, Reports, Automations, объекты Companies/People/Deals/Users/Workspaces/Invoices, списки Inbound Leads/Recruiting/Event Invitees/Customer Success/Onboarding Pipeline; сверху All Companies, View settings, Import / Export, New Company; таблица: Company, Domain, Categories, Description, LinkedIn, Employee range, Estimated ARR, Primary location. НОВОЕ: базовый экран Companies с кастомными тегами категорий и financial columns.

**Кадр 2:** Companies → All Companies; поверх таблицы открыт record picker/поисковая модалка выбора записи. Видимы: список результатов с аватарами/иконками и типами Person/Company, правая preview-панель выбранной записи Ruth Cockcroft, нижние кнопки Actions и Open record. НОВОЕ: всплывающее окно поиска/выбора связанных записей с preview и действием открытия записи.

**Кадр 3:** Record page компании Cosme; открыта вкладка Activity. Видимы: breadcrumb Companies / Cosme, вкладки Activity, Emails, Calls, Team, Associated deals, Notes, Tasks, Files; кнопка Add meeting; справа панель Details / Comments с полями Record Owner, People/relationships, Description, теги, Enhanced Firmographics, Employee range, Estimated ARR, Funding raised, Location, Social Media Links, Lists; сверху Sync/Chrome email и иконки действий. НОВОЕ: карточка записи компании с activity timeline и правой detail-панелью.

**Кадр 4:** Record page Cosme; выбрана вкладка Emails. Видимы: список писем Attio / Cosme - Booking an introduction и Next Steps with Basepoint, кнопки More и Manage access, те же вкладки записи, правая панель Details с firmographics/location/social links. НОВОЕ: email timeline внутри record page.

**Кадр 5:** Record page Cosme → Emails; открыта модалка View email. Видимы: заголовок View email, subject Attio / Cosme - Booking an introduction, отправитель Marina McOil, тело письма с bullet list, ссылка, подпись, кнопка Share, закрытие модалки; фон — список Emails и правая Details-панель. НОВОЕ: просмотр полного письма в модальном окне без ухода со страницы записи.

**Кадр 6:** Record page Cosme → Emails; модалка закрыта, курсор/фокус в правой зоне Details / Comments. Видимы: письма, More, Manage access, вкладки записи, Details-панель с теми же полями. НОВОЕ: возврат из просмотра письма к списку, состояние без модалки.

**Кадр 7:** Record page Cosme; выбрана вкладка Associated deals, справа открыта вкладка Comments. Видимы: Associated deals, связанная запись Cosme, кнопка Add Deal, переключатели/действия New, Board Mode, Full screen, закрытие; справа All comments и поле Add comment с кнопкой Comment. НОВОЕ: таб связанных сделок и боковая панель комментариев.

**Кадр 8:** Associated deals + Comments; в поле комментария введён @-mention, открыт autocomplete. Видимы: поле ввода комментария, синяя кнопка Comment, dropdown с предложениями людей/записей: Fred Armstr…, Fiona Mayfield, Anton Lee, Chloe Hausmann, Ruth Cockcroft, Marina McOil, email-результаты, Lina Cosme, Current; у строк аватары и иконки типа объекта. НОВОЕ: упоминания через @ с поиском по людям и компаниям.

**Кадр 9:** Associated deals + Comments; mention выбран и вставлен в комментарий как синяя ссылка/chip, рядом набран текст “can you jump on cc”. Видимы: кнопка Comment активна, поле комментария, вкладки Details / Comments, Add Deal и действия Associated deals. НОВОЕ: inline mention внутри комментария.

**Кадр 10:** Companies → All Companies; табличный список после горизонтального скролла вправо/расширения колонок. Видимы: All Companies, View settings, Import / Export, New Company; колонки Company, Domain, Categories, Description, LinkedIn, Employee range, Estimated ARR, Funding raised, Primary location; строки компаний с суммами ARR/funding и странами. НОВОЕ: колонка Funding raised и правые финансово-географические поля в таблице.

**Кадр 11:** Invoices → All Invoices, табличный объект инвойсов. Видимы: Invoices в сайдбаре выбран, All Invoices, View settings, фильтры/поля Due Date и Status, Import / Export, New Invoice; таблица: Invoice, Status, Company, Billing Admin, Workspace, Due Date, Amount, Add column; статусы Paid. НОВОЕ: отдельный объект Invoices с invoice-id, billing admin, workspace, датой и суммой.

**Кадр 12:** People → Recently Contacted People; табличный список контактов, hover по пункту People в сайдбаре. Видимы: Recently Contacted People, View settings, Import / Export, New Person; tooltip “Go to people page”; колонки Name, Email address, Company, Connection strength, Last email interaction, Last calendar interaction, Geography; значения Very weak и даты взаимодействий. НОВОЕ: people-view по недавним контактам и hover tooltip навигации.

**Кадр 13:** People → Recently Contacted People; таблица в том же view, состояние просмотра/фокуса на строках. Видимы: view-фильтр Last calendar interaction, View settings, Import / Export, New Person; колонки Name, Email address, Company, Connection strength, Last email interaction, Last calendar interaction, Geography; строки Lisa Cosme, Ora Herzog, Simon Schmidt и др. НОВОЕ: сохранённый фильтр/условие по последнему календарному взаимодействию.

**Кадр 14:** People → Recently Contacted People; курсор/hover на первой строке Lisa Cosme, таблица без модалок. Видимы: те же controls — View settings, Import / Export, New Person, колонки Name, Email address, Company, Connection strength, Last email interaction, Last calendar interaction, Geography. НОВОЕ: row-hover/выбор строки в people table.

**Кадр 15:** People → Admin users; переключение на другой сохранённый view. Видимы: Admin users, View settings, фильтр/условие Association type / Deal Type и кнопка New, Import / Export, New Person; таблица: Name, Email address, Company, LinkedIn, Add column; строки James Green, Camila Oram, Cameron Jackson и др.; справа пустая область из-за меньшего числа колонок. НОВОЕ: saved view Admin users с укороченной схемой колонок и быстрым добавлением колонки.


## Кадры 55-69

**Кадр 1:** People / табличный вид `Admin view`; открыт дропдаун выбора атрибута для колонки. Видимы: сайдбар `Quick actions`, Main menu (`Tasks`, `Notes`, `Emails`, `Calls`, `Reports`, `Automations`), объекты (`Companies`, `People`, `Deals`, `Users`, `Workspaces`, `Invoices`), списки (`Inbound Leads`, `Recruiting`, `Event Invitees`, `Customer Success`, `Onboarding Pipeline`, `POC`), сверху `Admin view`, `View settings`, `Import / Export`, `New Person`; таблица с колонками `Name`, `Email addresses`. **НОВОЕ:** меню атрибутов: `Record ID`, `Name`, `Email addresses`, `Description`, `Company`, `Job title`, `Phone numbers`, `Primary location`, `Last interaction`, `AngelList`, `Facebook`, `Instagram`, `LinkedIn`, далее связанные/кастомные поля.

**Кадр 2:** People / таблица после добавления колонок; дропдаун закрыт, выделена ячейка имени `Jamie Brophy`. Видимы колонки `Name`, `Email addresses`, `Company`, `LinkedIn`, сверху фильтр/параметр `Produce location | City`, `+ Add column`, справа `Save changes`, `Import / Export`, `New Person`.

**Кадр 3:** People / таблица; снова открыт дропдаун `+ Add column` после колонки `LinkedIn`. Видимы поля выбора: `Record ID`, `Name`, `Email addresses`, `Description`, `Company`, `Job title`, `Phone numbers`, `Primary location`, `Last interaction`, `AngelList`, `Facebook`, `Instagram`, `LinkedIn`.

**Кадр 4:** People / таблица; открыт вложенный список полей связанного объекта `Company`. **НОВОЕ:** в меню видны nested-поля компании: `First interaction`, `Connection strength`, `Strongest connection`, `Next due task`, `Associated deals`, `Associated workspaces`, `Created at`, `Created by`, `Customer Type`, `CEO`, `Investors`, `Segment`, `POC`.

**Кадр 5:** People / таблица после выбора nested-поля; добавлена новая колонка `Company > CEO` / `CEO`, рядом `+ Add column`. Видимы основные контролы: `Admin view`, `View settings`, `More`, `Save changes`, `Import / Export`, `New Person`; таблица с колонками `Name`, `Email addresses`, `Company`, `LinkedIn`, `Company > CEO`.

**Кадр 6:** People / таблица; выбран массовый набор строк, строки подсвечены голубым, слева у записей синие чекбоксы. **НОВОЕ:** нижняя bulk-панель: `21 selected`, `Add to list`, `Send email`, `Run workflow`, `Enroll in sequence`, `More`, кнопка закрытия `X`.

**Кадр 7:** People / bulk-действие; открыт модальный селектор списка поверх выбранных строк. **НОВОЕ:** модалка `Choose list` с поиском `Search lists...`, варианты `Customer Success Call Requests`, `Event Invitees`, `Inbound Leads`, `Product Launch Campaign`, `Recruiting`, `Create new list`; снизу счётчик результатов и синяя кнопка `Add 21`.

**Кадр 8:** People / после добавления выбранных записей в список; модалка закрыта, bulk-панель остаётся. **НОВОЕ:** toast внизу справа с подтверждением добавления записей в список `Customer Success`, рядом иконка/кнопка закрытия.

**Кадр 9:** People / выбор снят, таблица вернулась в обычное состояние. **НОВОЕ:** синий toast внизу справа: список `Event Invitees`, сообщение о добавленных участниках/записях, кнопка `Go to list`, крестик закрытия; в сайдбаре выделяется/выбирается `Event Invitees`.

**Кадр 10:** Event Invitees / kanban-вид списка участников. Видимы сверху `Event Invitees`, `All records`, `View settings`, переключатели/иконки вида, справа `Share`, `Import / Export`, синяя `Add Person`; доска с колонками `No stage`, `Shortlisted`, `Invited`, `Accepted`, `Declined`, у колонок цветные точки, счётчики, `+ Add Person`; карточки людей с компанией/полями и маленькими иконками активности. **НОВОЕ:** переход из таблицы People в kanban по стадиям.

**Кадр 11:** Event Invitees / поверх kanban открыта галерея шаблонов. **НОВОЕ:** большая модалка `Templates` с левыми категориями `Sales`, `Fundraising`, `Recruiting`, `Marketing`, `Customer Success`, `Productivity`, `Finance`, `HR`, `Operations`, `IT`, `Startups`, `Venture Capital`; поле поиска `Search for templates...`; шаблоны `Content co-creation`, `Customer success`, `Employee onboarding`, `Onboarding`, `Press outreach`; справа у строк иконки действий/объектов; снизу кнопки `Start from Scratch` и синяя `Preview template`.

**Кадр 12:** Event Invitees / модалка Templates закрывается или находится в переходном состоянии, фон kanban затемнён и размывается. Видимы те же элементы шаблонов и кнопки `Start from Scratch`, `Preview template`, но поверх доски идёт fade/transition. Новых постоянных элементов нет.

**Кадр 13:** Event Invitees / kanban снова открыт без модалки. Видимы `All records`, `View settings`, `Share`, `Import / Export`, `Add Person`, колонки `No stage`, `Shortlisted`, `Invited`, `Accepted`, `Declined`, карточки участников, нижние `+ Add condition`/добавление в колонках. Состояние стабилизировано после закрытия шаблонов.

**Кадр 14:** Event Invitees / kanban; открыт дропдаун настройки отображаемых полей/атрибутов. **НОВОЕ:** меню с полями `Record ID`, `Name`, `Email addresses`, `Description`, `Company`, `Job title`, `Phone numbers`, `Primary location`, `AngelList`, `Facebook`, `Instagram`, `LinkedIn`, пункт `Create new attribute`; курсор/ховер на `AngelList`.

**Кадр 15:** Event Invitees / kanban; дропдаун закрыт, доска в обычном состоянии. Видимы основные контролы `All records`, `View settings`, `Share`, `Import / Export`, `Add Person`; колонки `No stage`, `Shortlisted`, `Invited`, `Accepted`, `Declined` с карточками участников и кнопками добавления. Новых элементов нет.


## Кадры 70-84

**Кадр 1:** Workflows; список ещё грузится, в центре `Loading...`. Видимы: левое меню Basepoint (`Quick actions`, Mailboxes, Tasks, Notes, Emails, Calls, Reports, Automations → Sequences/Workflows, CRM-объекты), сверху `Sorted by Last published`, `Filter`, справа `View settings`, синяя `New workflow`.

**Кадр 2:** Workflows; таблица workflows загружена, вид `Sorted by Last published`. Видимы карточки/быстрые вкладки workflow (`High-value high priority leads`, `Email platform list Event sequence`, `Research Agent...`, `Notify team...`, `Workflow 8 - Send HTTP req...`, `Enroll in ICP inbound Leads`), строки: `Enroll invites in Event sequence and update status`, `High-value high priority leads`, `Onboarding routing`, `Notify team when a deal stage moved to "Won"`, `Enroll in ICP inbound Leads`; колонки с runs/status `Live`, owner, last updated; кнопки `Filter`, `View settings`, `New workflow`.

**Кадр 3:** Переход в новый workflow; breadcrumb `Workflows > Untitled Workflow`, центр `Loading workflow...`. НОВОЕ: создаётся `Untitled Workflow`, вместо списка открыт экран конструктора.

**Кадр 4:** Workflow builder `Untitled Workflow`; открыт правый drawer `Select trigger`, центр ещё `Loading workflow...`. НОВОЕ: вкладки `Editor`, `Runs`, `Settings`; поле поиска триггеров; группы/опции `Record command`, `Record created`, `Record updated`, `List entry command`, `List entry updated`, `Record added to list`, `Attribute updated`, `Task created`, `Manually run`, `Recurring schedule`, `Webhook received`; снизу `Documentation`, `Templates`; справа сверху `Save`.

**Кадр 5:** Canvas workflow загружен; сверху плашка `This workflow has not yet been activated` с синей кнопкой активации/проверки, в центре пустой trigger-блок `Add a trigger to start` и ссылка `Start with a trigger`. Справа остаётся `Select trigger` со всеми опциями; снизу появились controls canvas: zoom `100%`, кнопки навигации/масштаба.

**Кадр 6:** Hover по опции `Record command` в правом `Select trigger`. НОВОЕ: тёмный tooltip с описанием триггера `Record command`; сама опция подсвечена.

**Кадр 7:** Триггер `Record command` выбран; на canvas появился блок `Trigger → Record command` с кнопкой/меню `Actions`. НОВОЕ: правый panel настройки блока: заголовок `Record command`, кнопка `Change`, секция `Inputs`, ниже `Next step` с текущим trigger-блоком.

**Кадр 8:** Добавление следующего шага после trigger; под блоком `Record command` открыт пустой step-placeholder на canvas. НОВОЕ: правый drawer `Add step` с поиском и категориями: `Records` (`Create or update record`, `Create record`, `Find records`, `Update record`), `Lists` (`Add record to list`, `Delete list entry`, `Find list entries`, `Update list entry` — подсвечен), `Sequences` (`Enroll in sequence`, `Exit from sequence`), `Research record`, `AI` (`Classify record`, `Classify mail`).

**Кадр 9:** Возврат к Workflows; список снова грузится, центр `Loading...`. Видимы прежние controls: `Sorted by Last published`, `Filter`, `View settings`, `New workflow`; Workflows выбран в левом меню.

**Кадр 10:** Workflows list снова загружен. Видимы те же workflow-карточки/вкладки, таблица с `Live` статусами, owners и last updated; доступна кнопка `New workflow`, `View settings`, сортировка и `Filter`.

**Кадр 11:** Открыт workflow `Enroll invites in Event sequence and update status`; builder в состоянии `Live`, справа сверху toggle `Live`. НОВОЕ: canvas с цепочкой `Trigger: Record added to list` → `Enroll in sequence` → `Update list entry`; справа summary-card с названием workflow и описанием; снизу `Documentation`, `Templates`, zoom controls.

**Кадр 12:** Выделен шаг `Enroll in sequence` на canvas. НОВОЕ: правый inspector шага `Enroll in sequence` с кнопкой `Change`, секция `Inputs`: `Sequence: Event Invite`, `Record: Created entry / Person Record`, `Sender: Added by`; секция `Next step`: `Enroll in sequence` → `Update list entry`; снизу действия `Refresh block`, `Delete block`.

**Кадр 13:** Раздел Sequences; таблица sequence-кампаний. Видимы: сортировка `Sorted by Creation date`, `Filter`, `View settings`, синяя `New sequence`; список `Follow up email`, `ICP incoming Leads`, `Onboarding outreach`, `Connect Renewals`, `Event Invites`; колонки с members/статусом (`Running`/похожие зелёные badges), owner, last updated.

**Кадр 14:** Открыта sequence `Event Invites`; вкладка `Editor` активна, рядом `Recipients`, `Settings`; справа сверху toggle sequence и синяя `Enroll recipients`. НОВОЕ: редактор email step: `Step 1 Automated email`, subject `You're invited to Basepoint's networking event`, body с merge-полем `{{Person first}}`, блок `Event Details` (`Date: 25th February`, `Time: 06:00 pm onwards`, `Location: Basepoint Offices`), кнопка `Use AI to generate copy`; ниже виден `Step 2 Automated email`. Правый panel: описание sequence, `Delivery` с временем `09:00–17:00` и timezone `Europe/London`, toggle send-window, `Email` с dropdown `Mail account`, toggles tracking/unsubscribe, `Exit criteria: Reply received`, `Documentation`.

**Кадр 15:** Sequence editor остаётся на `Event Invites`, состояние почти без изменений; фокус/курсор смещён, правый settings-panel открыт. Видимы те же controls: `Editor`, `Recipients`, `Settings`, toggle sequence, `Enroll recipients`, email body, `Use AI to generate copy`, `Step 2 Automated email`, настройки `Delivery`, `Email`, `Exit criteria`, `Documentation`; новых продуктовых элементов не появилось.


## Кадры 85-99

**Кадр 1:** Sequences → Event Invitees, вкладка Editor; открыт редактор sequence с Step 1/Step 2 Automated email, блоком Wait 3 business days, email-текстом с переменными и event details. Видимы: Editor/Recipients/Settings, Invite someone, Email recipients, Share, правая панель Event Invitees → Delivery (09:00–17:00, Europe/London, Business days only), Email (Work accounts, Thread, Reduce sender signature), Exit criteria → Reply received, Documentation; слева навигация Basepoint: Mailrooms, Tasks, Notes, Emails, Calls, Reports, Automations, Sequences, Workflows, Companies, People, Deals, Users, Workspaces, Invoices, списки Inbound Leads/Recruiting/Event Invitees/Customer Success/Onboarding Pilot.

**Кадр 2:** Тот же Event Invitees sequence; прокрутка/фокус смещён на Step 2 Automated email, курсор стоит в теле письма-напоминания. НОВОЕ: полностью виден второй email-шаг с subject/body, ссылкой/переменной recipient, Event Details, нижняя кнопка добавления шага; правая панель настроек без изменений.

**Кадр 3:** Reports — список дашбордов/отчётов; выбран раздел Reports в левом меню. НОВОЕ: сверху View settings, New dashboard, Edit; блоки/карточки Reporting Dashboard и Sales Overview, группировка «Created by…», список строк Revenue Dashboard, 2026 Workstarts - Companies, Sales Overview, Business Metrics, Sales + Pipeline Reports, Companies by Country, справа у строк видны метаданные/иконки/меню.

**Кадр 4:** Открыт Reports → Revenue Dashboard; дашборд в состоянии загрузки. НОВОЕ: breadcrumb Reports / Revenue Dashboard со звездой, кнопки Share и New report, заголовок Revenue Dashboard, плейсхолдеры виджетов Total ARR, Input Report - deals flown by Team Member, Employee range for companies in pipeline, Locations in active pipeline.

**Кадр 5:** Revenue Dashboard загрузился; отображаются 4 верхних виджета. Видимы: KPI Total ARR / Deal value = US$94,403,176.00, stacked bar по стадиям/Team Member, pie chart Employee range for companies in pipeline, карта Locations in active pipeline, легенды, оси, меню виджетов, Share, New report.

**Кадр 6:** Нажат New report / открыт builder; справа выезжает панель выбора типа отчёта. НОВОЕ: пустое состояние «Your insights display chart», правая панель «What do you want to report on?» с опциями Insight, Historical values, Funnel, Time in stage, Stage changed, снизу Templates и Documentation; видна подсказка Create около верхней иконки.

**Кадр 7:** Возврат на Revenue Dashboard; панель builder закрыта, снова видны KPI, stacked bar, pie и map. НОВОЕ: карта перерисовывается/догружает тайлы, остальные контролы прежние — Share, New report, breadcrumb, меню виджетов.

**Кадр 8:** Revenue Dashboard без модалок; состояние почти то же, карта продолжает догружаться и становится детальнее. Видимы те же элементы: Total ARR, Input Report, Employee range pie, Locations map, легенды, Share, New report.

**Кадр 9:** Началась вертикальная прокрутка дашборда вниз; верхний заголовок уходит выше, нижняя часть страницы появляется. НОВОЕ: внизу виден старт секции Funnel Report с stage-карточками Prospecting, Qualification, Meeting, Proposal, Negotiation, Won и числовыми бейджами.

**Кадр 10:** Прокрутка ниже; KPI/бар остаются в верхней части, pie и map — в середине, Funnel Report раскрывается сильнее. НОВОЕ: stage-карточки Funnel Report стали читаемее, справа виден вертикальный scrollbar; кнопка New report закреплена вверху справа.

**Кадр 11:** Revenue Dashboard прокручен до области между pie/map и funnel. НОВОЕ: снизу появляется большая синяя funnel-диаграмма, разбитая по стадиям Prospecting → Qualification → Meeting → Proposal → Negotiation → Won.

**Кадр 12:** Прокрутка ещё ниже; верхние виджеты частично обрезаны, funnel занимает нижнюю половину экрана. Видимы: pie Employee range, map Locations, stage labels и синяя воронка; НОВОЕ: фокус страницы фактически переходит с верхних KPI на Funnel Report.

**Кадр 13:** Дашборд прокручен ниже; stacked bar почти ушёл вверх, pie/map и funnel остаются основными. НОВОЕ: синяя funnel-диаграмма растянута почти на всю ширину контента, видны вертикальные разделители стадий.

**Кадр 14:** Нижняя часть Funnel Report; сверху ещё видны pie и map, под funnel появляются следующие виджеты. НОВОЕ: заголовки нижних графиков Monthly account leads by owner и Pipeline stage changed, их легенды и первые элементы данных.

**Кадр 15:** Ещё ниже по Revenue Dashboard; Funnel Report центрирован, под ним частично видны нижние аналитические графики. НОВОЕ: у Monthly account leads by owner виден жёлтый столбец/бар, у Pipeline stage changed — многоцветные вертикальные значения; сверху сохраняются Share/New report и левая навигация.


## Кадры 100-114

**Кадр 1:** Reports / Revenue Dashboard; верхняя часть дашборда при прокрутке: видны обрезанные карточки с pie chart и гео-картой, большой Funnel Report с этапами 100% Prospecting, 100% Qualification, 94% Meeting, 82% Proposal, 71% Negotiation, 60% Won; ниже частично видны графики Monthly inbound leads by owner и Pipeline stage changed. Контролы: Basepoint dropdown, breadcrumb Reports / Revenue Dashboard, звезда, avatar, Share, ?, kebab, синяя New report; слева Quick ac..., 10 minutes, поиск, Notifications, Tasks, Notes, Emails, Calls, Reports, Automations, Sequences, Workflows, Records, Lists.

**Кадр 2:** Тот же Revenue Dashboard; страница прокручена чуть ниже, верхние pie/map почти ушли, Funnel Report расположен по центру, ниже лучше видны два графика. Новых элементов нет; состояние — вертикальный scroll, правая полоса прокрутки смещена вниз.

**Кадр 3:** Прокрутка ниже: Funnel Report уходит вверх, полностью видны карточки Monthly inbound leads by owner и Pipeline stage changed. Новые видимые подписи/поля графиков: Projected Close Date, Date changed, ось Count, легенды Matthew Fischer, Marisa McGill, Zev Lebowitz, Alexys Ledner, Heather Rowland, +3 more; Negotiation, Won, Qualification, Lead, Contacted, Proposal, Meeting, +3 more.

**Кадр 4:** Revenue Dashboard; фокус между нижней частью Funnel Report и строкой графиков, ниже начинают появляться три новые карточки. Новые элементы: заголовки Insight report: Workspaces created, Workspaces by plan, Workspace cancellation reasons, бейдж Workspaces, kebab-меню на каждой карточке.

**Кадр 5:** Прокрутка ниже: Funnel Report почти ушёл, Monthly inbound leads и Pipeline stage changed полностью в фокусе, нижние Workspaces-карточки видны сильнее. Новые элементы: у line chart частично видна ось First Contract Start Date; у pie chart легенда Plus, Pro, Enterprise, No Plan; у cancellation chart первые столбцы и ось Count.

**Кадр 6:** Продолжение прокрутки вниз: верхний Funnel Report остался тонкой полосой, средний ряд графиков основной; курсор наведен в области легенды/графика Monthly inbound leads. Новых контролов нет; состояние — hover без открытого tooltip/меню.

**Кадр 7:** Monthly inbound leads by owner и Pipeline stage changed подняты в верхнюю часть; курсор-рука наведен на сегмент stacked bar March в Monthly inbound leads. Новых элементов нет; состояние — интерактивный hover по бар-чарту, tooltip не открыт.

**Кадр 8:** Страница ниже: верхний ряд графиков частично обрезан, строка Workspaces-графиков видна почти полностью. Новые видимые элементы: line chart Insight report: Workspaces created с месяцами Mar 2024–Mar 2025, pie chart Workspaces by plan, bar chart Workspace cancellation reasons с категориями Competitor, Cost, Featurega..., No longer..., Customer....

**Кадр 9:** Та же область, курсор-рука наведен на нижний фиолетовый сегмент March в Monthly inbound leads. Новых элементов нет; состояние — hover по конкретному сегменту stacked bar, без всплывающей подсказки.

**Кадр 10:** Прокрутка ниже: Monthly inbound leads и Pipeline stage changed уходят вверх, Workspaces-графики центральные, снизу появляется следующая большая карточка. Новый элемент: Total paid invoices YTD с красным бейджем Invoices; видна верхняя часть синего bar chart и горизонтальная пунктирная линия.

**Кадр 11:** Workspaces-графики полностью в верхнем ряду, Total paid invoices YTD раскрыт сильнее. Новые видимые поля: ось Amount с $0k–$180k, месяцы Jan, Feb, Mar, подпись Due Date; на карточке Total paid invoices YTD есть kebab-меню.

**Кадр 12:** Revenue Dashboard ниже: верхние Workspaces-графики частично обрезаны, Total paid invoices YTD занимает центр, три синих столбца Jan/Feb/Mar и dotted baseline/target line. Новых элементов нет; состояние — прокрутка без открытых меню.

**Кадр 13:** Низ карточки Total paid invoices YTD; под графиком появляется пустая широкая зона добавления. Новый элемент: большая кнопка/плейсхолдер с иконкой «+» для добавления нового отчёта/блока на дашборд.

**Кадр 14:** После действия/перехода экран затемняется снизу: поверх Revenue Dashboard появляется тёмный overlay/loading area, верх интерфейса ещё виден. Новые элементы: таймер Quick action изменился на 9 minutes; продуктовые контролы сверху остаются Basepoint, Reports / Revenue Dashboard, Share, ?, kebab, New report, но содержимое нижней части скрыто тёмной панелью.

**Кадр 15:** Полноэкранное тёмное состояние загрузки/перехода: основной UI почти полностью скрыт, видны слабые контуры будущей сетки/карточек в центре. Новых интерактивных элементов, меню, полей или кнопок не видно.
