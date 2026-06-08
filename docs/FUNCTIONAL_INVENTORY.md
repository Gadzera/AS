# Перечень функционала эталона (Attio) — экраны, кнопки, сценарии

Документ собран по реальным кадрам видео-демо. Скриншоты — в docs/screens/. Анализ каждого экрана (кнопки/контролы/сценарии) делал GPT по изображениям.

---

## Партия 1 — Объекты, атрибуты, настройки

Скриншоты:

![Companies — таблица](screens/s_0005.jpg)
![Создание атрибута Text + AI autofill](screens/s_0013.jpg)
![Создание атрибута Relationship](screens/s_0018.jpg)
![Companies — колонки Team/Segment/POC](screens/s_0026.jpg)
![Settings → Objects](screens/s_0028.jpg)

### Companies — табличный список объекта
- **Назначение:** просмотр и управление записями объекта Companies в табличном виде.
- **Кнопки/контролы:** выпадающий выбор workspace `Basepoint`; иконка сворачивания/панели в сайдбаре; `Quick actions`; иконки поиска/быстрого действия рядом с Quick actions; пункты навигации `Notifications`, `Tasks`, `Notes`, `Emails`, `Calls`, `Reports`, `Automations`; раскрываемые секции `Favorites`, `Records`, `Lists`; пункты `Companies`, `People`, `Deals`, `Users`, `Workspaces`, `Invoices`, `Inbound Leads`, `Recruiting`, `Event Invites`, `Customer Success`, `Onboarding Pipe...`, `PQL`, `All lists`; заголовок объекта `Companies`; выпадающий view `All Companies`; кнопка `View settings`; строка управления `Sorted by Connection strength`; кнопка/иконка `Filter`; чекбоксы выбора строк; кнопка `Import / Export` с дропдауном; основная кнопка `+ New Company`; иконки в правом верхнем углу аккаунта/уведомлений; иконки сортировки/настроек в заголовках колонок; `+` в области заголовка таблицы для добавления поля/колонки; нижние действия `+ Add calculation`.
- **Колонки/поля:** `Company`, `Domains`, `Categories`, `Description`, `LinkedIn`, `Employee range`, `Estimated ARR`, `Primary lo...` / страна или локация; служебная колонка выбора строк через чекбокс.
- **Сценарии:**
  1. Пользователь выбирает объект `Companies` в сайдбаре и открывает представление `All Companies`.
  2. Пользователь сортирует список через `Sorted by Connection strength` и дополнительно ограничивает данные через `Filter`.
  3. Пользователь выбирает строки чекбоксами для массовых действий или просмотра конкретных компаний.
  4. Пользователь импортирует/экспортирует данные через `Import / Export` или создаёт новую компанию через `+ New Company`.
- **AI/особое:** таблица поддерживает богатые типы значений: цветные теги категорий, ссылки LinkedIn, диапазоны сотрудников, ARR-диапазоны и нижние расчёты по колонкам через `Add calculation`.

### Создание атрибута — Text с AI autofill
- **Назначение:** создание нового текстового атрибута для объекта Companies.
- **Кнопки/контролы:** модальное окно `Create attribute`; крестик закрытия модалки; дропдаун `Attribute Type` со значением `Text`; поле ввода `Name`; поле `Description optional` с плейсхолдером `Add a description for this attribute`; секция `Set up AI autofill`; пункт `AI autofill`; тоггл включения AI autofill; кнопка `Cancel`; подсказка `ESC`; основная кнопка `Create attribute` с дропдаун-стрелкой.
- **Колонки/поля:** форма содержит поля `Attribute Type`, `Name`, `Description optional`, настройку `AI autofill`.
- **Сценарии:**
  1. Пользователь открывает создание новой колонки/атрибута из таблицы Companies.
  2. Пользователь выбирает тип атрибута в `Attribute Type`, на скриншоте выбран `Text`.
  3. Пользователь вводит имя атрибута и опциональное описание.
  4. Пользователь включает или оставляет выключенным `AI autofill`, затем нажимает `Create attribute` либо отменяет через `Cancel`/`ESC`.
- **AI/особое:** видна отдельная настройка `AI autofill` с тогглом — атрибут может автоматически заполняться AI на основе данных записи или внешнего контекста.

### Создание атрибута — Relationship
- **Назначение:** создание relationship-атрибута, связывающего записи между объектами.
- **Кнопки/контролы:** модальное окно `Create attribute`; крестик закрытия; дропдаун `Attribute Type` со значением `Relationship`; информационный блок `Changes on one side of the relationship will be reflected on the other side as well`; ссылка `Learn more about attributes`; секция `Configure relationship`; выбор связанного объекта `Companies`; поле `Associated attribute name`; дропдаун `Select a value...`; второе поле `Associated attribute name`; кнопка `Cancel`; подсказка `ESC`; основная кнопка `Create attribute` с дропдаун-стрелкой.
- **Колонки/поля:** форма содержит `Attribute Type`, конфигурацию relationship, связанный объект `Companies`, два поля `Associated attribute name`, дропдаун выбора значения `Select a value...`.
- **Сценарии:**
  1. Пользователь выбирает тип атрибута `Relationship`.
  2. Пользователь настраивает связанный объект, на скриншоте выбран `Companies`.
  3. Пользователь задаёт имена ассоциированных атрибутов для обеих сторон связи.
  4. Пользователь выбирает тип/направление значения через `Select a value...` и создаёт атрибут через `Create attribute`.
- **AI/особое:** особое поведение relationship явно описано в интерфейсе: изменения на одной стороне связи отражаются на другой стороне.

### Companies — таблица с прокруткой колонок Team / Segment / POC
- **Назначение:** просмотр Companies с горизонтальной прокруткой до дополнительных relationship/people-колонок.
- **Кнопки/контролы:** workspace dropdown `Basepoint`; сайдбар с навигацией; объект `Companies`; view dropdown `All Companies`; `View settings`; строка `Sorted by Connection strength`; `Filter`; чекбоксы строк; `Import / Export`; `+ New Company`; иконки сортировки/настроек в заголовках колонок; кнопка `+ Add column` в правой части таблицы; нижние действия `+ Add calculation`.
- **Колонки/поля:** видимые колонки после горизонтальной прокрутки: `Estimated ARR`, `Primary lo...` / страна, `Team`, `Segment`, `POC`; слева также частично видны `Company` и другие предыдущие колонки; в `Team`, `Segment`, `POC` отображаются связанные люди/аватары и имена.
- **Сценарии:**
  1. Пользователь прокручивает таблицу Companies горизонтально, чтобы увидеть дополнительные колонки.
  2. Пользователь просматривает связанные команды, сегменты и POC по каждой компании.
  3. Пользователь добавляет новую колонку через `+ Add column`.
  4. Пользователь настраивает представление через `View settings`, сортировку и фильтр.
- **AI/особое:** видна поддержка relationship-like значений в ячейках: в колонках `Team`, `Segment`, `POC` отображаются связанные персоны с маленькими аватарами/иконками, а не простой текст.

### Settings → Objects
- **Назначение:** управление объектами workspace и просмотр списка стандартных/кастомных объектов.
- **Кнопки/контролы:** кнопка возврата назад в `Settings`; поле поиска `Search settings...`; левое меню настроек с разделами `Account`, `Workspace`, `Data`, `Reports`, `Automations`; пункты `Profile`, `Appearance`, `Email and calendar accounts`, `Storage accounts`, `Refer another team`, `Notifications`, `Call recording`, `General`, `Members`, `Plans`, `Billing`, `Developers`, `Security`, `Email and calendar`, `Support requests`, `Migrate CRM`, `Apps`, `Objects`, `Lists`, `Import History`, `Dashboards`, `Sequences`, `Workflows`; заголовок `Objects`; поле поиска `Search`; иконка фильтра/настроек рядом с поиском; основная кнопка `+ Create custom object`; меню действий `⋮` в строках объектов.
- **Колонки/поля:** таблица объектов с колонками `Object`, `Type`, `Records`; строки `Companies`, `Deals`, `Invoices`, `People`, `Users`, `Workspaces`; значения типа `Standard` или `Custom`; количества записей: `Companies — 804`, `Deals — 36`, `Invoices — 100`, `People — 2,756`, `Users — 62`, `Workspaces — 632`.
- **Сценарии:**
  1. Пользователь открывает `Settings` и переходит в раздел `Data → Objects`.
  2. Пользователь ищет объект через поле `Search`.
  3. Пользователь просматривает тип объекта и количество записей в колонках `Type` и `Records`.
  4. Пользователь создаёт новый кастомный объект через `+ Create custom object` или открывает меню `⋮` у существующего объекта.
- **AI/особое:** на этом экране AI-функции не видны; особенность экрана — разделение объектов на `Standard` и `Custom` и централизованное управление объектной моделью workspace.


---

## Партия 2 — Deals и Record-страница

Скриншоты:

![Deals — kanban](screens/s_0032.jpg)
![Deals — фильтр-вид](screens/s_0039.jpg)
![Compose email](screens/s_0041.jpg)
![Deals — пустой фильтр](screens/s_0044.jpg)
![Record — Activity+Details](screens/s_0045.jpg)
![Record — View email](screens/s_0049.jpg)
![Record — Calls (AI)](screens/s_0051.jpg)
![Record — Comments](screens/s_0056.jpg)

### 1. Deals — kanban по стадиям

- **Назначение:** визуальное управление сделками по стадиям воронки в kanban-представлении.

- **Кнопки/контролы:** 
  - Верхняя панель: `Deals`, вкладка/вид `Deals overview`, дропдаун `View settings`, кнопка `Import / Export`, синяя кнопка `+ New Deal`.
  - Панель вида: `Sorted by Created at`, кнопка `Filter`.
  - Kanban-колонки: цветные маркеры стадий, счётчики сделок, кнопки `+ New Deal` внутри стадий.
  - Карточки сделок: меню `…`, иконки активности/связей внизу карточек, индикаторы давности вроде `27d`, `0d`, `26d`.
  - Левая навигация: workspace `Basepoint`, `Quick actions`, поиск, `Notifications`, `Tasks`, `Notes`, `Emails`, `Calls`, `Reports`, `Automations`; блоки `Records`, `Lists`, `All lists`.
  - Объекты/разделы: `Companies`, `People`, `Deals`, `Users`, `Workspaces`, `Invoices`; списки `Inbound Leads`, `Recruiting`, `Event Invites`, `Customer Success`, `Onboarding Pipe`, `PQL`.

- **Колонки/поля/вкладки:**
  - Стадии kanban: `No stage`, `Lead`, `Contacted`, `Prospecting`, `Qualification`, `Meeting`, `Proposal`.
  - Поля на карточках: название сделки, сумма, компания, участники/ответственные, связанные контакты, таймер/давность активности.
  - Примеры карточек: `Judd`, `Cosme`, `Andersen`, `Apollo`, `Death Row Records`, `Enterprise Deal - Andersen`, `Enterprise Deal - Simon`, `Enterprise Deal - Shaw`.

- **Сценарии:**
  1. Пользователь открывает объект `Deals` и выбирает kanban-view `Deals overview`.
  2. Система группирует сделки по стадиям и показывает счётчики в каждой колонке.
  3. Пользователь добавляет сделку через `+ New Deal` в нужной стадии или через верхнюю кнопку `+ New Deal`.
  4. Пользователь фильтрует, сортирует, просматривает карточки и перемещает сделки между стадиями.

- **AI/особое:**
  - В kanban видны связанные сущности и активность по сделкам, что важно для AI-SDR: можно выбирать сделки по стадии, давности контакта и связанным людям.
  - Карточки показывают компактный контекст: сумма, компания, участники и последняя активность.

### 2. Deals — отфильтрованный табличный view

- **Назначение:** табличный список сделок в сохранённом view с активными фильтрами для inbound-лидов.

- **Кнопки/контролы:**
  - Верхняя панель: `Deals`, сохранённый view `Marisa: Inbound leads`, дропдаун `View settings`, `Import / Export`, `+ New Deal`.
  - Панель фильтров: `Sorted by Created at`, фильтры-чипы `Deal owner is Marisa McGill`, `Deal type is Inbound`, `Deal stage is Lead`, кнопка `+` для добавления фильтра.
  - Таблица: чекбокс выбора строки, кликабельные заголовки колонок, `+ Add column`, строки `+ Add calculation`.
  - Левая навигация: те же разделы workspace, records и lists.
  - В ячейках: цветные теги категорий, значения суммы, страна, приоритет, стадия.

- **Колонки/поля/вкладки:**
  - Колонки таблицы: `Deal`, `ICP`, `Typeform - What would you like to talk about?`, `Categories`, `Funding raised`, `Employ...`, `Co...`, `Priority`, `Deal st...`, `+ Add column`.
  - Видимые значения: `Cosme`, `ICP`, текст `We’re a 100-employee B2B fintech platform...`, теги `B2B`, `Finance`, `SAAS`, сумма `US$10,000,000.00`, `51-250`, `Portugal`, `Lead`.
  - Итоговая строка: `1 count`, `+ Add calculation`.

- **Сценарии:**
  1. Пользователь открывает сохранённый view `Marisa: Inbound leads`.
  2. Система применяет фильтры по владельцу, типу сделки и стадии.
  3. Пользователь просматривает найденные сделки в таблице и видит ключевые qualification-поля.
  4. Пользователь добавляет колонку, меняет фильтр, экспортирует данные или создаёт новую сделку.

- **AI/особое:**
  - View собран вокруг inbound-сделок и owner-а, что удобно для AI-приоритизации.
  - Колонка с Typeform-вводом содержит открытый текст лида, потенциальный источник AI-суммаризации и скоринга.
  - Категории `B2B`, `Finance`, `SAAS` выглядят как enriched/normalized tags.

### 3. Compose email — окно письма

- **Назначение:** отправка персонализированного письма одному или нескольким получателям из CRM.

- **Кнопки/контролы:**
  - Модальное окно `Compose email`.
  - Информационная строка: `Delivery time will depend on limits in your outbox. Learn more`, ссылка `Learn more`.
  - Дропдаун `View outbox`.
  - Поле `From` с отправителем `Marisa McGill`.
  - Поле `To`, текст `Sending email to 1 recipient`, поле `+ Add recipients`.
  - Выпадающий список получателей: `Lisa Cosme`, email `lisa@cosme.pt`.
  - Поле `Subject` с плейсхолдером `Enter subject...`.
  - Тело письма с плейсхолдером `Start typing, or create a template`.
  - Ссылка `create a template`.
  - Блок `Favorite templates`, текст `Templates that you favorite will appear here`.
  - Actions: `View all templates`, `Create new template`.
  - Нижние иконки редактора: вложение/форматирование/ссылка.
  - Тоггл `Send emails individually`.
  - Основная кнопка `Send Email (1)`.
  - Закрытие модалки `×`.
  - Нижняя bulk-панель за модалкой: `1 selected`, `Add to list`, `Send email`, `Run workflow`, `More`, `×`.

- **Колонки/поля/вкладки:**
  - Поля письма: `From`, `To`, `Subject`, body.
  - Получатели: `Lisa Cosme`.
  - Шаблоны: favorite templates, all templates, create new template.
  - Настройка отправки: `Send emails individually`.

- **Сценарии:**
  1. Пользователь выбирает одну или несколько сделок/записей в таблице.
  2. Нажимает bulk-action `Send email`.
  3. В модальном окне выбирает отправителя, получателя, тему, шаблон или пишет текст вручную.
  4. Включает/выключает `Send emails individually` и отправляет через `Send Email (1)`.

- **AI/особое:**
  - Поддержка шаблонов и массовой отправки по выбранным CRM-записям.
  - `Send emails individually` важен для outbound/AI-SDR: письма могут уходить персонально, а не одним общим письмом.
  - Интеграция с outbox и лимитами отправки.

### 4. Deals — пустой результат фильтра

- **Назначение:** показать состояние, когда активные фильтры не возвращают ни одной сделки.

- **Кнопки/контролы:**
  - Верхняя панель: `Deals`, view `Marisa: Inbound leads`, `View settings`, `Import / Export`, `+ New Deal`.
  - Панель фильтров: `Sorted by Created at`, `Deal owner is Marisa McGill`, `Deal type is Inbound`, `Deal stage is Lead`, кнопка `+`.
  - Таблица с заголовками колонок и строкой расчётов.
  - Empty state: текст `No Deals match that filter`, пояснение `No Deals match the filter that’s been set.`, синяя кнопка `Clear Filter`.
  - Колонка `+ Add column`.
  - Левая навигация workspace/records/lists.

- **Колонки/поля/вкладки:**
  - Колонки: `Deal`, `ICP`, `Typeform - What would you like to talk about?`, `Categories`, `Funding raised`, `Employ...`, `Co...`, `Priority`, `Deal st...`, `+ Add column`.
  - Итоговая строка: `0 count`, `+ Add calculation`.

- **Сценарии:**
  1. Пользователь применяет набор фильтров в сохранённом view.
  2. Система не находит подходящих записей.
  3. Пользователь видит empty state с причиной.
  4. Пользователь нажимает `Clear Filter`, меняет фильтр или создаёт новую сделку через `+ New Deal`.

- **AI/особое:**
  - Empty state явно связан с фильтрами, а не с отсутствием данных в объекте.
  - Для AI-SDR важно показывать, что выборка пуста из-за условий сегментации, чтобы не запускать рассылку по нулевой аудитории.

### 5. Record-страница компании — Activity + Details/Firmographics

- **Назначение:** карточка компании с таймлайном активности и правой панелью структурированных атрибутов.

- **Кнопки/контролы:**
  - Верхняя навигация записи: breadcrumb `Companies`, название `Cosme`, иконка избранного/звёздочка.
  - Заголовок записи: аватар/иконка компании, `Cosme`.
  - Участники/связанные люди: `Marisa McGill`, `Cosme`.
  - Верхние действия: `Compose email`, иконки дополнительных действий справа.
  - Вкладки активности: `Activity`, `Emails`, `Calls`, `Team`, `Associated deals`, `Notes`, `Tasks`, `Files`.
  - Правая панель: вкладки `Details`, `Comments`.
  - Сворачиваемые секции: `Record Details`, `Enriched Firmographics`, `Location`, `Social Media Links`, `Lists`.
  - Ссылки `Show all values`.
  - В секции Lists: кнопка `Add to list`.
  - Левая навигация workspace/records/lists.

- **Колонки/поля/вкладки:**
  - Вкладки записи: `Activity`, `Emails`, `Calls`, `Team`, `Associated deals`, `Notes`, `Tasks`, `Files`.
  - Правая панель:
    - `Domains`: `cosme.pt`
    - `Description`: описание компании
    - `Categories`: `Finance`, `SAAS`, `Technology`, `B2B`
    - `Foundation date`: `2022`
    - `Employee range`: `51-250`
    - `Estimated ARR`: `$1M-$10M`
    - `Funding raised`: `US$10,000,000.00`
    - `Primary City`: `Porto`
    - `Primary State`: `Set State...`
    - `Primary Country`: `Portugal`
    - `LinkedIn`, `Facebook`, `Twitter`, `AngelList`
  - Центральная область: состояние `Loading...` в Activity.

- **Сценарии:**
  1. Пользователь открывает компанию `Cosme` из списка или связанной сделки.
  2. Система показывает профиль компании и вкладку `Activity`.
  3. Пользователь переключается между активностями: письма, звонки, команда, сделки, заметки, задачи, файлы.
  4. Пользователь редактирует/просматривает атрибуты компании в правой панели `Details`.

- **AI/особое:**
  - Секция `Enriched Firmographics` показывает обогащённые данные: размер компании, ARR, funding, категории.
  - Эти поля могут использоваться для AI-персонализации писем, скоринга ICP и выбора последовательности.
  - Правая панель разделяет CRM-атрибуты и комментарии, не перегружая основной activity feed.

### 6. Record — просмотр письма

- **Назначение:** просмотр email-активности внутри карточки компании.

- **Кнопки/контролы:**
  - Вкладки записи: `Activity`, активная `Emails`, `Calls`, `Team`, `Associated deals`, `Notes`, `Tasks`, `Files`.
  - Левая колонка Emails: список писем.
  - Email item: `Attio / Cosme - booking an introd...`, отправитель/получатели, сниппет.
  - Второе письмо: `Next Steps with Basepoint`.
  - Модальное окно `View email`.
  - В модалке: заголовок письма `Attio / Cosme - booking an introduction`, отправитель `Marisa McGill`, получатель `Lisa Cosme`, время `4th Mar 3:05 PM`.
  - Кнопка `Share`.
  - Закрытие `×`.
  - Правая панель `Details` с теми же секциями company-details.
  - Верхняя кнопка `Compose email`.

- **Колонки/поля/вкладки:**
  - Email list: тема, участники, сниппет.
  - Email viewer: тема, отправитель, получатель, timestamp, тело письма.
  - Тело письма содержит блок вопросов:
    - цели звонка,
    - challenges/goals,
    - specific use cases,
    - team members joining,
    - other details.
  - Правая панель: `Record Details`, `Enriched Firmographics`, `Location`, `Social Media Links`.

- **Сценарии:**
  1. Пользователь открывает запись компании `Cosme`.
  2. Переходит на вкладку `Emails`.
  3. Выбирает письмо из списка.
  4. Система открывает письмо в модальном просмотрщике с полным содержанием и возможностью `Share`.

- **AI/особое:**
  - Email хранится как активность внутри CRM-записи, связанная с компанией и контактом.
  - Текст письма можно использовать для AI-суммаризации, автогенерации next steps и контекстной персонализации следующих касаний.
  - Видно, что письма отправляются от пользователя CRM и сохраняются в истории компании.

### 7. Record — вкладка Calls с AI-резюме звонка

- **Назначение:** просмотр звонков, связанных с компанией, включая краткое резюме разговора.

- **Кнопки/контролы:**
  - Активная вкладка `Calls`.
  - Остальные вкладки: `Activity`, `Emails`, `Team`, `Associated deals`, `Notes`, `Tasks`, `Files`.
  - Карточка звонка `Basepoint discussion`.
  - Иконки/аватары участников внизу карточки.
  - Индикатор длительности `9min`.
  - Правая панель: вкладки `Details`, `Comments`.
  - Секции правой панели: `Record Details`, `Enriched Firmographics`, `Location`, `Social Media Links`, `Lists`.
  - Верхняя кнопка `Compose email`.

- **Колонки/поля/вкладки:**
  - Calls:
    - название звонка `Basepoint discussion`
    - summary: `Marisa McGill and Lisa Cosme engaged in a conversation...`
    - дата и время: `Monday, March 3 3:00 PM - 3:15 PM`
    - участники
    - длительность `9min`
  - Правая панель Details:
    - домен, описание, категории, firmographics, location, social links.

- **Сценарии:**
  1. Пользователь открывает запись компании.
  2. Переходит во вкладку `Calls`.
  3. Система показывает карточки звонков, связанных с компанией.
  4. Пользователь читает summary, дату, участников и использует детали компании для следующего действия.

- **AI/особое:**
  - Карточка звонка содержит AI-style summary разговора: что обсуждали, кто участвовал, какой контекст.
  - Это ключевая функция для AI-SDR/CRM: автоматическое резюме звонка превращает коммуникацию в структурированную историю.
  - Summary может питать next-step рекомендации, follow-up email и обновление стадии сделки.

### 8. Record — вкладка Comments

- **Назначение:** совместные внутренние комментарии по записи компании.

- **Кнопки/контролы:**
  - Активная вкладка записи `Associated deals`.
  - Остальные вкладки: `Activity`, `Emails`, `Calls`, `Team`, `Notes`, `Tasks`, `Files`.
  - Таблица/список associated deals.
  - Кнопка `+ Add Deal`.
  - Правая панель: активная вкладка `Comments`.
  - Поле ввода `AI comments`.
  - Иконка пользователя/аватар внутри поля.
  - Иконки действий в комментарии: упоминание/добавление/форматирование.
  - Синяя кнопка `Comment`.
  - Верхняя кнопка `Compose email`.

- **Колонки/поля/вкладки:**
  - Associated deals:
    - запись `Cosme`
    - стадия `Lead`
    - owner `Marisa McGill`
    - value `No Deal value`
    - дополнительный числовой/счётчик-показатель справа.
  - Comments:
    - поле `AI comments`
    - кнопка отправки `Comment`.
  - Правая панель разделена на `Details` и `Comments`.

- **Сценарии:**
  1. Пользователь открывает компанию и переходит к связанным сделкам.
  2. Видит список associated deals и может добавить новую через `+ Add Deal`.
  3. Открывает правую вкладку `Comments`.
  4. Пишет внутренний комментарий и публикует его через `Comment`.

- **AI/особое:**
  - Поле `AI comments` указывает на возможность AI-assisted комментариев или AI-контекста в обсуждении.
  - Комментарии отделены от публичной email-коммуникации и подходят для внутренних заметок SDR/AE-команды.
  - Связанные сделки и комментарии находятся на одном экране, что удобно для командного handoff.


---

## Партия 3 — People, Списки, Invoices, Автоматизации

Скриншоты:

![Invoices](screens/s_0060.jpg)
![People — Recently Contacted](screens/s_0065.jpg)
![People — булк-действия](screens/s_0074.jpg)
![Список-kanban Event Invitees](screens/s_0078.jpg)
![Workflows — триггеры](screens/s_0085.jpg)
![Workflows — билдер](screens/s_0090.jpg)
![Sequences — список](screens/s_0092.jpg)
![Sequence — редактор](screens/s_0095.jpg)

### 1. Invoices — табличный объект со статусами

- **Назначение:** просмотр и управление счетами в виде таблицы CRM-объекта с оплатой, компанией, workspace, датой и суммой.

- **Кнопки/контролы:**  
  Basepoint dropdown; кнопка сворачивания сайдбара; Quick actions; поиск/иконка лупы; Notifications; Tasks; Notes; Emails; Calls; Reports; Automations; Favorites; секция Records: Companies, People, Deals, Users, Workspaces, Invoices; секция Lists: Inbound Leads, Recruiting, Event Invitees, Customer Success, Onboarding Pipeline, PQL, All lists; заголовок Invoices; view dropdown **All Invoices**; **View settings**; **Import / Export** dropdown; синяя кнопка **New Invoice**; **Sorted by Due Date**; **Filter**; чекбоксы выбора строк; кнопка/колонка **+ Add column**; нижние действия **+ Add calculation** под колонками.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Invoice; Status; Company; Billing Admin; Workspace; Due Date; Amount; Add column.  
  Статусы: **Paid** с зелёной точкой, **Sent** с жёлтой точкой.  
  Примеры строк: INV-093, INV-011, INV-067; компании VortexAI, PioneerSoft, VisionaryTech, CodeWave и др.; даты Mar 7, 2025 / Mar 6, 2025 / Feb 25, 2025; суммы в USD.

- **Сценарии:**  
  1. Пользователь открывает объект Invoices из Records.  
  2. Выбирает сохранённый view **All Invoices** и при необходимости сортирует по Due Date.  
  3. Фильтрует счета по статусу, компании, дате или сумме.  
  4. Создаёт новый счёт через **New Invoice**, импортирует/экспортирует данные или добавляет новую колонку.

- **AI/особое:**  
  Объект работает как гибкая CRM-таблица: можно добавлять кастомные колонки, считать агрегаты через **Add calculation**, использовать статусы как типизированные значения. Явных AI-контролов на экране нет.

---

### 2. People — Recently Contacted People, трекинг взаимодействий

- **Назначение:** список людей с показателями силы связи и последней коммуникации по email/календарю.

- **Кнопки/контролы:**  
  Basepoint dropdown; кнопка сворачивания сайдбара; Quick actions; поиск; Notifications; Tasks; Notes; Emails; Calls; Reports; Automations; Favorites; Records: Companies, People, Deals, Users, Workspaces, Invoices; Lists: Inbound Leads, Recruiting, Event Invitees, Customer Success, Onboarding Pipeline, PQL, All lists; заголовок **People**; view dropdown **Recently Contacted People**; открытое меню view; поле **Search views...**; пункты **Recently Contacted People**, **London locals**, **Admin users**, **Create new view**; **View settings**; **Import / Export**; синяя кнопка **New Person**; **Filter**; чекбоксы строк; **+ Add column**; нижние **+ Add calculation**.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Email addresses; Company; Connection strength; Last email interaction; Last calendar interaction; Company / сегменты справа.  
  Значения Connection strength: **Very weak** с красной точкой.  
  Временные значения: 2 minutes ago, 1 day ago, 10 months ago, 11 months ago, over 1 year ago, almost 2 years ago.  
  Сегменты/теги компаний: B2B, B2C, Agriculture, Human, Information и др.

- **Сценарии:**  
  1. Пользователь открывает объект People.  
  2. Переключает сохранённый view через dropdown и выбирает **Recently Contacted People**.  
  3. Анализирует, с кем давно не было email или календарного контакта.  
  4. Создаёт новый view или применяет фильтры для сегментации контактов.

- **AI/особое:**  
  Особенность — автоматизированный трекинг отношений: сила связи, последняя email-активность и последняя календарная активность считаются как CRM-сигналы. Явного AI-блока на экране нет.

---

### 3. People — множественный выбор строк и нижняя панель bulk-действий

- **Назначение:** массовая работа с выбранными контактами: добавление в список, отправка письма, запуск workflow, enrolment в sequence.

- **Кнопки/контролы:**  
  Basepoint dropdown; Quick actions; поиск; Notifications; Tasks; Notes; Emails; Calls; Reports; Automations; Records; Lists; заголовок **People**; view dropdown **Admin users**; **View settings**; **Import / Export**; синяя кнопка **New Person**; **Sort**; фильтр-пилюли **Associated users > User Type is Admin**, **Primary location > City is London**, **Company > ICP is ICP**; кнопка **+** для добавления фильтра; чекбоксы выбора строк; **+ Add column**; нижняя bulk-панель: **21 selected**, **Add to list**, **Send email**, **Run workflow**, **Enroll in sequence**, **More** dropdown, **X** закрыть; toast **Event Invitees — Checking for duplicate entries**.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Person; Email addresses; Company; LinkedIn; Add column.  
  Выбранные строки подсвечены голубым.  
  В строках видны имена людей, email, компании и LinkedIn-slug.  
  Фильтры задают выборку: Admin users, London, ICP.

- **Сценарии:**  
  1. Пользователь открывает view **Admin users**.  
  2. Применяет фильтры по user type, городу и ICP-компании.  
  3. Отмечает несколько строк чекбоксами.  
  4. Запускает массовое действие: добавить в список, отправить email, запустить workflow или enrolment в sequence.

- **AI/особое:**  
  Особенность — bulk automation layer поверх CRM-таблицы: выбранные записи можно сразу отправить в workflow или sequence. Toast показывает проверку дублей при добавлении в **Event Invitees**.

---

### 4. Event Invitees — kanban-список приглашённых

- **Назначение:** управление приглашёнными на событие в kanban-представлении по стадиям приглашения.

- **Кнопки/контролы:**  
  Basepoint dropdown; Quick actions; поиск; левое меню Records и Lists; выбран список **Event Invitees**; breadcrumb/заголовок **Event Invitees** и объект **People**; view dropdown **All Invitees**; **View settings**; **Import / Export**; синяя кнопка **Add Person**; **Sort**; **Filter**; кнопка **+** для добавления стадии/колонки; кнопка **+ Add Person** внутри стадии Shortlisted; карточные action-иконки внутри карточек; нижние **+ Add calculation** под стадиями.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Kanban-стадии: **No stage**, **Shortlisted**, **Invited 23**, **Accepted 2**, **Declined 1**.  
  Карточки содержат: имя человека, компанию, поле **Set Dietary requirements...**, теги/значения вроде **None**, **Vegan**, иконки активности/комментариев/связей, счётчик давности вроде **0d**, **27d**.  
  Примеры карточек: Manuela Crist-Heidenreich, Jamie Weber, Madelyn Jaskolski, Ona Herzog, Casimer Lockman, Mauricio Brekke, Sienna Schmitt, Kristin Legros, Shannon Ritchie.

- **Сценарии:**  
  1. Пользователь открывает список **Event Invitees**.  
  2. Видит приглашённых, сгруппированных по стадиям Shortlisted, Invited, Accepted, Declined.  
  3. Добавляет нового участника через **Add Person** или кнопку внутри стадии.  
  4. Перемещает карточки между стадиями и обновляет поля вроде dietary requirements.

- **AI/особое:**  
  Особенность — список работает как pipeline/kanban поверх объекта People. Видны кастомные поля на карточке, стадийность и быстрые индикаторы активности. Явных AI-кнопок нет.

---

### 5. Workflows — выбор триггера

- **Назначение:** создание нового workflow с выбором стартового события/триггера.

- **Кнопки/контролы:**  
  Basepoint dropdown; Quick actions; поиск; левое меню; Automations раскрыт; пункты **Sequences** и выбранный **Workflows**; breadcrumb **Workflows**; название **Untitled Workflow**; иконка звезды; вкладки **Editor**, **Runs**, **Settings**; **Share**; переключатель статуса **Draft**; верхний баннер **This workflow has not yet been published**; кнопка **Publish workflow**; canvas с dotted grid; центральная кнопка **Set a trigger in the sidebar**; разделитель **OR**; кнопка **Start with a template**; нижний zoom/control bar: масштаб **100%** dropdown, иконки режима/курсора/навигации; правая панель **Select trigger**; поле **Search triggers...**; карточки триггеров; блоки **Documentation** и **Templates**.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Вкладки workflow: Editor, Runs, Settings.  
  Триггеры в правой панели:  
  - Records: **Record command**, **Record created**, **Record updated**  
  - Lists: **List entry command**, **List entry updated**, **Record added to list**  
  - Data: **Attribute updated**  
  - Tasks: **Task created**  
  - Utilities: **Manually run**, **Recurring schedule**, **Webhook received**  
  Helpful resources: Documentation, Templates.

- **Сценарии:**  
  1. Пользователь открывает Workflows и создаёт новый workflow.  
  2. Выбирает стартовый триггер из правой панели или нажимает центральную кнопку на canvas.  
  3. Альтернативно стартует с готового шаблона через **Start with a template**.  
  4. После настройки публикует workflow через **Publish workflow**.

- **AI/особое:**  
  Особенность — визуальный automation-builder с типами триггеров по доменам CRM: records, lists, data, tasks, utilities. На экране есть шаблоны workflow, но явных AI-контролов нет.

---

### 6. Workflows — визуальный билдер Trigger → шаги

- **Назначение:** настройка опубликованного workflow, который срабатывает при добавлении записи в список и выполняет последовательные действия.

- **Кнопки/контролы:**  
  Basepoint dropdown; левое меню Automations с выбранным **Workflows**; breadcrumb **Workflows**; название **Enroll invitees in Event sequence and update status**; иконка звезды; вкладки **Editor**, **Runs**, **Settings**; **Share**; зелёный статус **Live**; переключатель Live; canvas с zoom bar **100%** и иконками режима; ноды workflow; соединительные линии и точки добавления шага; правая панель настройки; кнопка назад; кнопка **Change**; поле/ссылка **Add a description...**; dropdown **Event Invitees**; блок **Next step**; кнопка удаления шага **x**; **Refresh trigger**.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Вкладки: Editor, Runs, Settings.  
  Цепочка на canvas:  
  1. **Trigger — Record added to list**  
     Подпись: Record added to Event invitees  
     Тип: Lists  
  2. **Enroll in sequence**  
     Подпись: Enroll person in Event Invites sequence  
     Тип: Sequences  
  3. **Update list entry**  
     Подпись: Update an entry in Event Invitees  
     Тип: Lists  
  Правая панель выбранного trigger:  
  - Lists / Record added to list  
  - Change  
  - Inputs → List → Event Invitees  
  - Next step → Record added to list → Enroll in sequence

- **Сценарии:**  
  1. Пользователь выбирает workflow, который уже включён в режиме **Live**.  
  2. Настраивает trigger **Record added to list** для списка **Event Invitees**.  
  3. Добавляет следующий шаг **Enroll in sequence**, чтобы записать человека в email-sequence.  
  4. Добавляет шаг **Update list entry**, чтобы обновить статус/атрибут записи после enrolment.

- **AI/особое:**  
  Особенность — нодовая автоматизация CRM-событий: изменение списка запускает sequence и затем обновляет запись. Это ключевой паттерн для AI-SDR: вход в список → автоматическая коммуникация → обновление статуса.

---

### 7. Sequences — список последовательностей

- **Назначение:** экран списка email-sequences для автоматизированных цепочек касаний.

- **Кнопки/контролы:**  
  Basepoint dropdown; Quick actions; поиск; левое меню; Automations раскрыт; выбран пункт **Sequences**; пункт **Workflows** ниже; Records и Lists в сайдбаре; заголовок **Sequences**; **Sorted by Creation date**; **Filter**; иконка поиска справа; **View settings**; синяя кнопка **New sequence**; ссылка/кнопка **Help**; центральный индикатор **Loading...**.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  На момент скрина список ещё загружается, поэтому строки и колонки не видны.  
  Видимые параметры списка: сортировка по Creation date, фильтр, view settings.  
  Основное действие: создание новой sequence через **New sequence**.

- **Сценарии:**  
  1. Пользователь открывает Automations → Sequences.  
  2. Ждёт загрузки списка последовательностей.  
  3. При необходимости ищет, фильтрует или меняет view settings.  
  4. Создаёт новую последовательность через **New sequence**.

- **AI/особое:**  
  Экран является входной точкой в outbound/sequencing-модуль. Явных AI-контролов на скрине нет, но модуль связан с автоматизацией рассылок и дальнейшим enrolment получателей.

---

### 8. Sequence — редактор шага Wait + Automated email

- **Назначение:** редактирование email-sequence: задержки между шагами, содержание письма, delivery window, unsubscribe и exit criteria.

- **Кнопки/контролы:**  
  Basepoint dropdown; Quick actions с индикатором **20 minutes**; левое меню Automations → Sequences; breadcrumb **Sequences**; название sequence **Event Invites**; иконка звезды; вкладки **Editor**, **Recipients 2**, **Settings**; **Share**; переключатель **Enable sequence**; синяя кнопка **Enroll recipients**; блок ожидания **Wait 5 business days** dropdown; кнопка **+** между шагами; карточка **Step 2 Automated email**; меню/иконка управления карточкой; поле Subject; редактор тела письма; персонализационный токен **{Name | First}**; ссылка **Not interested? Let me know**; placeholder **Sender signature will appear here**; кнопка **Add step to sequence**; правая панель sequence; toggles; dropdowns; Helpful resources → Documentation.

- **Колонки/поля/вкладки/триггеры/шаги:**  
  Вкладки: Editor, Recipients 2, Settings.  
  Шаги sequence:  
  1. Предыдущий email-шаг частично виден сверху.  
  2. **Wait 5 business days**.  
  3. **Step 2 — Automated email**.  
  Поля письма:  
  - Subject: **Re: You're invited to Basepoint's networking event!**  
  - Greeting: **Hi {Name | First},**  
  - Body с Event Details  
  - Date: **23rd February**  
  - Time: **6:00 pm onwards**  
  - Location: **Basepoint Offices**  
  Правая панель:  
  - Sequence: Event Invites  
  - Описание sequence  
  - Delivery → Sending window: **09:00** to **17:00**  
  - Timezone: **Europe/London**  
  - **Business days only** toggle  
  - Email → **Unsubscribe link** dropdown: Not interested  
  - **Thread emails** toggle  
  - **Include sender signature** toggle  
  - Exit criteria → **Reply received**

- **Сценарии:**  
  1. Пользователь открывает sequence **Event Invites** в режиме Editor.  
  2. Настраивает задержку между письмами через **Wait 5 business days**.  
  3. Редактирует automated email: subject, персонализацию, текст, детали события и unsubscribe link.  
  4. Настраивает delivery window, рабочие дни, threading, подпись и критерий выхода **Reply received**, затем включает sequence и enroll recipients.

- **AI/особое:**  
  Особенности: персонализация письма через переменную **{Name | First}**, автоматический stop condition по ответу получателя, delivery window по часовому поясу, отправка только в business days, threaded follow-up emails. Это ключевой экран для AI-SDR outbound-последовательностей.


---

## Партия 4 — Reports/Dashboards, Шаблоны

Скриншоты:

![Templates — галерея](screens/s_0077.jpg)
![Dashboards — список](screens/s_0100.jpg)
![Report builder](screens/s_0101.jpg)
![Revenue Dashboard](screens/s_0104.jpg)

### Templates — галерея шаблонов по категориям
- **Назначение:** выбор готового шаблона workspace/list/report-процесса по бизнес-сценарию перед созданием с нуля или предпросмотром.
- **Кнопки/контролы:** Basepoint workspace dropdown; кнопка сворачивания сайдбара; Quick actions; поиск; индикатор/кнопка `30 minutes`; пункты сайдбара Notifications, Tasks, Notes, Emails, Calls, Reports, Automations; раскрываемые разделы Favorites, Records, Lists; записи Companies, People, Deals, Users, Workspaces, Invoices; списки Inbound Leads, Recruiting, Event Invitees, Customer Success, Onboarding Pipeline, PQL, All lists; верхние контролы страницы `All invitees`, `View settings`, `Sort`, `Filter`, `Import / Export`, `+ Add Person`, `Share`; модальное окно `Templates`; кнопка закрытия `×`; список категорий слева с чекбоксами/иконками; строка поиска `Search for templates, topics, goals...`; карточки шаблонов; иконки/счётчики справа в карточках; нижние кнопки `Start from Scratch`, `Preview template` с выпадающей стрелкой; подсказка `Navigate`.
- **Поля/типы отчётов/графики:** категории шаблонов: Sales, Investing, Recruiting, Marketing, Customer Success, Fundraising, Finance, HR, Operations, PR, Startups, Venture Capital, Content. Видимые шаблоны: Customer Success, Employee onboarding, Outsourcing, Press outreach, Recruiting. В карточках есть превью-миниатюра, название, описание, теги категорий, набор служебных иконок/метрик.
- **Сценарии:**
  1. Пользователь открывает создание/выбор шаблона и попадает в модальное окно `Templates`.
  2. Выбирает категорию слева или вводит запрос в поиск.
  3. Просматривает карточки, теги, описание и метрики шаблона.
  4. Нажимает `Preview template` для предпросмотра или `Start from Scratch` для ручного создания.
- **AI/особое:** шаблоны сгруппированы по бизнес-задачам, фактически работают как guided setup. Внизу слева поверх интерфейса виден видеооверлей спикера, не являющийся частью UI Attio.

### Reports/Dashboards — список дашбордов
- **Назначение:** каталог аналитических дашбордов с избранными карточками, списком отчётов внутри каждого дашборда и датой создания.
- **Кнопки/контролы:** Basepoint workspace dropdown; кнопка сворачивания сайдбара; Quick actions; поиск; `30 minutes`; пункты сайдбара Notifications, Tasks, Notes, Emails, Calls, Reports, Automations, Sequences, Workflows; разделы Favorites, Records, Lists; записи Companies, People, Deals, Users, Workspaces, Invoices; списки Inbound Leads, Recruiting, Event Invitees, Customer Success, Onboarding Pipeline, PQL, All lists; верхний заголовок `Reports`; кнопка `Help`; сортировка `Sorted by Creation date`; иконка поиска; `View settings`; синяя кнопка `New dashboard`; карточки Favorites; строки таблицы; звёздочка избранного в строках; меню строки `⋮`.
- **Поля/типы отчётов/графики:** блок `Favorites` с карточками `Revenue Dashboard` и `Sales Overview`, внутри карточек видны мини-иконки отчётов и счётчики `+8`, `+4`. Таблица с колонками `Dashboard`, `Reports`, `Created at`. Дашборды: Revenue Dashboard, 2024 Workspaces - Compliance, Sales Overview, Business Metrics, Sales - Pipeline Reports, Companies by Country. Чипы отчётов: Total ARR, Insight Report, Employee..., Locations..., Funnel Rep..., Monthly in..., Pipeline..., Compliance, ARR by compliance type, Historical Re..., Time in St..., Stage Chan..., Customer ARR..., Customer L..., # of deal..., Employee ranges for com..., Monthly Close..., Win rate, Companies by Country Count.
- **Сценарии:**
  1. Пользователь открывает раздел `Reports`.
  2. Сортирует список через `Sorted by Creation date` или настраивает отображение через `View settings`.
  3. Быстро открывает избранный дашборд из блока `Favorites` либо выбирает строку в таблице.
  4. Создаёт новый дашборд через `New dashboard` или управляет строкой через звёздочку/меню.
- **AI/особое:** отчёты представлены как reusable-чипы внутри дашбордов; видно, что один дашборд агрегирует несколько report-блоков разных типов. Внизу слева есть видеооверлей спикера.

### Report builder — выбор типа отчёта
- **Назначение:** стартовый экран конструктора отчёта, где пользователь выбирает тип аналитики перед настройкой источника данных и графика.
- **Кнопки/контролы:** левый сайдбар со всеми основными разделами; пункт `Reports` активен; кнопка закрытия `×` в верхней части рабочей области; tooltip `Close ESC`; центральная пустая область графика; правая панель выбора; карточки выбора типа отчёта; нижняя карточка `Documentation`; раздел `Helpful pages`.
- **Поля/типы отчётов/графики:** центральный placeholder: `Input needed to display chart` и `Select a data source`. Правая панель: заголовок `What do you want to report on?`, подпись `Select the type of report you want to build`. Раздел `Create your own`: `Insight` — report on the current state of your business; `Historical values` — see how your data has changed over time. Раздел `Pipeline reports`: `Funnel` — track progress and conversion through your pipelines; `Time in stage` — track how much time is spent in your pipelines; `Stage changed` — see how many records move to specific stages. Внизу: `Documentation` — learn to build powerful reports in Attio.
- **Сценарии:**
  1. Пользователь открывает создание нового отчёта.
  2. Система показывает пустой canvas и просит выбрать источник данных.
  3. Пользователь выбирает тип отчёта справа: Insight, Historical values, Funnel, Time in stage или Stage changed.
  4. После выбора типа переходит к настройке data source, pipeline/object и визуализации.
- **AI/особое:** интерфейс ведёт пользователя через decision tree вместо пустого конструктора; `Insight` выглядит как универсальный отчёт по текущему состоянию бизнеса. Внизу слева виден видеооверлей спикера.

### Revenue Dashboard — набор графиков
- **Назначение:** аналитический дашборд по revenue/pipeline с несколькими визуализациями: распределение компаний, география, funnel-конверсия и stage-метрики.
- **Кнопки/контролы:** Basepoint workspace dropdown; кнопка сворачивания сайдбара; Quick actions; поиск; `30 minutes`; активный пункт `Reports`; разделы Automations, Records, Lists; breadcrumb `Reports > Revenue Dashboard`; звёздочка рядом с названием дашборда; аватар пользователя; `Share`; иконка истории/активности; меню `⋮`; синяя кнопка `New report`; меню `⋮` на карточках графиков; вертикальный скролл страницы.
- **Поля/типы отчётов/графики:** видимый bar chart по `Stage` с категориями Prospecting, Qualification, Meeting, Proposal, Negotiation, Paused. Pie chart `Employee ranges for companies in pipeline` с легендой по диапазонам сотрудников: `11-50`, `51-250`, `1-10`, `251-1K`, `501-10K`, `1K-5K`. Гео-карта `Locations in active pipeline` с источником/чипом `Deals`, карта сфокусирована на Европе, Африке и части Азии. Funnel chart снизу: Prospecting `100%`, Qualification `100%`, Meeting `94%`, Proposal `82%`, Negotiation `71%`, Won `60%`.
- **Сценарии:**
  1. Пользователь открывает `Revenue Dashboard` из списка Reports.
  2. Просматривает верхние stage-метрики и распределения по pipeline.
  3. Анализирует сегменты компаний по employee range и географию активного pipeline.
  4. Добавляет новый отчёт через `New report`, делится дашбордом через `Share` или настраивает отдельный график через `⋮`.
- **AI/особое:** дашборд собран из отдельных report-блоков с разными типами визуализации; funnel явно показывает потери конверсии между стадиями. Внизу слева поверх экрана расположен видеооверлей спикера.


---

## Итог: модули для клонирования

Objects (Companies/People/Deals/Users/Workspaces/Invoices + кастомные), гибкие Attributes (вкл. AI autofill, Relationship), Views (Table/Kanban, фильтры/сортировки/колонки/calculations), Lists (table/kanban), Record-страница (Activity/Emails/Calls/Team/Deals/Notes/Tasks/Comments/Files + Details/Firmographics/Social/Lists), Compose email + шаблоны, Sequences (шаги/Wait/Delivery/Exit), Workflows (триггеры/шаги вкл. AI: Classify/Summarise/Prompt/HTTP), Reports/Dashboards (funnel/pie/bar/line/map), Settings (Objects/Members/Billing/Developers/Migrate CRM), Quick actions ⌘K, Notifications/Tasks/Notes/Calls/Emails.
