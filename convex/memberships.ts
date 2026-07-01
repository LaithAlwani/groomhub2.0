import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/rbac";
import { readOrgClaims, softAuth } from "./lib/tenant";

/**
 * Returns all active memberships in the caller's current org, joined with
 * the matching `users` row so the UI can show name + email + avatar.
 *
 * Used by future pages like `/staff` to list groomers, and by appointment
 * dialogs that need a staff picker.
 */
export const forOrg = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const claims = readOrgClaims(identity);
    if (!claims) return [];
    return await readMembersWithUsers(ctx, claims.orgId, true);
  },
});

/**
 * Same shape as `forOrg` but returns memberships where `isActive: false` too
 * — used by the "View N more inactive members" toggle on the team page so
 * removed staff can be re-invited or audited. Read-only; never mutates.
 */
export const forOrgIncludingInactive = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const claims = readOrgClaims(identity);
    if (!claims) return [];
    return await readMembersWithUsers(ctx, claims.orgId, false);
  },
});

async function readMembersWithUsers(
  ctx: QueryCtx,
  orgId: string,
  activeOnly: boolean,
): Promise<
  Array<{ membership: Doc<"memberships">; user: Doc<"users">; isOwner: boolean }>
> {
  // The shop's original creator — protected from removal / role change on the
  // team page. Falls back to "nobody" for pre-backfill orgs.
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgId))
    .unique();
  const creatorClerkUserId = org?.creatorClerkUserId;
  const rows = activeOnly
    ? await ctx.db
        .query("memberships")
        .withIndex("by_org_active", (index) =>
          index.eq("orgId", orgId).eq("isActive", true),
        )
        .collect()
    : [
        ...(await ctx.db
          .query("memberships")
          .withIndex("by_org_active", (index) =>
            index.eq("orgId", orgId).eq("isActive", true),
          )
          .collect()),
        ...(await ctx.db
          .query("memberships")
          .withIndex("by_org_active", (index) =>
            index.eq("orgId", orgId).eq("isActive", false),
          )
          .collect()),
      ];
  const results: Array<{
    membership: Doc<"memberships">;
    user: Doc<"users">;
    isOwner: boolean;
  }> = [];
  for (const membership of rows) {
    const user = await ctx.db.get(membership.userId);
    if (user) {
      results.push({
        membership,
        user,
        isOwner:
          creatorClerkUserId !== undefined &&
          user.clerkUserId === creatorClerkUserId,
      });
    }
  }
  return results;
}

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

/**
 * Records the inviting admin's location intent for a fresh invite. Called by
 * `InviteMemberDialog` BEFORE Clerk's `organization.inviteMember()` so the
 * subsequent `organizationMembership.created` webhook can apply these
 * `locationIds` to the new membership row.
 *
 * Admin / superAdmin only. Idempotent: a second call for the same
 * `(orgId, email)` patches the existing intent rather than duplicating.
 * Pass `locationIds: []` to mean "all locations" (won't restrict the staff).
 */
export const recordInviteIntent = mutation({
  args: {
    email: v.string(),
    locationIds: v.array(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      appError("VALIDATION", { field: "email", reason: "INVALID" });
    }
    // Validate every locationId belongs to the caller's org.
    for (const locationId of args.locationIds) {
      const location = await ctx.db.get(locationId);
      if (!location || location.orgId !== orgId) {
        appError("FORBIDDEN", { reason: "LOCATION_WRONG_ORG" });
      }
    }
    const existing = await ctx.db
      .query("staffInviteIntents")
      .withIndex("by_org_email", (index) =>
        index.eq("orgId", orgId).eq("email", email),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { locationIds: args.locationIds });
      return existing._id;
    }
    return await ctx.db.insert("staffInviteIntents", {
      orgId,
      email,
      locationIds: args.locationIds,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update which locations an existing membership is assigned to. Used by the
 * `/staff` page when an admin wants to add a groomer to a second location or
 * remove them from one. `locationIds: []` means "all locations" (default for
 * admins and the org creator).
 *
 * Admin / superAdmin only. Refuses cross-org IDs and refuses to demote a
 * superAdmin from "all locations" — superAdmins always see everything.
 */
export const setLocations = mutation({
  args: {
    membershipId: v.id("memberships"),
    locationIds: v.array(v.id("locations")),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const target = await ctx.db.get(args.membershipId);
    if (!target || target.orgId !== orgId) {
      appError("NOT_FOUND", { reason: "MEMBERSHIP_NOT_FOUND" });
    }
    if (target.role === "superAdmin" && args.locationIds.length > 0) {
      appError("VALIDATION", { reason: "SUPERADMIN_ALWAYS_ALL_LOCATIONS" });
    }
    for (const locationId of args.locationIds) {
      const location = await ctx.db.get(locationId);
      if (!location || location.orgId !== orgId) {
        appError("FORBIDDEN", { reason: "LOCATION_WRONG_ORG" });
      }
    }
    await ctx.db.patch(target._id, { locationIds: args.locationIds });
  },
});
