# AISDR — Каталог пользовательских сценариев (атомарные, 250+)

Полная декомпозиция эталона Attio на отдельные сценарии. Источник: реверс-инжиниринг 28 видео Academy
([ACADEMY_SCENARIOS.md](./ACADEMY_SCENARIOS.md)) + demo-storyboard (114) + [FUNCTIONAL_INVENTORY.md](./FUNCTIONAL_INVENTORY.md).
Формат: **Sxxx | Модуль | Сценарий** — шаги → ожидаемый результат (acceptance). Статус: ✓ готово · ~ частично · ⬜ нет.

---

## 1. Объекты (Objects)
- **S001** ⬜ Создать кастомный объект: Settings→Objects→New → имя + иконка + record-text → объект появляется в сайдбаре Records.
- **S002** ✓ Открыть стандартный объект (Companies) → таблица записей.
- **S003** ⬜ Переименовать объект / сменить иконку в object settings.
- **S004** ⬜ Архивировать объект.
- **S005** ✓ Bootstrap 5 стандартных объектов (Companies/People/Deals/Workspaces/Users) при первом входе.
- **S006** ⬜ Просмотр вкладок объекта в settings: Configuration / Permissions / Appearance / Attributes / Templates.
- **S007** ⬜ Выбрать Record text атрибут (какой text-атрибут = имя записи вместо Record ID).

## 2. Атрибуты (Attributes)
- **S010** ~ Открыть модалку Create attribute (тип + Name + Description).
- **S011** ⬜ Создать атрибут Text. **S012** ⬜ Long text. **S013** ⬜ Number. **S014** ⬜ Checkbox/Boolean.
- **S015** ⬜ Date. **S016** ⬜ Timestamp/Datetime. **S017** ⬜ Rating. **S018** ⬜ Status (стадии).
- **S019** ⬜ Select (+опции). **S020** ⬜ Multi-select. **S021** ⬜ Currency. **S022** ⬜ Email. **S023** ⬜ Phone. **S024** ⬜ URL.
- **S025** ⬜ Record (link). **S026** ⬜ User. **S027** ⬜ Location. **S028** ⬜ Relationship (см. модуль 3).
- **S029** ⬜ Пометить атрибут Unique (дедуп).
- **S030** ⬜ Пометить атрибут Required (нельзя создать запись без значения).
- **S031** ⬜ Reorder атрибутов (drag) в object settings.
- **S032** ⬜ Archive атрибута.
- **S033** ⬜ Добавить опции к Select прямо при создании.
- **S034** ⬜ System-атрибуты (List Entries, Next due task, Created at, Created by) — нередактируемы.

## 3. Связи (Relationships)
- **S040** ⬜ Создать relationship-атрибут: выбрать целевой объект.
- **S041** ⬜ Кардинальность one-to-one. **S042** ⬜ one-to-many. **S043** ⬜ many-to-one. **S044** ⬜ many-to-many.
- **S045** ⬜ Задать имена обеих сторон (Associated attribute name).
- **S046** ⬜ Двусторонняя навигация: с invoice→company и с company→invoices.
- **S047** ⬜ Несколько relationship на объект (Company, Billing Admin→People, Workspace).
- **S048** ⬜ Подтянуть поле связанной записи в колонку view (email billing-админа).
- **S049** ⬜ Drill-in: на company показать email-адреса team (связанных people).

## 4. Записи (Records)
- **S060** ✓ Создать запись (+ New) с заполнением атрибутов.
- **S061** ✓ Открыть запись → record-страница.
- **S062** ~ Inline-редактирование значения в таблице.
- **S063** ✓ Удалить (архивировать) запись.
- **S064** ✓ Поиск записей (по primary-атрибуту / searchText).
- **S065** ✓ Пагинация списка записей.
- **S066** ⬜ Bulk-выбор записей (чекбоксы) → массовое действие.
- **S067** ⬜ Right-click на значении → когда создано/обновлено.

## 5. Views (виды)
- **S080** ✓ Table-вид с типизированными колонками.
- **S081** ✓ Board (kanban) по select/status-атрибуту.
- **S082** ✓ Переключатель Table ↔ Board.
- **S083** ~ Фильтр: добавить условие (атрибут + оператор + значение).
- **S084** ⬜ Операторы фильтра: eq / neq / contains / gt / lt / in / is_empty / is_not_empty.
- **S085** ⬜ Advanced filter: комбинация AND/OR + группировка.
- **S086** ~ Сортировка (атрибут + asc/desc).
- **S087** ~ Выбор/порядок/ширина колонок (+ колонка).
- **S088** ~ Сохранить вид (Save view) / Save as new.
- **S089** ⬜ Дропдаун выбора сохранённого вида (несколько на объект).
- **S090** ⬜ Drag-drop карточки в Board → смена стадии (есть для deals).
- **S091** ⬜ Группировка Board по другому status-атрибуту.
- **S092** ⬜ Счётчик записей в виде (804 count) + per-column calculations.

## 6. Lists (списки)
- **S100** ⬜ Создать список с нуля (parent-объект + имя).
- **S101** ⬜ Создать список из шаблона (recruitment / customer success / fundraising).
- **S102** ⬜ List-атрибут (живёт только в списке, напр. RSVP, dietary, Summary).
- **S103** ⬜ Добавить запись в список (одна запись — во многих списках).
- **S104** ⬜ Стадии внутри списка (kanban по list-stage).
- **S105** ⬜ Импорт CSV в список (parent + list-атрибуты, см. S224).
- **S106** ⬜ Коллизия entry при импорте: update existing / add separate.
- **S107** ⬜ Сайдбар LISTS → открыть список (table/board как объект).
- **S108** ⬜ Enroll to sequence из people-списка с фильтрами (см. S175).
- **S109** ⬜ Add to list массово (bulk footer).

## 7. Record page (карточка)
- **S120** ✓ Открыть карточку (хлебные крошки, табы, Details).
- **S121** ~ Inline-редактирование полей Details.
- **S122** ⬜ Configure page: вход через «⋮» → режим настройки.
- **S123** ⬜ Highlights: добавить виджет (≤6).
- **S124** ⬜ Highlights: виджет интеграции (Linear/PandaDocs).
- **S125** ⬜ Reorder дефолтных табов (Activity/Emails/Notes/Tasks).
- **S126** ⬜ Добавить relationship-таб (Team/Deals/Invoices).
- **S127** ⬜ Правая панель: создать секцию атрибутов.
- **S128** ⬜ Перетащить атрибут между секциями.
- **S129** ⬜ Action-кнопки сверху: reorder (Compose email и др.).
- **S130** ⬜ Activity tab — история взаимодействий/обновлений.
- **S131** ⬜ Emails tab — общий тред писем (с учётом sharing settings).
- **S132** ⬜ Calls tab — записи звонков + саммари.
- **S133** ⬜ Notes tab — заметки (с нуля / шаблон / линк к встрече).
- **S134** ⬜ Tasks tab — задачи записи.
- **S135** ⬜ Files tab — вложения.
- **S136** ⬜ Comment на записи + @mention коллеги → уведомление (web/email).
- **S137** ⬜ Ответ на comment → уведомление автору.

## 8. Email-инструмент / продуктивность
- **S140** ⬜ Отправить email с record-страницы (выбор получателей: main contact / team).
- **S141** ⬜ Письмо из библиотеки шаблонов (onboarding + booking-ссылка).
- **S142** ⬜ Toggle mass send off → весь team в один тред.
- **S143** ⬜ Mass send группе (кандидаты в стадии screening → interview).
- **S144** ⬜ Email-шаблон с переменными атрибутов (first name, company name).
- **S145** ⬜ Создать email-шаблон (email tab → Templates).
- **S146** ⬜ Создать note-шаблон (notes tab → Templates).
- **S147** ⬜ Task: создать (описание + assignee + due + linked record).
- **S148** ⬜ Task page: фильтр по assignee, mark complete.
- **S149** ⬜ Outbox: очередь sequence-писем (превью, расписание).

## 9. AI-атрибуты (4 типа)
- **S160** ⬜ Создать Classify record (→ Select/Multi-select) + guidance.
- **S161** ⬜ Создать Summarize record (→ Text) + guidance.
- **S162** ⬜ Создать Research agent (→ Text) + вопросы.
- **S163** ⬜ Создать Prompt completion (→ Number/Text/Currency) + промпт.
- **S164** ⬜ Совместимость AI-типа с базовым типом (валидация).
- **S165** ⬜ Запуск AI по ячейке (table).
- **S166** ⬜ Запуск AI по карточке (kanban).
- **S167** ⬜ Запуск AI по заголовку колонки (все строки view).
- **S168** ⬜ Запуск AI на record-странице.
- **S169** ⬜ Loading-состояние «AI is thinking» → значение сохраняется.
- **S170** ⬜ Списание кредитов (Research=10, остальные=1).
- **S171** ⬜ Баланс кредитов (бейдж) + история (Billing).
- **S172** ⬜ Демо-AI без ключа (детерминированный осмысленный результат).
- **S173** ⬜ AI-значение используется в фильтрах/отчётах/триггерах.

## 10. Ask Attio (AI-ассистент)
- **S180** ⬜ Открыть Ask Attio (homepage / сайдбар / топбар).
- **S181** ⬜ «help me prep for my day» → встречи/сделки/задачи.
- **S182** ⬜ «what objections came up recently?» → сводка по calls/notes/emails + цитаты.
- **S183** ⬜ Сохранить промпт (Account settings → Prompts) + имя.
- **S184** ⬜ Переиспользовать сохранённый промпт → call-prep сводка.
- **S185** ⬜ Веб-ресёрч по компании/рынку.
- **S186** ⬜ Во время звонка: «спрашивали ли про pricing?» → кто/когда/что.
- **S187** ⬜ «suggest updates based on call» → ревью → обновить запись.
- **S188** ⬜ «create a task to follow up» → задача+линк+срок.
- **S189** ⬜ «draft a follow-up email» → черновик → send.
- **S190** ⬜ Homepage: приветствие + recent chat + Meetings + Tasks.

## 11. Sequences (цепочки писем) — видео 14–16, §11
- **S200** ⬜ Создать sequence: Automations→Sequences→New → title → черновик.
- **S201** ⬜ Settings: sending window (часы, напр. 9:00–18:00) — вне окна письмо в очередь до начала след. окна.
- **S202** ⬜ Settings: лимиты доставляемости — **12 писем/час на ящик**, пауза **5 мин**, **200/день на ящик**.
- **S203** ⬜ Settings: business days only / включить выходные.
- **S204** ⬜ Settings: unsubscribe-ссылка (свой текст + превью).
- **S205** ⬜ Settings: subsequent emails — тот же тред или новый.
- **S206** ⬜ Settings: вкл. Attio-подпись из mailbox settings.
- **S207** ⬜ Exit criteria: reply received → убрать получателя из цепочки.
- **S208** ⬜ Exit criteria: meeting booked → убрать получателя.
- **S209** ⬜ Доступ к sequence: по умолчанию весь workspace, можно ограничить.
- **S210** ⬜ Delegated sending: коллега энроллит, письмо уходит из твоего ящика.
- **S211** ⬜ Шаг 1: первое письмо в очередь сразу при энролле (или wait N дней).
- **S212** ⬜ Переменные в письме: персонализация атрибутами person (имя, компания).
- **S213** ⬜ Письмо из шаблона / с нуля.
- **S214** ⬜ Add step: доп. письмо + сколько дней ждать (follow-up не ответившим).
- **S215** ⬜ Publish sequence → черновик становится живым.
- **S216** ⬜ Enroll одного получателя (person) в sequence.
- **S217** ⬜ Enroll массово из people-списка с фильтрами (см. S108).
- **S218** ⬜ OOO-детект (auto-reply «отсутствую») → не считать ответом, не выходить.
- **S219** ⬜ Pause / resume / exit получателя вручную.
- **S220** ⬜ Outbox: очередь sequence-писем (превью, расписание) — см. S149.
- **S221** ⬜ Unsubscribe-список workspace (глобальный suppress).
- **S222** ~ Метрики sequence: sent / opened / replied / booked (легаси-аналитика по кампаниям частично есть).
- **S223** ⬜ Warm-up отправки нового ящика (ramp-лимиты) — у легаси есть, перенести в sequence.
- **S224** ⬜ Импорт получателей CSV прямо в enroll.

## 12. Workflows — триггеры и логика — видео 17–26, §12
- **S230** ⬜ Создать workflow: холст слева (блоки+связи) + редактор справа (настройка блока).
- **S231** ⬜ Trigger: Record created (выбрать объект).
- **S232** ⬜ Trigger: Record updated (объект + атрибут, напр. Deal→stage).
- **S233** ⬜ Trigger: List created / List updated.
- **S234** ⬜ Trigger: Record command — ручной запуск с записи.
- **S235** ⬜ Trigger: Task created.
- **S236** ⬜ Trigger: Utility — manual / schedule (cron) / webhook.
- **S237** ⬜ Trigger: Integration — Typeform submission / Outreach и т.п. → создать запись.
- **S238** ⬜ Logic: Filter — продолжать или нет по критерию (переменные прошлых шагов).
- **S239** ⬜ Logic: If/else — 2 пути.
- **S240** ⬜ Logic: Switch — N путей по группам критериев.
- **S241** ⬜ Logic: Advanced filters — AND/OR + группировка.
- **S242** ⬜ Logic: Round robin (распределение по владельцам).
- **S243** ⬜ Delay-блок: ждать N времени.
- **S244** ⬜ Delay until: ждать до условия/времени.
- **S245** ⬜ Переменные: вставка из любого предыдущего блока (видно «N блоков назад»).
- **S246** ⬜ Холст: добавить/удалить/соединить блоки, ветвление.
- **S247** ⬜ Библиотека шаблонов воркфлоу по индустриям.

## 13. Workflows — действия, AI, интеграции, runs — видео 19–26, §12
- **S255** ⬜ Action: Create record (объект + значения атрибутов из переменных).
- **S256** ⬜ Action: Create-or-update record (дедуп по уник-атрибуту).
- **S257** ⬜ Action: Update record.
- **S258** ⬜ Action: Find record (по критерию → в переменную).
- **S259** ⬜ Action: Delete record.
- **S260** ⬜ Action: Add record to list (+ заполнить list-атрибуты).
- **S261** ⬜ Action: Task (создать/обновить задачу + assignee + due).
- **S262** ⬜ Calculation: Formula (мат-операции, напр. new MRR − old MRR).
- **S263** ⬜ Calculation: Adjust time (сдвиг, напр. триггер + 2 дня = due date).
- **S264** ⬜ Calculation: Aggregate / Random.
- **S265** ⬜ AI-блок: Classify / Summarize / Research / Prompt (см. модуль 9).
- **S266** ⬜ AI-блок: Classify text (вход — произвольный текст).
- **S267** ⬜ Loop/Find блок: пройтись по набору записей (лимит 100).
- **S268** ⬜ Integration: Slack — post в канал (с переменными).
- **S269** ⬜ Integration: Slack actions — кнопки в сообщении + пауза воркфлоу до клика.
- **S270** ⬜ Integration: HTTP-блок (6 методов) — POST в внешний API (Intercom и т.п.).
- **S271** ⬜ Integration: Parse JSON блок (разобрать ответ в переменные).
- **S272** ⬜ Integration: Mailchimp / Mixmax / Outreach / Webhook.
- **S273** ⬜ Integration: enroll в sequence из воркфлоу.
- **S274** ⬜ Runs-вкладка: прохождение по блокам в реальном времени.
- **S275** ⬜ Runs: ретроспектива запусков + ошибки блоков.
- **S276** ⬜ Сквозной пример (26): MRR updated→formula(ΔMRR)→filter(≠0)→switch(рост/падение/отмена)→Slack+HTTP / task+adjust time / classify churn-причины.

## 14. Reports (отчёты) — видео 07–09, §14
- **S285** ⬜ Создать отчёт: тип Insight (pivot по атрибутам).
- **S286** ⬜ Тип Historical (анализ воронки во времени).
- **S287** ⬜ Тип Funnel (конверсии по стадиям).
- **S288** ⬜ Тип Time in stage (сколько в каждой стадии).
- **S289** ⬜ Тип Stage change (переходы между стадиями).
- **S290** ⬜ Group by (атрибут строк).
- **S291** ⬜ Segment by (атрибут колонок/серий).
- **S292** ⬜ Filter отчёта (по любым атрибутам, вкл. AI-атрибуты).
- **S293** ⬜ Источник: объект / список.
- **S294** ⬜ Визуализация: bar / line / table / funnel.
- **S295** ⬜ Pipeline-отчёт по status-атрибуту (сумма ARR по стадиям).
- **S296** ~ Дашборд: разместить виджеты-отчёты (легаси-дашборд с recharts есть, не Attio-паритет).
- **S297** ⬜ Drill-in из отчёта в записи.

## 15. Call Intelligence (звонки) — видео 12, §13
- **S310** ⬜ Рекордер авто-джойнит Zoom / Google Meet / MS Teams.
- **S311** ⬜ Account Settings → Call recording: какие звонки авто-джойнить, свой логотип.
- **S312** ⬜ Ручной добавляемый рекордер на встречу.
- **S313** ⬜ Insight-шаблон: секции-промпты (что извлечь/проанализировать), вывод text/bullets.
- **S314** ⬜ Неограниченно секций; персональные и командные шаблоны.
- **S315** ⬜ Применить любой шаблон к любому звонку; переключение = разные ракурсы.
- **S316** ⬜ Live-транскрипт в реальном времени.
- **S317** ⬜ После звонка: summary, meeting chapters, info, speaker stats.
- **S318** ⬜ Привязка звонка к company/person record + activity timeline.
- **S319** ⬜ Calls page: все звонки workspace, фильтр по участникам/записям, favorites.
- **S320** ⬜ Playback: pinned mode (видео+транскрипт при навигации).
- **S321** ⬜ Playback: picture-in-picture.
- **S322** ⬜ Демо: загрузка транскрипта + AI-саммари по шаблону (без реального рекордера).

## 16. Import (импорт) — видео 10–11, §3/§7
- **S330** ~ Импорт CSV в объект (легаси-импорт лидов есть, не Attio-маппинг).
- **S331** ⬜ Маппинг колонок CSV → атрибуты объекта.
- **S332** ⬜ Дедуп по уник-атрибуту (companies = domain).
- **S333** ⬜ Relationship по уник-id при импорте (связать с существующей записью).
- **S334** ⬜ Required-валидация при импорте.
- **S335** ⬜ Импорт CSV в список (parent + list-атрибуты).
- **S336** ⬜ Коллизия entry: update existing / add separate.
- **S337** ⬜ Import history (журнал импортов + откат).
- **S338** ⬜ Предпросмотр перед импортом (первые строки + типы).

## 17. Permissions / RBAC — видео 01, §16
- **S345** ⬜ Роли Admin / Member (admin — настройки workspace; member — нет).
- **S346** ⬜ 4 уровня доступа: No access / Read only / Read and write / Full access.
- **S347** ⬜ 3 области: Workspace (дефолт) / Team / Individual — точнее перекрывает шире.
- **S348** ⬜ Права на сущность: Objects / Lists / Dashboards / Workflows / Sequences.
- **S349** ⬜ Workspace access: дефолт для всех членов.
- **S350** ⬜ Team override: уровень для команды (Sales-EU/US/UK).
- **S351** ⬜ Individual override: уровень для конкретного члена.
- **S352** ⬜ Automations-грант: доступ воркфлоу к сущности (Read/Read+write).
- **S353** ⬜ Members and teams: создать команду, добавить участников.
- **S354** ⬜ Пригласить участника в workspace (invite).
- **S355** ⬜ Применение прав: скрыть/заблокировать UI по уровню (No access не виден).
- **S356** ⬜ Expert access groups (внешние эксперты с ограниченным доступом).

## 18. Apps & Integrations — видео 06, §16
- **S362** ⬜ Каталог приложений (Settings → Apps).
- **S363** ⬜ 3 типа приложений (нативные / OAuth-интеграции / кастомные).
- **S364** ⬜ Подключить интеграцию (Slack / Gmail / Calendar / Linear / PandaDoc).
- **S365** ⬜ Виджет приложения на record-странице (Highlights, см. S124).
- **S366** ⬜ Email-аккаунты: подключить ящик (Settings → Email and calendar accounts).
- **S367** ⬜ Developers: API-ключи / webhooks.

## 19. Settings / Workspace / кредиты-биллинг — §16
- **S372** ⬜ Settings-навигация: Personal (Profile, Appearance, Notifications…) / Workspace (General, Members, Plans, Billing, Objects, Lists, Dashboards, Sequences, Workflows…).
- **S373** ⬜ Workspace General: имя, логотип, домен.
- **S374** ⬜ Appearance: тема (light/dark) — у нас dark по умолчанию.
- **S375** ⬜ Plans: тарифы (Free/Plus/Pro/Enterprise) + лимиты.
- **S376** ⬜ Billing: кредиты AI — баланс, разбивка по типам и времени.
- **S377** ⬜ Списание кредитов (Research=10, остальные=1) — см. S170.
- **S378** ⬜ Докупка кредитов / месячный пакет в плане.
- **S379** ⬜ Storage accounts (хранилища файлов).
- **S380** ⬜ Security (2FA, SSO, сессии).
- **S381** ⬜ Migrate CRM (импорт из другой CRM).

## 20. Email sync & enrichment — видео 28, §10
- **S386** ⬜ Подключить ящик → авто-синк писем в Attio.
- **S387** ⬜ Email-sync наполняет People/Company автоматически (новые контакты из переписки).
- **S388** ⬜ Enrichment записи (домен → данные компании).
- **S389** ⬜ Communication intelligence (частота/последний контакт по записи).
- **S390** ⬜ Sharing settings: какие письма видны команде (private/shared).
- **S391** ⬜ Emails tab записи: общий тред переписки (см. S131).
- **S392** ⬜ Calendar-синк: встречи на activity timeline.

## 21. Notifications, collaboration & демо-режим
- **S396** ⬜ Comment на записи + @mention → уведомление (web/email), см. S136.
- **S397** ⬜ Ответ на comment → уведомление автору, см. S137.
- **S398** ⬜ Центр уведомлений (топбар): упоминания, задачи, назначения.
- **S399** ⬜ Email-дайджест уведомлений.
- **S400** ⬜ Demo-режим: всё работает без внешних ключей (демо-данные/SMTP/AI), см. S172.
- **S401** ⬜ Seed демо-workspace: объекты+записи+списки+воркфлоу+звонки для прохода сценариев.
- **S402** ⬜ Миграция legacy Lead/Campaign → People/Companies/Sequences (см. project-state).
- **S403** ⬜ Onboarding-визард первого входа (bootstrap 5 объектов, см. S005).
