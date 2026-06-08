# Реверс-инжиниринг — Видео 03: «Custom Objects and relationships» (4:06)

Тема: кастомные объекты + relationship-атрибуты (модель данных). Для ТЗ — §3 Объекты, §5 Relationship.

## Экраны (по кадрам)
**f_00230 — Settings → Objects → Invoices, модалка конфигурации relationship + список атрибутов:**
- Модалка «Invoices»: Type = **Relationship**; блок **Configure relationship**: слева **Invoices** (Associated attribute name: **Company**) — селектор кардинальности **Many to one** — справа **Companies** (Associated attribute name: **Invoices**); кнопка **Save changes**.
- Список атрибутов объекта Invoices: **List Entries** (Record, System), **Next due task** (Record, System), **Created at** (Timestamp, System), **Created by** (User, System), **Invoice Name** (Text, **Unique**), **Company** (→Companies, Relationship), **Billing Admin** (→People, Relationship), **Workspace** (→Workspaces, Relationship), **Amount** (Currency), **Status** (Status), **Due Date** (Date). Кнопка **Create attribute**.
- Каждый атрибут — drag-handle (порядок), имя, тип, бейдж System/Unique, меню «⋮».

## Механика (из звука)
- **5 стандартных объектов:** people, companies, deals, workspaces, users.
- **Кастомные объекты:** создаёт **Admin** из object menu в workspace settings: имя + иконка + атрибуты. Пример Invoices (payment status, due date, amount, company).
- **Relationship-атрибут** связывает записи разных объектов, двусторонне (на invoice показывается «Company», на company — обратное «Invoices»); навигация между записями. Стандартные связи: companies↔people (team), deals→company/people.
- **Кардинальность:** one-to-one / one-to-many / many-to-one / many-to-many (пример: одна company → много invoices, каждый invoice → одна company = many-to-one).
- **Несколько relationship на объект:** Company, Billing Admin (→People), Workspace (→Workspaces).
- **Unique-атрибут:** для ID/уник-идентификатора → предотвращает дубли, апдейтит/создаёт записи при синке из внешних систем (invoice ID = ID из биллинга).
- **Required-атрибут:** запись нельзя создать/обновить без значения.
- **Record text setting:** какой text-атрибут показывается как имя записи (вместо Record ID); выбор из любых text-атрибутов (пример: Invoice Name).
- **Наполнение данными:** вручную, через нативные интеграции, workflow-тул, low-code (Zapier/n8n), или API.
- **Первый view:** table (как таблица) или kanban (по стадиям); view settings → какие атрибуты-колонки показывать; **+ колонка** подтягивает существующие атрибуты и даёт создать новый; можно вытягивать данные из связей (напр. email billing-админа).

## Требования для ТЗ
- UI **Create object** (имя + иконка + тип записи) — Admin only.
- Конфиг relationship-атрибута: выбор целевого объекта + кардинальность (4 варианта) + имена обеих сторон (Associated attribute name) + двусторонняя навигация.
- Флаги атрибута: **Unique**, **Required**, **System** (нередактируемые), **Record text** (title-поле).
- Системные атрибуты по умолчанию: List Entries, Next due task, Created at, Created by.
- Подтягивание полей связанной записи в колонки view.

## Сценарии (acceptance)
1. Admin создаёт объект Invoices (иконка, имя) → добавляет атрибуты (Invoice Name=Text Unique, Amount=Currency, Status, Due Date).
2. Создаёт relationship Invoices→Companies, many-to-one, имена Company/Invoices → на company-записи появляется обратная вкладка Invoices.
3. Ставит Record text = Invoice Name → записи отображаются по имени, не по ID.
4. Unique Invoice ID предотвращает дубли при повторном создании.
