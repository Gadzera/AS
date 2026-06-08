# AI SDR Agent — UI Rebuild Brief (Attio-pattern)

Source of truth для всех 5 параллельных агентов. Эталон — **Attio.com**. Каждый агент обязан читать этот файл перед началом работы и не отклоняться от токенов / типографики / отступов.

---

## 0. Контекст проекта

- Stack: Next.js 14 (App Router) + TypeScript + Tailwind v3 + Framer Motion
- Backend на http://localhost:3001, фронт на http://localhost:3010
- Demo user уже сидится: `demo@aisdr.dev / demo1234`
- Sidebar уже переписан в Attio-стиль ([apps/frontend/src/components/layout/Sidebar.tsx](apps/frontend/src/components/layout/Sidebar.tsx)) — НЕ ТРОГАТЬ
- Auth helper: `@/lib/auth` (`getToken`, `logout`)
- API helper: `@/lib/api`
- Демо-данные: 12 leads (2 HOT — Ravi @ Snowflake, Marcus @ Stripe), 4 campaigns (2 ACTIVE), 8 emails sent

## 1. Design tokens (CSS variables в globals.css)

```css
--bg:            #fbfbfa;
--surface:       #ffffff;
--surface-2:     #f4f4f1;     /* hover row */
--surface-3:     #ebebe6;     /* nav hover */
--sidebar:       #f8f7f5;     /* sidebar bg */
--border:        #e3e3dd;     /* hairline */
--border-strong: #cfcfc7;
--text:          #1a1a1a;     /* primary ink */
--text-muted:    #5e5e58;     /* secondary */
--text-subtle:   #8a8a80;     /* tertiary, icons */
--text-disabled: #b0a99a;
--brand:         #4f46e5;     /* indigo, ТОЛЬКО на active state + key accents */
--brand-soft:    #eef2ff;
--success:       #2f8a5f;
--success-soft:  #e3f2ea;
--warning:       #b8782b;
--warning-soft:  #fbecd5;
--danger:        #b54141;
--danger-soft:   #f7e1e1;
--info:          #3a6db5;
--info-soft:     #e3eaf7;
```

Tag-цвета (для категорий B2B / SaaS / Finance — как у Attio):
```css
--tag-violet:    #ede9fe;  --tag-violet-ink:    #5b21b6;
--tag-pink:      #fce7f3;  --tag-pink-ink:      #9d174d;
--tag-yellow:    #fef3c7;  --tag-yellow-ink:    #92400e;
--tag-green:     #dcfce7;  --tag-green-ink:     #166534;
--tag-blue:      #dbeafe;  --tag-blue-ink:      #1e40af;
--tag-orange:    #fed7aa;  --tag-orange-ink:    #9a3412;
--tag-gray:      #f1efea;  --tag-gray-ink:      #5e5e58;
```

## 2. Типографика

```
display:  font-size 24px / 32px line-height / font-weight 700 / tracking -0.02em
h1:       20px / 28px / 700 / -0.018em
h2:       16px / 24px / 600 / -0.012em
h3:       14px / 20px / 600 / -0.005em
body:     14px / 20px / 400
body-sm:  13.5px / 18px / 400
caption:  12px / 16px / 500 / tracking 0.005em
nav:      13.5px / 18px / 500
label:    11px / 16px / 600 / tracking 0.08em / uppercase / muted
tabular:  font-variant-numeric tabular-nums (для чисел)
```

Font: Inter (уже подключён в globals.css). Features: `'cv11', 'ss01'`.

## 3. Spacing scale

Только эти значения: **2 4 6 8 10 12 16 20 24 32 40 48 64**. Никаких произвольных `px-3.5`.

## 4. Радиусы

```
sm: 4px   (chips, small tags)
md: 6px   (buttons, inputs, nav items)
lg: 8px   (cards)
xl: 12px  (modals, large cards)
2xl: 16px (page-level containers, optional)
```

## 5. Shadows

```
--shadow-xs: 0 1px 1px rgba(15,15,14,0.04);
--shadow-sm: 0 1px 2px rgba(15,15,14,0.05), 0 1px 1px rgba(15,15,14,0.04);
--shadow-md: 0 4px 12px rgba(15,15,14,0.07), 0 1px 2px rgba(15,15,14,0.04);
--shadow-lg: 0 16px 40px rgba(15,15,14,0.10), 0 2px 6px rgba(15,15,14,0.04);
--shadow-popover: 0 8px 24px rgba(15,15,14,0.12), 0 2px 4px rgba(15,15,14,0.06);
```

Использование: **дефолт = без тени**. Тень только на: dropdown, popover, modal, sticky-row active.

## 6. Иконки

`lucide-react`, размер 14px в плотных местах (filter chips, table cells), 16px в навигации/кнопках, 18-20px в hero/empty states. `strokeWidth={1.75}` по умолчанию, `{2}` для активного состояния.

## 7. Motion

- Микро-hover: `transition-colors duration-100`
- Active nav pill: framer-motion `layoutId="nav-active"` spring 500/38
- Page transitions: fade 200ms из template.tsx
- Modal: scale 0.96→1 + opacity 0→1 150ms ease-out
- Никаких `whileHover scale > 1.02`, никаких блобов, никаких градиентных backgrounds

## 8. Базовые компоненты (что должно существовать)

Все в `apps/frontend/src/components/ui/`:

| Компонент | Файл | Описание |
|---|---|---|
| Button | `Button.tsx` | variants: primary (черный), secondary (белый+border), ghost (transparent), danger. sizes: sm h-7, md h-8, lg h-9 |
| Tag | `Tag.tsx` | NEW. inline label `h-5 px-1.5 rounded-sm text-[11px]` + color variant |
| Avatar | `Avatar.tsx` | NEW. круглый `w-6 h-6 rounded-full` + initials |
| Dot | `Dot.tsx` | NEW. `w-1.5 h-1.5 rounded-full` для статусов |
| Tabs | `Tabs.tsx` | NEW. underline-стиль; active = `border-b-2 border-text` |
| Input | `Input.tsx` | h-8 px-2.5 text-[13.5px] border |
| Modal | `Modal.tsx` | overlay `bg-[#0f0f0e]/55`, panel `bg-white rounded-xl shadow-lg max-w-[560px]` |
| Dropdown | `Dropdown.tsx` | NEW. popover, shadow-popover, item h-8 px-2.5 |
| FilterChip | `FilterChip.tsx` | NEW. `Sorted by Created at`, `Filter`, `Sort` chips сверху таблиц |
| TableRow | через классы | hover `bg-surface-2`, h-9, border-bottom hairline |

## 9. Layout shell

```
+-----------------------------------------------------+
| Sidebar 240px  |  Main                              |
| (готов)        |  +--------------------------------+|
|                |  | Topbar (44px sticky)           ||
|                |  +--------------------------------+|
|                |  | View tabs + filters (44px)     ||
|                |  +--------------------------------+|
|                |  | Content (scrollable)           ||
|                |  +--------------------------------+|
|                |  | Bulk action footer (когда есть ||
|                |  | выбор; absolute bottom-4 cent.)||
+-----------------------------------------------------+
```

Topbar: H-11 (44px), `bg-white border-b border-[#e3e3dd]`, sticky top-0, z-20. Слева — breadcrumbs / page-title icon + title. Справа — avatars stack + кнопки `Compose email`, `+`, `…`.

---

# Агенты — что делает каждый

## Агент 1 — Layout + Topbar + Tabs + Bulk footer

**Файлы:**
- `apps/frontend/src/app/(dashboard)/layout.tsx` (переписать)
- `apps/frontend/src/components/layout/Topbar.tsx` (переписать в Attio-стиль)
- `apps/frontend/src/components/layout/PageHeader.tsx` (NEW) — иконка + название страницы + view-switcher
- `apps/frontend/src/components/layout/BulkActionFooter.tsx` (NEW)
- `apps/frontend/src/components/ui/Tabs.tsx`, `FilterChip.tsx`, `Avatar.tsx`, `Dot.tsx`, `Tag.tsx`, `Dropdown.tsx` (NEW)
- `apps/frontend/src/app/(dashboard)/template.tsx` (fade 200ms)
- `apps/frontend/src/app/globals.css` (token consolidation)

**Что должно получиться:**

1. Layout: sidebar (готов) + flex-1 main. Main = header (44) + view-tabs (44) + content. Никаких лишних paddings — content сам делает `p-6`.
2. Topbar:
   - Sticky top-0, h-11, bg white, border-b
   - Left: page-title icon (lucide, 16px, цвет category) + page name (h2 16/24/600) + optional star
   - Right: stack из 3 avatars (-space-x-1.5), кнопка `+`, кнопка `…`, кнопка `Compose email` (primary sm)
3. View-tabs row: h-11, bg white, border-b
   - Left: filter chip dropdown `All Companies ▾` (gray-tag style) + `View settings ▾`
   - Below (optional second row): `Sorted by Created at` chip, `Filter 2` chip, sort+filter add `+`
4. BulkActionFooter:
   - Centered bottom-4, `bg-white shadow-popover border rounded-lg px-2 h-10`
   - Pills: `1 selected` (gray), `Add to list`, `Send email`, `Run workflow`, `More ▾`, `×` close
   - Появляется когда state hasSelection (контракт через React context `SelectionContext`)
5. Tabs primitive: underline стиль, active border-b-2 var(--text), inactive text-muted

## Агент 2 — Table-first Leads page

**Файл:** `apps/frontend/src/app/(dashboard)/leads/page.tsx` (переписать полностью)

**Дополнительно:**
- `apps/frontend/src/components/leads/LeadsTable.tsx` (переписать)
- `apps/frontend/src/components/leads/LeadRow.tsx` (NEW)
- `apps/frontend/src/components/leads/LeadFilters.tsx` (NEW)

**Spreadsheet view (как у Attio Companies):**

Columns (порядок, ширины):
| col | width | content |
|---|---|---|
| checkbox | 36 | input checkbox |
| Name | 200 | avatar(initials, 24px) + `{firstName} {lastName}` (text) + (если HOT) flame icon 12px |
| Title | 180 | `{title}` truncate text-muted |
| Company | 160 | `{company}` text |
| Industry | 140 | Tag (color по индустрии: SaaS=violet, Finance=blue, Marketing=pink, etc.) |
| Status | 100 | Dot (color по статусу) + `{status}` text-12 |
| Score | 80 | tabular badge, color: 80+=green, 50-79=yellow, <50=gray |
| Email | 200 | `{email}` text-muted truncate |
| Location | 140 | `{city}, {country}` text-muted |
| Created | 100 | `Mar 4` (date-fns format) text-subtle |

Row height: **h-9 (36px)**. Header row h-8, bg-surface, sticky top-[88px] (под topbar+tabs), border-b. Cell: `px-2 text-[13.5px]`. Hover row: `bg-surface-2`. Selected row: `bg-brand-soft border-l-2 border-brand`. Checkboxes: 14px, accent indigo.

Header cell: иконка (lucide 12px, text-subtle) + название (text-muted 12px font-medium). Click header — sort. Right edge — drag-resize handle (визуально hairline на hover).

Above table: view-tabs row (Агент 1) с фильтр-чипами `Sorted by Score ↓`, `Status is Hot`, `+ Filter`. Counts: `1,064 count` в footer-row под таблицей.

Empty state: иконка lucide Users 32px, text-muted "No leads yet", primary button "Add lead" + secondary "Import CSV".

States: loading (skeleton rows 8 штук), error (toast).

Bulk select: чекбокс в header выбирает всех, появляется BulkActionFooter с числом, действия — Send email / Add to list / Delete / Export. Selection state — через `useState` в page + прокидывается в footer через context (см. Агент 1).

API: `GET /api/leads?limit=100` уже работает, возвращает `{ leads: [...], total }`.

## Агент 3 — Deals Kanban board (бывшие Campaigns)

**Файл:** `apps/frontend/src/app/(dashboard)/campaigns/page.tsx` (переписать как Kanban)

**Дополнительно:**
- `apps/frontend/src/components/campaigns/KanbanBoard.tsx` (NEW)
- `apps/frontend/src/components/campaigns/KanbanColumn.tsx` (NEW)
- `apps/frontend/src/components/campaigns/CampaignKanbanCard.tsx` (NEW) — переписать существующий CampaignCard

**Layout:**

Toggle сверху (внутри view-tabs row): `[ Kanban ] [ Table ]` segmented control. По умолчанию Kanban.

Kanban columns по `campaign.status`: **Draft / Active / Paused / Completed**. Каждая колонка:
- Header h-9: dot (color по статусу) + название + count `{n}` text-subtle + `+` add card
- Width 280px, gap-3 между колонками
- Background transparent, border-r dashed text-subtle/30 between columns (как у Attio)
- Scrollable вертикально внутри колонки

Card: `bg-white border border-[#e3e3dd] rounded-lg p-3 hover:shadow-sm cursor-pointer`
- Top: campaign.name (font-medium 13.5px)
- Row: `{leadCount} leads · {sequencesCount} steps` text-muted 12px
- Tags row: industry tag + country tag
- Bottom row: avatar (campaign.user.name initial) + dailyLimit small + меню `…`

Drag-and-drop: с использованием `@dnd-kit/core` — при отпускании в другую колонку → `PATCH /api/campaigns/:id { status }`. (Если @dnd-kit не установлен — оставить TODO-комментарий и сделать кликабельный статус-меню в карточке.)

Toggle "Table" → плоский список как у Attio All Deals: columns Deal name, Status, Channel, Industry, Country, Leads, Daily limit, Created, Owner.

API: `GET /api/campaigns`, `PATCH /api/campaigns/:id`.

## Агент 4 — Detail page (Lead profile in Attio style)

**Файл:** `apps/frontend/src/app/(dashboard)/leads/[id]/page.tsx` (переписать полностью)

**Layout — 2 column:**
```
+------------------------------------+----------------+
| Header (avatar + name + chips)     |                |
|------------------------------------|  Right panel   |
| Tabs: Activity / Emails / Calls /  |  (320px)       |
|       Notes / Tasks / Files        |  Record Details|
|------------------------------------|  Enriched data |
| Tab content (scrollable)           |  Lists         |
+------------------------------------+----------------+
```

**Header:** breadcrumb `Leads / {name}` в Topbar (Агент 1). В самой странице:
- Avatar 40px circle + name (h1 20/28/700)
- Chips row: status dot + status, score badge, source tag
- Action buttons (right): `Compose email` primary, `+ Add to campaign` secondary, `…` overflow

**Tabs (primitive из Агента 1):** Activity (default), Emails ({count}), Calls (n), Notes (n), Tasks (n), Files. Каждая вкладка показывает счётчик в text-subtle.

**Activity feed:**
- Группировка по дате-секциям (`2025`, `This week`, `March`)
- Timeline marker слева (dot 6px + vertical line)
- Event card: avatar (initials) + actor name + verb (`added a note`, `attended a meeting`, `first contacted`, `changed N attributes`) + время справа (`3 minutes ago`)
- Для notes: expanded card с body
- Для meetings: card с темой + временем
- Для attribute changes: inline diff (`Categories ➜ Added: B2B, Technology, SaaS, Finance`)

**Emails tab:**
- Список сжатый: avatar + subject (font-medium) + `{recipient}, {sender}` muted + preview snippet + дата справа
- Клик → разворачивается inline или открывает email viewer modal (Агент 5)

**Right panel** (`w-80 border-l border-[#e3e3dd] bg-white px-4 py-4 overflow-y-auto`):
- Section "Record Details" — collapsible
  - Domains: `{website}` (link)
  - Description: `{notes}` truncate с "Show more"
  - Categories: tag list
  - LinkedIn: link
- Section "Enriched Firmographics"
  - Foundation date, Employee range, Estimated ARR, Funding raised — list `dt/dd` style
- Section "Location" — Primary location ▸ City / State / Country
- Section "Social Media Links" — LinkedIn, Facebook, Twitter, AngelList
- Section "Lists" — `+ Add to list` если пусто

Все секции — h2 `Section title` (font-semibold 13.5px) + chevron toggle. Items: row h-8, label (text-subtle 12px) + value (text 13.5px).

API: `GET /api/leads/:id` уже возвращает lead + messages + campaignLeads.

## Агент 5 — Compose email modal + Empty states + Polish

**Файл (новые):**
- `apps/frontend/src/components/email/ComposeEmailModal.tsx` (NEW)
- `apps/frontend/src/components/email/TemplatePicker.tsx` (NEW)
- `apps/frontend/src/components/ui/EmptyState.tsx` (NEW)
- `apps/frontend/src/components/ui/Toast.tsx` (rewrite — proper position bottom-right, slide-in 200ms)

**Trigger:** кнопка `Compose email` в Topbar (Агент 1) + на bulk footer (Агент 1) + на detail page (Агент 4).

**Compose Email Modal:**

Размер: `max-w-[720px] h-[560px]`. Layout: header (back arrow + "Compose email" title + minimize/X) + tags-row (`Add recipients` input с chips) + template-picker dropdown OR composer textarea + attachments row + footer (toggle "Send emails individually" + primary "Send Email (N)" + delete).

**Template picker (когда subject пустой):**
- Dropdown popover под subject field
- Заголовок "Search templates..." input
- List: 6 предзаготовленных
  - Second outreach for inbound ICP
  - Customer Success — Check in call offer
  - Outreach for inbound ICP
  - Onboarding first outreach
  - Disco call follow up
  - High value inbound leads
  - Hiring — Invitation to interview
- Footer items: `View all templates`, `Create new template`
- Клик → подставляет subject + body в композер

**Composer:**
- Subject input (h-9, bold border-bottom on focus)
- Body textarea h-[280px] resize-none + bottom: attach paperclip / personalization `{...}` / emoji button

**Send button:** правый нижний `Send Email (1)` primary. Кнопка `1 selected` chip слева если bulk.

**Empty states (универсальный компонент):**
- Centered, vertical gap-3
- Lucide icon 32px text-subtle в круглом фоне bg-surface-2 56px
- Title h2
- Description text-muted max-w-[320px]
- Primary action button

Применить к: пустой Leads, пустой Campaigns, пустой Activity на Detail, пустой Outreach.

**Toast:** bottom-right `bg-white border shadow-popover px-3 h-10 rounded-lg`, фиксированно `position: fixed bottom-6 right-6`. Slide-in `translateY 8 → 0` + opacity 0 → 1 200ms. Auto-dismiss 4s. Иконка слева (✓ для success, ! для error), text + `×`.

**Дополнительный polish (после своих файлов, в свободное время):**
- Все цифровые значения — `tabular-nums` (analytics, score, counts)
- Все ссылки на компании/email — `text-[#1a1a1a] hover:underline underline-offset-2`
- Login/Register pages — переписать в Attio-стиль (split не нужен, центрированная карточка max-w-[400px], тёмная кнопка)

---

# Контракт для всех агентов

1. **НЕ ТРОГАТЬ** `Sidebar.tsx` — он готов.
2. **Используй только токены** из §1. Никаких inline hex/rgb за пределами списка цветов.
3. **Размеры из spacing scale** §3. Никаких `px-3.5` / `gap-7`.
4. **Иконки** только из `lucide-react`. Размеры 14/16/18/20. `strokeWidth={1.75}`.
5. **Никаких эмодзи** в коде. Если нужен emoji-effect — lucide иконка с цветом.
6. **Никаких градиентов** background, никаких glass-blur эффектов.
7. **Тени** — только из §5, по списку.
8. **Tabular nums** для всех чисел.
9. **Hover** только `bg-surface-2` (или `bg-[#f4f4f1]`).
10. После завершения — добавить запись в `WORK_LOG.md` с перечислением изменённых файлов.

---

# Demo accounts (уже сидится, не пересоздавать)

```
demo@aisdr.dev / demo1234       — обычный demo user
admin@aisdr.dev / admin1234     — admin
```

Seed скрипт: `apps/backend/prisma/seed.ts`. 12 leads, 4 campaigns, 8 messages — данные уже в БД.
