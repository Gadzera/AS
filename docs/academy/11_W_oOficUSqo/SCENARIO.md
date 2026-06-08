# Реверс-инжиниринг — Видео 11: «Import your data into Lists» (4:15)

Тема: импорт CSV в списки. Для ТЗ — §7 Lists + импорт. (База — как видео 10.)

## Отличия импорта в список (из звука)
- Импорт в список **создаёт/обновляет И list entries, И parent-записи**. Пример: список leads, parent = people → создаются list entries + person-запись на каждую строку.
- В маппинге доступны **атрибуты parent-объекта (people) И атрибуты уровня списка**.
- Можно создать новый атрибут на лету (напр. text «Summary» в списке).
- **Действие при существующем list entry для записи:** выбрать **update existing entry** ИЛИ **add as separate entry** (пример: новые лиды с ивента → add again, чтобы не перезатереть).
- Уник-атрибут (email) → дедуп parent-записей (update/create), как в объектах.
- Несуществующее значение select (lead source «Tech Week event») в review → добавить как опцию атрибута.
- Required: на people и на этом списке их нет → не обязательны.
- Preview (records/list entries created/updated) + Import history + ошибки.

## Требования для ТЗ
- Импорт в список: маппинг на parent-атрибуты + list-атрибуты; создание list-атрибута на лету.
- Опция при коллизии entry: update existing / add separate.
- Добавление новой опции select прямо в review.
- Создание/обновление и list entry, и parent record.

## Сценарии (acceptance)
1. Импорт leads.csv в список Inbound Leads (parent=people): email→дедуп person; stage→list-атрибут; новый list-атрибут Summary.
2. Коллизия entry → выбрать «add as separate entry».
3. Новая опция lead source «Tech Week event» добавлена в review.
