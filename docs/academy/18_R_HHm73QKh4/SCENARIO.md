# Реверс-инжиниринг — Видео 18: «Workflows — Condition and Delay blocks» (3:45)

Тема: блоки логики и задержек. Для ТЗ — §12 Workflows (Logic/Delay).

## Condition-блоки (3 типа, из звука)
- **Filter** — воркфлоу продолжается только если критерий выполнен (напр. email address «not empty»).
- **If/else** — берёт один filter, форкает на 2 ветки (true/false). Пример: existing customer? true → look up person → add to Customer Success list; false → create deal в стадии Lead.
- **Switch** — несколько логических веток + default. Пример: US→Alexis, UK→Joan, default→Zev. Сколько угодно условий/веток.

**Round robin** (рядом с роутингом) — выбрать членов команды (sales reps), ротация на каждом запуске → равномерное распределение лидов; «picked user» используется как переменная (deal owner).

## Delay-блоки
- **Delay** — фиксированная задержка (число + единица: напр. 1 week). Пример: после create deal ждать неделю → filter (stage всё ещё qualification?) → slack «почему не квалифицировали».
- **Delay until** — пауза до указанной даты.

## Требования для ТЗ
- Logic-блоки: Filter, If/else, Switch (N веток + default), Round robin.
- Delay (amount+unit), Delay-until (date). Заморозка/возобновление таймера.

## Сценарии (acceptance)
1. Filter email not empty → продолжить.
2. If/else existing customer → CS-list / create deal Lead. + round robin для owner.
3. Switch по country → разные owner + default. Delay 1 week → проверка stage → slack.
