import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { readOrgClaims, softAuth } from "./lib/tenant";

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
    const claims = readOrgClaims(identity);
    if (!claims) return [];

    const activeMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_active", (index) =>
        index.eq("orgId", claims.orgId).eq("isActive", true),
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

/**
 * Returns the list of shops where the calling user is the **only** active
 * `superAdmin` AND there are other active members in the shop. Used by the
 * "Delete account" flow in `/account` to block self-deletion that would
 * orphan a multi-member shop — the user has to transfer ownership (or
 * archive all the other members) before they can delete themselves.
 *
 * Returns `[]` when the user has no blocking ownerships (delete is safe).
 * Each entry has the shop's display name so the UI can list them
 * specifically: "You're the sole owner of: Posh Paws Grooming, Tail Wags".
 *
 * Read rules:
 *   - Driven entirely by the caller's auth identity — no `userId` arg, so
 *     a user can only check their own ownership state.
 *   - All scans are indexed: `by_user_org` walks the user's memberships,
 *     `by_org_active` for the other-members check, `by_clerkOrgId` to get
 *     each shop's display name.
 */
export const myBlockingOwnerships = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (index) =>
        index.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    // All memberships for the caller across every shop.
    const myMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_user_org", (index) => index.eq("userId", user._id))
      .collect();

    const blocking: Array<{ orgId: string; orgName: string; otherMemberCount: number }> = [];
    for (const membership of myMemberships) {
      if (!membership.isActive) continue;
      if (membership.role !== "superAdmin") continue;

      // Are there any OTHER active members in this shop?
      const orgMembers = await ctx.db
        .query("memberships")
        .withIndex("by_org_active", (index) =>
          index.eq("orgId", membership.orgId).eq("isActive", true),
        )
        .collect();
      const others = orgMembers.filter((row) => row._id !== membership._id);
      if (others.length === 0) continue;

      // Look up the shop's display name so the UI can be specific.
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", membership.orgId))
        .unique();
      blocking.push({
        orgId: membership.orgId,
        orgName: org?.name ?? "Unnamed shop",
        otherMemberCount: others.length,
      });
    }
    return blocking;
  },
});
