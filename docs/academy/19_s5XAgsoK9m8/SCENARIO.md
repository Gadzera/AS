# Реверс-инжиниринг — Видео 19: «Workflows — Calculation blocks» (5:22)

Тема: блоки вычислений. Для ТЗ — §12 Workflows (Calculation).

## 4 calculation-блока (из звука)
- **Adjust time** — берёт timestamp (старт) + offset (число + единица) → новый timestamp. Пример: workspace created + 1 week → due date задачи.
- **Formula** — мат-выражения над числами/переменными (только number/currency-атрибуты). Пример: ARR / 12 = MRR → update record (MRR на workspace).
- **Aggregate values** — берёт числовой атрибут из группы записей → **sum / average / min / max**. По записям из find-блока ИЛИ по relationship (напр. средний возраст всех people компании). Пример: sum(ARR) найденных workspaces за неделю.
- **Random number** — случайное число в диапазоне [min, max] для последующих шагов.

## Примеры сборки
1. Trigger: workspace created → adjust time (+1 week) → create task (due = adjusted) + formula (ARR/12=MRR) → update record (MRR).
2. Trigger: recurring schedule (пятница) → find records (workspaces, subscription start за последнюю неделю) → aggregate sum(ARR) → slack (число новых workspaces + total ARR).

## Требования для ТЗ
- Calculation-блоки: Adjust time, Formula, Aggregate (sum/avg/min/max по записям/связям), Random.
- Переменные между блоками (number/currency для формул/агрегатов).

## Сценарии (acceptance)
1. workspace created → adjust time +1w → task due; formula ARR/12 → update MRR.
2. schedule → find records → aggregate sum(ARR) → slack-сводка.
