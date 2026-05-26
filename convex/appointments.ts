import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import {
  assertWithinAvailability,
  findConflictForStaff,
} from "./lib/appointmentChecks";
import { ensureMembership, readMembershipForQuery } from "./lib/ensureMembership";
import { mapClerkOrgRole } from "./lib/roles";
import { requireRole } from "./lib/rbac";
import { requireAuth, softAuth } from "./lib/tenant";

const MAX_RESULTS = 500;
const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;
const APPOINTMENT_STATUSES = [
  "pendingApproval",
  "declined",
  "scheduled",
  "checkedIn",
  "inProgress",
  "completed",
  "noShow",
  "cancelled",
] as const;
const TERMINAL_STATUSES: ReadonlyArray<Doc<"appointments">["status"]> = [
  "completed",
  "cancelled",
  "noShow",
];
// "Quiet" statuses don't send the client an email when transitioning out —
// the client hasn't been told about the booking yet.
const QUIET_PRE_STATUSES: ReadonlyArray<Doc<"appointments">["status"]> = [
  "pendingApproval",
  "declined",
];
const statusValidator = v.union(
  ...APPOINTMENT_STATUSES.map((status) => v.literal(status)),
);

/**
 * Lists appointments overlapping `[fromTime, toTime]` in the caller's org.
 * Staff see only their own; admin/superAdmin see everyone. The two paths use
 * different indexes (`by_staff_start` vs `by_org_location_start` / `by_org_start`)
 * — no `.filter()`, per Convex guidelines.
 *
 * `locationId` is optional:
 *   - set    → admins see only appointments at that location;
 *              staff see only their own at that location (post-fetch JS filter
 *              against the bounded staff result).
 *   - unset  → admins see every location; staff see their own across all
 *              locations.
 * UI passes the current location id from the sidebar switcher; the calendar
 * filter dropdown can explicitly clear it for an org-wide view.
 */
export const listInRange = query({
  args: {
    fromTime: v.number(),
    toTime: v.number(),
    locationId: v.optional(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const role = mapClerkOrgRole(identity.orgRole);
    const { membership } = await readMembershipForQuery(ctx, identity);
    let rows: Doc<"appointments">[];
    if (role === "staff") {
      if (!membership) return [];
      const candidates = await ctx.db
        .query("appointments")
        .withIndex("by_staff_start", (index) =>
          index
            .eq("staffId", membership._id)
            .gte("startTime", args.fromTime)
            .lt("startTime", args.toTime),
        )
        .take(MAX_RESULTS);
      rows = args.locationId
        ? candidates.filter((row) => row.locationId === args.locationId)
        : candidates;
    } else if (args.locationId) {
      rows = await ctx.db
        .query("appointments")
        .withIndex("by_org_location_start", (index) =>
          index
            .eq("orgId", identity.orgId)
            .eq("locationId", args.locationId!)
            .gte("startTime", args.fromTime)
            .lt("startTime", args.toTime),
        )
        .take(MAX_RESULTS);
    } else {
      rows = await ctx.db
        .query("appointments")
        .withIndex("by_org_start", (index) =>
          index
            .eq("orgId", identity.orgId)
            .gte("startTime", args.fromTime)
            .lt("startTime", args.toTime),
        )
        .take(MAX_RESULTS);
    }
    return await Promise.all(rows.map((row) => enrichAppointment(ctx, row)));
  },
});

/**
 * Full appointment history for a single client. Any signed-in member can read
 * (the client-detail privacy rule is "everyone sees client history"). Sorted
 * descending by start time so the most recent appointment is first.
 */
export const listForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const client = await ctx.db.get(args.clientId);
    if (!client) appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    if (client.orgId !== identity.orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_client", (index) => index.eq("clientId", args.clientId))
      .take(MAX_RESULTS);
    const sorted = rows.sort((a, b) => b.startTime - a.startTime);
    return await Promise.all(sorted.map((row) => enrichAppointment(ctx, row)));
  },
});

/**
 * Returns the current user's appointments still awaiting their approval. Used
 * by the dashboard "Needs approval" tile. Each row is enriched so the tile
 * doesn't need extra joins. Returns `[]` for users not yet in any org.
 */
export const pendingForMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const { membership } = await readMembershipForQuery(ctx, identity);
    if (!membership) return [];
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_staff_start", (index) =>
        index.eq("staffId", membership._id),
      )
      .take(MAX_RESULTS);
    const pending = rows
      .filter((row) => row.status === "pendingApproval")
      .sort((a, b) => a.startTime - b.startTime);
    return await Promise.all(pending.map((row) => enrichAppointment(ctx, row)));
  },
});

/** Fetch a single appointment by id. Refuses cross-org. Returns enriched. */
export const get = query({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const row = await loadOwnAppointment(ctx, args.id, identity.orgId);
    return await enrichAppointment(ctx, row);
  },
});

/**
 * Create an appointment. Any signed-in member can create. Server enforces:
 *   - availability hard-block (staff schedule + per-day overrides)
 *   - overlap guard against existing non-cancelled appointments
 *   - idempotency via `clientUuid` (replay-safe for the offline write queue)
 */
export const create = mutation({
  args: {
    clientUuid: v.string(),
    locationId: v.id("locations"),
    clientId: v.id("clients"),
    petId: v.id("pets"),
    staffId: v.id("memberships"),
    serviceId: v.id("services"),
    startTime: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const { membership: actor } = await ensureMembership(ctx, identity);
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);

    const existing = await ctx.db
      .query("appointments")
      .withIndex("by_clientUuid", (index) =>
        index.eq("clientUuid", args.clientUuid),
      )
      .unique();
    if (existing) return existing._id;

    const { client, pet, service, staff, location } = await loadRefs(
      ctx,
      identity.orgId,
      {
        clientId: args.clientId,
        petId: args.petId,
        staffId: args.staffId,
        serviceId: args.serviceId,
        locationId: args.locationId,
      },
    );
    const endTime = args.startTime + service.durationMin * 60 * 1000;
    await assertWithinAvailability(
      ctx,
      identity.orgId,
      location._id,
      staff._id,
      args.startTime,
      endTime,
      location.timezone,
    );
    const conflict = await findConflictForStaff(
      ctx,
      staff._id,
      args.startTime,
      endTime,
      null,
    );
    if (conflict) {
      appError("SLOT_TAKEN", { conflictId: conflict._id });
    }
    // Self-bookings auto-confirm; admin booking on someone else's behalf
    // lands as `pendingApproval` and waits for the assigned groomer (or any
    // admin/superAdmin) to confirm.
    const initialStatus =
      actor._id === staff._id ? "scheduled" : "pendingApproval";
    const insertedId = await ctx.db.insert("appointments", {
      orgId: identity.orgId,
      locationId: location._id,
      clientId: client._id,
      petId: pet._id,
      staffId: staff._id,
      serviceId: service._id,
      startTime: args.startTime,
      endTime,
      status: initialStatus,
      priceCentsSnapshot: service.priceCents,
      paymentStatus: "unpaid",
      notes: args.notes?.trim() || undefined,
      clientUuid: args.clientUuid,
      createdBy: actor._id,
      createdAt: Date.now(),
    });
    if (initialStatus === "scheduled") {
      await ctx.scheduler.runAfter(0, internal.email.sendBookingConfirmation, {
        appointmentId: insertedId,
      });
      await scheduleReminderIfFarEnough(ctx, insertedId, args.startTime);
    } else {
      // pendingApproval — alert the assigned groomer by email.
      await ctx.scheduler.runAfter(
        0,
        internal.email.sendPendingApprovalToGroomer,
        { appointmentId: insertedId },
      );
    }
    return insertedId;
  },
});

/**
 * Move an appointment to a new `startTime`. Privacy: staff can only reschedule
 * their own. Re-runs availability + overlap checks at the new time. Optional
 * `staffId` lets admin/superAdmin reassign the appointment in the same call.
 */
export const reschedule = mutation({
  args: {
    id: v.id("appointments"),
    startTime: v.number(),
    staffId: v.optional(v.id("memberships")),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const { role } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnAppointment(ctx, args.id, identity.orgId);
    if (role === "staff") {
      const { membership } = await ensureMembership(ctx, identity);
      if (existing.staffId !== membership._id) {
        appError("FORBIDDEN", { reason: "NOT_OWN_APPOINTMENT" });
      }
      if (args.staffId && args.staffId !== existing.staffId) {
        appError("FORBIDDEN", { reason: "STAFF_CANNOT_REASSIGN" });
      }
    }
    const targetStaffId = args.staffId ?? existing.staffId;
    const targetStaff = await ctx.db.get(targetStaffId);
    if (!targetStaff || targetStaff.orgId !== identity.orgId) {
      appError("NOT_FOUND", { reason: "STAFF_NOT_FOUND" });
    }
    const service = await ctx.db.get(existing.serviceId);
    if (!service) appError("NOT_FOUND", { reason: "SERVICE_NOT_FOUND" });
    const location = await loadLocation(ctx, existing.locationId, identity.orgId);
    const newEndTime = args.startTime + service.durationMin * 60 * 1000;
    await assertWithinAvailability(
      ctx,
      identity.orgId,
      location._id,
      targetStaffId,
      args.startTime,
      newEndTime,
      location.timezone,
    );
    const conflict = await findConflictForStaff(
      ctx,
      targetStaffId,
      args.startTime,
      newEndTime,
      existing._id,
    );
    if (conflict) appError("SLOT_TAKEN", { conflictId: conflict._id });
    await ctx.db.patch(existing._id, {
      staffId: targetStaffId,
      startTime: args.startTime,
      endTime: newEndTime,
    });
    // Notify the client about the move — but only if they've already been
    // told about the booking. Pending approvals are still private.
    if (
      existing.status !== "pendingApproval" &&
      existing.status !== "declined" &&
      !TERMINAL_STATUSES.includes(existing.status) &&
      args.startTime !== existing.startTime
    ) {
      await ctx.scheduler.runAfter(0, internal.email.sendBookingReschedule, {
        appointmentId: existing._id,
        previousStartTime: existing.startTime,
      });
      // Schedule a fresh reminder for the new time. The stale one will fire at
      // its old time and no-op via the expectedStartTime guard.
      await scheduleReminderIfFarEnough(ctx, existing._id, args.startTime);
    }
  },
});

/**
 * Update an appointment's status (no time change). Staff can only update their
 * own appointment; admin/superAdmin can update any.
 */
export const updateStatus = mutation({
  args: { id: v.id("appointments"), status: statusValidator },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const { role } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnAppointment(ctx, args.id, identity.orgId);
    if (role === "staff") {
      const { membership } = await ensureMembership(ctx, identity);
      if (existing.staffId !== membership._id) {
        appError("FORBIDDEN", { reason: "NOT_OWN_APPOINTMENT" });
      }
    }
    const previousStatus = existing.status;
    if (previousStatus === args.status) return;
    // Declining is the assigned groomer's prerogative — admins can cancel or
    // reassign, but only the staff member the booking is on can flip it to
    // "declined" (which signals "I don't want to take this" back to admins).
    if (args.status === "declined") {
      if (previousStatus !== "pendingApproval") {
        appError("VALIDATION", { reason: "CAN_ONLY_DECLINE_PENDING" });
      }
      const { membership } = await ensureMembership(ctx, identity);
      if (existing.staffId !== membership._id) {
        appError("FORBIDDEN", { reason: "ONLY_ASSIGNED_GROOMER_CAN_DECLINE" });
      }
    }
    await ctx.db.patch(existing._id, { status: args.status });
    // pendingApproval → scheduled is the confirmation moment.
    if (previousStatus === "pendingApproval" && args.status === "scheduled") {
      await ctx.scheduler.runAfter(0, internal.email.sendBookingConfirmation, {
        appointmentId: existing._id,
      });
      await scheduleReminderIfFarEnough(ctx, existing._id, existing.startTime);
    }
    // pendingApproval → declined: alert admins so they can reassign/cancel.
    if (previousStatus === "pendingApproval" && args.status === "declined") {
      await ctx.scheduler.runAfter(0, internal.email.sendDeclinedToAdmins, {
        appointmentId: existing._id,
      });
    }
    // Cancellation email: only when the client already knew about the booking
    // (i.e. previous status wasn't pendingApproval or declined — those never
    // surfaced to the client).
    if (
      args.status === "cancelled" &&
      !TERMINAL_STATUSES.includes(previousStatus) &&
      !QUIET_PRE_STATUSES.includes(previousStatus)
    ) {
      await ctx.scheduler.runAfter(0, internal.email.sendBookingCancellation, {
        appointmentId: existing._id,
      });
    }
    // Pet-ready notification when the booking wraps up.
    if (args.status === "completed" && previousStatus !== "completed") {
      await ctx.scheduler.runAfter(0, internal.email.sendPetReady, {
        appointmentId: existing._id,
      });
    }
  },
});

/**
 * Update the free-text notes on an appointment. Same privacy rule as
 * `updateStatus` — staff can only patch their own row.
 */
export const updateNotes = mutation({
  args: { id: v.id("appointments"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const { role } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const existing = await loadOwnAppointment(ctx, args.id, identity.orgId);
    if (role === "staff") {
      const { membership } = await ensureMembership(ctx, identity);
      if (existing.staffId !== membership._id) {
        appError("FORBIDDEN", { reason: "NOT_OWN_APPOINTMENT" });
      }
    }
    await ctx.db.patch(existing._id, {
      notes: args.notes?.trim() || undefined,
    });
  },
});

/**
 * Reassign a still-pending or declined booking to a different groomer.
 * Admin / superAdmin only. Re-runs availability + overlap checks for the new
 * staff at the current `startTime`, then flips the row to `pendingApproval`
 * so the new groomer sees it in their approval tile.
 *
 * Allowed source states are `declined` (groomer rejected) and
 * `pendingApproval` (admin wants to move it before the original groomer
 * responds). Already-scheduled bookings have to be cancelled first.
 */
export const reassign = mutation({
  args: { id: v.id("appointments"), staffId: v.id("memberships") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnAppointment(ctx, args.id, identity.orgId);
    if (
      existing.status !== "declined" &&
      existing.status !== "pendingApproval"
    ) {
      appError("VALIDATION", { field: "status", reason: "NOT_REASSIGNABLE" });
    }
    if (existing.staffId === args.staffId) {
      appError("VALIDATION", { field: "staffId", reason: "SAME_GROOMER" });
    }
    const targetStaff = await ctx.db.get(args.staffId);
    if (!targetStaff || targetStaff.orgId !== orgId) {
      appError("NOT_FOUND", { reason: "STAFF_NOT_FOUND" });
    }
    if (!targetStaff.isActive) {
      appError("VALIDATION", { field: "staffId", reason: "INACTIVE_STAFF" });
    }
    const location = await loadLocation(ctx, existing.locationId, orgId);
    await assertWithinAvailability(
      ctx,
      orgId,
      location._id,
      args.staffId,
      existing.startTime,
      existing.endTime,
      location.timezone,
    );
    const conflict = await findConflictForStaff(
      ctx,
      args.staffId,
      existing.startTime,
      existing.endTime,
      existing._id,
    );
    if (conflict) appError("SLOT_TAKEN", { conflictId: conflict._id });
    await ctx.db.patch(existing._id, {
      staffId: args.staffId,
      status: "pendingApproval",
    });
    // Alert the newly-assigned groomer that they have a booking awaiting them.
    await ctx.scheduler.runAfter(
      0,
      internal.email.sendPendingApprovalToGroomer,
      { appointmentId: existing._id },
    );
  },
});

/**
 * Lists appointments awaiting admin attention because a groomer declined.
 * Admin / superAdmin only — staff don't see other groomers' rejections.
 */
export const declinedForOrg = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const role = mapClerkOrgRole(identity.orgRole);
    if (role !== "admin" && role !== "superAdmin") return [];
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_org_start", (index) => index.eq("orgId", identity.orgId))
      .take(MAX_RESULTS);
    const declined = rows
      .filter((row) => row.status === "declined")
      .sort((a, b) => a.startTime - b.startTime);
    return await Promise.all(declined.map((row) => enrichAppointment(ctx, row)));
  },
});

/**
 * Hard delete. superAdmin only — past appointment history that references a
 * deleted appointment will be orphaned; prefer status="cancelled" instead.
 */
export const hardDelete = mutation({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnAppointment(ctx, args.id, orgId);
    await ctx.db.delete(existing._id);
  },
});

export type EnrichedAppointment = Doc<"appointments"> & {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  petName: string;
  staffName: string;
  serviceName: string;
  serviceColor?: string;
  serviceDurationMin: number;
};

async function enrichAppointment(
  ctx: QueryCtx,
  row: Doc<"appointments">,
): Promise<EnrichedAppointment> {
  const [client, pet, service, staff] = await Promise.all([
    ctx.db.get(row.clientId),
    ctx.db.get(row.petId),
    ctx.db.get(row.serviceId),
    ctx.db.get(row.staffId),
  ]);
  let staffName = "Unknown";
  if (staff) {
    const user = await ctx.db.get(staff.userId);
    if (user) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
      staffName = fullName || user.email || "Unknown";
    }
  }
  return {
    ...row,
    clientName: client?.fullName ?? "Removed client",
    clientEmail: client?.email,
    clientPhone: client?.phone,
    petName: pet?.name ?? "Removed pet",
    staffName,
    serviceName: service?.name ?? "Removed service",
    serviceColor: service?.color,
    serviceDurationMin: service?.durationMin ?? 60,
  };
}

async function loadOwnAppointment(
  ctx: QueryCtx | MutationCtx,
  id: Id<"appointments">,
  orgId: string,
): Promise<Doc<"appointments">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "APPOINTMENT_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

async function loadLocation(
  ctx: QueryCtx | MutationCtx,
  locationId: Id<"locations">,
  orgId: string,
): Promise<Doc<"locations">> {
  const location = await ctx.db.get(locationId);
  if (!location) appError("NOT_FOUND", { reason: "LOCATION_NOT_FOUND" });
  if (location.orgId !== orgId) {
    appError("FORBIDDEN", { reason: "LOCATION_WRONG_ORG" });
  }
  if (location.deletedAt !== undefined || !location.isActive) {
    appError("NOT_FOUND", { reason: "LOCATION_INACTIVE" });
  }
  return location;
}

async function loadRefs(
  ctx: MutationCtx,
  orgId: string,
  ids: {
    clientId: Id<"clients">;
    petId: Id<"pets">;
    staffId: Id<"memberships">;
    serviceId: Id<"services">;
    locationId: Id<"locations">;
  },
) {
  const [client, pet, service, staff, location] = await Promise.all([
    ctx.db.get(ids.clientId),
    ctx.db.get(ids.petId),
    ctx.db.get(ids.serviceId),
    ctx.db.get(ids.staffId),
    loadLocation(ctx, ids.locationId, orgId),
  ]);
  if (!client || client.orgId !== orgId) {
    appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
  }
  if (!pet || pet.orgId !== orgId || pet.clientId !== client._id) {
    appError("NOT_FOUND", { reason: "PET_NOT_FOUND" });
  }
  if (!service || service.orgId !== orgId) {
    appError("NOT_FOUND", { reason: "SERVICE_NOT_FOUND" });
  }
  if (!staff || staff.orgId !== orgId) {
    appError("NOT_FOUND", { reason: "STAFF_NOT_FOUND" });
  }
  if (service.deletedAt !== undefined) {
    appError("VALIDATION", { field: "serviceId", reason: "ARCHIVED" });
  }
  if (pet.deletedAt !== undefined) {
    appError("VALIDATION", { field: "petId", reason: "ARCHIVED" });
  }
  if (client.deletedAt !== undefined) {
    appError("VALIDATION", { field: "clientId", reason: "ARCHIVED" });
  }
  if (!staff.isActive) {
    appError("VALIDATION", { field: "staffId", reason: "INACTIVE_STAFF" });
  }
  // Service must be available at this location: org-wide services pass; a
  // location-only service must match the requested location. Per-location
  // overrides with `isActive:false` are checked here so an "archived at this
  // location" service can't be booked.
  if (service.locationId && service.locationId !== location._id) {
    appError("VALIDATION", { field: "serviceId", reason: "WRONG_LOCATION" });
  }
  const override = await ctx.db
    .query("serviceLocationOverrides")
    .withIndex("by_service_location", (index) =>
      index.eq("serviceId", service._id).eq("locationId", location._id),
    )
    .unique();
  if (override?.isActive === false) {
    appError("VALIDATION", { field: "serviceId", reason: "ARCHIVED" });
  }
  return { client, pet, service, staff, location };
}

/**
 * Schedule the 24-hour reminder if the appointment is far enough out that a
 * "tomorrow" reminder still makes sense. If it's closer than 24h we skip —
 * the confirmation we just sent already serves as the heads-up. The action's
 * own fire-time guard handles cancellations + reschedules, so callers don't
 * need to track or cancel the scheduled invocation.
 */
async function scheduleReminderIfFarEnough(
  ctx: MutationCtx,
  appointmentId: Id<"appointments">,
  startTime: number,
): Promise<void> {
  const fireAt = startTime - REMINDER_LEAD_MS;
  if (fireAt <= Date.now()) return;
  await ctx.scheduler.runAt(fireAt, internal.email.sendBookingReminder, {
    appointmentId,
    expectedStartTime: startTime,
  });
}
