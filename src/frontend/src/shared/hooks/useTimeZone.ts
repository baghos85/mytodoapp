import { useState } from 'react';
import { getBrowserTimeZone } from '../lib/dates';

/** The browser's IANA time zone, sent as `timeZone` to the Today/Upcoming endpoints (SPEC 4.7). */
export function useTimeZone(): string {
  const [timeZone] = useState(getBrowserTimeZone);
  return timeZone;
}
