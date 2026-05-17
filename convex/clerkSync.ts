import { v } from "convex/values";
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
      plan: "free",
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
    for (const membership of memberships) {
      if (membership.isActive) {
        await ctx.db.patch(membership._id, { isActive: false });
      }
    }
  },
});
