import type { Doc } from "../_generated/dataModel";

// Role lives on the membership, not the global user.
export type Role = Doc<"memberships">["role"];

/**
 * Maps a Clerk organization role claim (e.g. "org:admin") to our schema role.
 *
 * Clerk's defaults: creators get `org:admin`, invitees get `org:member`.
 * The user creates ONE custom Clerk role, `org:manager`, for the middle tier.
 *
 * Mapping:
 *   org:admin   → superAdmin   (shop owner / creator — Clerk default for creators)
 *   org:manager → admin        (custom role; can edit but not hard-delete)
 *   org:member  → staff        (default invitee role — own appointments only)
 *   org:staff   → staff        (alias if the customer prefers naming it that)
 */
export function mapClerkOrgRole(orgRole: string | undefined | null): Role {
  if (!orgRole) return "staff";
  const stripped = orgRole.startsWith("org:") ? orgRole.slice(4) : orgRole;
  if (stripped === "admin") return "superAdmin";
  if (stripped === "manager") return "admin";
  return "staff";
}
