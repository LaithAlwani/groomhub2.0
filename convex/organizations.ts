import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError } from "./lib/errors";
import { requireRole } from "./lib/rbac";
import { softAuth } from "./lib/tenant";
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
    // Treat soft-deleted orgs as gone — the slug is immediately free for
    // a new shop to claim while we wait the 30-day grace before hard-delete.
    if (!org || org.deletedAt !== undefined) return null;
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;
    return {
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      currency: org.currency,
      logoUrl,
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
    // Soft-deleted orgs free their slug immediately (no grace period). The
    // 30-day delay before hard-delete is purely for audit-trail latitude.
    if (existing && existing.deletedAt === undefined) {
      return { ok: false as const, code: "SLUG_TAKEN" as const };
    }
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
    logoStorageId: v.optional(v.id("_storage")),
    contactEmail: v.optional(v.string()),
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
    // If the slug belongs to a soft-deleted org, treat it as free — but
    // rename the soft-deleted row's slug so the index doesn't keep two
    // rows pointing at the same value. The mangled name keeps support
    // recovery possible (data is still readable by clerkOrgId) until the
    // cron hard-deletes it after the grace period.
    if (
      slugOwner &&
      slugOwner.clerkOrgId !== args.clerkOrgId &&
      slugOwner.deletedAt !== undefined
    ) {
      await ctx.db.patch(slugOwner._id, {
        slug: `deleted-${slugOwner.deletedAt}-${slugOwner.slug}`,
      });
    } else if (slugOwner && slugOwner.clerkOrgId !== args.clerkOrgId) {
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
        logoStorageId: args.logoStorageId ?? existing.logoStorageId,
        contactEmail: args.contactEmail?.trim() || existing.contactEmail,
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
      plan: "essential",
      logoStorageId: args.logoStorageId,
      contactEmail: args.contactEmail?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

/**
 * Generates a one-shot Convex Storage upload URL for the shop logo during
 * onboarding. Requires only that the caller be signed in to Clerk — they
 * don't have an org context yet (that's what we're creating). The returned
 * URL is short-lived; the storageId returned to the client gets handed to
 * `seedFromClerk` on org creation.
 */
export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) appError("UNAUTHENTICATED");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Returns the active org row for the caller, or null while auth is in flight
 * (e.g. org switch). Used by `/settings/shop` to prefill the form.
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) =>
        index.eq("clerkOrgId", identity.orgId),
      )
      .unique();
    if (!org || org.deletedAt !== undefined) return null;
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;
    return { ...org, logoUrl };
  },
});

/**
 * Update the shop's customer-facing contact info. Admin / superAdmin only.
 * Values are written as digits-only (phone) or trimmed (email); blank strings
 * clear the field so the email footer / Reply-To header omit it.
 */
export const updateContact = mutation({
  args: {
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) => index.eq("clerkOrgId", orgId))
      .unique();
    if (!org) appError("NOT_FOUND", { reason: "ORG_NOT_FOUND" });
    const trimmedEmail = args.contactEmail?.trim() ?? "";
    if (trimmedEmail.length > 0 && !trimmedEmail.includes("@")) {
      appError("VALIDATION", { field: "contactEmail", reason: "INVALID" });
    }
    const digitsOnly = (args.contactPhone ?? "").replace(/\D/g, "");
    await ctx.db.patch(org._id, {
      contactEmail: trimmedEmail || undefined,
      contactPhone: digitsOnly || undefined,
    });
  },
});
