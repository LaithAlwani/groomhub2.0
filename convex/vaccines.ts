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

const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
const MAX_INTERVAL_MONTHS = 12 * 10; // 10-year cap on default intervals.

/**
 * Lists the active vaccine catalog for the caller's org. Sorted by name for
 * stable rendering in the page table and the pet form dropdown. Soft-deleted
 * rows are hidden unless `includeArchived` is true (no UI consumer today,
 * but matches the `services.list` shape for parity).
 */
export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const rows = await ctx.db
      .query("vaccines")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .collect();
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => row.deletedAt === undefined);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

const vaccineInputValidator = {
  name: v.string(),
  species: v.array(speciesValidator),
  defaultIntervalMonths: v.optional(v.number()),
  description: v.optional(v.string()),
};

/**
 * Create a vaccine catalog entry. Open to all roles per the product rule —
 * groomers add their own vaccine types as they encounter them.
 */
export const create = mutation({
  args: vaccineInputValidator,
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, [
      "superAdmin",
      "admin",
      "staff",
    ]);
    validateInput(args);
    return await ctx.db.insert("vaccines", {
      orgId,
      name: args.name.trim(),
      species: args.species,
      defaultIntervalMonths: args.defaultIntervalMonths,
      description: args.description?.trim() || undefined,
      isActive: true,
    });
  },
});

/**
 * Update an existing catalog entry. Open to all roles like `create`. Refuses
 * cross-org IDs.
 */
export const update = mutation({
  args: { id: v.id("vaccines"), ...vaccineInputValidator },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, [
      "superAdmin",
      "admin",
      "staff",
    ]);
    const existing = await loadOwnVaccine(ctx, args.id, orgId);
    validateInput(args);
    await ctx.db.patch(existing._id, {
      name: args.name.trim(),
      species: args.species,
      defaultIntervalMonths: args.defaultIntervalMonths,
      description: args.description?.trim() || undefined,
    });
  },
});

/**
 * Soft-delete (archive) a catalog entry. **Admin + superAdmin only** — staff
 * cannot delete catalog rows even though they can create / edit them. Pet
 * records that already reference the row stay valid; the dropdown just no
 * longer offers it for new selections.
 */
export const archive = mutation({
  args: { id: v.id("vaccines") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnVaccine(ctx, args.id, orgId);
    if (existing.deletedAt !== undefined) return;
    await ctx.db.patch(existing._id, {
      isActive: false,
      deletedAt: Date.now(),
    });
  },
});

/**
 * Undo a soft-delete. Admin + superAdmin only.
 */
export const restore = mutation({
  args: { id: v.id("vaccines") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await loadOwnVaccine(ctx, args.id, orgId);
    if (existing.deletedAt === undefined) return;
    await ctx.db.patch(existing._id, {
      isActive: true,
      deletedAt: undefined,
    });
  },
});

/**
 * Permanent delete. superAdmin only. Existing pet records that reference
 * this id will render "(removed)" since the catalog row is gone for good.
 * Prefer `archive` when you just want to retire a vaccine.
 */
export const hardDelete = mutation({
  args: { id: v.id("vaccines") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin"]);
    const existing = await loadOwnVaccine(ctx, args.id, orgId);
    await ctx.db.delete(existing._id);
  },
});

async function loadOwnVaccine(
  ctx: QueryCtx | MutationCtx,
  id: Id<"vaccines">,
  orgId: string,
): Promise<Doc<"vaccines">> {
  const row = await ctx.db.get(id);
  if (!row) appError("NOT_FOUND", { reason: "VACCINE_NOT_FOUND" });
  if (row.orgId !== orgId) appError("FORBIDDEN", { reason: "WRONG_ORG" });
  return row;
}

function validateInput(args: {
  name: string;
  species: ReadonlyArray<string>;
  defaultIntervalMonths?: number;
  description?: string;
}): void {
  const name = args.name.trim();
  if (name.length === 0) {
    appError("VALIDATION", { field: "name", reason: "REQUIRED" });
  }
  if (name.length > NAME_MAX) {
    appError("VALIDATION", { field: "name", reason: "LENGTH" });
  }
  if (
    args.defaultIntervalMonths !== undefined &&
    (args.defaultIntervalMonths <= 0 ||
      args.defaultIntervalMonths > MAX_INTERVAL_MONTHS ||
      !Number.isInteger(args.defaultIntervalMonths))
  ) {
    appError("VALIDATION", {
      field: "defaultIntervalMonths",
      reason: "OUT_OF_RANGE",
    });
  }
  if (
    args.description !== undefined &&
    args.description.length > DESCRIPTION_MAX
  ) {
    appError("VALIDATION", { field: "description", reason: "LENGTH" });
  }
}
