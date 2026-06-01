import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import { ensureMembership, readMembershipForQuery } from "./lib/ensureMembership";
import { mapClerkOrgRole } from "./lib/roles";
import { requireAuth, softAuth } from "./lib/tenant";
import {
  assertWeeklyWithinShopHours,
  constrainToShopHours,
  readShopHours,
} from "./locationHours";

const MAX_RANGES_PER_DAY = 6;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const rangeValidator = v.object({
  weekday: v.number(),
  startMin: v.number(),
  endMin: v.number(),
});

const slotValidator = v.object({
  startMin: v.number(),
  endMin: v.number(),
});

const overrideKindValidator = v.union(v.literal("off"), v.literal("custom"));

/**
 * Returns the caller's weekly schedule at a specific location (all weekdays).
 * Sorted by `(weekday, startMin)` for stable rendering. UI passes the active
 * location id from the sidebar switcher.
 */
export const myWeekly = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    await assertLocationInOrg(ctx, args.locationId, identity.orgId);
    const { membership } = await readMembershipForQuery(ctx, identity);
    if (!membership) return [];
    return await readWeekly(ctx, identity.orgId, args.locationId, membership._id);
  },
});

/**
 * Returns the caller's overrides at a location between `fromDate` and `toDate`
 * (inclusive), keyed by date string.
 */
export const myOverridesInRange = query({
  args: {
    locationId: v.id("locations"),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    await assertLocationInOrg(ctx, args.locationId, identity.orgId);
    const { membership } = await readMembershipForQuery(ctx, identity);
    if (!membership) return [];
    return await readOverridesInRange(
      ctx,
      identity.orgId,
      args.locationId,
      membership._id,
      args.fromDate,
      args.toDate,
    );
  },
});

/**
 * Replaces the caller's weekly schedule at a location with the supplied ranges.
 * Transactional (delete-all + insert) so the editor saves the full grid in one shot.
 */
export const upsertMyWeekly = mutation({
  args: {
    locationId: v.id("locations"),
    ranges: v.array(rangeValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await assertLocationInOrg(ctx, args.locationId, identity.orgId);
    const { membership } = await ensureMembership(ctx, identity);
    validateRanges(args.ranges);
    // A groomer can only be available while the shop is open.
    await assertWeeklyWithinShopHours(
      ctx,
      identity.orgId,
      args.locationId,
      args.ranges,
    );
    await replaceWeeklyForStaff(
      ctx,
      identity.orgId,
      args.locationId,
      membership._id,
      args.ranges,
    );
    // First time the groomer saves their own hours, mark them confirmed — this
    // is what completes the "Confirm your working hours" onboarding step. The
    // inherited shop-hours seed does not call this path, so it stays unset until
    // the groomer actively reviews/saves.
    if (membership.availabilityConfirmedAt === undefined) {
      await ctx.db.patch(membership._id, { availabilityConfirmedAt: Date.now() });
    }
  },
});

/**
 * Set or clear the caller's override for a single date at a location.
 *  - `kind: "off"` — day is unavailable.
 *  - `kind: "custom"` — `slots` replaces the weekly pattern for that date.
 *  - omit body (this path passes a `kind` but the caller can also pass
 *    `clear: true` via the separate `clearMyOverride` mutation to remove it).
 */
export const upsertMyOverride = mutation({
  args: {
    locationId: v.id("locations"),
    date: v.string(),
    kind: overrideKindValidator,
    slots: v.optional(v.array(slotValidator)),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await assertLocationInOrg(ctx, args.locationId, identity.orgId);
    const { membership } = await ensureMembership(ctx, identity);
    validateOverride(args);
    await upsertOverrideForStaff(
      ctx,
      identity.orgId,
      args.locationId,
      membership._id,
      args.date,
      args.kind,
      args.slots,
    );
  },
});

/**
 * Removes the caller's override row for a date at a location (= revert to the
 * weekly pattern).
 */
export const clearMyOverride = mutation({
  args: { locationId: v.id("locations"), date: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await assertLocationInOrg(ctx, args.locationId, identity.orgId);
    const { membership } = await ensureMembership(ctx, identity);
    if (!DATE_PATTERN.test(args.date)) {
      appError("VALIDATION", { field: "date", reason: "INVALID" });
    }
    const existing = await readOverrideRow(
      ctx,
      identity.orgId,
      args.locationId,
      membership._id,
      args.date,
    );
    if (existing) await ctx.db.delete(existing._id);
  },
});

/**
 * Admin / superAdmin: read another staff member's weekly schedule at a
 * location. Staff can still call this for their own `staffId` — the auth check
 * enforces it.
 */
export const forStaffWeekly = query({
  args: {
    locationId: v.id("locations"),
    staffId: v.id("memberships"),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOwnOrAdmin(ctx, args.staffId);
    if (!orgId) return [];
    await assertLocationInOrg(ctx, args.locationId, orgId);
    return await readWeekly(ctx, orgId, args.locationId, args.staffId);
  },
});

/**
 * Admin / superAdmin: read another staff member's overrides at a location in a
 * range.
 */
export const forStaffOverridesInRange = query({
  args: {
    locationId: v.id("locations"),
    staffId: v.id("memberships"),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOwnOrAdmin(ctx, args.staffId);
    if (!orgId) return [];
    await assertLocationInOrg(ctx, args.locationId, orgId);
    return await readOverridesInRange(
      ctx,
      orgId,
      args.locationId,
      args.staffId,
      args.fromDate,
      args.toDate,
    );
  },
});

/**
 * Resolves concrete available slots for a staff member at a location across a
 * date range. For each date in `[fromDate, toDate]` it picks override.slots if
 * `kind="custom"`, an empty array if `kind="off"`, or the weekly ranges
 * otherwise. Used by the booking calendar.
 */
export const forStaffSlotsInRange = query({
  args: {
    locationId: v.id("locations"),
    staffId: v.id("memberships"),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOwnOrAdmin(ctx, args.staffId);
    if (!orgId) return {};
    await assertLocationInOrg(ctx, args.locationId, orgId);
    if (!DATE_PATTERN.test(args.fromDate) || !DATE_PATTERN.test(args.toDate)) {
      appError("VALIDATION", { reason: "INVALID_DATE_RANGE" });
    }
    const weekly = await readWeekly(ctx, orgId, args.locationId, args.staffId);
    const overrides = await readOverridesInRange(
      ctx,
      orgId,
      args.locationId,
      args.staffId,
      args.fromDate,
      args.toDate,
    );
    const overrideByDate = new Map(overrides.map((row) => [row.date, row]));
    const result: Record<string, Array<{ startMin: number; endMin: number }>> = {};
    for (const date of datesInRange(args.fromDate, args.toDate)) {
      const override = overrideByDate.get(date);
      if (override?.kind === "off") {
        result[date] = [];
        continue;
      }
      if (override?.kind === "custom") {
        result[date] = (override.slots ?? []).map((slot) => ({ ...slot }));
        continue;
      }
      const weekday = weekdayFromDate(date);
      result[date] = weekly
        .filter((row) => row.weekday === weekday)
        .map((row) => ({ startMin: row.startMin, endMin: row.endMin }));
    }
    // Clamp every date to the shop's open hours — closed days/times drop out.
    const shop = await readShopHours(ctx, orgId, args.locationId);
    for (const day of Object.keys(result)) {
      result[day] = constrainToShopHours(
        result[day]!,
        weekdayFromDate(day),
        shop,
      );
    }
    return result;
  },
});

/**
 * Org-wide availability — the **union** of every active member's slots for
 * each date in the range. Used by the calendar's "All groomers" view so the
 * time axis collapses to actual working hours and gaps (e.g. shop lunch
 * break, an early-finish day) get the same red blocked styling as a day off.
 *
 * Result shape matches `forStaffSlotsInRange` so the desktop `Calendar` and
 * the mobile timeline can consume either query interchangeably. Slots within
 * a date are sorted and merged when they touch or overlap, so the consumer
 * sees the final unioned hours, not raw per-staff entries.
 */
export const forOrgSlotsInRange = query({
  args: {
    locationId: v.id("locations"),
    fromDate: v.string(),
    toDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return {};
    await assertLocationInOrg(ctx, args.locationId, identity.orgId);
    if (!DATE_PATTERN.test(args.fromDate) || !DATE_PATTERN.test(args.toDate)) {
      appError("VALIDATION", { reason: "INVALID_DATE_RANGE" });
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_active", (index) =>
        index.eq("orgId", identity.orgId).eq("isActive", true),
      )
      .collect();
    const result: Record<string, Array<{ startMin: number; endMin: number }>> =
      {};
    for (const date of datesInRange(args.fromDate, args.toDate)) {
      result[date] = [];
    }
    for (const membership of memberships) {
      const weekly = await readWeekly(
        ctx,
        identity.orgId,
        args.locationId,
        membership._id,
      );
      const overrides = await readOverridesInRange(
        ctx,
        identity.orgId,
        args.locationId,
        membership._id,
        args.fromDate,
        args.toDate,
      );
      const overrideByDate = new Map(overrides.map((row) => [row.date, row]));
      for (const date of datesInRange(args.fromDate, args.toDate)) {
        const override = overrideByDate.get(date);
        if (override?.kind === "off") continue;
        if (override?.kind === "custom") {
          for (const slot of override.slots ?? []) {
            result[date]!.push({ ...slot });
          }
          continue;
        }
        const weekday = weekdayFromDate(date);
        for (const row of weekly) {
          if (row.weekday !== weekday) continue;
          result[date]!.push({ startMin: row.startMin, endMin: row.endMin });
        }
      }
    }
    const shop = await readShopHours(ctx, identity.orgId, args.locationId);
    for (const date of Object.keys(result)) {
      result[date] = constrainToShopHours(
        mergeSlots(result[date]!),
        weekdayFromDate(date),
        shop,
      );
    }
    return result;
  },
});

/** Merge sorted/unsorted ranges so adjacent or overlapping ones collapse. */
function mergeSlots(
  slots: ReadonlyArray<{ startMin: number; endMin: number }>,
): Array<{ startMin: number; endMin: number }> {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
  const merged: Array<{ startMin: number; endMin: number }> = [
    { startMin: sorted[0]!.startMin, endMin: sorted[0]!.endMin },
  ];
  for (let index = 1; index < sorted.length; index += 1) {
    const last = merged[merged.length - 1]!;
    const current = sorted[index]!;
    if (current.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, current.endMin);
    } else {
      merged.push({ startMin: current.startMin, endMin: current.endMin });
    }
  }
  return merged;
}

// Per product rule, only the schedule's owner edits their own availability.
// No admin/superAdmin write path exists — that's intentional, not an oversight.
// Phase 5's booking calendar still needs to *read* other staff's slots, so the
// `forStaff*` query helpers above remain (admin can see; only self can edit).

async function readWeekly(
  ctx: QueryCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
): Promise<Doc<"staffWeeklySchedule">[]> {
  const rows = await ctx.db
    .query("staffWeeklySchedule")
    .withIndex("by_org_location_staff", (index) =>
      index
        .eq("orgId", orgId)
        .eq("locationId", locationId)
        .eq("staffId", staffId),
    )
    .collect();
  return rows.sort(
    (a, b) => a.weekday - b.weekday || a.startMin - b.startMin,
  );
}

async function readOverridesInRange(
  ctx: QueryCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
  fromDate: string,
  toDate: string,
): Promise<Doc<"staffDayOverride">[]> {
  if (!DATE_PATTERN.test(fromDate) || !DATE_PATTERN.test(toDate)) return [];
  const rows = await ctx.db
    .query("staffDayOverride")
    .withIndex("by_org_location_staff_date", (index) =>
      index
        .eq("orgId", orgId)
        .eq("locationId", locationId)
        .eq("staffId", staffId)
        .gte("date", fromDate)
        .lte("date", toDate),
    )
    .collect();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function readOverrideRow(
  ctx: QueryCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
  date: string,
): Promise<Doc<"staffDayOverride"> | null> {
  return await ctx.db
    .query("staffDayOverride")
    .withIndex("by_org_location_staff_date", (index) =>
      index
        .eq("orgId", orgId)
        .eq("locationId", locationId)
        .eq("staffId", staffId)
        .eq("date", date),
    )
    .unique();
}

async function replaceWeeklyForStaff(
  ctx: MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
  ranges: ReadonlyArray<{ weekday: number; startMin: number; endMin: number }>,
): Promise<void> {
  const existing = await ctx.db
    .query("staffWeeklySchedule")
    .withIndex("by_org_location_staff", (index) =>
      index
        .eq("orgId", orgId)
        .eq("locationId", locationId)
        .eq("staffId", staffId),
    )
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  for (const range of ranges) {
    await ctx.db.insert("staffWeeklySchedule", {
      orgId,
      locationId,
      staffId,
      weekday: range.weekday,
      startMin: range.startMin,
      endMin: range.endMin,
    });
  }
}

async function upsertOverrideForStaff(
  ctx: MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  staffId: Id<"memberships">,
  date: string,
  kind: "off" | "custom",
  slots: ReadonlyArray<{ startMin: number; endMin: number }> | undefined,
): Promise<void> {
  const normalisedSlots =
    kind === "custom"
      ? (slots ?? []).map((slot) => ({
          startMin: slot.startMin,
          endMin: slot.endMin,
        }))
      : undefined;
  const existing = await readOverrideRow(ctx, orgId, locationId, staffId, date);
  if (existing) {
    await ctx.db.patch(existing._id, { kind, slots: normalisedSlots });
    return;
  }
  await ctx.db.insert("staffDayOverride", {
    orgId,
    locationId,
    staffId,
    date,
    kind,
    slots: normalisedSlots,
  });
}

/**
 * Asserts a location id refers to an active (non-deleted) row in the given org.
 * Refuses cross-org reads cleanly with FORBIDDEN. Used at the entry of every
 * availability query/mutation that accepts a `locationId` arg.
 */
async function assertLocationInOrg(
  ctx: QueryCtx,
  locationId: Id<"locations">,
  orgId: string,
): Promise<void> {
  const location = await ctx.db.get(locationId);
  if (!location) appError("NOT_FOUND", { reason: "LOCATION_NOT_FOUND" });
  if (location.orgId !== orgId) {
    appError("FORBIDDEN", { reason: "LOCATION_WRONG_ORG" });
  }
  if (location.deletedAt !== undefined || !location.isActive) {
    appError("NOT_FOUND", { reason: "LOCATION_INACTIVE" });
  }
}

/**
 * Like the call name suggests — for queries called by anyone reading availability.
 * Returns `null` for transient missing-auth states (org switch in progress) so
 * the live query just returns empty rather than blowing up. Throws FORBIDDEN
 * for real violations (staff reading another staff's row).
 */
async function requireOwnOrAdmin(
  ctx: QueryCtx,
  staffId: Id<"memberships">,
): Promise<string | null> {
  const identity = await softAuth(ctx);
  if (!identity) return null;
  const target = await ctx.db.get(staffId);
  if (!target) appError("NOT_FOUND", { reason: "MEMBERSHIP_NOT_FOUND" });
  if (target.orgId !== identity.orgId) {
    appError("FORBIDDEN", { reason: "WRONG_ORG" });
  }
  const { membership } = await readMembershipForQuery(ctx, identity);
  const isSelf = membership?._id === staffId;
  const role = mapClerkOrgRole(identity.orgRole);
  if (!isSelf && role === "staff") {
    appError("FORBIDDEN", { reason: "STAFF_CAN_ONLY_VIEW_OWN" });
  }
  return identity.orgId;
}


function validateRanges(
  ranges: ReadonlyArray<{ weekday: number; startMin: number; endMin: number }>,
): void {
  const byWeekday = new Map<number, Array<{ startMin: number; endMin: number }>>();
  for (const range of ranges) {
    if (range.weekday < 0 || range.weekday > 6) {
      appError("VALIDATION", { field: "weekday", reason: "OUT_OF_RANGE" });
    }
    if (
      range.startMin < 0 ||
      range.startMin >= 24 * 60 ||
      range.endMin <= 0 ||
      range.endMin > 24 * 60
    ) {
      appError("VALIDATION", { field: "range", reason: "OUT_OF_RANGE" });
    }
    if (range.startMin % 15 !== 0 || range.endMin % 15 !== 0) {
      appError("VALIDATION", { field: "range", reason: "NOT_QUARTER_HOUR" });
    }
    if (range.startMin >= range.endMin) {
      appError("VALIDATION", { field: "range", reason: "START_AFTER_END" });
    }
    const bucket = byWeekday.get(range.weekday) ?? [];
    bucket.push(range);
    byWeekday.set(range.weekday, bucket);
  }
  for (const [, bucket] of byWeekday) {
    if (bucket.length > MAX_RANGES_PER_DAY) {
      appError("VALIDATION", { field: "range", reason: "TOO_MANY" });
    }
    const sorted = [...bucket].sort((a, b) => a.startMin - b.startMin);
    for (let index = 1; index < sorted.length; index++) {
      if (sorted[index].startMin < sorted[index - 1].endMin) {
        appError("VALIDATION", { field: "range", reason: "OVERLAP" });
      }
    }
  }
}

function validateOverride(args: {
  date: string;
  kind: "off" | "custom";
  slots?: ReadonlyArray<{ startMin: number; endMin: number }>;
}): void {
  if (!DATE_PATTERN.test(args.date)) {
    appError("VALIDATION", { field: "date", reason: "INVALID" });
  }
  if (args.kind === "custom") {
    const slots = args.slots ?? [];
    if (slots.length > MAX_RANGES_PER_DAY) {
      appError("VALIDATION", { field: "slots", reason: "TOO_MANY" });
    }
    const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
    for (let index = 0; index < sorted.length; index++) {
      const slot = sorted[index];
      if (
        slot.startMin < 0 ||
        slot.startMin >= 24 * 60 ||
        slot.endMin <= 0 ||
        slot.endMin > 24 * 60 ||
        slot.startMin >= slot.endMin
      ) {
        appError("VALIDATION", { field: "slots", reason: "OUT_OF_RANGE" });
      }
      if (slot.startMin % 15 !== 0 || slot.endMin % 15 !== 0) {
        appError("VALIDATION", { field: "slots", reason: "NOT_QUARTER_HOUR" });
      }
      if (index > 0 && slot.startMin < sorted[index - 1].endMin) {
        appError("VALIDATION", { field: "slots", reason: "OVERLAP" });
      }
    }
  }
}

function weekdayFromDate(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function* datesInRange(fromDate: string, toDate: string): Generator<string> {
  if (fromDate > toDate) return;
  let current = fromDate;
  while (current <= toDate) {
    yield current;
    const [year, month, day] = current.split("-").map(Number);
    const next = new Date(year, month - 1, day + 1);
    current = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  }
}
