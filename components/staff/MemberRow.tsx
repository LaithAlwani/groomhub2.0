"use client";

import { Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { MemberAvatar } from "./MemberAvatar";
import { MemberLocationsEditor } from "./MemberLocationsEditor";

const ROLE_LABEL: Record<string, string> = {
  superAdmin: "Owner",
  admin: "Admin",
  staff: "Staff",
};

// Coloured pill tone per schema role — matches the new team page's
// uppercase chip vocabulary (orange Owner, blue Admin, cyan Staff).
const ROLE_TONE: Record<string, string> = {
  superAdmin:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  admin: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  staff: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
};

/**
 * One row of the Active / Inactive members list. Avatar + name on the left,
 * location chip + role badge + Remove button on the right. Inactive members
 * dim out and don't show the Remove button (already gone).
 */
export function MemberRow({
  member,
  link,
  locations,
  isMultiLocation,
  isSelf,
  isOwner,
  isRemoving,
  canManage,
  isChangingRole,
  onChangeRole,
  onRemove,
}: {
  member: Doc<"users">;
  link: Doc<"memberships">;
  locations: Doc<"locations">[];
  isMultiLocation: boolean;
  isSelf: boolean;
  // The shop's original creator — never removable or demotable.
  isOwner: boolean;
  isRemoving: boolean;
  // Caller is an admin/superAdmin who may change roles + remove others.
  canManage: boolean;
  isChangingRole: boolean;
  onChangeRole: (clerkRoleKey: string) => void;
  onRemove: () => void;
}) {
  const displayName = nameOrEmail(member);
  const roleLabel = ROLE_LABEL[link.role] ?? link.role;
  const roleTone =
    ROLE_TONE[link.role] ??
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const isInactive = !link.isActive;
  // A compact role dropdown replaces the static badge for members the caller
  // can manage — excluding the owner (protected) and yourself (no self-demote).
  // superAdmins that aren't the founder keep the static badge; promoting new
  // owners isn't offered here.
  const canEditRole =
    canManage &&
    !isOwner &&
    !isSelf &&
    !isInactive &&
    (link.role === "admin" || link.role === "staff");
  const showRemove = canManage && !isSelf && !isInactive && !isOwner;

  return (
    <li
      className={`flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 first:border-t-0 dark:border-zinc-900 ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* Avatar + role badge: pill is absolutely positioned so it
            overlaps the bottom edge of the avatar — reads as a "title"
            label tucked under the photo, not a separate row element. */}
        <div className="relative shrink-0 pb-2.5">
          <MemberAvatar user={member} />
          <span
            className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm ring-2 ring-white dark:ring-zinc-950 ${roleTone}`}
          >
            {roleLabel}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {displayName}
            {isSelf && (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                (you)
              </span>
            )}
            {isInactive && (
              <span className="ml-2 text-xs font-normal text-zinc-500">
                (removed)
              </span>
            )}
          </p>
          {displayName !== member.email && member.email && (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {member.email}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isMultiLocation && (
          <MemberLocationsEditor membership={link} locations={locations} />
        )}
        {canEditRole && (
          <select
            value={link.role === "admin" ? "org:manager" : "org:member"}
            disabled={isChangingRole}
            onChange={(event) => onChangeRole(event.target.value)}
            aria-label="Change role"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#00273c] focus:outline-none focus:ring-2 focus:ring-[#00273c]/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="org:manager">Admin</option>
            <option value="org:member">Staff</option>
          </select>
        )}
        {showRemove && (
          <button
            type="button"
            disabled={isRemoving}
            onClick={onRemove}
            aria-label={isRemoving ? "Removing…" : "Remove member"}
            title="Remove member"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </li>
  );
}

function nameOrEmail(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const fullName = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  return fullName || user.email || "Unnamed member";
}
