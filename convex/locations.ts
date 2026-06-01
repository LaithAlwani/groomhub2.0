import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError } from "./lib/errors";
import { requirePlanFeature } from "./lib/plans";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";
import { validateSlugShape } from "./lib/reservedSlugs";
import { seedDefaultLocationHours } from "./locationHours";

const NAME_MAX = 60;
const ADDRESS_FIELD_MAX = 120;

/**
 * Lists active locations for the caller's org. `getCurrent` (organizations.ts)
 * returns the org row; this returns the per-location detail used by the
 * sidebar switcher and `/settings/locations`. Soft-deleted rows are excluded.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const rows = await ctx.db
      .query("locations")
      .withIndex("by_org_active", (index) =>
        index.eq("orgId", identity.orgId).eq("isActive", true),
      )
      .collect();
    return rows
      .filter((row) => row.deletedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Fetch a single location. Refuses cross-org cleanly. Returns `null` if the
 * row was soft-deleted or doesn't exist so callers can fall back to the
 * default location instead of crashing.
 */
export const get = query({
  args: { id: v.id("locations") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== identity.orgId) return null;
    if (row.deletedAt !== undefined) return null;
    return row;
  },
});

/**
 * Create a new location for the caller's org. The *first* location is always
 * free (created during `seedFromClerk`). Any further location requires the
 * `enterprise` plan — the gate enforces it server-side regardless of any UI
 * disabled-button checks.
 *
 * Admin / superAdmin only.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    currency: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const name = args.name.trim();
    if (!name || name.length > NAME_MAX) {
      appError("VALIDATION", { field: "name", reason: "LENGTH" });
    }
    const lowerSlug = args.slug.toLowerCase();
    const shape = validateSlugShape(lowerSlug);
    if (!shape.ok) appError(shape.code);
    if (!args.timezone.trim()) {
      appError("VALIDATION", { field: "timezone", reason: "REQUIRED" });
    }
    if (!args.currency.trim()) {
      appError("VALIDATION", { field: "currency", reason: "REQUIRED" });
    }

    // Plan gate: the very first location is always free; the SECOND one is
    // the upsell moment. Plan check fires only when at least one active
    // location already exists.
    const existingActive = await ctx.db
      .query("locations")
      .withIndex("by_org_active", (index) =>
        index.eq("orgId", orgId).eq("isActive", true),
      )
      .take(1);
    if (existingActive.length > 0) {
      await requirePlanFeature(ctx, orgId, "multipleLocations");
    }

    const slugOwner = await ctx.db
      .query("locations")
      .withIndex("by_org_slug", (index) =>
        index.eq("orgId", orgId).eq("slug", lowerSlug),
      )
      .unique();
    if (slugOwner && slugOwner.deletedAt === undefined) {
      appError("SLUG_TAKEN");
    }

    const insertedId = await ctx.db.insert("locations", {
      orgId,
      name,
      slug: lowerSlug,
      timezone: args.timezone.trim(),
      currency: args.currency.trim(),
      addressLine1: trimOrUndef(args.addressLine1),
      addressLine2: trimOrUndef(args.addressLine2),
      city: trimOrUndef(args.city),
      state: trimOrUndef(args.state),
      postalCode: trimOrUndef(args.postalCode),
      country: trimOrUndef(args.country),
      phone: trimOrUndef(args.phone),
      contactEmail: trimOrUndef(args.contactEmail),
      isActive: true,
    });
    // Seed the shop's default operating hours so the new location is bookable
    // and new groomers assigned here inherit a sensible weekly schedule.
    await seedDefaultLocationHours(ctx, orgId, insertedId);
    return insertedId;
  },
});

/**
 * Patch an existing location. Slug changes go through the same shape +
 * uniqueness validation as `create`. Admin / superAdmin only.
 */
export const update = mutation({
  args: {
    id: v.id("locations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.orgId !== orgId || existing.deletedAt !== undefined) {
      appError("NOT_FOUND", { reason: "LOCATION_NOT_FOUND" });
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name || name.length > NAME_MAX) {
        appError("VALIDATION", { field: "name", reason: "LENGTH" });
      }
      patch.name = name;
    }
    if (args.slug !== undefined) {
      const lowerSlug = args.slug.toLowerCase();
      const shape = validateSlugShape(lowerSlug);
      if (!shape.ok) appError(shape.code);
      if (lowerSlug !== existing.slug) {
        const slugOwner = await ctx.db
          .query("locations")
          .withIndex("by_org_slug", (index) =>
            index.eq("orgId", orgId).eq("slug", lowerSlug),
          )
          .unique();
        if (slugOwner && slugOwner._id !== existing._id) {
          appError("SLUG_TAKEN");
        }
        patch.slug = lowerSlug;
      }
    }
    if (args.timezone !== undefined && args.timezone.trim()) {
      patch.timezone = args.timezone.trim();
    }
    if (args.currency !== undefined && args.currency.trim()) {
      patch.currency = args.currency.trim();
    }
    for (const field of [
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "postalCode",
      "country",
      "phone",
      "contactEmail",
    ] as const) {
      if (args[field] !== undefined) {
        const trimmed = args[field]?.trim() ?? "";
        if (trimmed.length > ADDRESS_FIELD_MAX) {
          appError("VALIDATION", { field, reason: "LENGTH" });
        }
        patch[field] = trimmed.length > 0 ? trimmed : undefined;
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, patch);
    }
  },
});

/**
 * Soft-deletes a location: flips `isActive=false` and stamps `deletedAt`.
 * Existing appointments + schedules at this location stay readable in the
 * database for audit history. Refuses to remove the org's last active
 * location — every org must have at least one. Admin / superAdmin only.
 */
export const archive = mutation({
  args: { id: v.id("locations") },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.orgId !== orgId || existing.deletedAt !== undefined) {
      appError("NOT_FOUND", { reason: "LOCATION_NOT_FOUND" });
    }
    const activeCount = await ctx.db
      .query("locations")
      .withIndex("by_org_active", (index) =>
        index.eq("orgId", orgId).eq("isActive", true),
      )
      .collect();
    const livingActive = activeCount.filter(
      (row) => row.deletedAt === undefined && row._id !== existing._id,
    );
    if (livingActive.length === 0) {
      appError("VALIDATION", { reason: "LAST_LOCATION" });
    }
    await ctx.db.patch(existing._id, {
      isActive: false,
      deletedAt: Date.now(),
    });
  },
});

function trimOrUndef(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
