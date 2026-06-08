# Реверс-инжиниринг — Видео 13: «Introducing AI Attributes» (4:55)

Тема: 4 типа AI-атрибутов. Для ТЗ — §4.1 (ядро AI-SDR). Кадры: f_00095 (дропдаун типов), f_00150 (модалка Create attribute с AI autofill).

## Экраны (по кадрам)
- **f_00095** — дропдаун типа атрибута: секция **AI Autofill** (Classify record / Summarize record / Research agent / Prompt completion) + базовые типы (Text, Number, Checkbox, Date, Rating, Timestamp, Select, Multi-select, Currency, Record, User, Status, Relationship, Location, Phone Number); справа Company attributes + **Create new attribute**.
- **f_00150** — модалка **Create attribute**: Attribute Type, Name, Description (optional), блок **Set up AI autofill** (тумблер), **Autofill type** (напр. Summarize record), **Guidance (optional)** («Tell the AI what to generate from record details and attributes»), «AI will have access to all record attributes», Cancel / Create attribute.

## 4 типа AI-атрибутов (из звука)
| Тип | Вход | Выход | Кредитов |
|-----|------|-------|----------|
| **Classify record** | вся запись | Select / Multi-select (теги) | 1 |
| **Summarize record** | запись (+опц. guidance) | Text | 1 |
| **Research agent** | вопрос/guidance + данные записи (веб-ресёрч) | Text | **10** |
| **Prompt completion** | промпт + переменные | Number / Text / Currency | 1 |

- Создаются как обычные атрибуты (из view объекта/списка или в настройках атрибутов); AI-тип зависит от базового типа.
- **Запуск:** иконка в ячейке (table) / на карточке (kanban) / клик по заголовку колонки (все строки view) / на record-странице. После клика — «AI is thinking» → значение сохраняется как обычное.
- Значения AI используются везде: фильтры, отчёты, триггеры workflow.
- Примеры из видео: Summarize workspace для онбординг-специалиста; Research agent проверяет компанию на ICP; Classify роутит лид в команду по теме обращения; Prompt completion нормализует локацию в ISO country code (чистка данных под отчёты/фильтры).
- **Кредиты:** Research=10, остальные=1/запуск. Баланс и разбивка — в Workspace Settings → Billing. Планы включают месячный пакет + докупка.

## Требования для ТЗ
- enum AttributeAiType (CLASSIFY/SUMMARIZE/RESEARCH/PROMPT) + поля на Attribute (aiType, aiPrompt/guidance).
- Совместимость: CLASSIFY→SELECT/MULTI_SELECT, SUMMARIZE/RESEARCH→TEXT, PROMPT→NUMBER/TEXT/CURRENCY.
- Сервис расчёта + демо-AI (детерминированно, без ключа) + списание кредитов + CreditTransaction.
- UI: модалка Create attribute (как f_00150) + дропдаун с AI-секцией (как f_00095) + иконки запуска (ячейка/заголовок/record) + бейдж кредитов.

## Сценарии (acceptance) — см. текущий блок AI-атрибуты
1. Создать Classify-атрибут (SELECT) с guidance → запустить по строке → присвоен тег, −1 кредит.
2. Research-атрибут → запуск → demo-бриф, −10 кредитов.
3. Запуск по заголовку колонки → пересчёт всех строк view.
