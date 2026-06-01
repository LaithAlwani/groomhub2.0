import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";

/**
 * Shop operating hours per location — the template that new groomers inherit.
 *
 * Admins edit these (unlike per-staff schedules, which only their owner edits).
 * A new location is seeded with a sensible default; when a membership is first
 * created, the location's hours are copied into that groomer's
 * `staffWeeklySchedule` so booking works out of the box.
 */

const MAX_RANGES_PER_DAY = 6;

const rangeValidator = v.object({
  weekday: v.number(),
  startMin: v.number(),
  endMin: v.number(),
});

type Range = { weekday: number; startMin: number; endMin: number };

// Default shop hours for a brand-new location: Mon–Fri 9:00–17:00.
const DEFAULT_HOURS: ReadonlyArray<Range> = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMin: 9 * 60,
  endMin: 17 * 60,
}));

/** Read the active org's hours for one location (sorted), or `[]` mid-auth. */
export const getLocationHours = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const location = await ctx.db.get(args.locationId);
    if (!location || location.orgId !== identity.orgId) return [];
    return await readLocationHours(ctx, identity.orgId, args.locationId);
  },
});

/** Admin/superAdmin: replace a location's operating hours in one shot. */
export const setLocationHours = mutation({
  args: { locationId: v.id("locations"), ranges: v.array(rangeValidator) },
  handler: async (ctx, args) => {
    const identity = await requireRole(ctx, ["superAdmin", "admin"]);
    const location = await ctx.db.get(args.locationId);
    if (!location || location.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "LOCATION_NOT_FOUND" });
    }
    validateRanges(args.ranges);
    await replaceLocationHours(ctx, identity.orgId, args.locationId, args.ranges);
  },
});

export async function readLocationHours(
  ctx: QueryCtx,
  orgId: string,
  locationId: Id<"locations">,
): Promise<Doc<"locationHours">[]> {
  const rows = await ctx.db
    .query("locationHours")
    .withIndex("by_org_location", (index) =>
      index.eq("orgId", orgId).eq("locationId", locationId),
    )
    .collect();
  return rows.sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
}

async function replaceLocationHours(
  ctx: MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  ranges: ReadonlyArray<Range>,
): Promise<void> {
  const existing = await ctx.db
    .query("locationHours")
    .withIndex("by_org_location", (index) =>
      index.eq("orgId", orgId).eq("locationId", locationId),
    )
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  for (const range of ranges) {
    await ctx.db.insert("locationHours", { orgId, locationId, ...range });
  }
}

/**
 * Seed a brand-new location with the default Mon–Fri 9–5 hours. Idempotent —
 * no-ops if the location already has any hours. Called when a location is created.
 */
export async function seedDefaultLocationHours(
  ctx: MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
): Promise<void> {
  const existing = await ctx.db
    .query("locationHours")
    .withIndex("by_org_location", (index) =>
      index.eq("orgId", orgId).eq("locationId", locationId),
    )
    .take(1);
  if (existing.length > 0) return;
  for (const range of DEFAULT_HOURS) {
    await ctx.db.insert("locationHours", { orgId, locationId, ...range });
  }
}

/**
 * Copy a location's operating hours into a new groomer's weekly schedule so they
 * inherit the shop's hours by default. Idempotent — no-ops if the staff already
 * has any weekly schedule. `locationIds: []` (member at all locations) → seed
 * against every active location (usually just "Main").
 */
export async function seedStaffScheduleFromLocation(
  ctx: MutationCtx,
  orgId: string,
  staffId: Id<"memberships">,
  locationIds: ReadonlyArray<Id<"locations">>,
): Promise<void> {
  const existingAny = await ctx.db
    .query("staffWeeklySchedule")
    .withIndex("by_org_staff", (index) =>
      index.eq("orgId", orgId).eq("staffId", staffId),
    )
    .take(1);
  if (existingAny.length > 0) return;

  const targetLocationIds =
    locationIds.length > 0
      ? locationIds
      : (
          await ctx.db
            .query("locations")
            .withIndex("by_org_active", (index) =>
              index.eq("orgId", orgId).eq("isActive", true),
            )
            .collect()
        ).map((location) => location._id);

  for (const locationId of targetLocationIds) {
    const hours = await readLocationHours(ctx, orgId, locationId);
    for (const hour of hours) {
      await ctx.db.insert("staffWeeklySchedule", {
        orgId,
        locationId,
        staffId,
        weekday: hour.weekday,
        startMin: hour.startMin,
        endMin: hour.endMin,
      });
    }
  }
}

export type MinSlot = { startMin: number; endMin: number };

/**
 * The shop's open slots grouped by weekday for a location, plus whether the shop
 * has ANY hours configured. When it doesn't (`configured: false` — e.g. shops
 * created before operating hours existed), callers MUST skip the shop-hours
 * constraint, because an empty config means "unknown", not "closed all week".
 */
export async function readShopHours(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
): Promise<{ byWeekday: Map<number, MinSlot[]>; configured: boolean }> {
  const rows = await readLocationHours(ctx, orgId, locationId);
  const byWeekday = new Map<number, MinSlot[]>();
  for (const row of rows) {
    const bucket = byWeekday.get(row.weekday) ?? [];
    bucket.push({ startMin: row.startMin, endMin: row.endMin });
    byWeekday.set(row.weekday, bucket);
  }
  return { byWeekday, configured: rows.length > 0 };
}

/**
 * Clamp a staff member's slots to the shop's open hours for a weekday — a
 * groomer is never available when the shop is closed. Returns the slots
 * unchanged when the shop has no hours configured (legacy fallback).
 */
export function constrainToShopHours(
  slots: ReadonlyArray<MinSlot>,
  weekday: number,
  shop: { byWeekday: Map<number, MinSlot[]>; configured: boolean },
): MinSlot[] {
  if (!shop.configured) return slots.map((slot) => ({ ...slot }));
  return intersectSlots(slots, shop.byWeekday.get(weekday) ?? []);
}

/**
 * Write-time guard for the groomer's own weekly editor: rejects any range that
 * isn't fully inside one of the shop's open windows for that weekday. No-op when
 * the shop has no hours configured.
 */
export async function assertWeeklyWithinShopHours(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  ranges: ReadonlyArray<Range>,
): Promise<void> {
  const shop = await readShopHours(ctx, orgId, locationId);
  if (!shop.configured) return;
  for (const range of ranges) {
    const open = shop.byWeekday.get(range.weekday) ?? [];
    const fits = open.some(
      (slot) => slot.startMin <= range.startMin && range.endMin <= slot.endMin,
    );
    if (!fits) {
      appError("VALIDATION", {
        field: "range",
        reason: "OUTSIDE_SHOP_HOURS",
        weekday: range.weekday,
      });
    }
  }
}

function intersectSlots(
  slots: ReadonlyArray<MinSlot>,
  open: ReadonlyArray<MinSlot>,
): MinSlot[] {
  const out: MinSlot[] = [];
  for (const slot of slots) {
    for (const window of open) {
      const startMin = Math.max(slot.startMin, window.startMin);
      const endMin = Math.min(slot.endMin, window.endMin);
      if (startMin < endMin) out.push({ startMin, endMin });
    }
  }
  return mergeMinSlots(out);
}

function mergeMinSlots(slots: MinSlot[]): MinSlot[] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
  const merged: MinSlot[] = [{ ...sorted[0] }];
  for (let index = 1; index < sorted.length; index += 1) {
    const last = merged[merged.length - 1];
    const current = sorted[index];
    if (current.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, current.endMin);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

// Same rules the per-staff editor enforces (quarter-hour grid, no overlaps).
function validateRanges(ranges: ReadonlyArray<Range>): void {
  const byWeekday = new Map<number, Range[]>();
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
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].startMin < sorted[index - 1].endMin) {
        appError("VALIDATION", { field: "range", reason: "OVERLAP" });
      }
    }
  }
}
