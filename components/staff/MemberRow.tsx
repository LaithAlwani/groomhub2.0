"use client";

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
  isRemoving,
  canRemove,
  onRemove,
}: {
  member: Doc<"users">;
  link: Doc<"memberships">;
  locations: Doc<"locations">[];
  isMultiLocation: boolean;
  isSelf: boolean;
  isRemoving: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const displayName = nameOrEmail(member);
  const roleLabel = ROLE_LABEL[link.role] ?? link.role;
  const roleTone =
    ROLE_TONE[link.role] ??
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const isInactive = !link.isActive;

  return (
    <li
      className={`flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 first:border-t-0 dark:border-zinc-900 ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <MemberAvatar user={member} />
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
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleTone}`}
        >
          {roleLabel}
        </span>
        {canRemove && !isSelf && !isInactive && (
          <button
            type="button"
            disabled={isRemoving}
            onClick={onRemove}
            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            {isRemoving ? "Removing…" : "Remove"}
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
