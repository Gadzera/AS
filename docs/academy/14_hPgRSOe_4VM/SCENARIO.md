# Реверс-инжиниринг — Видео 14: «How to manage sequences» (3:24)

Тема: мониторинг/управление живыми sequences. Для ТЗ — §11 Sequences.

## Механика (из звука)
- **Sequences tab** — список всех sequences; archive / delete. Опубликованную нельзя удалить (только archive).
- **Archive published:** новых получателей не добавляет, но уже enrolled дойдут до конца. Restore: View settings → show archived → Restore sequence.
- **Edit + publish:** новые получатели получают последнюю версию; уже enrolled продолжают версию, активную на момент enroll.
- **Recipients list:** кто enrolled, sender, прогресс. Видно: получил все письма / ответил на первое → exited.
- **Управление активным получателем:** **pause** (стоп будущих писем; countdown delay-шага замораживается и продолжается с места при resume) / **resume** / **manual exit** (навсегда убрать).
- **Insights внизу:** сколько active / enrolled / exited.
- **Out-of-office:** Attio авто-распознаёт OOO-ответы; если есть дата возврата — задерживает остаток до дня после возврата.
- **Лимиты доставляемости:** 12 писем/час/ящик, пауза 5 мин, **200/день/ящик**.
- **Outbox:** в delivery window очередь писем в Emails → Outbox (превью, к какому sequence, когда запланировано).
- **Admin (workspace settings):** все sequences workspace, права, полный список **unsubscribed** (email, причина, от чего, дата/время). После unsubscribe нельзя enroll в sequences с тем же sender; убрать из unsub-списка нельзя (кроме bounce/ручного добавления).

## Требования для ТЗ
- Sequences tab: list + archive/restore/delete + edit (версионирование для enrolled).
- Recipients: статусы (active/exited), pause/resume (заморозка delay)/exit, insights-счётчики.
- OOO-детект (демо), лимиты доставляемости, Outbox-очередь.
- Unsubscribe-список (admin) + блок повторного enroll.

## Сценарии (acceptance)
1. Pause активного получателя → delay-countdown замораживается → resume продолжает.
2. Получатель ответил на 1-е письмо → авто-exit (exit criteria reply).
3. Archive sequence → новые не добавляются, enrolled завершают.
