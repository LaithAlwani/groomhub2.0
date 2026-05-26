import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { roleValidator } from "./schema";

/**
 * Internal mutations called by the Clerk webhook httpAction (convex/http.ts).
 * Never called from the client — all routes are `internalMutation`.
 *
 * Each mutation is idempotent so duplicate webhook deliveries are safe.
 *
 * After the Phase 2.5 split: `users` is the global identity mirror,
 * `memberships` is per `(user × org)`. Webhook events touch only the
 * table that owns the relevant data.
 */

export const upsertOrganization = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, slug: args.slug });
      return existing._id;
    }

    return await ctx.db.insert("organizations", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: args.slug,
      timezone: "UTC",
      currency: "USD",
      plan: "essential",
      createdAt: Date.now(),
    });
  },
});

/**
 * Upsert the global `users` row from `user.created` / `user.updated` events.
 * Does not touch any membership.
 */
export const upsertUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (index) => index.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tokenIdentifier: args.tokenIdentifier,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        avatarUrl: args.avatarUrl,
        isActive: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: args.tokenIdentifier,
      clerkUserId: args.clerkUserId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      avatarUrl: args.avatarUrl,
      isActive: true,
    });
  },
});

/**
 * Upsert the `(user × org)` membership row from `organizationMembership.created` /
 * `.updated` events. Ensures the `users` row exists first so the foreign key
 * is always valid, even if `user.created` arrived out of order.
 */
export const upsertMembership = internalMutation({
  args: {
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
    tokenIdentifier: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    avatarUrl: v.optional(v.string()),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (index) => index.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) {
      const insertedId = await ctx.db.insert("users", {
        tokenIdentifier: args.tokenIdentifier,
        clerkUserId: args.clerkUserId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        avatarUrl: args.avatarUrl,
        isActive: true,
      });
      user = await ctx.db.get(insertedId);
      if (!user) throw new Error("upsertMembership: inserted user vanished");
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user_org", (index) =>
        index.eq("userId", user._id).eq("orgId", args.clerkOrgId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, isActive: true });
      return existing._id;
    }

    return await ctx.db.insert("memberships", {
      userId: user._id,
      orgId: args.clerkOrgId,
      role: args.role,
      isActive: true,
    });
  },
});

export const deactivateMembership = internalMutation({
  args: {
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (index) => index.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user_org", (index) =>
        index.eq("userId", user._id).eq("orgId", args.clerkOrgId),
      )
      .unique();
    if (membership && membership.isActive) {
      await ctx.db.patch(membership._id, { isActive: false });
    }
  },
});

/**
 * Patch the global `users` row when Clerk's `user.updated` event fires.
 * Only one row to touch — no per-org duplication.
 */
export const patchUserProfile = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (index) => index.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return;

    const profilePatch: Record<string, unknown> = {};
    if (args.email !== undefined) profilePatch.email = args.email;
    if (args.firstName !== undefined) profilePatch.firstName = args.firstName;
    if (args.lastName !== undefined) profilePatch.lastName = args.lastName;
    if (args.avatarUrl !== undefined) profilePatch.avatarUrl = args.avatarUrl;
    if (Object.keys(profilePatch).length > 0) {
      await ctx.db.patch(user._id, profilePatch);
    }
  },
});

/**
 * Soft-delete the user globally and cascade-deactivate every membership.
 * Foreign keys on appointments stay valid for audit history.
 */
export const deactivateUserEverywhere = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (index) => index.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return;

    if (user.isActive) await ctx.db.patch(user._id, { isActive: false });

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user_org", (index) => index.eq("userId", user._id))
      .collect();

    // Track orgs the user was a superAdmin of so we can check whether they
    // need cleanup. We deliberately don't react to deletions of non-
    // superAdmin members here — if a staff or admin leaves and happens to
    // be the last one in an empty shop, that's a weird edge case worth
    // having support look at rather than auto-wiping the org.
    //
    // Add unconditionally on `isActive` since Clerk often fires
    // `organizationMembership.deleted` before `user.deleted`, leaving rows
    // already `isActive: false` by the time we run. The role check stays
    // the gate.
    const affectedOrgIds = new Set<string>();
    for (const membership of memberships) {
      if (membership.isActive) {
        await ctx.db.patch(membership._id, { isActive: false });
      }
      if (membership.role === "superAdmin") {
        affectedOrgIds.add(membership.orgId);
      }
    }

    // Orphan-org cleanup: for each org the user was active in, count the
    // remaining active members. If zero, the org has no one left to manage
    // it — soft-delete it (frees the slug immediately) and schedule the
    // Clerk Backend API call to wipe the Clerk dashboard entry too. The
    // 30-day cron in `orgCleanup.sweepDeletedOrgs` hard-deletes the Convex
    // data + storage afterwards.
    for (const orgId of affectedOrgIds) {
      const remaining = await ctx.db
        .query("memberships")
        .withIndex("by_org_active", (index) =>
          index.eq("orgId", orgId).eq("isActive", true),
        )
        .take(1);
      if (remaining.length > 0) continue;

      const org = await ctx.db
        .query("organizations")
        .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgId))
        .unique();
      if (!org || org.deletedAt !== undefined) continue;
      await ctx.db.patch(org._id, { deletedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.orgCleanup.deleteClerkOrg, {
        clerkOrgId: orgId,
      });
    }
  },
});
