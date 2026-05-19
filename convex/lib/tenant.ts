import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { UserIdentity } from "convex/server";
import { appError } from "./errors";

export type AuthedIdentity = UserIdentity & {
  orgId: string;
  orgRole: string;
  orgSlug?: string;
};

/**
 * Extracts the active organisation claims from a Clerk JWT, accepting both
 * snake_case (`org_id`/`org_role`/`org_slug` — the names Clerk's JWT template
 * shortcuts emit) and camelCase (`orgId`/`orgRole`/`orgSlug` — what some
 * older templates or manual configurations use). Convex's `UserIdentity`
 * exposes custom claims under their literal JWT name, so we have to read
 * both forms defensively.
 */
export function readOrgClaims(
  identity: UserIdentity,
): { orgId: string; orgRole: string; orgSlug?: string } | null {
  const orgId =
    (identity["org_id"] as string | undefined) ??
    (identity.orgId as string | undefined);
  const orgRole =
    (identity["org_role"] as string | undefined) ??
    (identity.orgRole as string | undefined);
  if (!orgId || !orgRole) return null;
  const orgSlug =
    (identity["org_slug"] as string | undefined) ??
    (identity.orgSlug as string | undefined);
  return { orgId, orgRole, orgSlug };
}

/**
 * Pulls the verified Clerk JWT claims and asserts the user is signed in to a
 * Clerk organization (i.e. has an active shop context). Returns an identity
 * with `orgId` / `orgRole` resolved to whichever naming convention the JWT
 * used.
 *
 * Throws `UNAUTHENTICATED` if no identity; `FORBIDDEN` if signed in but no
 * org claims (a user mid-onboarding before joining any shop).
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthedIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) appError("UNAUTHENTICATED");
  const claims = readOrgClaims(identity);
  if (!claims) appError("FORBIDDEN", { reason: "NO_ORG_CONTEXT" });
  return Object.assign(identity, claims) as AuthedIdentity;
}
