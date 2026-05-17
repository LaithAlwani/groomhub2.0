import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Returns all active memberships in the caller's current org, joined with
 * the matching `users` row so the UI can show name + email + avatar.
 *
 * Used by future pages like `/staff` to list groomers, and by appointment
 * dialogs that need a staff picker.
 */
export const forOrg = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const orgId = identity.orgId as string | undefined;
    if (!orgId) return [];

    const activeMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_active", (index) =>
        index.eq("orgId", orgId).eq("isActive", true),
      )
      .collect();

    const results: Array<{
      membership: Doc<"memberships">;
      user: Doc<"users">;
    }> = [];
    for (const membership of activeMemberships) {
      const user = await ctx.db.get(membership.userId);
      if (user && user.isActive) {
        results.push({ membership, user });
      }
    }
    return results;
  },
});
