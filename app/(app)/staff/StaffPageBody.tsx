"use client";

import { useState } from "react";
import { InviteMemberForm } from "@/components/staff/InviteMemberForm";
import { MemberList } from "@/components/staff/MemberList";
import { PendingInvitationsList } from "@/components/staff/PendingInvitationsList";

/**
 * Thin client wrapper that wires a refresh signal from the invite form to the
 * pending-invitations list. The server-side staff page composes this so the
 * auth check stays on the server.
 */
export function StaffPageBody(_props: { children?: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <InviteMemberForm onInvited={() => setRefreshKey((value) => value + 1)} />
      <PendingInvitationsList refreshKey={refreshKey} />
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Active members
          </h2>
        </header>
        <MemberList />
      </section>
    </div>
  );
}
