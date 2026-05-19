"use client";

import { useState } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const ROLE_LABEL: Record<string, string> = {
  superAdmin: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export function MemberList() {
  const members = useQuery(api.memberships.forOrg);
  const { organization } = useOrganization();
  const { user: currentClerkUser } = useUser();

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { clerkUserId: string; displayName: string } | null
  >(null);

  if (members === undefined) return <ListSkeleton />;
  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        No members yet.
      </p>
    );
  }

  async function confirmRemove() {
    if (!organization || !confirmTarget) return;
    const { clerkUserId } = confirmTarget;
    setRemovingId(clerkUserId);
    setRemoveError(null);
    try {
      await organization.removeMember(clerkUserId);
      setConfirmTarget(null);
    } catch (caught) {
      setRemoveError(
        caught instanceof Error ? caught.message : "Could not remove member",
      );
      setConfirmTarget(null);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {members.map((row) => {
          const member = row.user;
          const link = row.membership;
          const displayName = nameOrEmail(member);
          const roleLabel = ROLE_LABEL[link.role] ?? link.role;
          const isSelf = member.clerkUserId === currentClerkUser?.id;
          const isRemoving = removingId === member.clerkUserId;
          return (
            <li
              key={link._id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {displayName}
                  {isSelf && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      (you)
                    </span>
                  )}
                </p>
                {displayName !== member.email && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {member.email}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {roleLabel}
                </span>
                {!isSelf && (
                  <button
                    type="button"
                    disabled={isRemoving || !organization}
                    onClick={() =>
                      setConfirmTarget({
                        clerkUserId: member.clerkUserId,
                        displayName,
                      })
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    {isRemoving ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {removeError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {removeError}
        </p>
      )}
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Remove member?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {confirmTarget.displayName}
              </span>{" "}
              will lose access to this shop immediately. You can re-invite them
              later.
            </>
          )
        }
        confirmLabel="Remove"
        tone="danger"
        busy={removingId !== null}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
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

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
