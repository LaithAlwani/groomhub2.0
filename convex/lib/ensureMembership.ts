import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mapClerkOrgRole } from "./roles";
import type { AuthedIdentity } from "./tenant";

export type UserAndMembership = {
  user: Doc<"users">;
  membership: Doc<"memberships">;
};

/**
 * Returns the Convex `{ user, membership }` pair for the current
 * (Clerk user × org), creating either record from JWT claims if it's missing.
 * Bootstrap safety net for missed/delayed Clerk webhook deliveries.
 */
export async function ensureMembership(
  ctx: MutationCtx,
  identity: AuthedIdentity,
): Promise<UserAndMembership> {
  const user = await ensureUserRecord(ctx, identity);
  const membership = await ensureMembershipRecord(ctx, user._id, identity);
  return { user, membership };
}

/**
 * Read-only variant for queries. Returns `null` for either record that
 * doesn't exist yet — queries cannot mutate. Callers treat null as
 * "loading/unknown" and retry on a subsequent render.
 */
export async function readMembershipForQuery(
  ctx: QueryCtx,
  identity: AuthedIdentity,
): Promise<UserAndMembership | { user: Doc<"users"> | null; membership: null }> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (index) =>
      index.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) return { user: null, membership: null };

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_org", (index) =>
      index.eq("userId", user._id).eq("orgId", identity.orgId),
    )
    .unique();
  return { user, membership };
}

async function ensureUserRecord(
  ctx: MutationCtx,
  identity: AuthedIdentity,
): Promise<Doc<"users">> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (index) =>
      index.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (existing) return existing;

  const insertedId = await ctx.db.insert("users", {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: identity.subject,
    email: identity.email ?? "",
    firstName: (identity.givenName as string | undefined) ?? "",
    lastName: (identity.familyName as string | undefined) ?? "",
    avatarUrl: identity.pictureUrl ?? undefined,
    isActive: true,
  });
  const inserted = await ctx.db.get(insertedId);
  if (!inserted) throw new Error("ensureUserRecord: inserted row vanished");
  return inserted;
}

async function ensureMembershipRecord(
  ctx: MutationCtx,
  userId: Doc<"users">["_id"],
  identity: AuthedIdentity,
): Promise<Doc<"memberships">> {
  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_user_org", (index) =>
      index.eq("userId", userId).eq("orgId", identity.orgId),
    )
    .unique();
  if (existing) {
    // If this user was previously removed from the org and just rejoined,
    // reactivate the row rather than orphan it. The Clerk JWT proves they're
    // an active member right now, so the row should reflect that.
    const role = mapClerkOrgRole(identity.orgRole);
    if (!existing.isActive || existing.role !== role) {
      await ctx.db.patch(existing._id, { isActive: true, role });
      const refreshed = await ctx.db.get(existing._id);
      if (!refreshed) throw new Error("ensureMembershipRecord: patched row vanished");
      return refreshed;
    }
    return existing;
  }

  const role = mapClerkOrgRole(identity.orgRole);
  const insertedId = await ctx.db.insert("memberships", {
    userId,
    orgId: identity.orgId,
    role,
    isActive: true,
  });
  const inserted = await ctx.db.get(insertedId);
  if (!inserted) throw new Error("ensureMembershipRecord: inserted row vanished");
  return inserted;
}
