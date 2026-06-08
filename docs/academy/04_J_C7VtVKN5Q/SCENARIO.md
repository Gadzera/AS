# Реверс-инжиниринг — Видео 04: «Introduction to Standard Objects» (3:51)

Тема: 5 стандартных объектов и как они связаны. Для ТЗ — §3 Объекты.

## Механика (из звука)
- **Object** = один тип данных (people/companies/deals…), **record** = строка (запись). Аналогия: объект=таблица, запись=строка.
- **Companies + People** включены по умолчанию; при подключении mailbox автоматически наполняются всеми, с кем переписывался/встречался (исторически и далее) → авто-поддерживаемая контактная база.
- **Deals** — воронка; каждый deal = одна opportunity, связан с company (кому продаём) и people (с кем общаемся). Связи позволяют вести несколько сделок с одной компанией (new/renewal/upsell).
- **Workspaces + Users** — продуктовые данные: workspace = аккаунт клиента в продукте (subscription status, число юзеров, engagement), user = индивидуальный юзер внутри workspace, линкуется к person-записи. Синк через Segment (интеграция) или reverse-ETL (Polytomic) из БД/DWH. Даёт GTM-команде текущее+историческое состояние клиентов и автоматизации флагов opportunity/churn.
- **Сквозной сценарий:** общение с Lisa@Cosme → email-синк создаёт person(Lisa)+company(Cosme) → создаём deal, связанный с обоими → если купила, при заведении аккаунта создаётся workspace (subscription/users/engagement) → Lisa с коллегами становятся user-записями, линкуются к person.
- **System-атрибуты** — стандартные шаблоны ключевых полей (company name, email). + кастомные атрибуты. Пример: deal type (new vs renewal).
- **Типы атрибутов:** text, number, date, currency, dropdown (=select), + **AI-атрибуты** (генерят/обогащают данные), + relationship (двусторонние, напр. billing admin: с person-записи видны все deals, где он billing admin).
- **Управление атрибутами:** object settings — reorder, archive.
- **Наполнение:** вручную / workflows / интеграции (синк product data; создание deal по web-форме; обогащение через research agent или сторонние тулы).

## Требования для ТЗ
- 5 стандартных объектов: Companies, People, Deals, Workspaces, Users (bootstrap).
- System-атрибуты на каждом + добавление кастомных; reorder/archive в object settings.
- Связи между объектами (двусторонние) как ядро модели.
- Демо: эмуляция mailbox-синка (наполнение Companies/People), web-форма→deal.

## Сценарии (acceptance)
1. Companies/People наполняются (демо-синк), Deals связывается с company+people.
2. В deals добавить кастомный select «Deal type» (new/renewal/upsell).
3. С person-записи видны deals, где он billing admin (обратная связь).
