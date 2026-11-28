import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays, formatDateOnly, isDateOnly, parseDateOnly, toDateOnly, todayIn } from './dates';

// Tests run with TZ=America/Los_Angeles (vite.config.ts), west of UTC.

afterEach(() => {
  vi.useRealTimers();
});

describe('parseDateOnly', () => {
  it('Environment_NativeDateParsing_IsOffByOneHere', () => {
    // The pitfall dates.ts exists for: `new Date('YYYY-MM-DD')` is UTC midnight = the previous local day.
    expect(new Date('2026-03-05').getDate()).toBe(4);
  });

  it('parseDateOnly_ValidDate_ReturnsLocalMidnightOfTheSameDay', () => {
    const date = parseDateOnly('2026-03-05');

    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 3, 5]);
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
  });

  it('parseDateOnly_RoundTripThroughToDateOnly_ReturnsSameValue', () => {
    for (const value of ['2000-01-01', '2026-03-08', '2026-11-01', '2099-12-31']) {
      expect(toDateOnly(parseDateOnly(value))).toBe(value);
    }
  });

  it.each(['2026-02-30', '2026-2-3', '2026-13-01', '', 'not a date', '2026-03-05T00:00:00Z'])(
    'parseDateOnly_InvalidValue_ThrowsRangeError (%s)',
    (value) => {
      expect(() => parseDateOnly(value)).toThrow(RangeError);
      expect(isDateOnly(value)).toBe(false);
    },
  );
});

describe('todayIn', () => {
  it('todayIn_OneSecondBeforeMidnightInParis_ReturnsThatDay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T22:59:59Z')); // 23:59:59 in Paris (UTC+1)

    expect(todayIn('Europe/Paris')).toBe('2026-11-27');
  });

  it('todayIn_AtMidnightInParis_ReturnsNextDay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T23:00:00Z')); // 00:00 on 28 Nov in Paris

    expect(todayIn('Europe/Paris')).toBe('2026-11-28');
    expect(todayIn('UTC')).toBe('2026-11-27');
    expect(todayIn('America/New_York')).toBe('2026-11-27');
  });

  it('todayIn_ExplicitNow_UsesTheGivenInstant', () => {
    expect(todayIn('Pacific/Auckland', new Date('2026-12-31T11:00:00Z'))).toBe('2027-01-01');
  });
});

describe('addDays', () => {
  it('addDays_AcrossMonthYearAndDst_ReturnsCalendarDate', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08'); // US DST starts 8 March 2026
  });
});

describe('formatDateOnly', () => {
  it('formatDateOnly_DefaultOptions_FormatsTheSameDay', () => {
    expect(formatDateOnly('2026-03-05', undefined, 'en-US')).toBe('Mar 5, 2026');
  });

  it('formatDateOnly_WeekdayOption_UsesThatDaysWeekday', () => {
    expect(formatDateOnly('2026-11-27', { weekday: 'long' }, 'en-US')).toBe('Friday');
  });
});
