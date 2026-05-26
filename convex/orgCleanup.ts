import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Soft-deleted-org cleanup pipeline.
 *
 * Trigger graph:
 *   user.deleted webhook
 *     ↳ clerkSync.deactivateUserEverywhere mutation
 *         ↳ for each newly-orphaned org:
 *             - set organizations.deletedAt = Date.now()  (frees slug NOW)
 *             - scheduler.runAfter(0, orgCleanup.deleteClerkOrg)  (Clerk dashboard cleanup)
 *
 *   convex/crons.ts daily tick
 *     ↳ orgCleanup.sweepDeletedOrgs action
 *         ↳ for each org past 30-day grace:
 *             - orgCleanup.hardDeleteOrg mutation  (cascade Convex data + storage)
 *
 * Why split actions + mutations:
 *   - HTTP calls to Clerk Backend API need an action (mutations can't fetch).
 *   - Convex data + storage deletes need a mutation (atomic per-org).
 */

/** DELETE the Clerk organization so the Clerk dashboard isn't littered. */
export const deleteClerkOrg = internalAction({
  args: { clerkOrgId: v.string() },
  handler: async (_ctx, args) => {
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) {
      console.error("orgCleanup: CLERK_SECRET_KEY not set; skipping Clerk org delete");
      return;
    }
    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${args.clerkOrgId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${secret}` },
      },
    );
    // 404 means Clerk already cleaned it up (deleted by webhook race, or the
    // user removed it manually) — also OK.
    if (!response.ok && response.status !== 404) {
      const body = await response.text().catch(() => "");
      console.error(
        `orgCleanup: failed to delete Clerk org ${args.clerkOrgId} (${response.status}): ${body}`,
      );
      throw new Error(`Clerk org delete failed: ${response.status}`);
    }
  },
});

/**
 * Daily sweep — finds soft-deleted orgs whose grace period has elapsed and
 * schedules hard-deletion for each. Actions can't iterate the DB directly,
 * so we delegate the per-org wipe to `hardDeleteOrg` (a mutation).
 */
export const sweepDeletedOrgs = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - GRACE_MS;
    const candidates = await ctx.runQuery(
      internal.orgCleanup.listOrgsPastGrace,
      { cutoff },
    );
    for (const org of candidates) {
      await ctx.runMutation(internal.orgCleanup.hardDeleteOrg, {
        orgRowId: org._id,
      });
    }
  },
});

import { internalQuery } from "./_generated/server";

/** Pulled out as its own internalQuery so the action above can call it. */
export const listOrgsPastGrace = internalQuery({
  args: { cutoff: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      // by_deletedAt sorts ascending by `deletedAt`; range-walk from oldest
      // up to `cutoff`. Anything past the cutoff is safe to wipe.
      .withIndex("by_deletedAt", (index) =>
        index.gt("deletedAt", 0).lte("deletedAt", args.cutoff),
      )
      .take(50);
  },
});

/**
 * Cascade-deletes every row tied to an org plus any pet image storage
 * objects, then the org row itself. Safe to call on the same org twice
 * (second call is a no-op — `ctx.db.get` returns null).
 *
 * Tables touched (in delete order — within Convex there's no FK enforcement
 * but ordering keeps the queries small as we go):
 *   appointments → staffDayOverride → staffWeeklySchedule → pets (+ image
 *   storage) → clients → services → memberships → organizations row
 */
export const hardDeleteOrg = internalMutation({
  args: { orgRowId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgRowId);
    if (!org) return; // already gone
    const orgId = org.clerkOrgId;

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_org", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of appointments) await ctx.db.delete(row._id);

    const overrides = await ctx.db
      .query("staffDayOverride")
      .withIndex("by_org_location_staff_date", (index) =>
        index.eq("orgId", orgId),
      )
      .collect();
    for (const row of overrides) await ctx.db.delete(row._id);

    const weekly = await ctx.db
      .query("staffWeeklySchedule")
      .withIndex("by_org_staff", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of weekly) await ctx.db.delete(row._id);

    // Per-location service overrides reference the org's services + locations;
    // wipe before the parent rows go away.
    const serviceOverrides = await ctx.db
      .query("serviceLocationOverrides")
      .withIndex("by_org_location", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of serviceOverrides) await ctx.db.delete(row._id);

    const pets = await ctx.db
      .query("pets")
      .withIndex("by_org", (index) => index.eq("orgId", orgId))
      .collect();
    for (const pet of pets) {
      if (pet.imageStorageId) {
        await ctx.storage.delete(pet.imageStorageId);
      }
      await ctx.db.delete(pet._id);
    }

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of clients) await ctx.db.delete(row._id);

    const services = await ctx.db
      .query("services")
      .withIndex("by_org", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of services) await ctx.db.delete(row._id);

    // Pending invite intents tied to this org never reach a webhook now —
    // wipe them so the next time the email re-onboards as their own org
    // they're not silently joined to a location that no longer exists.
    const intents = await ctx.db
      .query("staffInviteIntents")
      .withIndex("by_org_email", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of intents) await ctx.db.delete(row._id);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_active", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of memberships) await ctx.db.delete(row._id);

    // Locations go last among tenant tables — every row that references a
    // location id was already deleted in earlier passes.
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_org", (index) => index.eq("orgId", orgId))
      .collect();
    for (const row of locations) await ctx.db.delete(row._id);

    if (org.logoStorageId) {
      await ctx.storage.delete(org.logoStorageId);
    }
    await ctx.db.delete(org._id);
  },
});
