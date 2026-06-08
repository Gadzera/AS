# Реверс-инжиниринг Attio Academy — индекс сценариев (28 видео)

Полный покадровый+аудио разбор всех 28 обучающих видео Attio Academy. По каждому видео — отдельный
`SCENARIO.md`: экраны (по кадрам) + механика (по звуку) + требования к ТЗ + acceptance-сценарии.
Метод: транскрипт (faster-whisper, дословно) + разбор кадров (2/сек) глазами. Все кадры на диске в `docs/academy/<id>/frames/`.

| # | Видео | Сценарий | Модуль ТЗ |
|---|-------|----------|-----------|
| 01 | Manage team access and permissions | [SCENARIO](academy/01_RG8N7ZRaugw/SCENARIO.md) | §16 Permissions/RBAC |
| 02 | Introduction to Ask Attio | [SCENARIO](academy/02_wIrHOjRljCU/SCENARIO.md) | §15 AI-ассистент |
| 03 | Custom Objects and relationships | [SCENARIO](academy/03_X4FJY4bMvTk/SCENARIO.md) | §3 Объекты, §5 Связи |
| 04 | Introduction to Standard Objects | [SCENARIO](academy/04_J_C7VtVKN5Q/SCENARIO.md) | §3 Объекты |
| 05 | How to customise record pages | [SCENARIO](academy/05_jopZf9DANOM/SCENARIO.md) | §8 Record page |
| 06 | Apps and Integrations | [SCENARIO](academy/06_8G-HQ6rEz1c/SCENARIO.md) | §16 Apps |
| 07 | Introduction to Reports | [SCENARIO](academy/07_cpWH3DGjjmc/SCENARIO.md) | §14 Reports |
| 08 | Insight reports | [SCENARIO](academy/08_hFCh45VrP8Q/SCENARIO.md) | §14 Reports |
| 09 | Historical reports | [SCENARIO](academy/09_x9nnoiPPPYw/SCENARIO.md) | §14 Reports |
| 10 | Import data into Objects | [SCENARIO](academy/10_u39Xn1nacl8/SCENARIO.md) | §3 Импорт |
| 11 | Import data into Lists | [SCENARIO](academy/11_W_oOficUSqo/SCENARIO.md) | §7 Lists |
| 12 | Introducing Call Intelligence | [SCENARIO](academy/12_-HbTAAz9-r0/SCENARIO.md) | §13 Calls |
| 13 | Introducing AI Attributes | [SCENARIO](academy/13_3p4HFH3nWaM/SCENARIO.md) | §4.1 AI-атрибуты |
| 14 | How to manage sequences | [SCENARIO](academy/14_hPgRSOe_4VM/SCENARIO.md) | §11 Sequences |
| 15 | How to enroll recipients to sequences | [SCENARIO](academy/15_1afurxoqTPI/SCENARIO.md) | §11 Sequences |
| 16 | How to create sequences | [SCENARIO](academy/16_YlzA4wxHVhI/SCENARIO.md) | §11 Sequences |
| 17 | Workflows — How to trigger a workflow | [SCENARIO](academy/17_k8rO5aCwv7o/SCENARIO.md) | §12 Workflows |
| 18 | Workflows — Condition and Delay blocks | [SCENARIO](academy/18_R_HHm73QKh4/SCENARIO.md) | §12 Workflows |
| 19 | Workflows — Calculation blocks | [SCENARIO](academy/19_s5XAgsoK9m8/SCENARIO.md) | §12 Workflows |
| 20 | Workflows — AI blocks | [SCENARIO](academy/20_j_oiNwgURGI/SCENARIO.md) | §12 Workflows + §4.1 |
| 21 | Workflows — bulk actions (Loop/Find) | [SCENARIO](academy/21_AlLubYvPC0Y/SCENARIO.md) | §12 Workflows |
| 22 | Workflows — HTTP and JSON blocks | [SCENARIO](academy/22_-kFDZ1R3SEk/SCENARIO.md) | §12 Workflows |
| 23 | Workflows — Integration blocks | [SCENARIO](academy/23_AHl29jbufUc/SCENARIO.md) | §12 Workflows |
| 24 | Workflows — Record and List blocks | [SCENARIO](academy/24_CIvyaV6ByP8/SCENARIO.md) | §12 Workflows |
| 25 | Workflows — AI Research agent | [SCENARIO](academy/25_YsW-VE4oOHA/SCENARIO.md) | §12 + §15 |
| 26 | Introduction to Workflows | [SCENARIO](academy/26_34VHoJRrQsw/SCENARIO.md) | §12 Workflows |
| 27 | Notes, tasks, and email sending | [SCENARIO](academy/27_SXybVmcSfPA/SCENARIO.md) | §8 Record page |
| 28 | Email sync, People and Company records | [SCENARIO](academy/28_0WqSZGs3PUc/SCENARIO.md) | §10 Email sync |

## Ключевые открытия для постройки (сводно)
- **Permissions (01):** роли Admin/Member; 4 уровня (No access/Read/Read+write/Full) × 3 области (Workspace/Team/Individual), individual>team>workspace; на Objects/Lists/Dashboards/Workflows/Sequences + Automations-грант.
- **AI (02,13,20,25):** Ask Attio (чат-ассистент); 4 AI-атрибута (Classify/Summarize/Research/Prompt) + Classify text; Research agent (веб, 10 кредитов).
- **Объекты (03,04,28):** 5 стандартных + кастомные; relationship (4 кардинальности, двусторонние); Unique/Required/Record text/System; email-синк наполняет People/Company + enrichment + communication intelligence.
- **Workflows (17–26):** Triggers (record/list command/created/updated, attribute updated, task, utility manual/schedule/webhook, integration Outreach/Typeform); Logic (Filter/If-else/Switch/Advanced AND-OR/Round robin); Delay (+Delay until); Calculation (Adjust time/Formula/Aggregate/Random); Data (Create/Create-or-update/Find/Update/Delete + list); AI (4+classify text+research); Loop/Find (limit 100); HTTP (6 методов)/Parse JSON; Integration (Slack message/**Slack actions-кнопки с паузой**/sequences).
- **Sequences (14–16):** settings (window, лимиты 12/час·5мин·200/день, exit reply/meeting, delegated sending); шаги+wait+variables; pause/resume/exit; OOO-детект; unsubscribe-список.
- **Reports (07–09):** 5 типов (Insight, Historical, Funnel, Time in stage, Stage change); group/segment/filter; pipeline-отчёты по status-атрибутам.
- **Record page (05,27):** configure page (Highlights ≤6, табы+relationship-табы, секции атрибутов, action-кнопки); comments/@mention/tasks/notes/email (templates+mass send).
- **Calls (12):** рекордер Zoom/Meet/Teams, insight-шаблоны, live-транскрипт, Calls page, pinned/PiP.
- **Import (10,11):** CSV-маппинг, дедуп по уник-атрибуту (companies=domain), relationship по уник-id, required, import history.
- **Apps (06):** каталог, 3 типа приложений, виджеты на record.
