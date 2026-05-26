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
import { speciesValidator } from "./schema";

/**
 * Lists services available in the caller's org.
 * - `staff+` can read.
 * - When `includeArchived` is false (default), soft-deleted rows are hidden.
 */
export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const rows = await ctx.db
      .query("services")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .collect();
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => row.deletedAt === undefined);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

const serviceInputValidator = {
  name: v.string(),
  description: v.optional(v.string()),
  durationMin: v.number(),
  priceCents: v.number(),
  species: v.array(speciesValidator),
  color: v.optional(v.string()),
};

/**
 * Create a service. Admin + superAdmin only.
 */
export const create = mutation({
  args: serviceInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    validateInput(args);
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgId))
      .unique();
    return await ctx.db.insert("services", {
      orgId,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      durationMin: args.durationMin,
      priceCents: args.priceCents,
      currency: org?.currency ?? "USD",
      species: args.species,
      color: args.color,
      isActive: true,
    });
  },
});

/**
 * Update an existing service. Admin + superAdmin only. Refuses cross-org IDs.
 */
export const update = mutation({
  args: { id: v.id("services"), ...serviceInputValidator },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnService(ctx, args.id, orgId);
    validateInput(args);
    await ctx.db.patch(existing._id, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      durationMin: args.durationMin,
      priceCents: args.priceCents,
      species: args.species,
      color: args.color,
    });
  },
});

/**
 * Soft-delete a service (sets `deletedAt`). Admin + superAdmin can call.
 * Appointment history that references this service stays readable.
 */
export const archive = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnService(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return;
    await ctx.db.patch(existing._id, {
      isActive: false,
      deletedAt: Date.now(),
    });
  },
});

/**
 * Restore a previously archived service. Admin + superAdmin.
 */
export const restore = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnService(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return;
    await ctx.db.patch(existing._id, {
      isActive: true,
      deletedAt: undefined,
    });
  },
});

/**
 * Permanently delete a service. superAdmin only. Use with caution —
 * historical appointment rows that reference this service will be orphaned.
 */
export const hardDelete = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnService(ctx, args.id, orgId);
    await ctx.db.delete(existing._id);
  },
});

async function loadOwnService(
  ctx: MutationCtx,
  id: Id<"services">,
  orgId: string,
): Promise<Doc<"services">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "SERVICE_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

/**
 * Lists every per-location override row for a single location in the caller's
 * org. The services page uses this to show effective price + duration per
 * service after merging the org-wide values with any location patch.
 *
 * Returns `[]` while auth / org context is in flight so the live query
 * doesn't blow up the UI during org switches.
 */
export const listOverridesForLocation = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const location = await ctx.db.get(args.locationId);
    if (!location || location.orgId !== identity.orgId) return [];
    if (location.deletedAt !== undefined) return [];
    return await ctx.db
      .query("serviceLocationOverrides")
      .withIndex("by_org_location", (index) =>
        index.eq("orgId", identity.orgId).eq("locationId", args.locationId),
      )
      .collect();
  },
});

/**
 * Upsert a per-location override on an org-wide service. Any of
 * `priceCents` / `durationMin` / `isActive` set means "patch this on top of
 * the org-wide value at this location". Pass `undefined` for fields that
 * should fall back to the org-wide default; passing all three undefined
 * leaves no patch in place and deletes the override row.
 *
 * Admin / superAdmin only. Refuses if the target service is itself
 * location-only (i.e. `service.locationId` is set) — those are already
 * scoped and shouldn't have overrides on top.
 */
export const setLocationOverride = mutation({
  args: {
    serviceId: v.id("services"),
    locationId: v.id("locations"),
    priceCents: v.optional(v.number()),
    durationMin: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const service = await loadOrgService(ctx, args.serviceId, orgId);
    if (service.locationId !== undefined) {
      appError("VALIDATION", { reason: "LOCATION_ONLY_SERVICE" });
    }
    const location = await ctx.db.get(args.locationId);
    if (!location || location.orgId !== orgId) {
      appError("FORBIDDEN", { reason: "LOCATION_WRONG_ORG" });
    }
    if (location.deletedAt !== undefined || !location.isActive) {
      appError("NOT_FOUND", { reason: "LOCATION_INACTIVE" });
    }
    if (args.priceCents !== undefined && args.priceCents < 0) {
      appError("VALIDATION", { field: "priceCents", reason: "NEGATIVE" });
    }
    if (
      args.durationMin !== undefined &&
      (args.durationMin <= 0 || args.durationMin > 24 * 60)
    ) {
      appError("VALIDATION", { field: "durationMin", reason: "OUT_OF_RANGE" });
    }

    const existing = await ctx.db
      .query("serviceLocationOverrides")
      .withIndex("by_service_location", (index) =>
        index
          .eq("serviceId", args.serviceId)
          .eq("locationId", args.locationId),
      )
      .unique();

    // Cleared override (all three fields undefined) ⇒ drop the row so the
    // service falls back to the org-wide default cleanly.
    const empty =
      args.priceCents === undefined &&
      args.durationMin === undefined &&
      args.isActive === undefined;
    if (empty) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        priceCents: args.priceCents,
        durationMin: args.durationMin,
        isActive: args.isActive,
      });
      return existing._id;
    }
    return await ctx.db.insert("serviceLocationOverrides", {
      orgId,
      serviceId: args.serviceId,
      locationId: args.locationId,
      priceCents: args.priceCents,
      durationMin: args.durationMin,
      isActive: args.isActive,
    });
  },
});

/**
 * Remove the per-location override row entirely so the service falls back
 * to the org-wide values at this location. Admin / superAdmin only.
 */
export const clearLocationOverride = mutation({
  args: {
    serviceId: v.id("services"),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    await loadOrgService(ctx, args.serviceId, orgId);
    const existing = await ctx.db
      .query("serviceLocationOverrides")
      .withIndex("by_service_location", (index) =>
        index
          .eq("serviceId", args.serviceId)
          .eq("locationId", args.locationId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

async function loadOrgService(
  ctx: QueryCtx | MutationCtx,
  id: Id<"services">,
  orgId: string,
): Promise<Doc<"services">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "SERVICE_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

function validateInput(args: {
  name: string;
  durationMin: number;
  priceCents: number;
  species: ReadonlyArray<string>;
}): void {
  if (args.name.trim().length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (args.durationMin <= 0 || args.durationMin > 24 * 60) {
    appError("VALIDATION", { field: "durationMin", reason: "OUT_OF_RANGE" });
  }
  if (args.priceCents < 0) {
    appError("VALIDATION", { field: "priceCents", reason: "NEGATIVE" });
  }
  if (args.species.length === 0) {
    appError("VALIDATION", { field: "species", reason: "AT_LEAST_ONE" });
  }
}
