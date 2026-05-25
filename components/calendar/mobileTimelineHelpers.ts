import type { CalendarEvent } from "./calendarStyles";

// px per hour row in the mobile timeline. 160 → 80 px per 30-min slot, enough
// room for the pet name + time row + service detail line in a 30-minute
// appointment without truncation.
export const HOUR_HEIGHT = 160;
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
  accent: string;       // 4px left strip — always the service color
  bgClass: string;      // card background tint — status driven
  borderClass: string;  // card outline color — status driven
  chipBg: string;       // status pill background
  chipFg: string;       // status pill text
};

// Status → standard pill color. Pill never inherits service color.
const STATUS_CHIP: Record<string, { chipBg: string; chipFg: string }> = {
  scheduled:       { chipBg: "#e0f2fe", chipFg: "#0c4a6e" }, // sky
  checkedIn:       { chipBg: "#e0e7ff", chipFg: "#3730a3" }, // indigo
  inProgress:      { chipBg: "#dbeafe", chipFg: "#1e3a8a" }, // deep blue
  completed:       { chipBg: "#ecfdf5", chipFg: "#065f46" }, // emerald
  pendingApproval: { chipBg: "#fef3c7", chipFg: "#92400e" }, // amber
  declined:        { chipBg: "#fef3c7", chipFg: "#92400e" }, // amber
  cancelled:       { chipBg: "#fee2e2", chipFg: "#991b1b" }, // red
  noShow:          { chipBg: "#fee2e2", chipFg: "#991b1b" }, // red
};

const DEFAULT_CHIP = { chipBg: "#e0f2fe", chipFg: "#0c4a6e" };

// Status → card background + border (Tailwind classes so dark mode handles
// itself). The 4px left strip stays the service color regardless of status.
function statusSurface(status: string): { bgClass: string; borderClass: string } {
  switch (status) {
    case "pendingApproval":
    case "declined":
      return {
        bgClass: "bg-amber-50 dark:bg-amber-950/30",
        borderClass: "border-amber-200 dark:border-amber-900/50",
      };
    case "cancelled":
    case "noShow":
      return {
        bgClass: "bg-red-200 dark:bg-red-950/60",
        borderClass: "border-red-300 dark:border-red-900",
      };
    case "completed":
      return {
        bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
        borderClass: "border-emerald-200 dark:border-emerald-900/50",
      };
    case "inProgress":
      return {
        bgClass: "bg-blue-100 dark:bg-blue-950/40",
        borderClass: "border-blue-300 dark:border-blue-900/50",
      };
    case "checkedIn":
      return {
        bgClass: "bg-indigo-50 dark:bg-indigo-950/30",
        borderClass: "border-indigo-200 dark:border-indigo-900/50",
      };
    case "scheduled":
    default:
      return {
        bgClass: "bg-zinc-50 dark:bg-zinc-900",
        borderClass: "border-zinc-200 dark:border-zinc-800",
      };
  }
}

export function cardStyles(event: CalendarEvent): CardStyles {
  const chip = STATUS_CHIP[event.status] ?? DEFAULT_CHIP;
  const surface = statusSurface(event.status);
  return {
    accent: event.color ?? "#00273c",
    bgClass: surface.bgClass,
    borderClass: surface.borderClass,
    chipBg: chip.chipBg,
    chipFg: chip.chipFg,
  };
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
