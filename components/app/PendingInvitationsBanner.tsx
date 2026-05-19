"use client";

import { useState } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { Mail } from "lucide-react";

/**
 * Shows on authed pages when the user has pending organisation invitations.
 * One row per invitation with an Accept button — accepting joins the org and
 * makes it the active session, then reloads to land on the new shop.
 */
export function PendingInvitationsBanner() {
  const { userInvitations, setActive } = useOrganizationList({
    userInvitations: { infinite: false, pageSize: 20 },
  });
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pending = userInvitations?.data ?? [];
  if (pending.length === 0) return null;

  async function handleAccept(invitationId: string) {
    if (!userInvitations || !setActive) return;
    const target = userInvitations.data?.find((row) => row.id === invitationId);
    if (!target) return;
    setAcceptingId(invitationId);
    setErrorMessage(null);
    try {
      await target.accept();
      const orgId = target.publicOrganizationData?.id;
      if (orgId) await setActive({ organization: orgId });
      window.location.assign("/dashboard");
    } catch (caught) {
      setAcceptingId(null);
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : "Could not accept the invitation",
      );
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <header className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          <Mail size={16} />
          You have {pending.length === 1 ? "an invitation" : `${pending.length} invitations`} waiting
        </header>
        <ul className="flex flex-col gap-2">
          {pending.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 dark:border-emerald-900/40 dark:bg-zinc-950"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {invitation.publicOrganizationData?.name ?? "A shop"}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  Role: {invitation.role.replace("org:", "")}
                </p>
              </div>
              <button
                type="button"
                disabled={acceptingId === invitation.id}
                onClick={() => handleAccept(invitation.id)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {acceptingId === invitation.id ? "Joining…" : "Accept"}
              </button>
            </li>
          ))}
        </ul>
        {errorMessage && (
          <p className="mt-3 text-sm text-red-900 dark:text-red-200">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
