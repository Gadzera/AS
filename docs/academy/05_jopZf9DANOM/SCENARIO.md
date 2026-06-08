# Реверс-инжиниринг — Видео 05: «How to customise record pages» (2:04)

Тема: настройка макета record-страницы. Для ТЗ — §8 Record page.

## Экран (по кадру)
**f_00110 — Configure record page (Companies):**
- Шапка: «Companies › Configure record page», крестик; **Record name** + action-кнопки справа (**Compose email** + иконки интеграций).
- Ряд вкладок: **Overview**, дропдаун **+10**, **+ Add tab**.
- **Highlights**: кнопка **Add widget (4/6)**; виджеты: **Connection strength** (No Connection), **Associated deals**, **Last interaction**, **Customer requests (Linear)** — виджет интеграции.
- Правая панель (секции атрибутов): **Record Details** (Domains, Description, Categories), **Enriched Firmographics** (Foundation date, Employee range, Estimated ARR, Funding raised), **Location** (Primary location ×3), **Social Media Links** (LinkedIn, Facebook, Twitter, AngelList), **Lists**, **+ Add section**.
- Низ: «Changes will be visible to all» + **Cancel / Save changes**.

## Механика (из звука)
- Открытие: на record-странице «⋮» (три точки) вверху справа → **Configure page**. У каждого типа объекта свой макет.
- **4 зоны настройки:**
  1. **Highlights** (вверху Overview-таба) — до **6 виджетов** ключевых атрибутов (segment, company type) + виджеты интеграций.
  2. **Main panel** — переупорядочивание дефолтных вкладок (Activity, Emails, Notes, Tasks) + добавление **relationship-вкладок** (Team, Deals, Invoices…).
  3. **Right side** — атрибуты, сгруппированные в **секции** по темам (General info, Firmographics, Location, Social media); rearrange/add/create sections.
  4. **Action buttons** (вверху справа) — переупорядочивание; дефолты = core-действия Attio + действия интеграций.

## Требования для ТЗ
- Режим **Configure page** на record-странице (вход через «⋮»).
- Highlights: до 6 настраиваемых виджетов.
- Табы: дефолтные (Activity/Emails/Notes/Tasks) reorderable + добавляемые relationship-табы.
- Правая панель: секции атрибутов (создание/переименование/reorder, drag атрибутов между секциями).
- Action-кнопки сверху (Compose email и др.), reorder.
- Сохранение макета пер-объект; «visible to all».

## Сценарии (acceptance)
1. На company-записи «⋮» → Configure page → добавить highlight-виджет (≤6) → Save.
2. Добавить relationship-таб Invoices → на карточке появляется вкладка со связанными invoice-записями.
3. Создать секцию «Social Media Links», перетащить туда LinkedIn/Twitter → Save → отражается на всех company-записях.
