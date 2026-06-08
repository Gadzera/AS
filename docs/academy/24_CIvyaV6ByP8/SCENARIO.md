# Реверс-инжиниринг — Видео 24: «Workflows — Record and List blocks» (6:05)

Тема: блоки создания/изменения записей и списков. Для ТЗ — §12 Workflows (Action: data).

## Блоки (из звука)
Для records И lists:
- **Create record** — выбрать объект → заполнить атрибуты (variables/fixed).
- **Create-or-update record** — сначала проверить по **matching attribute** (уник, напр. email); есть = update, нет = create.
- **Create list entry**.
- **Find records / list entries**.
- **Update records / list entries** — выбрать запись + конкретные атрибуты для новых значений.
- **Delete list entries**.

Переменные create/update = все атрибуты объекта/списка. Для command-триггера доступна переменная **triggered by** (юзер).

## Примеры
1. Record command (company) → **create record** deal (name=company name, type=new business, stage=qualification, owner=triggered by, associated=record) → **update record** company (status=in pipeline).
2. Typeform submitted → **create-or-update person** (match email) + name/phone → **add record to list** inbound leads (stage=fixed, lead source=form answer).

## Требования для ТЗ
- Action-блоки: create / create-or-update (matching attr) / create list entry / find / update / delete list entry.
- Variables = атрибуты объекта; fixed+variable значения; triggered-by.

## Сценарии (acceptance)
1. Company command → create deal + update company status=in pipeline.
2. Typeform → create-or-update person (email) → add to inbound leads (lead source из формы).
