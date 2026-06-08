# Реверс-инжиниринг — Видео 15: «How to enroll recipients to sequences» (4:15)

Тема: запись получателей в sequences (вручную + воркфлоу). Для ТЗ — §11 Sequences + §12 Workflows.

## Ручной enroll (из звука)
- В **sequence editor** → кнопка **Enroll recipients**.
- Кнопка **Enroll to sequence** на object views и record-страницах people, и в people-списках.
- Сценарий: применить фильтры (city is London + associated user status is active) → выбрать чекбоксами / Select all из отфильтрованного view → **Enroll to sequence** → выбрать **sender** (можно коллегу, у кого включён delegated sending, напр. Heather).

## Авто-enroll через workflow (пример inbound lead)
- Триггер: **form submitted** (Typeform talk-to-sales на сайте).
- **Create/update person** record из данных формы → **Delay 5 минут** (чтобы создалась company и наполнились enriched-атрибуты).
- **If-else** на ICP (VC-backed tech startup, основан <5 лет): данные category, foundation date, funding raised в условии.
  - **False path** (не ICP): **round robin** block → create deal в стадии **Lead** (sales ревьюит ежедневно).
  - **True path** (ICP): round robin → create deal, пометить **ICP**, стадия **Contacted** → **Enroll sequence** block (sequence + recipient + sender = picked user из round robin / deal owner).
- Trigger + logic + action блоки дают полную гибкость когда/как enroll.

## Требования для ТЗ
- Enroll вручную: из sequence editor, из people view/record/list (с фильтрами + select all), выбор sender (+ delegated).
- **Enroll sequence** как action-блок воркфлоу (sequence/recipient/sender, sender из round-robin/owner).
- Round-robin блок (распределение по команде).

## Сценарии (acceptance)
1. People view → фильтр city=London + active → select all → Enroll to sequence, sender=Heather (delegated).
2. Workflow: Typeform submitted → create person → delay 5м → if ICP → round robin → create deal (ICP, Contacted) → enroll sequence.
