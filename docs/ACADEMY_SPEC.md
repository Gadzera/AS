# Attio Academy — выжимка точных механик (build-ready спецификация)

Источник: 28 обучающих видео Attio Academy, скачаны и распознаны (yt-dlp → ffmpeg → faster-whisper).
Полные дословные транскрипты: [ACADEMY_TRANSCRIPTS.md](./ACADEMY_TRANSCRIPTS.md). Кадры: `docs/academy/<id>/frames/`.
Ниже — конкретные механики, по которым GPT строит наши аналоги. Дополняет [NARRATION.md](./NARRATION.md).

---

## 1. AI-атрибуты (видео 13) — ядро нашего AI-SDR
**4 типа** (все они же доступны как action-блоки в Workflows):
| Тип | Вход | Выход | Кредитов | Пример из видео |
|---|---|---|---|---|
| **Classify record** | вся запись | Select / Multi-select (теги) | 1 | роутинг лида в нужную команду по теме обращения |
| **Summarize record** | запись (+опц. guidance-промпт) | Text | 1 | саммари workspace для онбординг-специалиста |
| **Research agent** | вопрос/guidance + данные записи | Text | **10** | проверка компании на соответствие ICP |
| **Prompt completion** | промпт + только заданные переменные | Number / Text / Currency | 1 | привести ответ о локации к ISO-коду страны |

Механика:
- Создаются как обычные атрибуты: из view объекта/списка, либо в настройках атрибутов; в дропдауне типа есть AI-варианты + toggle.
- Доступный AI-тип зависит от выбранного базового типа атрибута.
- Запуск: иконка в ячейке (table) / на карточке (kanban); клик по заголовку колонки = пересчёт всех строк в view; либо на record-странице.
- Значения AI-атрибутов используются везде, где и обычные: в отчётах, как триггеры/фильтры воркфлоу.
- Кредиты: видны в Workspace Settings → Billing (разбивка по типам и времени). Планы включают месячный пакет + докупка.

## 2. Workflows (видео 17–26) — конструктор автоматизаций
**Холст слева (блоки и связи) + редактор справа (настройка блока).** 4 категории блоков:

**A. Trigger (старт, всегда первый):**
- Record updated (объект + атрибут, напр. Deal → stage), Record created.
- List created / updated.
- Record command — ручной запуск.
- Task created.
- Utility-триггеры + Integration-триггеры (напр. Typeform submission → создать Deal).

**B. Logic (управление потоком):**
- **Filter** — простейший: продолжать или нет по критерию (переменные из прошлых шагов, напр. «new value of stage = Won»).
- **If/else** — 2 пути.
- **Switch** — N путей по группам критериев.
- **Advanced filters** — комбинации AND/OR + группировка.

**C. Action (действие внутри Attio):**
- Add record to list (выбрать список + record-переменную + заполнить атрибуты списка).
- Create record, Update record, Find record (и то же для списков).
- Task actions.
- AI-блоки: Classify / Summarize / Research / Prompt (см. п.1).
- **Formula block** — мат-операции над переменными (напр. new MRR − old MRR).
- **Adjust time block** — сдвиг времени (напр. триггер + 2 дня = due date задачи).

**D. Integration (downstream-системы):**
- Slack (post в канал, с переменными), HTTP/JSON (POST в Intercom и т.п.), Webhooks, Typeform, Mailchimp, Mixmax, Outreach.

Переменные: вставляются из любого предыдущего блока (отображаются в обратном порядке, видно «N блоков назад»).
**Runs**-вкладка показывает прохождение по блокам в реальном времени и ретроспективно. Есть **библиотека шаблонов** воркфлоу по индустриям.

Пример advanced (видео 26): триггер MRR updated → formula (Δ MRR) → filter (≠0) → switch на 3 пути (рост/падение/отмена) → действия: Slack+HTTP при росте; task+adjust time при падении; classify фидбэка при отмене (причина churn).

## 3. Sequences (видео 14–16) — цепочки писем
Раздел **Automations → Sequences**. New Sequence → title.
**Settings:**
- **Sending window** — часы отправки (напр. 9:00–18:00); вне окна письмо уходит в очередь на начало след. окна.
- **Лимиты доставляемости:** макс **12 писем/час на ящик**, пауза **5 мин** между отправками, **200 писем/день на ящик**.
- Business days only (или вкл. выходные).
- Unsubscribe-ссылка (свой текст + превью).
- Subsequent emails: в тот же тред или новый.
- Включить Attio-подпись (из mailbox settings).
- **Exit criteria** — что убирает получателя из цепочки: **reply received** / **meeting booked**.
- Доступ: по умолчанию весь workspace видит/правит; можно ограничить.
- **Delegated sending** — коллега энроллит получателей, а письмо уходит из ТВОЕГО ящика.

**Шаги (email steps):**
- 1-е письмо — в очередь сразу при энролле (или через N дней wait).
- **Variables** — персонализация атрибутами person-записи (имя, компания…). Шаблон или с нуля.
- Add step to sequence — доп. письма + сколько дней ждать. Follow-up уходит тем, кто не ответил/не забукал встречу.
- Publish sequence → черновик становится живым.

## 4. Call Intelligence (видео 12) — запись звонков
- Рекордер joins **Zoom / Google Meet / Microsoft Teams**, хранит внутри Attio.
- Настройка: Account Settings → Call recording (какие звонки авто-джойнить; ручной добавляемый рекордер; свой логотип). Авто-джойн после email-sync.
- **Insight templates** — секции с промптами (что извлечь/проанализировать/суммировать), вывод text или bullets; неограниченно секций; персональные и командные; пример — sales qualification (current tool, needed features, budget, timeline). Любой шаблон к любой записи, переключение шаблонов = разные ракурсы.
- Live-транскрипт в реальном времени; после звонка — summary, meeting chapters, info, speaker stats.
- Привязка к company/person record, activity timeline, calls page (все звонки workspace; фильтр по участникам/записям, favorites).
- Playback: **pinned mode** (видео+транскрипт при навигации), **picture-in-picture**.

## 5. Прочие уроки (кратко; полностью — в ACADEMY_TRANSCRIPTS.md)
- **Standard Objects (04)** / **Custom Objects & relationships (03)** — модель данных, кардинальности связей.
- **Customise record pages (05)** — настройка highlights и блоков карточки.
- **Notes/tasks/email sending (27)**, **Email sync (28)** — авто-наполнение People/Company.
- **Reports (07) / Insight (08) / Historical (09)** — pivot + исторический анализ воронки.
- **Import in Objects (10) / Lists (11)** — маппинг колонок при импорте.
- **Permissions (01)**, **Ask Attio (02)**, **Apps & Integrations (06)**, **bulk actions (21)**, **HTTP/JSON (22)**, **Integration blocks (23)**, **Record/List blocks (24)**, **AI Research agent (25)**.

---

## Что из этого критично для нашего проекта (новые требования)
1. **AI-атрибуты = 4 типа** с разными выходами и кредитной моделью — закладываем в модель Attribute (AI-подтипы) + воркер расчёта.
2. **Workflow-движок** = trigger + logic(filter/if-else/switch) + action(record/list/task/AI/formula/time) + integration(slack/http). Переменные между блоками + runs-лог.
3. **Sequences** = настройки доставляемости (12/час, 5 мин, 200/день, sending window) + exit criteria (reply/meeting) + delegated sending + шаги с wait + переменные.
4. **Call Intelligence** = insight-шаблоны (секции-промпты) + live-транскрипт + calls page + привязка к записям. (У нас — демо: загрузка транскрипта + AI-саммари по шаблону.)
5. **Кредитная система** AI + биллинг-экран.
