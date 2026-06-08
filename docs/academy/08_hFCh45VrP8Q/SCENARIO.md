# Реверс-инжиниринг — Видео 08: «How to use Insight reports» (2:52)

Тема: детальная сборка Insight-отчёта. Для ТЗ — §14 Reports (Insight).

## Сборка Insight-отчёта (шаги, из звука)
Insight = real-time снимок (данные как есть сейчас). Гибкий «холст» для атрибутов:
1. **Метрика** (Y-ось): напр. total open revenue по объекту Deals (сумма $ всех сделок). Можно сохранить как одиночное значение (single value) на дашборд.
2. **Group by** (X-ось): атрибут группировки, напр. **sales stage** → текущее значение по каждой стадии воронки.
3. Скрытие стадий: спрятать Closed Won / Closed Lost → показать только open pipeline.
4. **Segment by**: композиция каждого бара, напр. **owner** (вклад каждого AE в open pipeline).
5. **Filters** (на любом типе отчёта): сузить записи, напр. deals owned by US team → только US-воронка.

## Популярные примеры Insight
- Сколько новых клиентов в каждой стадии onboarding-воронки (group by onboarding stage = status).
- Сколько клиентов отвалилось и по каким причинам (churn reason).
- Новые workspace-signups понедельно (group by **created at** = system date attribute, cadence weekly).
- X может быть status-атрибутом ИЛИ date-атрибутом (любым кастомным date → time-series).

## Требования для ТЗ
- Билдер Insight: Метрика (sum/count/value по атрибуту объекта) → Group by (атрибут, X) → Segment by (композиция) → Filters → скрытие отдельных значений.
- Поддержка single-value отчёта.
- X = status ИЛИ date-атрибут (включая created at, кастомные date) с cadence (weekly/monthly).

## Сценарии (acceptance)
1. Insight на Deals: metric=sum(amount), group by=stage, hide Closed → open pipeline по стадиям.
2. + segment by owner → composition баров. + filter team=US.
3. Insight: group by created at, weekly → новые сделки по неделям.
