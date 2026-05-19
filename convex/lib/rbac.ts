import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";
import { mapClerkOrgRole, type Role } from "./roles";
import type { AuthedIdentity } from "./tenant";
import { requireAuth } from "./tenant";

/**
 * Asserts the caller has one of the allowed roles in the active org.
 * Returns the authed identity with the resolved role attached so callers
 * can branch on it without re-reading the JWT.
 *
 * Roles map from Clerk's `org_role` claim:
 *   - `org:admin`   (Clerk default for creators) → `superAdmin`
 *   - `org:manager` (custom)                     → `admin`
 *   - `org:member`  (Clerk default invitee role) → `staff`
 *
 * Authoritative: this check reads the JWT, not the Convex `memberships` row,
 * so it's not subject to webhook lag.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowed: ReadonlyArray<Role>,
): Promise<AuthedIdentity & { role: Role }> {
  const identity = await requireAuth(ctx);
  const role = mapClerkOrgRole(identity.orgRole);
  if (!allowed.includes(role)) {
    appError("FORBIDDEN", { reason: "ROLE_NOT_PERMITTED", role, allowed });
  }
  return Object.assign(identity, { role });
}
