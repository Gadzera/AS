/**
 * M11-3/M11-6: окно отправки (send window) с учётом таймзоны организации.
 * clampToSendWindow(target, win) → ближайший момент >= target, попадающий в рабочее окно
 * (рабочие дни sendDays + интервал [start,end) по локальному времени орг-таймзоны).
 * Чистые функции, без БД. Используется при resume (M11-3) и в планировании шагов (M11-6).
 */

export interface SendWindow {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  days: number[]; // 1=Пн .. 7=Вс
  timeZone: string; // IANA, напр. 'Europe/Berlin'
}

const WD: Record<string, number> = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** «Настенные» компоненты инстанта в заданной таймзоне. */
function zonedParts(date: Date, timeZone: string): { weekday: number; minutes: number; y: number; mo: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const y = +get('year'), mo = +get('month'), d = +get('day');
  let h = +get('hour'); const mi = +get('minute');
  if (h === 24) h = 0; // некоторые движки дают '24' для полуночи
  return { weekday: WD[get('weekday')] ?? 1, minutes: h * 60 + mi, y, mo, d };
}

/** UTC-инстант для «настенного» времени (y,mo,d,h,mi) в таймзоне (учитывает offset/DST). */
function zonedWallToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = zonedParts(new Date(guess), timeZone);
  const shown = Date.UTC(p.y, p.mo - 1, p.d, Math.floor(p.minutes / 60), p.minutes % 60);
  const offset = shown - guess; // насколько tz впереди UTC
  return new Date(guess - offset);
}

/** В окне ли момент (тот же расчёт, что clampToSendWindow — без второго варианта логики). */
export function isWithinSendWindow(date: Date, win: SendWindow): boolean {
  return clampToSendWindow(date, win).getTime() === date.getTime();
}

/** Ближайший момент >= target внутри рабочего окна. Если days пуст — не клампим. */
export function clampToSendWindow(target: Date, win: SendWindow): Date {
  const [sh, sm] = win.start.split(':').map(Number);
  const [eh, em] = win.end.split(':').map(Number);
  const startMin = sh * 60 + sm, endMin = eh * 60 + em;
  const days = new Set(win.days);
  if (days.size === 0 || !(endMin > startMin)) return target;

  let cur = new Date(target);
  for (let i = 0; i < 14; i++) {
    const p = zonedParts(cur, win.timeZone);
    if (days.has(p.weekday) && p.minutes < endMin) {
      // день валиден и окно ещё не закрылось: до открытия → старт окна; внутри → как есть.
      return p.minutes < startMin ? zonedWallToUtc(p.y, p.mo, p.d, sh, sm, win.timeZone) : cur;
    }
    // иначе → старт окна СЛЕДУЮЩЕГО календарного дня (в орг-таймзоне).
    const tp = zonedParts(new Date(cur.getTime() + 24 * 3600 * 1000), win.timeZone);
    cur = zonedWallToUtc(tp.y, tp.mo, tp.d, sh, sm, win.timeZone);
  }
  return target; // фолбэк (не должен достигаться при корректном окне)
}
