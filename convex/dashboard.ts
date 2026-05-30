import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { mapClerkOrgRole } from "./lib/roles";
import { requirePlanFeature } from "./lib/plans";
import { softAuth } from "./lib/tenant";

/**
 * Dashboard aggregations. Each query is bounded by `withIndex` over the
 * relevant date range — no full table scans, no `.filter()` on indexed
 * paths, per Convex guidelines.
 *
 * Two independent gating dimensions:
 *   - **Plan tier** (`requirePlanFeature`) decides whether a widget's
 *     backing query is reachable at all. Lower-tier callers see a
 *     thrown `PLAN_REQUIRED` and the UI flips to a locked teaser.
 *   - **Role** decides whether sensitive financial cells are revealed.
 *     Revenue / AR / top-client-spend require `superAdmin`. The query
 *     returns those fields as `null` for non-owners so the wire format
 *     stays uniform but the data is gone.
 */

const MAX_SCAN = 2000;

// ──────────────────────────────────────────────────────────────────────────
// upcomingToday — Essential+, any role. Next 3 appointments today.
// ──────────────────────────────────────────────────────────────────────────

export const upcomingToday = query({
  args: { locationId: v.optional(v.id("locations")) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const { start, end } = dayRange(0);
    const rows = await scanAppointments(ctx, identity.orgId, args.locationId, start, end);
    const now = Date.now();
    const upcoming = rows
      .filter((row) => row.startTime >= now && !TERMINAL.has(row.status))
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
    return await Promise.all(upcoming.map((row) => enrich(ctx, row)));
  },
});

// ──────────────────────────────────────────────────────────────────────────
// revenueToday — Essential+, superAdmin only. Today's paid revenue + count.
// ──────────────────────────────────────────────────────────────────────────

export const revenueToday = query({
  args: { locationId: v.optional(v.id("locations")) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    if (mapClerkOrgRole(identity.orgRole) !== "superAdmin") return null;
    const { start, end } = dayRange(0);
    const rows = await scanAppointments(ctx, identity.orgId, args.locationId, start, end);
    const paid = rows.filter((row) => row.paymentStatus === "paid");
    const revenueCents = paid.reduce((sum, row) => sum + row.priceCentsSnapshot, 0);
    return {
      revenueCents,
      paidCount: paid.length,
      bookedCount: rows.filter((row) => !TERMINAL_CANCEL.has(row.status)).length,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// salonHealth — Professional+. Occupancy this week.
// ──────────────────────────────────────────────────────────────────────────

export const salonHealth = query({
  args: { locationId: v.optional(v.id("locations")) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    await requirePlanFeature(ctx, identity.orgId, "dashboardSalonHealth");
    const { start, end } = weekRange(0);
    const rows = await scanAppointments(ctx, identity.orgId, args.locationId, start, end);
    const bookedMin = rows
      .filter((row) => !TERMINAL_CANCEL.has(row.status))
      .reduce((sum, row) => sum + Math.max(0, (row.endTime - row.startTime) / 60000), 0);
    // Available minutes per staff = sum of weekly schedule rows for this org
    // (and location if filtered). Bounded by org size; small.
    const scheduleRows = await ctx.db
      .query("staffWeeklySchedule")
      .withIndex("by_org_staff", (index) => index.eq("orgId", identity.orgId))
      .take(MAX_SCAN);
    const availableMin = scheduleRows
      .filter((row) => !args.locationId || row.locationId === args.locationId)
      .reduce((sum, row) => sum + Math.max(0, row.endMin - row.startMin), 0);
    const occupancyPct =
      availableMin > 0 ? Math.min(100, Math.round((bookedMin / availableMin) * 100)) : 0;
    // Tomorrow's free slots = available - already booked tomorrow.
    const { start: tomStart, end: tomEnd } = dayRange(1);
    const tomorrow = await scanAppointments(ctx, identity.orgId, args.locationId, tomStart, tomEnd);
    const tomorrowBookedMin = tomorrow
      .filter((row) => !TERMINAL_CANCEL.has(row.status))
      .reduce((sum, row) => sum + (row.endTime - row.startTime) / 60000, 0);
    const tomorrowAvailableMin = scheduleRows
      .filter(
        (row) =>
          row.weekday === new Date(tomStart).getDay() &&
          (!args.locationId || row.locationId === args.locationId),
      )
      .reduce((sum, row) => sum + Math.max(0, row.endMin - row.startMin), 0);
    const slotsRemainingMinutes = Math.max(0, tomorrowAvailableMin - tomorrowBookedMin);
    return {
      occupancyPct,
      bookedMin: Math.round(bookedMin),
      availableMin: Math.round(availableMin),
      slotsRemainingMinutes,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// criticalAlerts — Essential+. Expired vaccines, banned/deceased pets.
// ──────────────────────────────────────────────────────────────────────────

export const criticalAlerts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) {
      return { expiredVaccinations: [], bannedPets: [], deceasedPets: [] };
    }
    const pets = await ctx.db
      .query("pets")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .take(MAX_SCAN);
    const todayIso = isoDateUtc(new Date());
    type Expired = { petId: Id<"pets">; petName: string; vaccineName: string; expiresOn: string };
    const expiredVaccinations: Expired[] = [];
    const bannedPets: { petId: Id<"pets">; petName: string }[] = [];
    const deceasedPets: { petId: Id<"pets">; petName: string }[] = [];
    for (const pet of pets) {
      if (pet.deletedAt !== undefined) continue;
      if (pet.isBanned) bannedPets.push({ petId: pet._id, petName: pet.name });
      if (pet.isDeceased) deceasedPets.push({ petId: pet._id, petName: pet.name });
      for (const vaccination of pet.vaccinations) {
        if (vaccination.expiresOn < todayIso) {
          const vaccine = await ctx.db.get(vaccination.vaccineId);
          expiredVaccinations.push({
            petId: pet._id,
            petName: pet.name,
            vaccineName: vaccine?.name ?? "Unknown",
            expiresOn: vaccination.expiresOn,
          });
        }
      }
    }
    return {
      expiredVaccinations: expiredVaccinations.slice(0, 10),
      bannedPets: bannedPets.slice(0, 10),
      deceasedPets: deceasedPets.slice(0, 10),
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// weekMetrics — Professional+. Count vs last week, no-show rate, revenue.
// Revenue / AR / avg-ticket fields are null for non-superAdmin callers.
// ──────────────────────────────────────────────────────────────────────────

export const weekMetrics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    await requirePlanFeature(ctx, identity.orgId, "dashboardSalonHealth");
    const isOwner = mapClerkOrgRole(identity.orgRole) === "superAdmin";
    const thisWeek = weekRange(0);
    const lastWeek = weekRange(-1);
    const [thisRows, lastRows] = await Promise.all([
      scanAppointments(ctx, identity.orgId, undefined, thisWeek.start, thisWeek.end),
      scanAppointments(ctx, identity.orgId, undefined, lastWeek.start, lastWeek.end),
    ]);
    const thisCount = thisRows.filter((row) => !TERMINAL_CANCEL.has(row.status)).length;
    const lastCount = lastRows.filter((row) => !TERMINAL_CANCEL.has(row.status)).length;
    const deltaPct = lastCount === 0 ? null : Math.round(((thisCount - lastCount) / lastCount) * 100);
    const thisCompleted = thisRows.filter((row) => row.status === "completed").length;
    const thisNoShow = thisRows.filter((row) => row.status === "noShow").length;
    const finished = thisCompleted + thisNoShow;
    const noShowRatePct = finished === 0 ? null : Math.round((thisNoShow / finished) * 100);
    let revenueWeekCents: number | null = null;
    let unpaidArCents: number | null = null;
    let avgTicketCents: number | null = null;
    if (isOwner) {
      const paid = thisRows.filter((row) => row.paymentStatus === "paid");
      revenueWeekCents = paid.reduce((sum, row) => sum + row.priceCentsSnapshot, 0);
      unpaidArCents = thisRows
        .filter((row) => row.paymentStatus === "unpaid" && row.status === "completed")
        .reduce((sum, row) => sum + row.priceCentsSnapshot, 0);
      avgTicketCents = paid.length === 0 ? null : Math.round(revenueWeekCents / paid.length);
    }
    return {
      thisWeekCount: thisCount,
      lastWeekCount: lastCount,
      deltaPct,
      noShowRatePct,
      revenueWeekCents,
      unpaidArCents,
      avgTicketCents,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// topServicesMonth — Enterprise+. Top 5 services by booking count MTD.
// `revenueCents` per row is null unless caller is superAdmin.
// ──────────────────────────────────────────────────────────────────────────

export const topServicesMonth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    await requirePlanFeature(ctx, identity.orgId, "dashboardAdvancedAnalytics");
    const isOwner = mapClerkOrgRole(identity.orgRole) === "superAdmin";
    const { start, end } = monthRange();
    const rows = await scanAppointments(ctx, identity.orgId, undefined, start, end);
    const totals = new Map<Id<"services">, { bookings: number; revenueCents: number }>();
    for (const row of rows) {
      if (TERMINAL_CANCEL.has(row.status)) continue;
      const prev = totals.get(row.serviceId) ?? { bookings: 0, revenueCents: 0 };
      prev.bookings += 1;
      if (row.paymentStatus === "paid") prev.revenueCents += row.priceCentsSnapshot;
      totals.set(row.serviceId, prev);
    }
    const ranked = [...totals.entries()]
      .sort((a, b) => b[1].bookings - a[1].bookings)
      .slice(0, 5);
    return await Promise.all(
      ranked.map(async ([serviceId, totals]) => {
        const service = await ctx.db.get(serviceId);
        return {
          serviceId,
          name: service?.name ?? "Unknown service",
          bookings: totals.bookings,
          revenueCents: isOwner ? totals.revenueCents : null,
        };
      }),
    );
  },
});

// ──────────────────────────────────────────────────────────────────────────
// topClientsMonth — Enterprise+, superAdmin only. Top 5 clients by spend.
// ──────────────────────────────────────────────────────────────────────────

export const topClientsMonth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    if (mapClerkOrgRole(identity.orgRole) !== "superAdmin") return [];
    await requirePlanFeature(ctx, identity.orgId, "dashboardAdvancedAnalytics");
    const { start, end } = monthRange();
    const rows = await scanAppointments(ctx, identity.orgId, undefined, start, end);
    const totals = new Map<Id<"clients">, { totalCents: number; visits: number }>();
    for (const row of rows) {
      if (row.paymentStatus !== "paid") continue;
      const prev = totals.get(row.clientId) ?? { totalCents: 0, visits: 0 };
      prev.totalCents += row.priceCentsSnapshot;
      prev.visits += 1;
      totals.set(row.clientId, prev);
    }
    const ranked = [...totals.entries()]
      .sort((a, b) => b[1].totalCents - a[1].totalCents)
      .slice(0, 5);
    return await Promise.all(
      ranked.map(async ([clientId, totals]) => {
        const client = await ctx.db.get(clientId);
        return {
          clientId,
          name: client?.fullName ?? "Unknown client",
          totalCents: totals.totalCents,
          visitCount: totals.visits,
        };
      }),
    );
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const TERMINAL = new Set<Doc<"appointments">["status"]>([
  "completed",
  "cancelled",
  "noShow",
]);
const TERMINAL_CANCEL = new Set<Doc<"appointments">["status"]>([
  "cancelled",
  "declined",
]);

async function scanAppointments(
  ctx: QueryCtx,
  orgId: string,
  locationId: Id<"locations"> | undefined,
  start: number,
  end: number,
): Promise<Doc<"appointments">[]> {
  if (locationId) {
    return await ctx.db
      .query("appointments")
      .withIndex("by_org_location_start", (index) =>
        index
          .eq("orgId", orgId)
          .eq("locationId", locationId)
          .gte("startTime", start)
          .lt("startTime", end),
      )
      .take(MAX_SCAN);
  }
  return await ctx.db
    .query("appointments")
    .withIndex("by_org_start", (index) =>
      index.eq("orgId", orgId).gte("startTime", start).lt("startTime", end),
    )
    .take(MAX_SCAN);
}

async function enrich(ctx: QueryCtx, row: Doc<"appointments">) {
  const [client, pet, service, staff] = await Promise.all([
    ctx.db.get(row.clientId),
    ctx.db.get(row.petId),
    ctx.db.get(row.serviceId),
    ctx.db.get(row.staffId),
  ]);
  const staffUser = staff ? await ctx.db.get(staff.userId) : null;
  return {
    _id: row._id,
    startTime: row.startTime,
    petName: pet?.name ?? "Unknown",
    clientName: client?.fullName ?? "Unknown",
    serviceName: service?.name ?? "Unknown",
    serviceColor: service?.color ?? undefined,
    staffName: staffUser
      ? `${staffUser.firstName} ${staffUser.lastName}`.trim() || staffUser.email
      : "Unassigned",
  };
}

function dayRange(daysFromToday: number): { start: number; end: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysFromToday);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function weekRange(weeksOffset: number): { start: number; end: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // Sunday = 0
  start.setDate(start.getDate() - day + weeksOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

function monthRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
}

function isoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
