# Реверс-инжиниринг — Видео 28: «Email sync, People and Company records» (3:57)

Тема: синк почты → авто-наполнение People/Company. Для ТЗ — §10 Email sync + §9 Enrichment.

## Механика (из звука)
- При регистрации — предложение **sync mailbox** (можно позже в account settings).
- После синка **People** наполняется всеми, с кем переписывался/встречался; **Companies** — из email-доменов; каждый person связан с company (relationship-атрибут).
- На record: **Activity tab** (встречи/события), **Email tab** (письма). Видимость письма зависит от **inbox sharing settings** (полное содержимое / тема+получатели / только получатели); можно дать full access конкретным людям или на record-уровне.
- Правая панель атрибутов: name/email из синка + **авто-enrichment** (job title, social handles, location, для company — size/financials/industry/location).
- **Communication intelligence** атрибуты: strength + recency коммуникации с любым company/person.
- **Custom views** через фильтры: пример «tech-фирмы в US» — filter category contains technology + country = USA; выбор колонок (убрать/добавить, напр. primary location state); **drill-in связанных people** (team email addresses через relationship); сортировка (атрибут + asc/desc); save changes / create new view (общий, коллаборативный).

## Требования для ТЗ
- Демо-синк почты → авто People/Company + relationship person↔company.
- Activity/Email табы + inbox sharing settings (3 уровня видимости).
- Авто-enrichment атрибуты + communication intelligence (strength/recency).
- Custom views (фильтры + колонки + drill-in связей + сортировка + save/create) — пересекается с Блоком 1.5.

## Сценарии (acceptance)
1. Sync mailbox (демо) → People/Company наполнены, person связан с company.
2. На person: Email tab по sharing settings; правая панель enrichment + connection strength.
3. Создать view «tech US»: filter category=technology + country=USA, добавить team emails (drill-in), сортировка → save as new.
