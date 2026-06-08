# AI SDR UI Rebuild — Work Log

## Agent 1 — Layout shell + Topbar + Tabs + Bulk footer + UI primitives + globals.css

_Note: planned location was `.claude/WORK_LOG.md`, but the sandbox blocks writes to that directory. Created here at repo root instead._

### globals & layout
- `apps/frontend/src/app/globals.css` — rewrote with canonical design tokens (surface/border/text/brand/semantic/tag x7, shadow scale incl. `--shadow-popover`); added `tabular`/`shadow-*` utilities; kept Inter import, `shimmer`, `fadeIn` keyframes.
- `apps/frontend/src/app/(dashboard)/layout.tsx` — shell: `SelectionProvider > Sidebar + main flex-1 flex flex-col min-w-0`. No paddings, no max-w, no bg overrides on main. (Subsequently augmented by Agent 5 with `<ComposeEmailModalRoot />`.)
- `apps/frontend/src/app/(dashboard)/template.tsx` — keyed by `pathname`, fade + y:4 → y:0, duration 0.2 ease-out, framer-motion.

### State
- `apps/frontend/src/lib/selection.tsx` — `SelectionProvider` + `useSelection()` exposing `{selected:Set<string>, toggle, toggleMany, selectMany, clear, isSelected, count}`. Mounted in dashboard layout for cross-page row selection.

### Layout components
- `apps/frontend/src/components/layout/Topbar.tsx` — rewrote per brief: sticky top-0 h-11 bg-white border-b; props `{icon, title, breadcrumb, subtitle, actions, iconColor}`; breadcrumb chain rendered with `/` separators; default actions cluster = 3-avatar stack (-space-x-1.5, ring-2 ring-white) + Plus 16 + MoreHorizontal 16 + primary `Compose email` (Mail 14). Backwards compat: `subtitle` becomes the 2nd crumb when present.
- `apps/frontend/src/components/layout/PageHeader.tsx` — wraps Topbar; exports `ViewTabsRow` (sticky top-11 h-11 bg-white border-b; supports `left`/`right` slots OR children) and `ListActions` preset (`Import / Export ▾` secondary + `+ New ...` primary).
- `apps/frontend/src/components/layout/_stubs/ViewTabsRow.tsx` — compat re-export from `../PageHeader` so any path already used by other agents keeps resolving.
- `apps/frontend/src/components/layout/BulkActionFooter.tsx` — fixed bottom-6 left-1/2 -translate-x-1/2 z-30; h-10 bg-white border rounded-lg shadow-popover; props `{count, actions: {icon,label,onClick,separator?,danger?}[], onClose, noun?}`; counter chip + ghost h-7 px-2.5 13px buttons + close X; framer y:8 fade 0.15s.
- `apps/frontend/src/components/layout/UserMenu.tsx` — avatar trigger + Dropdown with email and `Sign out` (calls existing `logout()`).

### UI primitives
- `apps/frontend/src/components/ui/Button.tsx` — variants `primary` (`bg-[var(--text)]` text-white, hover `#28282a`) / `secondary` (white + `--border-strong`) / `ghost` / `danger`; sizes sm h-7 12.5px / md h-8 13px / lg h-9 13.5px; rounded-md font-medium transition-colors 100ms; focus ring `var(--brand)`. No motion wrapper.
- `apps/frontend/src/components/ui/Tag.tsx` — h-5 px-1.5 rounded-sm 11px font-medium; 7 colors via `--tag-{color}` / `--tag-{color}-ink`; optional `icon` slot.
- `apps/frontend/src/components/ui/Avatar.tsx` — sizes 16/20/24/32/40; `src` OR deterministic-hash initials; 6 pastel palettes from `--tag-*` tokens.
- `apps/frontend/src/components/ui/Dot.tsx` — `w/h 6` (or 8) `rounded-full`; variants success/warning/danger/info/gray/brand/yellow via CSS vars.
- `apps/frontend/src/components/ui/Tabs.tsx` — `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`. List h-10 px-4 gap-4 border-b. Trigger 13.5px font-medium muted → text on active; `motion.span` underline `h-0.5 bg-[var(--text)]` with `layoutId` spring transition. Optional `count` prop.
- `apps/frontend/src/components/ui/Input.tsx` — h-8 px-2.5 rounded-md bg-white 13.5px border `--border-strong`; focus border `--brand` + ring `--brand-soft`. Replaced legacy `⚠` with lucide `AlertCircle` 12.
- `apps/frontend/src/components/ui/Modal.tsx` — overlay `bg-[#0f0f0e]/55 z-40`; panel `bg-white rounded-xl shadow-lg max-w-[560px] w-full mx-4 max-h-[85vh]`; header h-12 with lucide X; scale 0.96→1 + opacity 150ms; added optional `footer` slot + `size` (sm 400 / md 560 / lg 720 / xl 920).
- `apps/frontend/src/components/ui/Dropdown.tsx` — popover with click-outside + Escape close; AnimatePresence fade + y; `DropdownItem` h-8 px-2.5 13px (optional icon + `danger`), `DropdownSeparator`, `DropdownLabel`.
- `apps/frontend/src/components/ui/FilterChip.tsx` — h-7 px-2.5 rounded-md `bg-[var(--surface-2)]` 12.5px font-medium muted; hover surface-3; `{icon, label, suffix, chevron?, active?}`; supports children for old API.
- `apps/frontend/src/components/ui/Skeleton.tsx` — rewritten to `bg-[var(--surface-2)] animate-pulse rounded-md`; `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonTable` retained.
- `apps/frontend/src/components/ui/Toast.tsx` — fixed bottom-6 right-6 z-50; card `bg-white border shadow-popover rounded-lg h-10 max-w-[400px]`; lucide `Check`/`AlertCircle`/`Info` 14 semantic-colored; X close; AnimatePresence x:8→0 fade 0.2s; auto-dismiss 4s with pause-on-hover. `ToastProvider` / `useToast()` API unchanged (`success/error/info/warning` + generic `toast(msg, opts)`).

### Notes for other agents
- `Sidebar.tsx`, `Badge.tsx`, `Card.tsx` left untouched.
- All UI primitives keep previous default exports — old pages compile unmodified.
- Use `useSelection()` for cross-page row selection; pair with `<BulkActionFooter count={count} actions={[...]} onClose={clear} />`.
- Composition pattern per brief:
  ```tsx
  <PageHeader icon={<Users size={16} />} title="Leads">
    <ViewTabsRow
      left={[<FilterChip label="All Leads" />, <FilterChip label="View settings" />]}
      right={<ListActions newLabel="New lead" onNew={...} />}
    />
  </PageHeader>
  ```

## Сессия GPT-мост — платформа доведена до рабочего состояния

**Конвейер разработки через GPT (мост):** скрипты в `C:\Users\gadze\chatgpt-bridge` — `chat.mjs` (детерминированная отправка в закреплённый чат проекта), `clip_capture.mjs` (захват кода через кнопку «Копировать» — единственный способ без потери переводов строк/бэктиков), `apply_pairs.mjs` (раскладка `FILE:`+code-блоков по файлам). Обмен файлами — через `.bridge/`.

**Блок 1 — DEMO-режим (GPT):** `services/claude.ts` и `services/email.ts` переписаны: без `ANTHROPIC_API_KEY` — шаблонная персонализированная генерация; без SMTP — симуляция отправки. С ключами — реальные вызовы. `tsc=0`, проверено вживую (`/api/outreach/generate`).

**Блок 2 — сквозная проверка (GPT):** добавлен `POST /api/outreach/run-now` (синхронный прогон due-лидов кампании = фича «отправить сейчас»); написан `apps/backend/scripts/smoke.ts` — сквозной тест всех сценариев.

**Результат проверок:**
- Backend `tsc=0`, frontend `tsc=0`.
- `smoke.ts`: **24/24 PASS** (auth, лиды CRUD+import, кампании+sequence+start, run-now→письмо+статусы+аналитика, outreach generate/classify/auto-reply, трекинг-пиксель, billing).
- UI-аудит (`audit_ui.mjs`): все страницы грузятся с данными, JS-ошибок нет (был лишь favicon-404 → добавлена `app/icon.svg`).
- Фоновый воркер (BullMQ) стартует и коннектится к Redis.

**Локальный запуск:** Docker `postgres:5440`/`redis:6390`; backend `PORT=3099` (т.к. :3001 занят сторонним проектом); frontend `:3010` с `NEXT_PUBLIC_API_URL=http://localhost:3099`. Demo-вход: `demo@aisdr.dev` / `demo1234`.

## Сессия — полный по-кадровый реверс-инжиниринг эталона (vision-анализ)

**Цель (требование пользователя):** проанализировать КАЖДЫЙ кадр (не выборку) всех 28 видео Attio
Academy + demo, по каждому кадру составить описание экрана → потом свести в каталог сценариев (200+) и
финализировать ТЗ.

**Кадры:** извлечены при 2 кадра/сек БЕЗ дедупа (жёсткое правило пользователя). Итого **15 822 кадра**
(14 708 academy в `docs/academy/<id>/frames/` + 1 114 demo в `.bridge/ref/dense_hq/`).

**Пайплайн анализа:** `.bridge/analyze_frames.py` — локальная vision-модель **`qwen2.5vl:7b`** через
Ollama (`http://127.0.0.1:11434`), GPU RTX 3080 16ГБ (86% GPU / 14% CPU, ~5 сек/кадр, `num_ctx=4096`,
`keep_alive=30m`). Резюмируемый: пишет `frames_analysis.jsonl` в папку каждого видео (`{frame, desc}` на
строку), при перезапуске пропускает готовые кадры. Запуск: `python .bridge/analyze_frames.py qwen2.5vl:7b`.

**Качество проверено:** сверка описания кадра f_00051 (видео 01) с самой картинкой — модель точно читает
заголовки, поля модалок и ВЕСЬ сайдбар настроек (мелкий текст пунктов меню). Результат устраивает.

**Баг и фикс:** скрипт падал на `print` со стрелкой `→` (консоль Windows cp1251 не кодирует) после
первого видео. Исправлено: `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` + убрана стрелка +
`PYTHONIOENCODING=utf-8`. После фикса идёт стабильно по всем видео.

**Статус на момент сохранения:** ~3700/15 822 кадра (23%), видео 01-08 готовы, 09 в работе, ETA ~17 ч.
Анализ продолжает молотить в фоне.

**Следующий шаг (после завершения анализа):** свести все `frames_analysis.jsonl` в единый по-кадровый
реестр → дострочить `docs/SCENARIOS_CATALOG.md` модули 11-21 (S200-S375) → финализировать MASTER_TZ →
продолжить стройку (блок AI-атрибутов на паузе, ждёт «продолжение» от GPT).

**Параллельная тема (только концепт, кода нет):** свой голосовой движок для AI-SDR звонков —
4 концептуальные ставки: (1) просодия как интонационные токены внутри LLM, (2) пересборка реального
аудио из персонального корпуса на нейрокодеках вместо синтеза, (3) онлайн-обучение из исходов звонков,
(4) синтетический датасет дистилляцией из большого учителя. Прорывная связка 2+1+3.
