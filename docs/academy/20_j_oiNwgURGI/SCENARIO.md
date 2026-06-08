# Реверс-инжиниринг — Видео 20: «Workflows — AI blocks» (6:01)

Тема: AI-блоки в воркфлоу. Для ТЗ — §12 Workflows (AI) + §4.1.

## 5 AI-блоков (из звука)
- **Summarize record** — атрибуты записи → текстовый summary (guidance: что включить).
- **Classify record** — атрибуты записи → теги (select-опции), не текст. Пример: тип бизнеса связанной компании.
- **Classify text** — свободный текст → теги. Пример: причина отмены (churn reason) из формы → стандартизированные теги.
- **Prompt completion** — LLM-ответ на кастомный промпт + переменные. Пример: «where are you based» → ISO country code (London→GB) для чистки данных.
- **Research record** (agent-секция) — веб-ресёрч (отдельное видео 25).

**Важно:** теги, которые AI-блок выдаёт для classify, **должны совпадать с select-опциями** атрибута, куда пишем.

## Пример сборки (sales→CS handover)
Trigger record updated (deal status) + filter (Won) → **Summarize record** (deal, guidance) → **Classify record** (company → industry-теги) → **Add record to list** (CS-list): deal notes = summary-переменная, tag = tags-переменная.

## Требования для ТЗ
- AI-блоки в воркфлоу = те же 4 типа AI-атрибутов + classify text + research (видео 25).
- Выход AI-блока (summary/tags/число) → переменная для следующих блоков (update/add to list).
- Совпадение тегов classify с select-опциями целевого атрибута.

## Сценарии (acceptance)
1. Won deal → summarize → classify company industry → add company to CS-list с notes+tag.
2. Workspace cancelled → classify text(churn answer) → update workspace churn reason.
3. Form → prompt completion (location→ISO) → add to list с country=GB.
