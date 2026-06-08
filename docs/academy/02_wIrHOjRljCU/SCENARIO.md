# Реверс-инжиниринг — Видео 02: «Introduction to Ask Attio» (4:57)

Тема: **Ask Attio** — разговорный AI-ассистент по CRM (search / update / create через чат). Для ТЗ — модуль AI-ассистент (§15 Ask Attio).

## Экраны (по кадрам)
**f_00080 — Homepage с Ask Attio:**
- Заголовок «Good afternoon, Marisa.»
- Строка «Recent chat · Check pricing discussion with company».
- Поле **«Ask anything…»** с режимом **Auto** и кнопкой отправки.
- Быстрые промпты-чипы: **Prep for next meeting**, **Recap last call**.
- Блок **Meetings** (Today, Jan 26): «2 past events», карточка встречи (Basepoint <> Picoma, 12:15–12:45, ссылка Google Meet, Participants, Host-индикатор), другие встречи.
- Блок **Tasks**: «Follow up with Picoma… (In 3 days)», ссылка **View all**.
- Сайдбар: раздел **Chats** с сохранёнными чатами Ask Attio (Check pricing…, Draft follow up…, Recent objections from calls…, Prep for today include overdue…).

## Возможности Ask Attio (из звука)
- **Доступ:** с homepage, из сайдбара, и из верх-права большинства страниц.
- **Search/понимание:** ищет по звонкам, заметкам, почте, интегрированным данным; «help me prep for my day» → апкаминг-встречи, сделки требующие внимания, просроченные задачи.
- **Глубокий анализ:** «what objections have come up most often recently?» → сводка по recent calls/notes/emails + релевантные цитаты/сниппеты звонков.
- **Сохранённые промпты:** Account settings → Prompts → создать промпт + имя → доступен везде в Ask Attio (примеры: детальный call-prep, лёгкий «what do I need to know to run this call?»).
- **Веб-ресёрч:** добавляет фон по компании/рынку/активности без выхода из инструмента.
- **Во время звонка:** «have we spoken to anyone at this company about pricing?» → кто/когда/что обсуждали.
- **После звонка / take action (с подтверждением пользователя):**
  - «suggest updates based on the call» → после ревью обновляет запись.
  - «create a task to follow up next week» → создаёт задачу, линкует к записи, ставит срок.
  - «draft a follow-up email based on this call» → черновик письма по контексту звонка, ревью+send.

## Требования для ТЗ
- Чат-панель **Ask Attio**: доступ с homepage/сайдбара/топбара; поле «Ask anything», режим Auto, быстрые промпты.
- Возможности: поиск по данным (records/calls/notes/emails) + веб-ресёрч + действия (update record / create task / draft email) с обязательным ревью пользователя.
- **Saved prompts** в Account settings (имя + текст), переиспользование.
- Homepage: приветствие, recent chat, Meetings (из календаря), Tasks (overdue/upcoming).
- Демо-режим: детерминированные ответы ассистента без ключа.

## Сценарии (acceptance)
1. Открыть Ask Attio с homepage → «help me prep for my day» → список встреч/сделок/задач.
2. Сохранить промпт в settings → выбрать его в Ask Attio → получить call-prep сводку.
3. «draft a follow-up email based on this call» → черновик → ревью → отправка.
