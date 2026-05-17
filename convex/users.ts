import { mutation, query } from "./_generated/server";
import {
  ensureMembership,
  readMembershipForQuery,
} from "./lib/ensureMembership";
import type { AuthedIdentity } from "./lib/tenant";

/**
 * Returns the current `{ user, membership }` pair for the active
 * (Clerk user × org). Returns `null` when the user isn't signed in or
 * Convex's cached JWT hasn't yet picked up the active org. Callers should
 * treat `null` as "loading/unknown" and retry on the next render.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const orgId = identity.orgId as string | undefined;
    if (!orgId) return null;
    const { user, membership } = await readMembershipForQuery(
      ctx,
      identity as AuthedIdentity,
    );
    if (!user || !membership) return null;
    return { user, membership };
  },
});

/**
 * Bootstrap mutation: creates either the `users` row or the matching
 * `memberships` row (or both) if missing. Idempotent and forgiving —
 * returns `null` when the JWT lacks `org_id` (next render will retry).
 */
export const ensureMe = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const orgId = identity.orgId as string | undefined;
    const orgRole = identity.orgRole as string | undefined;
    if (!orgId || !orgRole) return null;
    return await ensureMembership(ctx, identity as AuthedIdentity);
  },
});
