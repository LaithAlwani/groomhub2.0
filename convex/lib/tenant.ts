import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { UserIdentity } from "convex/server";
import { appError } from "./errors";

export type AuthedIdentity = UserIdentity & {
  orgId: string;
  orgRole: string;
};

/**
 * Pulls the verified Clerk JWT claims and asserts the user is signed in
 * to a Clerk organization (i.e. has an active shop context).
 *
 * Throws `UNAUTHENTICATED` if no identity; `FORBIDDEN` if signed in but no orgId
 * (a user mid-onboarding before joining any shop).
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthedIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) appError("UNAUTHENTICATED");
  const orgId = (identity.orgId as string | undefined) ?? undefined;
  const orgRole = (identity.orgRole as string | undefined) ?? undefined;
  if (!orgId || !orgRole) appError("FORBIDDEN", { reason: "NO_ORG_CONTEXT" });
  return identity as AuthedIdentity;
}
