import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";

const MAX_APPOINTMENT_MS = 24 * 60 * 60 * 1000;
const NON_BLOCKING_STATUSES: ReadonlyArray<Doc<"appointments">["status"]> = [
  "cancelled",
];

/**
 * Returns the existing conflicting appointment (other than `excludeId`) for a
 * staff member in the given time range, or null. The `by_staff_start` index is
 * scanned from `startTime - MAX_APPOINTMENT_MS` to `endTime`; we then filter
 * in JS for actual overlap. Bounded by a 64-row take which is more than enough
 * for any realistic single-day staff calendar.
 */
export async function findConflictForStaff(
  ctx: QueryCtx | MutationCtx,
  staffId: Id<"memberships">,
  startTime: number,
  endTime: number,
  excludeId: Id<"appointments"> | null,
): Promise<Doc<"appointments"> | null> {
  const candidates = await ctx.db
    .query("appointments")
    .withIndex("by_staff_start", (index) =>
      index
        .eq("staffId", staffId)
        .gte("startTime", startTime - MAX_APPOINTMENT_MS)
        .lt("startTime", endTime),
    )
    .take(64);
  for (const candidate of candidates) {
    if (excludeId && candidate._id === excludeId) continue;
    if (NON_BLOCKING_STATUSES.includes(candidate.status)) continue;
    if (candidate.startTime < endTime && candidate.endTime > startTime) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolves a staff member's available slots (in minutes from midnight in the
 * location's timezone) for a single calendar date at a single location. Order:
 * per-day override wins, else the weekly pattern for that weekday at that
 * location, else `[]`.
 */
export async function getSlotsForStaffOnDate(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
  date: string,
): Promise<Array<{ startMin: number; endMin: number }>> {
  const override = await ctx.db
    .query("staffDayOverride")
    .withIndex("by_org_location_staff_date", (index) =>
      index
        .eq("orgId", orgId)
        .eq("locationId", locationId)
        .eq("staffId", staffId)
        .eq("date", date),
    )
    .unique();
  if (override?.kind === "off") return [];
  if (override?.kind === "custom") {
    return (override.slots ?? []).map((slot) => ({ ...slot }));
  }
  const weekday = weekdayFromDate(date);
  const rows = await ctx.db
    .query("staffWeeklySchedule")
    .withIndex("by_org_location_staff_weekday", (index) =>
      index
        .eq("orgId", orgId)
        .eq("locationId", locationId)
        .eq("staffId", staffId)
        .eq("weekday", weekday),
    )
    .collect();
  return rows.map((row) => ({ startMin: row.startMin, endMin: row.endMin }));
}

/**
 * Throws `OUTSIDE_AVAILABILITY` if [startTime, endTime] doesn't fit entirely
 * within any of the staff's available slots on `dateKey` at the named location.
 * Times are interpreted in the location's timezone.
 */
export async function assertWithinAvailability(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
  startTime: number,
  endTime: number,
  locationTimezone: string,
): Promise<void> {
  const dateKey = formatDateInTimezone(startTime, locationTimezone);
  const dateKeyEnd = formatDateInTimezone(endTime - 1, locationTimezone);
  if (dateKey !== dateKeyEnd) {
    appError("OUTSIDE_AVAILABILITY", { reason: "SPANS_MIDNIGHT" });
  }
  const startMin = minutesIntoDayInTimezone(startTime, locationTimezone);
  const endMin = minutesIntoDayInTimezone(endTime, locationTimezone);
  const slots = await getSlotsForStaffOnDate(
    ctx,
    orgId,
    locationId,
    staffId,
    dateKey,
  );
  const inSlot = slots.some(
    (slot) => slot.startMin <= startMin && endMin <= slot.endMin,
  );
  if (!inSlot) appError("OUTSIDE_AVAILABILITY", { dateKey });
}

function weekdayFromDate(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * Returns the calendar date (YYYY-MM-DD) of `timestamp` in `timezone`.
 * Uses Intl with `en-CA` because it produces ISO-shaped output reliably.
 */
function formatDateInTimezone(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function minutesIntoDayInTimezone(timestamp: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}
