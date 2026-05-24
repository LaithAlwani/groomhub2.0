import type { CalendarEvent } from "./calendarStyles";

export const HOUR_HEIGHT = 88; // px per hour row in the mobile timeline
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

export function sameDayEvents(
  events: ReadonlyArray<CalendarEvent>,
  date: Date,
): ReadonlyArray<CalendarEvent> {
  return events
    .filter((event) => isSameDay(event.start, date))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Pick hour bounds for the timeline. Availability wins — if the focused day
 * has any availability slots, the box ends one hour after the last slot, so a
 * stray event later in the evening can't stretch the timeline past the
 * shop's working hours. Falls back to event bounds (one-hour pad), then to
 * the global defaults.
 */
export function bounds(
  events: ReadonlyArray<CalendarEvent>,
  availability?: ReadonlyArray<{ startMin: number; endMin: number }>,
): { startHour: number; endHour: number } {
  if (availability && availability.length > 0) {
    let earliest = Infinity;
    let latest = -Infinity;
    for (const slot of availability) {
      earliest = Math.min(earliest, Math.floor(slot.startMin / 60));
      latest = Math.max(latest, Math.ceil(slot.endMin / 60));
    }
    return {
      startHour: Math.max(0, earliest - 1),
      endHour: Math.min(24, latest + 1),
    };
  }
  if (events.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }
  let earliest = DEFAULT_START_HOUR;
  let latest = DEFAULT_END_HOUR;
  for (const event of events) {
    earliest = Math.min(earliest, event.start.getHours());
    latest = Math.max(
      latest,
      Math.ceil(event.end.getHours() + event.end.getMinutes() / 60),
    );
  }
  return {
    startHour: Math.max(0, earliest - 1),
    endHour: Math.min(24, latest + 1),
  };
}

export type CardStyles = {
  accent: string;
  chipBg: string;
  chipFg: string;
};

export function cardStyles(event: CalendarEvent): CardStyles {
  if (event.status === "pendingApproval" || event.status === "declined") {
    return { accent: "#f97316", chipBg: "#fff7ed", chipFg: "#9a3412" };
  }
  if (event.status === "completed") {
    return { accent: "#10b981", chipBg: "#ecfdf5", chipFg: "#065f46" };
  }
  if (event.status === "cancelled" || event.status === "noShow") {
    return { accent: "#a1a1aa", chipBg: "#f4f4f5", chipFg: "#52525b" };
  }
  const accent = event.color ?? "#00273c";
  return { accent, chipBg: `${accent}1a`, chipFg: accent };
}

export function statusLabel(status: string): string {
  if (status === "pendingApproval") return "Pending";
  if (status === "declined") return "Declined";
  if (status === "completed") return "Done";
  if (status === "cancelled") return "Cancelled";
  if (status === "noShow") return "No-show";
  if (status === "checkedIn") return "Checked in";
  if (status === "inProgress") return "In progress";
  return "Scheduled";
}

export function addDays(date: Date, delta: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + delta);
  return result;
}

export function atHour(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatHourLabel(hour: number): string {
  const hh = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${String(hh).padStart(2, "0")}:00 ${suffix}`;
}

export function formatTimeRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}
