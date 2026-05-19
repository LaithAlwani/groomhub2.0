"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Mail } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  "org:admin": "Owner",
  "org:manager": "Admin",
  "org:member": "Staff",
};

export function PendingInvitationsList({ refreshKey }: { refreshKey: number }) {
  const { invitations } = useOrganization({
    invitations: { infinite: false, pageSize: 50 },
  });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Re-fetch when an invite is sent so the new pending row appears.
  // The query is reactive but Clerk's pagination cache sometimes lags.
  // `refreshKey` lets the parent nudge a refetch after `inviteMember`.
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
        {pending.map((invitation) => (
          <li
            key={invitation.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Mail size={16} className="text-zinc-400" />
              <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                {invitation.emailAddress}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {ROLE_LABEL[invitation.role] ?? invitation.role}
              </span>
            </div>
            <button
              type="button"
              disabled={revokingId === invitation.id}
              onClick={() => handleRevoke(invitation.id)}
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {revokingId === invitation.id ? "Revoking…" : "Revoke"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
