import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
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
