/**
 * Model + conversions for the slot-based availability editor (the pill-strip +
 * per-day slot design). Times are held as HOURS (0–23.5, half-hour steps) in
 * the UI, matching the design; converted to minutes-from-midnight only when
 * talking to Convex (`staffWeeklySchedule` / `staffDayOverride`).
 *
 * Two sources, resolved per date exactly like the backend does:
 *   - `weekly`   — the recurring template, keyed by weekday 0(Sun)–6(Sat).
 *   - `overrides`— per-date exceptions: booked off, or one-off custom slots.
 * A date with no override follows its weekday's weekly template ("repeat").
 */

export type Slot = { id: number; start: number; end: number }; // hours
export type WeeklyDay = { on: boolean; slots: Slot[] };
export type WeeklyState = Record<number, WeeklyDay>; // weekday 0–6
export type Override = { bookedOff: true } | { slots: Slot[] };
export type OverrideState = Record<string, Override>; // dateKey → override

export type WeeklyRow = { weekday: number; startMin: number; endMin: number };
export type MinSlot = { startMin: number; endMin: number };
export type OverrideRow = {
  date: string;
  kind: "off" | "custom";
  slots?: MinSlot[];
};

const hoursToMin = (hours: number): number => Math.round(hours * 60);
const minToHours = (min: number): number => min / 60;

/** Blank week — every weekday off with no slots. */
function emptyWeek(): WeeklyState {
  const week: WeeklyState = {};
  for (let day = 0; day < 7; day += 1) week[day] = { on: false, slots: [] };
  return week;
}

export function weeklyFromRows(rows: ReadonlyArray<WeeklyRow>): WeeklyState {
  const week = emptyWeek();
  const byDay = new Map<number, MinSlot[]>();
  for (const row of rows) {
    const list = byDay.get(row.weekday) ?? [];
    list.push({ startMin: row.startMin, endMin: row.endMin });
    byDay.set(row.weekday, list);
  }
  for (const [weekday, slots] of byDay) {
    const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
    week[weekday] = {
      on: sorted.length > 0,
      slots: sorted.map((slot, index) => ({
        id: index + 1,
        start: minToHours(slot.startMin),
        end: minToHours(slot.endMin),
      })),
    };
  }
  return week;
}

export function overridesFromRows(
  rows: ReadonlyArray<OverrideRow>,
): OverrideState {
  const result: OverrideState = {};
  for (const row of rows) {
    if (row.kind === "off") {
      result[row.date] = { bookedOff: true };
    } else {
      const slots = [...(row.slots ?? [])].sort(
        (a, b) => a.startMin - b.startMin,
      );
      result[row.date] = {
        slots: slots.map((slot, index) => ({
          id: index + 1,
          start: minToHours(slot.startMin),
          end: minToHours(slot.endMin),
        })),
      };
    }
  }
  return result;
}

/** Flatten the weekly template into Convex weekly rows (skips off days). */
export function weeklyToRows(weekly: WeeklyState): WeeklyRow[] {
  const rows: WeeklyRow[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const day = weekly[weekday];
    if (!day || !day.on) continue;
    for (const slot of day.slots) {
      rows.push({
        weekday,
        startMin: hoursToMin(slot.start),
        endMin: hoursToMin(slot.end),
      });
    }
  }
  return rows;
}

export function slotsToMin(slots: ReadonlyArray<Slot>): MinSlot[] {
  return slots.map((slot) => ({
    startMin: hoursToMin(slot.start),
    endMin: hoursToMin(slot.end),
  }));
}

export type EffectiveDay = {
  bookedOff: boolean;
  on: boolean;
  slots: Slot[];
  repeat: boolean; // following the weekly template (no override)
};

export function effectiveForDate(
  dateStr: string,
  weekly: WeeklyState,
  overrides: OverrideState,
): EffectiveDay {
  const override = overrides[dateStr];
  if (override && "bookedOff" in override) {
    return { bookedOff: true, on: false, slots: [], repeat: false };
  }
  if (override && "slots" in override) {
    return {
      bookedOff: false,
      on: override.slots.length > 0,
      slots: override.slots,
      repeat: false,
    };
  }
  const weeklyDay = weekly[dowOf(dateStr)] ?? { on: false, slots: [] };
  return {
    bookedOff: false,
    on: weeklyDay.on,
    slots: weeklyDay.slots,
    repeat: weeklyDay.on,
  };
}

/** "" when valid, else a human message. Matches the design's rules. */
export function validateSlots(slots: ReadonlyArray<Slot>): string {
  const sorted = [...slots].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].end <= sorted[i].start) {
      return "End time must be after start time.";
    }
    if (i > 0 && sorted[i].start < sorted[i - 1].end) {
      return "Slots overlap — adjust the times.";
    }
  }
  return "";
}

export function overrideEquals(
  a: Override | undefined,
  b: Override | undefined,
): boolean {
  if (!a || !b) return a === b;
  const aOff = "bookedOff" in a;
  const bOff = "bookedOff" in b;
  if (aOff || bOff) return aOff && bOff;
  const as = a.slots;
  const bs = b.slots;
  if (as.length !== bs.length) return false;
  const sortByStart = (list: Slot[]) =>
    [...list].sort((x, y) => x.start - y.start);
  const sa = sortByStart(as);
  const sb = sortByStart(bs);
  return sa.every(
    (slot, index) => slot.start === sb[index].start && slot.end === sb[index].end,
  );
}

// --- date + time helpers -------------------------------------------------

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dowOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

export function formatAmPm(hours: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  let hh = Math.floor(hours) % 12;
  if (hh === 0) hh = 12;
  const mm = Math.round((hours - Math.floor(hours)) * 60);
  return `${hh}:${String(mm).padStart(2, "0")} ${period}`;
}

export function longDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export type TimeOption = { value: string; label: string };

/** Half-hour options across the day, matching the design (0 … 23.5). */
export const TIME_OPTIONS: TimeOption[] = (() => {
  const options: TimeOption[] = [];
  for (let h = 0; h <= 23.5; h += 0.5) {
    options.push({ value: String(h), label: formatAmPm(h) });
  }
  return options;
})();

export type DayPill = {
  key: string;
  month: string;
  dow: string;
  num: number;
  isToday: boolean;
  isSelected: boolean;
  tone: "off" | "on" | "none"; // status dot
  disabled: boolean; // booking: date has no open slot
};

function pillDateParts(
  date: Date,
  index: number,
  selectedDate: string,
): Pick<DayPill, "key" | "month" | "dow" | "num" | "isToday" | "isSelected"> {
  const key = dateKey(date);
  return {
    key,
    month: index === 0 || date.getDate() === 1 ? MONTH_NAMES[date.getMonth()] : "",
    dow: WEEKDAY_NAMES[date.getDay()].slice(0, 3).toUpperCase(),
    num: date.getDate(),
    isToday: index === 0,
    isSelected: key === selectedDate,
  };
}

/** Availability-editor pills: `count` days from `today`, status dot per day. */
export function buildPills(
  today: Date,
  count: number,
  selectedDate: string,
  weekly: WeeklyState,
  overrides: OverrideState,
): DayPill[] {
  const pills: DayPill[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const eff = effectiveForDate(dateKey(date), weekly, overrides);
    pills.push({
      ...pillDateParts(date, i, selectedDate),
      tone: eff.bookedOff ? "off" : eff.on ? "on" : "none",
      disabled: false,
    });
  }
  return pills;
}

/** Booking pills: `count` days from `startDate`; days with no open slot are
 *  disabled (dimmed, unselectable). */
export function buildBookingPills(
  startDate: Date,
  count: number,
  selectedDate: string,
  availableDates: ReadonlySet<string>,
): DayPill[] {
  const pills: DayPill[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const parts = pillDateParts(date, i, selectedDate);
    const available = availableDates.has(parts.key);
    pills.push({
      ...parts,
      tone: available ? "on" : "none",
      disabled: !available,
    });
  }
  return pills;
}
