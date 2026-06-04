/**
 * Timezone-aware date helpers for the booking calendar.
 *
 * Background: `react-big-calendar` and the date pickers in the appointment
 * dialog all read native `Date` methods (`getHours`, `getDate`, …) that return
 * values in the **browser's** timezone. The booking backend, however,
 * validates against the **location's** timezone. For a Jordan-based viewer
 * looking at a Toronto shop, those don't agree — the calendar paints a slot
 * at 9 AM Amman, but the click sends a UTC timestamp that the backend reads
 * as 1 AM Toronto, falling outside the 9 AM–5 PM availability window.
 *
 * Fix: convert at the boundary using a **pseudo-Date** pattern. A "zoned
 * pseudo-Date" is a `Date` whose browser-local accessors give the wall-clock
 * values for the *target* timezone — i.e. for a Jordan browser viewing a
 * Toronto shop, `getHours()` returns the Toronto hour, not the Amman hour.
 * react-big-calendar then renders it correctly because every accessor it
 * reads is already in the location's frame. Click handlers receive a Date
 * back, which we interpret as a location-TZ wall-clock when converting to
 * a UTC ms timestamp for the backend.
 *
 * Nothing in this file imports Convex — it's pure datetime maths.
 */

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Extracts the wall-clock parts (year/month/day/hour/minute/second) of a UTC
 * timestamp as they appear in `timezone`. Uses `Intl.DateTimeFormat` with
 * `en-CA` because that locale's part stream is ISO-shaped.
 */
export function partsInTimezone(utcMs: number, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  let hour = get("hour");
  // Some ICU implementations emit "24" for midnight in en-CA; normalize.
  if (hour === 24) hour = 0;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Interprets a wall-clock (year/month/day/hour/minute/second) as being in
 * `timezone`, returns the matching UTC ms instant. Handles DST transitions
 * with a two-pass refinement (the first guess overshoots/undershoots across
 * a transition; the second pass corrects).
 *
 * Edge case during a DST "gap" (e.g. 02:30 on a spring-forward Sunday): no
 * real UTC instant maps to the wall-clock. Returns the instant one offset
 * later, which is what most libraries (and Stripe/Google) do.
 */
export function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): number {
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  // What does `timezone` show at the desired instant if interpreted as UTC?
  const seenAtDesired = partsInTimezone(desired, timezone);
  const seenUtc = Date.UTC(
    seenAtDesired.year,
    seenAtDesired.month - 1,
    seenAtDesired.day,
    seenAtDesired.hour,
    seenAtDesired.minute,
    seenAtDesired.second,
  );
  // The TZ offset (positive when ahead of UTC) at this instant
  const offset = desired - seenUtc;
  const refined = desired + offset;
  // Re-measure to catch DST transitions: at the refined instant the offset
  // may differ from the first guess.
  const seenAtRefined = partsInTimezone(refined, timezone);
  const refinedSeenUtc = Date.UTC(
    seenAtRefined.year,
    seenAtRefined.month - 1,
    seenAtRefined.day,
    seenAtRefined.hour,
    seenAtRefined.minute,
    seenAtRefined.second,
  );
  return refined + (desired - refinedSeenUtc);
}

/**
 * Returns a `Date` instance whose browser-local accessors give the wall-clock
 * values that `timezone` would show for `utcMs`. Hand these to libraries that
 * read `Date.prototype.getHours` etc. — they'll see the location's clock,
 * not the viewer's.
 */
export function utcToZonedPseudoDate(utcMs: number, timezone: string): Date {
  const p = partsInTimezone(utcMs, timezone);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
}

/**
 * Inverse of `utcToZonedPseudoDate`. Treats the pseudo-Date's browser-local
 * wall-clock as being in `timezone`, returns the real UTC ms instant.
 */
export function zonedPseudoDateToUtc(pseudo: Date, timezone: string): number {
  return wallClockToUtc(
    pseudo.getFullYear(),
    pseudo.getMonth() + 1,
    pseudo.getDate(),
    pseudo.getHours(),
    pseudo.getMinutes(),
    pseudo.getSeconds(),
    timezone,
  );
}

/**
 * Returns a pseudo-Date for `Date.now()` in the location timezone — useful
 * for "today" / "now" comparisons against other pseudo-Dates the calendar is
 * already rendering.
 */
export function nowInTimezone(timezone: string): Date {
  return utcToZonedPseudoDate(Date.now(), timezone);
}

/**
 * `Date.now()` rounded up to the next 15-minute mark, expressed as a
 * location-TZ pseudo-Date. Used as the default start time when opening the
 * appointment dialog from a button click (vs from a calendar slot click).
 */
export function roundedNowInTimezone(timezone: string): Date {
  const pseudo = nowInTimezone(timezone);
  pseudo.setMinutes(Math.ceil(pseudo.getMinutes() / 15) * 15, 0, 0);
  return pseudo;
}

/** YYYY-MM-DD of `utcMs` in `timezone`. */
export function isoDateInTimezone(utcMs: number, timezone: string): string {
  const p = partsInTimezone(utcMs, timezone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** HH:MM of `utcMs` in `timezone`. */
export function isoTimeInTimezone(utcMs: number, timezone: string): string {
  const p = partsInTimezone(utcMs, timezone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Combines a YYYY-MM-DD + HH:MM pair, interpreted as a wall-clock in
 * `timezone`, into a UTC ms timestamp. Drop-in replacement for
 * `combineLocalIso` from `lib/time.ts` once the calendar/dialog flow knows
 * which timezone to pass.
 */
export function combineDateTimeInTimezone(
  dateStr: string,
  timeStr: string,
  timezone: string,
): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return wallClockToUtc(year, month, day, hour, minute, 0, timezone);
}

/**
 * Start-of-day in `timezone` for the day that contains `utcMs`, expressed in
 * UTC ms. Used to compute fetch windows for the calendar so the 3-week range
 * lands on location-TZ day boundaries.
 */
export function startOfDayInTimezone(utcMs: number, timezone: string): number {
  const p = partsInTimezone(utcMs, timezone);
  return wallClockToUtc(p.year, p.month, p.day, 0, 0, 0, timezone);
}
