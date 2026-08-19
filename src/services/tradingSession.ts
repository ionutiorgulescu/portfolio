export type SessionMarket = 'us' | 'bvb' | 'crypto';

export type TradingSessionWindow = {
  start: number;
  end: number;
  timeZone: string;
};

export type ResolveTradingSessionOptions = {
  /** US 1D window includes pre-market (04:00) and after-hours (to 20:00 ET). */
  includeExtendedHours?: boolean;
};

type CivilDate = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const US_TZ = 'America/New_York';
const BVB_TZ = 'Europe/Bucharest';
const UTC_TZ = 'UTC';

function zonedParts(ms: number, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: WEEKDAY[get('weekday')] ?? 0,
  };
}

/** Wall-clock time in `timeZone` → UTC ms. Safe for NY/Bucharest market hours (no DST overlap). */
export function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const shifted = zonedParts(utcGuess, timeZone);
  const asIfUtc = Date.UTC(
    shifted.year,
    shifted.month - 1,
    shifted.day,
    shifted.hour,
    shifted.minute,
    0,
  );
  return utcGuess - (asIfUtc - utcGuess);
}

function addDays(year: number, month: number, day: number, delta: number): CivilDate {
  const utc = Date.UTC(year, month - 1, day + delta);
  const date = new Date(utc);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    weekday: date.getUTCDay(),
  };
}

function previousWeekday(year: number, month: number, day: number): CivilDate {
  let cursor = { year, month, day, hour: 0, minute: 0, weekday: 0 };
  do {
    cursor = addDays(cursor.year, cursor.month, cursor.day, -1);
  } while (cursor.weekday === 0 || cursor.weekday === 6);
  return cursor;
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function windowOn(
  timeZone: string,
  date: Pick<CivilDate, 'year' | 'month' | 'day'>,
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): TradingSessionWindow {
  return {
    start: zonedLocalToUtc(timeZone, date.year, date.month, date.day, startH, startM),
    end: zonedLocalToUtc(timeZone, date.year, date.month, date.day, endH, endM),
    timeZone,
  };
}

function usExtendedSessionForDate(
  date: Pick<CivilDate, 'year' | 'month' | 'day'>,
): TradingSessionWindow {
  return windowOn(US_TZ, date, 4, 0, 20, 0);
}

function usSessionForDate(
  date: Pick<CivilDate, 'year' | 'month' | 'day'>,
  now: number,
  includeExtendedHours = false,
): TradingSessionWindow {
  const preOpen = zonedLocalToUtc(US_TZ, date.year, date.month, date.day, 4, 0);
  const regularOpen = zonedLocalToUtc(US_TZ, date.year, date.month, date.day, 9, 30);
  const regularClose = zonedLocalToUtc(US_TZ, date.year, date.month, date.day, 16, 0);
  const postClose = zonedLocalToUtc(US_TZ, date.year, date.month, date.day, 20, 0);

  if (includeExtendedHours) {
    // Always include pre-market; extend through after-hours once it has started.
    if (now <= regularClose) {
      return { start: preOpen, end: regularClose, timeZone: US_TZ };
    }
    return { start: preOpen, end: postClose, timeZone: US_TZ };
  }

  if (now < regularOpen) {
    return { start: preOpen, end: regularOpen, timeZone: US_TZ };
  }
  if (now <= regularClose) {
    return { start: regularOpen, end: regularClose, timeZone: US_TZ };
  }
  if (now <= postClose) {
    return { start: regularOpen, end: postClose, timeZone: US_TZ };
  }
  return { start: regularOpen, end: regularClose, timeZone: US_TZ };
}

function bvbSessionForDate(date: Pick<CivilDate, 'year' | 'month' | 'day'>): TradingSessionWindow {
  return windowOn(BVB_TZ, date, 10, 0, 17, 45);
}

function cryptoSessionForDate(date: Pick<CivilDate, 'year' | 'month' | 'day'>): TradingSessionWindow {
  const start = zonedLocalToUtc(UTC_TZ, date.year, date.month, date.day, 0, 0);
  const next = addDays(date.year, date.month, date.day, 1);
  const end = zonedLocalToUtc(UTC_TZ, next.year, next.month, next.day, 0, 0);
  return { start, end, timeZone: UTC_TZ };
}

function sessionDay(market: SessionMarket, now: number): CivilDate {
  const timeZone = market === 'us' ? US_TZ : market === 'bvb' ? BVB_TZ : UTC_TZ;
  const parts = zonedParts(now, timeZone);

  if (market === 'crypto') return parts;

  if (parts.weekday === 0 || parts.weekday === 6) {
    return previousWeekday(parts.year, parts.month, parts.day);
  }

  const openMinute = market === 'us' ? minutesOfDay(4, 0) : minutesOfDay(10, 0);
  if (minutesOfDay(parts.hour, parts.minute) < openMinute) {
    return previousWeekday(parts.year, parts.month, parts.day);
  }

  return parts;
}

/**
 * 1D chart window: session open → session close.
 * Before the open (or on weekends) this is the previous completed regular session.
 * US premarket uses 04:00–09:30 ET; regular 09:30–16:00; after-hours extends to 20:00.
 * Pass `includeExtendedHours` to always plot the full US 04:00–20:00 window.
 */
export function resolveTradingSession(
  market: SessionMarket,
  now: number,
  latestBarT?: number,
  options?: ResolveTradingSessionOptions,
): TradingSessionWindow {
  const includeExtendedHours = options?.includeExtendedHours === true;
  const date = sessionDay(market, now);
  const session =
    market === 'us'
      ? usSessionForDate(date, now, includeExtendedHours)
      : market === 'bvb'
        ? bvbSessionForDate(date)
        : cryptoSessionForDate(date);

  if (latestBarT == null || latestBarT >= session.start) return session;

  // Weekday holiday (or no prints yet for a past session): show the day of the last bar.
  const barZone = session.timeZone;
  const barDay = zonedParts(latestBarT, barZone);
  if (barDay.weekday === 0 || barDay.weekday === 6) return session;

  const barDate = { year: barDay.year, month: barDay.month, day: barDay.day };
  const barSession =
    market === 'us'
      ? includeExtendedHours
        ? usExtendedSessionForDate(barDate)
        : windowOn(US_TZ, barDate, 9, 30, 16, 0)
      : market === 'bvb'
        ? bvbSessionForDate(barDate)
        : cryptoSessionForDate(barDate);

  if (barSession.end < session.start && now > session.end) return barSession;
  return session;
}

/** Live US extended-hours phase, or null during regular hours / weekends / overnight. */
export function resolveUsPriceSession(now: number): 'PRE' | 'POST' | null {
  const parts = zonedParts(now, US_TZ);
  if (parts.weekday === 0 || parts.weekday === 6) return null;
  const mins = minutesOfDay(parts.hour, parts.minute);
  if (mins >= minutesOfDay(4, 0) && mins < minutesOfDay(9, 30)) return 'PRE';
  if (mins >= minutesOfDay(16, 0) && mins < minutesOfDay(20, 0)) return 'POST';
  return null;
}
