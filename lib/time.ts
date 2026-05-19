/**
 * Minutes-from-midnight helpers shared between the availability editor and
 * (later) the booking calendar. All values are in the org's timezone.
 *
 * Time picker grid: the app standardises on 15-minute increments (00/15/30/45)
 * everywhere a user enters a time. UI inputs use `step={QUARTER_HOUR_SECONDS}`
 * for native picker filtering, and any out-of-grid value is snapped via
 * `snapToQuarter` on change. Convex side validates `% 15 === 0` as a server
 * guard.
 */

export const QUARTER_HOUR = 15;
export const QUARTER_HOUR_SECONDS = QUARTER_HOUR * 60;

export function snapToQuarter(minutes: number): number {
  const snapped = Math.round(minutes / QUARTER_HOUR) * QUARTER_HOUR;
  if (snapped < 0) return 0;
  if (snapped > 24 * 60) return 24 * 60;
  return snapped;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function minutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

export function formatRange(startMin: number, endMin: number): string {
  return `${minutesToHHMM(startMin)} – ${minutesToHHMM(endMin)}`;
}

/**
 * Format a YYYY-MM-DD date string using the user's locale (long month, day).
 */
export function formatLocalDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}
