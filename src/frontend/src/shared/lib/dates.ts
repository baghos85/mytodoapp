/**
 * Date-only helpers (SPEC 3, 5.1, 10.8). Due dates are `YYYY-MM-DD` strings without a time zone.
 * Never use `new Date('YYYY-MM-DD')`: it parses as UTC midnight and shows the previous day west of UTC.
 */

/** A calendar date as `YYYY-MM-DD`. */
export type DateOnly = string;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function toParts(value: DateOnly): DateParts {
  const match = DATE_ONLY.exec(value);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() === year &&
      check.getUTCMonth() === month - 1 &&
      check.getUTCDate() === day
    ) {
      return { year, month, day };
    }
  }
  throw new RangeError(`Invalid date-only value: "${value}"`);
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function fromParts({ year, month, day }: DateParts): DateOnly {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** `true` if `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isDateOnly(value: string): boolean {
  try {
    toParts(value);
    return true;
  } catch {
    return false;
  }
}

/** Parses `YYYY-MM-DD` to a `Date` at **local** midnight of that day. Throws `RangeError` if invalid. */
export function parseDateOnly(value: DateOnly): Date {
  const { year, month, day } = toParts(value);
  return new Date(year, month - 1, day);
}

/** The local calendar date of `date` as `YYYY-MM-DD`. */
export function toDateOnly(date: Date): DateOnly {
  return fromParts({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
}

/** Today's date in the IANA time zone `timeZone` (SPEC 5.1). `now` is injectable for tests. */
export function todayIn(timeZone: string, now: Date = new Date()): DateOnly {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return fromParts({ year: get('year'), month: get('month'), day: get('day') });
}

/** `value` plus `days` calendar days (negative to go back). */
export function addDays(value: DateOnly, days: number): DateOnly {
  const { year, month, day } = toParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return fromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/**
 * Formats a date-only value in the browser locale (or `locale`). Formatting happens in UTC on purpose,
 * so neither the device time zone nor DST can shift the day.
 */
export function formatDateOnly(
  value: DateOnly,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale?: string,
): string {
  const { year, month, day } = toParts(value);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** The browser's IANA time zone (SPEC 4.7), `UTC` if the browser doesn't report one. */
export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
