# Озвучка эталонного видео Attio — транскрипт + требования к продукту

Источник: `vimeo.com/1075744483`, демо «Platform Demo» (спикер — Marissa, Attio).
Длительность 9:17, 106 реплик. Аудио извлечено ffmpeg → распознано faster-whisper (small, en).
Файлы: `.bridge/ref/transcript.srt` (с таймкодами), `.bridge/ref/transcript.txt`, `.bridge/ref/audio.mp3`.

Привязка к кадрам: нарезка 2 кадра/сек → **№ плотного кадра ≈ секунда × 2** (всего 1114 в `.bridge/ref/dense_hq/`,
уникальных 114 в `docs/screens_dense/`). Ниже — что говорят (англ. оригинал) + что это значит для НАШЕГО продукта (RU).

---

## 1. Позиционирование (00:00–00:16)
> «Atio is the next generation of CRM… CRM should be quick to set up, easily adapt to your business model, and AI should be foundational to the experience.»

**Требование:** CRM как платформа с гибкой моделью данных и AI «в фундаменте» (не сбоку). Три столпа: быстрый старт, адаптивность под бизнес-модель, AI-first.

## 2. Объекты Companies + People, авто-наполнение из почты (00:16–00:35)
> «start with a company object… Alongside people, these objects automatically populate when you connect your mailbox by creating records for the companies and people that you have emailed or met with, reducing setup time.»

**Требование:**
- Стандартные объекты **Companies** и **People** с записями (records).
- **Mailbox sync**: при подключении почты автоматически создаются записи компаний/людей, с кем была переписка/встречи. (У нас — демо-импорт + реальный IMAP/Gmail коннектор позже.)

## 3. Обогащение (enrichment) (00:31–00:51)
> «Atio enriches these records with attributes like LinkedIn, employee range, and job title. Communication and intelligence, again synced from your mailbox… connection strength, last interaction, and next calendar interaction.»

**Требование:** авто-атрибуты:
- Enrichment-поля: **LinkedIn, Employee range, Job title** (внешние источники Clearbit/Crunchbase — как в тултипе кадра 7).
- **Communication intelligence** из почты/календаря: **Connection strength, Last interaction, Next calendar interaction**.

## 4. Кастомные атрибуты + типы данных (00:51–01:22)
> «create as many of your own custom attributes… choose my data type, give it a title… a select type attribute to show if a company is a prospect or a customer, or a currency type attribute to store their MRR.»

**Требование:** конструктор атрибутов (модалка Create attribute, кадры 9–12). Типы (полный список из кадра 10): Text, Number, Checkbox, Date, Rating, Timestamp, Status, Multi-select, Currency, Record, User, Select, Relationship, Location, Phone Number + **AI-типы: Classify record, Summarize record, Research agent**. Примеры: Select (prospect/customer), Currency (MRR).

## 5. Relationship-атрибуты (01:22–02:13)
> «relationship attributes… associate different records to one another… retrieve attribute data from the other side of the relationship… create a relationship between companies and people, select one to one… main point of contact… pull in data from their record, such as the email address.»

**Требование:**
- Тип **Relationship** связывает записи (Company↔Person и т.д.), кардинальность **one-to-one / one-to-many**.
- Обратная сторона связи доступна с двух концов; можно **подтягивать поля связанной записи** (напр. email главного контакта прямо в карточке компании).

## 6. Стандартные объекты целиком (02:13–02:28)
> «Companies and people are two of Atio's standard objects which also include **deals** for your sales pipeline and **workspaces** and **users** for syncing your customer and product usage data… track both prospective and existing customers.»

**Требование:** 5 стандартных объектов: **Companies, People, Deals, Workspaces, Users**. Deals = воронка продаж; Workspaces/Users = синхронизация продуктовых данных (existing customers).

## 7. Deals: воронка, Table/Kanban, workflow-наполнение (02:23–02:49)
> «track the buying journey from first contact through to close in table or Kanban views. Atio's workflow tool and integrations… populate new leads from web forms, demo bookings, or customer usage data… complete control over the data… streamline and automate every step of the deal management process.»

**Требование:** Deals — путь сделки first contact→close, виды **Table и Kanban** (✅ уже сделано). Наполнение лидами из веб-форм / бронирований демо / usage-данных через workflow+интеграции.

## 8. Views: фильтры, кастомные колонки, Kanban (02:49–03:06)
> «Views let you build customized pages with the exact data that you need… filter customized attributes or switch to a Kanban board for clear process tracking.»

**Требование (= текущий Блок 1.5):** сохраняемые **Views** с фильтрами, выбором/порядком колонок, сортировкой, переключением Table↔Kanban.

## 9. AI-атрибут ICP + email-шаблон + смена стадии (03:06–03:37)
> «a view of all deals in inbound leads assigned to me with an **AI attribute evaluating their fit to our ideal customer profile**… high urgency opportunity… send them an **email template for high value leads** which is customized with details from our data… flag them as a high value opportunity and move them to our **contacted** sales stage… automate processes like these to send emails and update the data with a single click.»

**Требование:**
- **AI-атрибут** = оценка соответствия ICP (fit/urgency) — наш Classify record.
- **Email-шаблоны** с подстановкой данных записи (merge-поля).
- Сценарий «один клик»: отправить email → пометить High value → перевести стадию → всё автоматизируется.

## 10. Record page: highlights, табы Activity/Email/Calls/Notes/Tasks/Files, comments + @mention (03:37–04:44)
> «navigate to a record page… highly customizable… control over what data points you're highlighting at the top and at the side… **activity overview** tracks history of interactions and data updates… **email tab** shared view of every email touch point… fine grained control over how email data is shared… **calls** recorded through Atio's call recorder… templates to extract and summarize topics… **Notes** store call prep and meeting summaries… **to-dos and files**… add tabs for relationship attributes… **comments** and when you @mention a teammate they'll receive an alert in Atio web and mobile app… configure additional alerts like emails.»

**Требование (карточка записи):**
- Настраиваемые **highlights** (топ + правая панель Details). ✅ панель есть, добавить выбор полей.
- Табы: **Activity** (история), **Emails** (общий вид всех писем + контроль доступа), **Calls** (запись звонков + AI-саммари по шаблону), **Notes** (подготовка/итоги встреч), **Tasks/To-dos**, **Files**, табы по relationship-атрибутам.
- **Comments + @mention** → алерты в web/mobile + опционально email.

## 11. Кастомные объекты (04:44–05:15)
> «open data model doesn't limit you to standard objects… create custom objects tailored to represent any process or entity… an **invoices object** which is syncing due dates and amounts from my invoicing platform and associating them to the company, workspace and billing admin… single source of truth.»

**Требование:** пользователь создаёт **свои объекты** (напр. Invoices) с атрибутами и связями (Invoice→Company/Workspace/Billing admin). У нас модель Object уже гибкая — нужен UI «Create object».

## 12. Cross-object workflow: фильтрация людей для события (05:15–06:03)
> «run a workflow… upcoming event in London… start from this list of platform admins… a saved view… people whose associated user login (user object) has admin level permissions… filter that their city is London… only people who work for companies where they are in the **ICP category**… narrowed down to those based in London whose companies match my ICP and who are power users… add them all to a **list of invitees**.»

**Требование:** фильтры через связи между объектами (Person → User permissions, Person → Company ICP). Saved views + многокритериальная фильтрация → массовое действие **Add to list**.

## 13. Lists (списки-процессы) (06:03–06:48)
> «**Lists are a subset of records**… track processes like recruitment, customer success or fundraising… from scratch or from a pre-existing template… manage as many processes as needed… **list specific attributes** which exist only in the context of their list… RSVPs and dietary requirements without editing or cluttering the parent record.»

**Требование (= Блок 1.9):** **Lists** — подмножества записей под процессы. Создание с нуля/из шаблона. **Атрибуты уровня списка** (живут только в списке, не засоряют объект). Пример: RSVP, Dietary.

## 14. Workflows (триггеры + блоки) (06:48–07:34)
> «this list uses both **workflows and sequences**… Workflows automate your go-to-market tasks… anything from simple Slack notifications all the way to researching, triaging and routing your leads… choose a **trigger**… then various **action, condition or calculation blocks**… a workflow triggered any time a person is added to the invite list… add that person into an email sequence and update the status attribute.»

**Требование (= Блок Workflows):** конструктор: **Trigger** + блоки **Action / Condition / Calculation**. Пример: триггер «person added to list» → action «add to sequence» + action «update status». Интеграции (Slack), AI-блоки (research/triage/route).

## 15. Sequences (цепочки писем + авто-follow-up) (07:34–08:12)
> «that **sequence** automates email sending for one or more subsequent emails… sends an initial email with details of the event requesting that person replies to RSVP… if after our chosen amount of days we have not received a reply then Atio will automatically send the **follow-up email**… one click of add to list.»

**Требование (= Блок 1.10):** **Sequences** — цепочки писем: первичное письмо + авто-follow-up через N дней при отсутствии ответа. Полная связка: add to list → workflow → sequence → отправка+статус, всё одним кликом.

## 16. Reporting (08:12–09:10)
> «reporting gives leaders tools to understand trends, patterns and track performance against goals. **Five types of reports**… pivot style reporting… complex historical analysis to understand how customers moved through pipelines over time… revenue dashboard… growth of customer base… **funnel reports**… inbound lead volume, number of product sign-ups, data from users who decide to **churn**… reporting extends beyond just deals.»

**Требование (= Блок Reports/Dashboards):** **5 типов отчётов**, pivot-style, исторический анализ движения по воронке. Дашборды: рост базы, funnel-эффективность, inbound lead volume, sign-ups, churn. Отчёты по любым объектам, не только deals.

---

## Итоговый перечень фич из озвучки (чек-лист продукта)

| # | Фича | Статус у нас |
|---|------|-------------|
| 1 | Объекты Companies/People/Deals/Workspaces/Users | ✅ Companies/People/Deals; ⬜ Workspaces/Users |
| 2 | Mailbox sync → авто-записи | ⬜ (демо-импорт есть) |
| 3 | Enrichment (LinkedIn/Employee range/Job title) | 🟡 поля есть, авто-обогащение демо |
| 4 | Communication intelligence (connection strength/last/next interaction) | ⬜ |
| 5 | Конструктор атрибутов + все типы | 🟡 backend есть, UI-модалка ⬜ |
| 6 | AI-типы (Classify/Summarize/Research) | ⬜ (Блок Workflows) |
| 7 | Relationship-атрибуты (1-1/1-many, обратная сторона) | 🟡 модель есть, UI ⬜ |
| 8 | Deals Table/Kanban | ✅ |
| 9 | Saved Views (фильтр/колонки/сортировка) | 🟡 Блок 1.5 в работе |
| 10 | Email-шаблоны с merge-полями | ⬜ Блок 1.10 |
| 11 | Record page: Activity/Email/Calls/Notes/Tasks/Files/comments/@mention | 🟡 каркас есть, табы ⬜ |
| 12 | Custom objects (UI создания) | 🟡 модель есть, UI ⬜ |
| 13 | Lists + list-level attributes | ⬜ Блок 1.9 |
| 14 | Workflows (trigger + action/condition/calculation) | ⬜ |
| 15 | Sequences (письма + авто-follow-up) | ⬜ Блок 1.10 |
| 16 | Reports (5 типов) + Dashboards | ⬜ |
