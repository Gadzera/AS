/**
 * Send time optimizer — picks the next business-hours send window
 * based on the lead's country/timezone.
 *
 * Target window: Tuesday–Thursday, 09:00–11:00 local time
 * (highest open rates per industry research).
 * Falls back to Monday/Friday if no Tue–Thu slot within 3 days.
 */

// Country → IANA timezone (subset covering most B2B markets)
const COUNTRY_TZ: Record<string, string> = {
  'United States': 'America/New_York',
  'US':            'America/New_York',
  'USA':           'America/New_York',
  'United Kingdom': 'Europe/London',
  'UK':            'Europe/London',
  'Germany':       'Europe/Berlin',
  'France':        'Europe/Paris',
  'Netherlands':   'Europe/Amsterdam',
  'Spain':         'Europe/Madrid',
  'Italy':         'Europe/Rome',
  'Poland':        'Europe/Warsaw',
  'Russia':        'Europe/Moscow',
  'Canada':        'America/Toronto',
  'Australia':     'Australia/Sydney',
  'India':         'Asia/Kolkata',
  'Brazil':        'America/Sao_Paulo',
  'Mexico':        'America/Mexico_City',
  'Sweden':        'Europe/Stockholm',
  'Denmark':       'Europe/Copenhagen',
  'Norway':        'Europe/Oslo',
  'Finland':       'Europe/Helsinki',
  'Belgium':       'Europe/Brussels',
  'Switzerland':   'Europe/Zurich',
  'Austria':       'Europe/Vienna',
  'Israel':        'Asia/Jerusalem',
  'UAE':           'Asia/Dubai',
  'Singapore':     'Asia/Singapore',
  'Japan':         'Asia/Tokyo',
  'South Korea':   'Asia/Seoul',
};

const FALLBACK_TZ = 'UTC';
const TARGET_HOUR = 10; // 10:00 local time
const TARGET_DAYS = [2, 3, 4]; // Tue=2, Wed=3, Thu=4 (0=Sun)

export function getOptimalSendTime(country: string | null | undefined, fromDate: Date = new Date()): Date {
  const tz = (country ? COUNTRY_TZ[country] : null) ?? FALLBACK_TZ;

  // Find next Tue–Thu slot at TARGET_HOUR in that timezone
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(fromDate.getTime() + daysAhead * 86_400_000);

    // Get local date parts in target timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(candidate);

    const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';
    const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = WEEKDAY_MAP[weekdayStr] ?? candidate.getUTCDay();

    if (!TARGET_DAYS.includes(weekday)) continue;

    // Build a Date that represents TARGET_HOUR in target timezone
    const localMidnight = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(candidate); // YYYY-MM-DD

    const targetLocal = new Date(`${localMidnight}T${String(TARGET_HOUR).padStart(2, '0')}:00:00`);

    // Convert from local time to UTC using timezone offset
    const utcStr = new Date(targetLocal.getTime()).toLocaleString('en-US', { timeZone: tz });
    const utcFromLocal = new Date(targetLocal.getTime() - (new Date(utcStr).getTime() - targetLocal.getTime()));

    if (utcFromLocal > fromDate) return utcFromLocal;
  }

  // Fallback: 24h from now
  return new Date(fromDate.getTime() + 86_400_000);
}
