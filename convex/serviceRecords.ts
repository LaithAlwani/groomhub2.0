import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { appError } from "./lib/errors";
import { refreshClientLastVisit } from "./lib/clientSummary";
import { ensureMembership, readMembershipForQuery } from "./lib/ensureMembership";
import { mapClerkOrgRole } from "./lib/roles";
import { requireRole } from "./lib/rbac";
import { requireAuth, softAuth } from "./lib/tenant";

/**
 * The permanent history of services performed on a pet (`serviceRecords`),
 * distinct from scheduled `appointments`:
 *   - `create`             — a walk-in / manual entry (no appointment).
 *   - `completeAppointment`— finish a scheduled appointment: spawns a linked
 *     record AND flips the appointment to `completed`.
 *   - `listForPet` / `listForClient` — history for the detail pages.
 *   - `update` / `remove` / `addImage` / `removeImage` — author-or-admin edits.
 *   - `backfillFromCompletedAppointments` — one-time migration.
 *
 * A record with no `serviceId` is a plain note (price 0). Photos reuse the
 * reference-free `appointments.generateImageUploadUrl`.
 */

const MAX_RESULTS = 500;
const MAX_IMAGES_PER_STAGE = 12;
const imageStageValidator = v.union(v.literal("before"), v.literal("after"));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Currency for a record — the location's, else the org's, else USD. */
async function resolveCurrency(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  locationId: Id<"locations"> | undefined,
): Promise<string> {
  if (locationId) {
    const location = await ctx.db.get(locationId);
    if (location && location.orgId === orgId && location.currency) {
      return location.currency;
    }
  }
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgId))
    .unique();
  return org?.currency || "USD";
}

/**
 * Resolve a service into its snapshot fields at the given location: name,
 * effective price (per-location override applied), and currency.
 */
async function resolveServiceSnapshot(
  ctx: MutationCtx,
  orgId: string,
  serviceId: Id<"services">,
  locationId: Id<"locations"> | undefined,
): Promise<{ name: string; priceCents: number; currency: string }> {
  const service = await ctx.db.get(serviceId);
  if (!service || service.orgId !== orgId) {
    appError("NOT_FOUND", { reason: "SERVICE_NOT_FOUND" });
  }
  let priceCents = service.priceCents;
  if (locationId) {
    const override = await ctx.db
      .query("serviceLocationOverrides")
      .withIndex("by_service_location", (index) =>
        index.eq("serviceId", serviceId).eq("locationId", locationId),
      )
      .unique();
    if (override?.priceCents !== undefined && override.priceCents !== null) {
      priceCents = override.priceCents;
    }
  }
  return {
    name: service.name,
    priceCents,
    currency: service.currency || (await resolveCurrency(ctx, orgId, locationId)),
  };
}

function cleanProducts(products: string[] | undefined): string[] | undefined {
  if (!products) return undefined;
  const cleaned = products.map((entry) => entry.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function positiveWeight(weightLb: number | undefined): number | undefined {
  if (weightLb === undefined) return undefined;
  return Number.isFinite(weightLb) && weightLb > 0 ? weightLb : undefined;
}

// ---------------------------------------------------------------------------
// Enrichment (read side)
// ---------------------------------------------------------------------------

export type ServiceRecordImage = { storageId: Id<"_storage">; url: string | null };

export type EnrichedServiceRecord = Doc<"serviceRecords"> & {
  serviceName: string | null;
  staffName: string;
  petName: string;
  beforeImages: ServiceRecordImage[];
  afterImages: ServiceRecordImage[];
  // Whether the caller may edit/delete this record (author, or admin+).
  canManage: boolean;
};

async function resolveImages(
  ctx: QueryCtx,
  storageIds: ReadonlyArray<Id<"_storage">> | undefined,
): Promise<ServiceRecordImage[]> {
  if (!storageIds || storageIds.length === 0) return [];
  return await Promise.all(
    storageIds.map(async (storageId) => ({
      storageId,
      url: await ctx.storage.getUrl(storageId),
    })),
  );
}

async function staffName(
  ctx: QueryCtx,
  staffId: Id<"memberships">,
): Promise<string> {
  const staff = await ctx.db.get(staffId);
  if (!staff) return "Unknown";
  const user = await ctx.db.get(staff.userId);
  if (!user) return "Unknown";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.email || "Unknown";
}

async function enrichRecord(
  ctx: QueryCtx,
  row: Doc<"serviceRecords">,
  callerMembershipId: Id<"memberships"> | null,
  isAdmin: boolean,
): Promise<EnrichedServiceRecord> {
  const [pet, beforeImages, afterImages, name] = await Promise.all([
    ctx.db.get(row.petId),
    resolveImages(ctx, row.beforeImageStorageIds),
    resolveImages(ctx, row.afterImageStorageIds),
    staffName(ctx, row.staffId),
  ]);
  // Prefer the live service name so renames show through; fall back to the
  // snapshot for archived/removed services.
  let serviceName: string | null = row.serviceNameSnapshot ?? null;
  if (row.serviceId) {
    const service = await ctx.db.get(row.serviceId);
    if (service) serviceName = service.name;
  }
  return {
    ...row,
    serviceName,
    staffName: name,
    petName: pet?.name ?? "Removed pet",
    beforeImages,
    afterImages,
    canManage: isAdmin || row.createdBy === callerMembershipId,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Resolve a list of just-uploaded storage ids into preview URLs. Used by the
 * "Log a service" form to show thumbnails for photos staged before the record
 * exists. Authed members only; storage ids are opaque and unguessable.
 */
export const storageImageUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    return await resolveImages(ctx, args.storageIds);
  },
});

export const listForPet = query({
  args: { petId: v.id("pets") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const pet = await ctx.db.get(args.petId);
    if (!pet) appError("NOT_FOUND", { reason: "PET_NOT_FOUND" });
    if (pet.orgId !== identity.orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
    const { membership } = await readMembershipForQuery(ctx, identity);
    const isAdmin = ["admin", "superAdmin"].includes(
      mapClerkOrgRole(identity.orgRole),
    );
    const rows = await ctx.db
      .query("serviceRecords")
      .withIndex("by_pet", (index) => index.eq("petId", args.petId))
      .take(MAX_RESULTS);
    const sorted = rows.sort((a, b) => b.date - a.date);
    return await Promise.all(
      sorted.map((row) =>
        enrichRecord(ctx, row, membership?._id ?? null, isAdmin),
      ),
    );
  },
});

export const listForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const client = await ctx.db.get(args.clientId);
    if (!client) appError("NOT_FOUND", { reason: "CLIENT_NOT_FOUND" });
    if (client.orgId !== identity.orgId)
      appError("FORBIDDEN", { reason: "WRONG_ORG" });
    const { membership } = await readMembershipForQuery(ctx, identity);
    const isAdmin = ["admin", "superAdmin"].includes(
      mapClerkOrgRole(identity.orgRole),
    );
    const rows = await ctx.db
      .query("serviceRecords")
      .withIndex("by_client", (index) => index.eq("clientId", args.clientId))
      .take(MAX_RESULTS);
    const sorted = rows.sort((a, b) => b.date - a.date);
    return await Promise.all(
      sorted.map((row) =>
        enrichRecord(ctx, row, membership?._id ?? null, isAdmin),
      ),
    );
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const recordInputValidator = {
  serviceId: v.optional(v.id("services")),
  priceCents: v.optional(v.number()),
  notes: v.optional(v.string()),
  weightLb: v.optional(v.number()),
  productsUsed: v.optional(v.array(v.string())),
};

/**
 * Create a service record for a walk-in / manual entry (no appointment). Any
 * staff+ member. Derives the client from the pet; snapshots the service's
 * resolved price + name when a service is chosen.
 */
export const create = mutation({
  args: {
    petId: v.id("pets"),
    locationId: v.optional(v.id("locations")),
    staffId: v.optional(v.id("memberships")),
    date: v.optional(v.number()),
    beforeImageStorageIds: v.optional(v.array(v.id("_storage"))),
    afterImageStorageIds: v.optional(v.array(v.id("_storage"))),
    ...recordInputValidator,
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const { membership: actor } = await ensureMembership(ctx, identity);
    const orgId = identity.orgId;

    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.orgId !== orgId) {
      appError("NOT_FOUND", { reason: "PET_NOT_FOUND" });
    }
    if (args.priceCents !== undefined && args.priceCents < 0) {
      appError("VALIDATION", { field: "priceCents", reason: "NEGATIVE" });
    }

    let serviceNameSnapshot: string | undefined;
    let priceCentsSnapshot = args.priceCents ?? 0;
    let currency: string;
    if (args.serviceId) {
      const snapshot = await resolveServiceSnapshot(
        ctx,
        orgId,
        args.serviceId,
        args.locationId,
      );
      serviceNameSnapshot = snapshot.name;
      priceCentsSnapshot = args.priceCents ?? snapshot.priceCents;
      currency = snapshot.currency;
    } else {
      currency = await resolveCurrency(ctx, orgId, args.locationId);
    }

    const staffId = args.staffId ?? actor._id;
    if (args.staffId) {
      const staff = await ctx.db.get(args.staffId);
      if (!staff || staff.orgId !== orgId) {
        appError("NOT_FOUND", { reason: "STAFF_NOT_FOUND" });
      }
    }

    const now = Date.now();
    return await ctx.db.insert("serviceRecords", {
      orgId,
      locationId: args.locationId,
      clientId: pet.clientId,
      petId: pet._id,
      staffId,
      date: args.date ?? now,
      serviceId: args.serviceId,
      serviceNameSnapshot,
      priceCentsSnapshot,
      currency,
      notes: args.notes?.trim() || undefined,
      weightLb: positiveWeight(args.weightLb),
      productsUsed: cleanProducts(args.productsUsed),
      beforeImageStorageIds: args.beforeImageStorageIds?.slice(
        0,
        MAX_IMAGES_PER_STAGE,
      ),
      afterImageStorageIds: args.afterImageStorageIds?.slice(
        0,
        MAX_IMAGES_PER_STAGE,
      ),
      createdBy: actor._id,
      createdAt: now,
    });
  },
});

/**
 * Complete a scheduled appointment: create (or update, if re-run) a linked
 * service record and flip the appointment to `completed`. Staff may only
 * complete their own appointment. Fields default from the appointment but can
 * be overridden. Preserves the pet-ready email side effect.
 */
export const completeAppointment = mutation({
  args: { appointmentId: v.id("appointments"), ...recordInputValidator },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const { role } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
    const { membership: actor } = await ensureMembership(ctx, identity);
    const orgId = identity.orgId;

    const appt = await ctx.db.get(args.appointmentId);
    if (!appt || appt.orgId !== orgId) {
      appError("NOT_FOUND", { reason: "APPOINTMENT_NOT_FOUND" });
    }
    if (role === "staff" && appt.staffId !== actor._id) {
      appError("FORBIDDEN", { reason: "NOT_OWN_APPOINTMENT" });
    }
    if (args.priceCents !== undefined && args.priceCents < 0) {
      appError("VALIDATION", { field: "priceCents", reason: "NEGATIVE" });
    }

    const serviceId = args.serviceId ?? appt.serviceId;
    let serviceNameSnapshot: string | undefined;
    let priceCentsSnapshot: number;
    if (serviceId === appt.serviceId && args.serviceId === undefined) {
      // Unchanged service — reuse the appointment's own snapshot/override total.
      const service = await ctx.db.get(appt.serviceId);
      serviceNameSnapshot = service?.name;
      priceCentsSnapshot =
        args.priceCents ?? appt.totalPriceCents ?? appt.priceCentsSnapshot;
    } else {
      const snapshot = await resolveServiceSnapshot(
        ctx,
        orgId,
        serviceId,
        appt.locationId,
      );
      serviceNameSnapshot = snapshot.name;
      priceCentsSnapshot = args.priceCents ?? snapshot.priceCents;
    }
    const currency = await resolveCurrency(ctx, orgId, appt.locationId);

    const fields = {
      orgId,
      locationId: appt.locationId,
      clientId: appt.clientId,
      petId: appt.petId,
      appointmentId: appt._id,
      staffId: appt.staffId,
      date: appt.startTime,
      serviceId,
      serviceNameSnapshot,
      priceCentsSnapshot,
      currency,
      notes: (args.notes ?? appt.notes)?.trim() || undefined,
      weightLb: positiveWeight(args.weightLb),
      productsUsed: cleanProducts(args.productsUsed),
    };

    // Idempotent: if this appointment already spawned a record, update it.
    const existingRecord = await ctx.db
      .query("serviceRecords")
      .withIndex("by_appointment", (index) =>
        index.eq("appointmentId", appt._id),
      )
      .unique();
    let recordId: Id<"serviceRecords">;
    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, { ...fields, updatedAt: Date.now() });
      recordId = existingRecord._id;
    } else {
      recordId = await ctx.db.insert("serviceRecords", {
        ...fields,
        createdBy: actor._id,
        createdAt: Date.now(),
      });
    }

    if (appt.status !== "completed") {
      await ctx.db.patch(appt._id, { status: "completed" });
      // Completing possibly-most-recent appt: refresh the client's last-visit.
      await refreshClientLastVisit(ctx, appt.clientId);
      await ctx.scheduler.runAfter(0, internal.email.sendPetReady, {
        appointmentId: appt._id,
      });
    }
    return recordId;
  },
});

/** Load a record the caller may edit: same org, and author or admin+. */
async function loadManageableRecord(
  ctx: MutationCtx,
  id: Id<"serviceRecords">,
): Promise<Doc<"serviceRecords">> {
  const identity = await requireAuth(ctx);
  const { role } = await requireRole(ctx, ["superAdmin", "admin", "staff"]);
  const row = await ctx.db.get(id);
  if (!row || row.orgId !== identity.orgId) {
    appError("NOT_FOUND", { reason: "SERVICE_RECORD_NOT_FOUND" });
  }
  const isAdmin = role === "admin" || role === "superAdmin";
  if (!isAdmin) {
    const { membership } = await ensureMembership(ctx, identity);
    if (row.createdBy !== membership._id) {
      appError("FORBIDDEN", { reason: "NOT_OWN_RECORD" });
    }
  }
  return row;
}

export const update = mutation({
  args: { id: v.id("serviceRecords"), ...recordInputValidator },
  handler: async (ctx, args) => {
    const row = await loadManageableRecord(ctx, args.id);
    if (args.priceCents !== undefined && args.priceCents < 0) {
      appError("VALIDATION", { field: "priceCents", reason: "NEGATIVE" });
    }
    const patch: Partial<Doc<"serviceRecords">> = {
      notes: args.notes?.trim() || undefined,
      weightLb: positiveWeight(args.weightLb),
      productsUsed: cleanProducts(args.productsUsed),
      updatedAt: Date.now(),
    };
    if (args.serviceId !== undefined) {
      const snapshot = await resolveServiceSnapshot(
        ctx,
        row.orgId,
        args.serviceId,
        row.locationId,
      );
      patch.serviceId = args.serviceId;
      patch.serviceNameSnapshot = snapshot.name;
      patch.priceCentsSnapshot = args.priceCents ?? snapshot.priceCents;
      patch.currency = snapshot.currency;
    } else if (args.priceCents !== undefined) {
      patch.priceCentsSnapshot = args.priceCents;
    }
    await ctx.db.patch(row._id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("serviceRecords") },
  handler: async (ctx, args) => {
    const row = await loadManageableRecord(ctx, args.id);
    for (const storageId of [
      ...(row.beforeImageStorageIds ?? []),
      ...(row.afterImageStorageIds ?? []),
    ]) {
      await ctx.storage.delete(storageId);
    }
    await ctx.db.delete(row._id);
  },
});

export const addImage = mutation({
  args: {
    id: v.id("serviceRecords"),
    stage: imageStageValidator,
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const row = await loadManageableRecord(ctx, args.id);
    const current =
      (args.stage === "before"
        ? row.beforeImageStorageIds
        : row.afterImageStorageIds) ?? [];
    if (current.length >= MAX_IMAGES_PER_STAGE) {
      appError("VALIDATION", { field: args.stage, reason: "TOO_MANY_IMAGES" });
    }
    const next = [...current, args.storageId];
    await ctx.db.patch(
      row._id,
      args.stage === "before"
        ? { beforeImageStorageIds: next }
        : { afterImageStorageIds: next },
    );
  },
});

export const removeImage = mutation({
  args: {
    id: v.id("serviceRecords"),
    stage: imageStageValidator,
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const row = await loadManageableRecord(ctx, args.id);
    const current =
      (args.stage === "before"
        ? row.beforeImageStorageIds
        : row.afterImageStorageIds) ?? [];
    const next = current.filter((storageId) => storageId !== args.storageId);
    await ctx.db.patch(
      row._id,
      args.stage === "before"
        ? { beforeImageStorageIds: next }
        : { afterImageStorageIds: next },
    );
    await ctx.storage.delete(args.storageId);
  },
});

// ---------------------------------------------------------------------------
// One-time backfill
// ---------------------------------------------------------------------------

/**
 * Insert a service record mirroring an appointment. Idempotent per appointment
 * (skips if one already exists). Returns whether a new record was created.
 */
async function insertRecordFromAppointment(
  ctx: MutationCtx,
  appt: Doc<"appointments">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("serviceRecords")
    .withIndex("by_appointment", (index) => index.eq("appointmentId", appt._id))
    .unique();
  if (existing) return false;
  const service = await ctx.db.get(appt.serviceId);
  const currency = await resolveCurrency(ctx, appt.orgId, appt.locationId);
  await ctx.db.insert("serviceRecords", {
    orgId: appt.orgId,
    locationId: appt.locationId,
    clientId: appt.clientId,
    petId: appt.petId,
    appointmentId: appt._id,
    staffId: appt.staffId,
    date: appt.startTime,
    serviceId: appt.serviceId,
    serviceNameSnapshot: service?.name,
    priceCentsSnapshot: appt.totalPriceCents ?? appt.priceCentsSnapshot,
    currency,
    notes: appt.notes,
    beforeImageStorageIds: appt.beforeImageStorageIds,
    afterImageStorageIds: appt.afterImageStorageIds,
    createdBy: appt.createdBy,
    createdAt: appt.createdAt,
  });
  return true;
}

/**
 * Convert every existing `completed` appointment into a linked service record
 * (skipping any that already have one). Idempotent. The completed appointments
 * are left in place so dashboards + consent links keep working. Run with
 * `npx convex run serviceRecords:backfillFromCompletedAppointments`.
 */
export const backfillFromCompletedAppointments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const completed = await ctx.db
      .query("appointments")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    let created = 0;
    for (const appt of completed) {
      if (await insertRecordFromAppointment(ctx, appt)) created += 1;
    }
    return { scanned: completed.length, created };
  },
});

/**
 * Convert specific appointments into service records — for visits that were
 * booked as appointments but should live in service history. Target either by
 * explicit `ids`, or by `sinceDaysAgo` (appointments CREATED within that many
 * days, excluding cancelled). Idempotent (skips appointments that already have
 * a record). By default also marks each converted appointment `completed` so it
 * leaves the schedule and shows as history; pass `markCompleted: false` to keep
 * its status. Examples:
 *   npx convex run serviceRecords:recordsFromAppointments '{"sinceDaysAgo":5}'
 *   npx convex run serviceRecords:recordsFromAppointments '{"ids":["<id>","<id>"]}'
 */
export const recordsFromAppointments = internalMutation({
  args: {
    ids: v.optional(v.array(v.id("appointments"))),
    sinceDaysAgo: v.optional(v.number()),
    markCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.ids && args.sinceDaysAgo === undefined) {
      throw new Error("Pass either `ids` or `sinceDaysAgo`.");
    }
    let targets: Doc<"appointments">[];
    if (args.ids && args.ids.length > 0) {
      const loaded = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
      targets = loaded.filter(
        (row): row is Doc<"appointments"> => row !== null,
      );
    } else {
      const cutoff =
        Date.now() - (args.sinceDaysAgo ?? 0) * 24 * 60 * 60 * 1000;
      targets = (await ctx.db.query("appointments").collect()).filter(
        (appt) => appt.createdAt >= cutoff && appt.status !== "cancelled",
      );
    }
    const markCompleted = args.markCompleted ?? true;
    let created = 0;
    let skipped = 0;
    for (const appt of targets) {
      if (await insertRecordFromAppointment(ctx, appt)) {
        created += 1;
        if (markCompleted && appt.status !== "completed") {
          await ctx.db.patch(appt._id, { status: "completed" });
        }
      } else {
        skipped += 1;
      }
    }
    return { targets: targets.length, created, skipped };
  },
});
