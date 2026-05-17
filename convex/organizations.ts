import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError } from "./lib/errors";
import { validateSlugShape } from "./lib/reservedSlugs";

/**
 * Public unauthenticated query — returns minimal org info for the v2 client
 * portal (`/<shopSlug>`). Returns null if no shop with that slug exists.
 * No PII; safe for unauthenticated callers.
 */
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (index) => index.eq("slug", slug))
      .unique();
    if (!org) return null;
    return {
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      currency: org.currency,
      logoUrl: org.logoUrl ?? null,
      primaryColor: org.primaryColor ?? null,
    };
  },
});

/**
 * Live slug-availability check for the shop onboarding wizard.
 * Returns `{ ok: true }` if the slug passes shape validation and is unclaimed,
 * otherwise `{ ok: false, code }` so the UI can render the right hint.
 */
export const isSlugAvailable = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const lowerSlug = slug.toLowerCase();
    const shape = validateSlugShape(lowerSlug);
    if (!shape.ok) return { ok: false as const, code: shape.code };
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (index) => index.eq("slug", lowerSlug))
      .unique();
    if (existing) return { ok: false as const, code: "SLUG_TAKEN" as const };
    return { ok: true as const };
  },
});

/**
 * Called by the onboarding wizard right after `useOrganizationList().createOrganization`.
 * The caller passes the new Clerk orgId explicitly because Convex's cached
 * JWT may not yet reflect `setActive` (the org_id claim is still stale).
 *
 * Authorization:
 *   - Caller must be authenticated with any Clerk session.
 *   - If a `users` row already exists for (caller, clerkOrgId), the caller is
 *     a verified member and we patch.
 *   - Otherwise the org has just been created and no webhook has fired yet;
 *     we insert. A future webhook for `organization.created` /
 *     `organizationMembership.created` will reconcile, and any subsequent
 *     re-seed by a non-member will fail the membership check above.
 *
 * Idempotent — re-running with the same clerkOrgId patches.
 */
export const seedFromClerk = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) appError("UNAUTHENTICATED");

    const lowerSlug = args.slug.toLowerCase();
    const shape = validateSlugShape(lowerSlug);
    if (!shape.ok) appError(shape.code);

    const slugOwner = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (index) => index.eq("slug", lowerSlug))
      .unique();
    if (slugOwner && slugOwner.clerkOrgId !== args.clerkOrgId) {
      appError("SLUG_TAKEN");
    }

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (existing) {
      // Membership check via the (post-2.5) split tables: find the caller's
      // `users` row, then look for a matching `memberships` row in this org.
      const callerUser = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (index) =>
          index.eq("tokenIdentifier", identity.tokenIdentifier),
        )
        .unique();
      const membership = callerUser
        ? await ctx.db
            .query("memberships")
            .withIndex("by_user_org", (index) =>
              index.eq("userId", callerUser._id).eq("orgId", args.clerkOrgId),
            )
            .unique()
        : null;
      if (!membership) appError("FORBIDDEN", { reason: "NOT_MEMBER" });

      await ctx.db.patch(existing._id, {
        name: args.name,
        slug: lowerSlug,
        timezone: args.timezone,
        currency: args.currency,
      });
      return existing._id;
    }

    // Org row doesn't exist yet — the Clerk webhook hasn't reached us.
    // The caller is authenticated and just created this org in Clerk; trust
    // the call. The webhook will eventually arrive and reconcile name/slug.
    return await ctx.db.insert("organizations", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: lowerSlug,
      timezone: args.timezone,
      currency: args.currency,
      plan: "free",
      createdAt: Date.now(),
    });
  },
});
