"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Mail } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  "org:admin": "Owner",
  "org:manager": "Admin",
  "org:member": "Staff",
};

// Coloured pill tone per Clerk role string. Matches the new design's
// uppercase chip vocabulary (light blue for ADMIN/STAFF, orange for OWNER).
const ROLE_TONE: Record<string, string> = {
  "org:admin":
    "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  "org:manager":
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "org:member":
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
};

export function PendingInvitationsList({ refreshKey }: { refreshKey: number }) {
  const { invitations } = useOrganization({
    invitations: { infinite: false, pageSize: 50 },
  });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Re-fetch when an invite is sent so the new pending row appears.
  // Clerk's pagination cache sometimes lags otherwise.
  void refreshKey;

  if (!invitations) return null;

  const pending = invitations.data ?? [];
  if (pending.length === 0) return null;

  async function handleRevoke(invitationId: string) {
    if (!invitations) return;
    const target = invitations.data?.find((row) => row.id === invitationId);
    if (!target) return;
    setRevokingId(invitationId);
    try {
      await target.revoke();
      await invitations.revalidate?.();
    } catch (caught) {
      // eslint-disable-next-line no-console
      console.error("Could not revoke invitation", caught);
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Pending invitations
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          People you&apos;ve invited who haven&apos;t accepted yet.
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {pending.map((invitation) => {
          const roleLabel = ROLE_LABEL[invitation.role] ?? invitation.role;
          const roleTone =
            ROLE_TONE[invitation.role] ??
            "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
          return (
            <li
              key={invitation.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  <Mail size={16} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {invitation.emailAddress}
                  </span>
                  <span
                    className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleTone}`}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={revokingId === invitation.id}
                onClick={() => handleRevoke(invitation.id)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {revokingId === invitation.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
