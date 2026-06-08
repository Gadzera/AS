# Доп. исследование Attio — Academy, платформенные страницы, видео

Marissa в конце демо сослалась на **Attio Academy** («in-depth videos of all features»). Ниже — что
удалось вытащить с официальных страниц Attio (help-центр + platform/*), плюс список видео для более
глубокого изучения (их можно прогнать через тот же конвейер: yt-dlp → ffmpeg → faster-whisper).

Дополняет [NARRATION.md](./NARRATION.md) (озвучка основного демо) и [BUILD_BASE.md](./BUILD_BASE.md).

---

## A. Модель данных (platform/data, data-model)
- **Стандартные объекты:** Company, Person, Deal, **User**, **Workspace** (последние два — для софт-компаний: продуктовые данные).
- **Кастомные объекты:** Partnership, Invoices, Buyer, Seller, Transaction… — любая сущность с своими атрибутами и связями.
- **Объект vs Список:** *custom object* — моделирует НОВЫЕ данные/сущность; *list* — организует СУЩЕСТВУЮЩИЕ записи под процесс/воркфлоу.
- **Views** — способы отображения записей без изменения данных; сохраняются внутри объекта или списка.
- **Типы атрибутов (из demo, кадр 10 + страниц):** Text, Number, Checkbox, Date, Rating, Timestamp, Status, Multi-select, Currency, Record, User, Select, Relationship, Location, Phone Number + AI: Classify record, Summarize record, Research agent.
- **Activity Timelines** — история взаимодействий на записи.

## B. Sync почты/календаря + Enrichment (platform/data, enriched-data)
- При подключении Gmail/Outlook + календаря записи People/Company **создаются автоматически** (с кем переписывались/встречались).
- **Enrichment из сотен источников:** revenue, location, employee count/range, LinkedIn, job title, фандрайзинг-данные. Real-time обновление + AI pre-analysis.
- **Communication intelligence** (из почты/календаря/встреч): **connection strength, last interaction, next calendar interaction**, mutual contacts (общие контакты).

## C. AI (platform/ai) — ВАЖНО для нашего AI-SDR слоя
- **Classify record** — превращает неструктурированные данные в структурированные (категории, ICP-фит).
- **Summarize record** — выжимка ключевой информации о записи в actionable-инсайты.
- **AI Research Agent** — веб-ресёрч на основе данных Attio, отвечает на сложные вопросы о проспектах; результаты **триггерят воркфлоу**.
- **AI Autofill** — кастомные AI-промпты под свою модель данных (автозаполнение атрибута).
- **AI Attributes** — обогащение: детали компании, поиск ЛПР (decision-makers).
- **Relationship Intelligence** — connection strength, mutual contacts, relationship mapping.
- **MCP server (read+write tools)** — расширение через свои промпты/воркфлоу/интеграции.

## D. Call Intelligence (platform/call-intelligence)
- Нативная запись звонков: **Zoom, Google Meet, Microsoft Teams**.
- Авто-транскрипция, **100+ языков**.
- AI-саммари в реал-тайме; детект **buying signals, objections, blockers, requests**; **Focus Mode** (перейти к ключевым моментам/ЛПР).
- Авто-привязка звонка к record/deal/person; searchable-библиотека транскриптов; шеринг клипов; **AI-триггеры follow-up/reminders**.

## E. Workflows (platform/workflows)
- **Триггеры:** 2 категории — *Attio Updates* (изменения внутри Attio) и *External Inputs* (внешние тулы).
- **Блоки:** Action / Condition (деревья решений) / Calculation.
- **Интеграции-экшены:** Outreach (добавить в email-sequence + CRM-экшены), **Slack** (контекст/задачи/решения), Typeform (форма→воркфлоу), Mailchimp, Mixmax, **Webhooks** (внешние тулы/DWH/CDP).
- **AI в воркфлоу:** классификация лидов/сделок, генерация саммари, qualification + routing + scoring лидов.
- **Сценарии lifecycle:** onboarding, expansion/upsell, retention/renewal, churn-prevention outreach.

## F. Sequences (из demo + workflows)
- Авто-цепочки писем: первичное + follow-up через N дней при отсутствии ответа.
- Запуск вручную или из воркфлоу по изменению данных в CRM.
- Связка: add to list → workflow (trigger) → enroll in sequence → update status.

## G. Reporting & Dashboards (platform/reporting)
- Визуализации: **line, bar, funnel, pie, map**.
- Метрики: pipeline performance, RevOps, PLG-данные, CAC, lead source, **ARR**, гео-паттерны, account по тарифу.
- Дашборды: комбинируют виджеты, real-time коллаборация, **drill-down**, группировка/категоризация.
- Из demo: **5 типов отчётов**, pivot-style, исторический анализ движения по воронке; revenue dashboard, funnel reports, inbound lead volume, sign-ups, churn.

---

## H. Видео для более глубокого изучения (следующий заход)

Можно скачать (yt-dlp) и прогнать тем же конвейером **ffmpeg → faster-whisper**, что и основное демо,
чтобы получить дословные ТЗ по каждой фиче:

| Видео | URL | Что даёт |
|---|---|---|
| Platform Demo (уже изучено) | vimeo 1075744483 | основной обзор — [NARRATION.md](./NARRATION.md) |
| What is Attio? Full intro & demo | youtube `VSYQLmGf3To` | расширенный обзор |
| Attio 101: Complete Tour | youtube `3HY7xhstqZk` | полный тур по UI |
| Getting Started & Beginners (2026) | youtube `Lmek2fUDDhw` | пошаговая настройка |
| Beginner's Guide (2025) | youtube `PG0jk_cRyN0` | базовые сценарии |
| **Academy playlist** (все уроки) | youtube list `PLdI3fFmZEoitQVmpFN6qI9mxgJCHVwky4` | по уроку на фичу: workflows, sequences, reporting, enrichment, calls |

**Источники (help/platform):** attio.com/platform/{data, ai, call-intelligence, workflows, reporting},
attio.com/help/reference/managing-your-data/enriched-data, attio.com/help/academy.
