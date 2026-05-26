"use client";

import { useState } from "react";
import { InviteMemberForm } from "@/components/staff/InviteMemberForm";
import { MemberList } from "@/components/staff/MemberList";
import { PendingInvitationsList } from "@/components/staff/PendingInvitationsList";

/**
 * Thin client wrapper that wires a refresh signal from the invite form to the
 * pending-invitations list. Each child renders its own card so the page just
 * stacks them with a consistent gap.
 */
export function StaffPageBody() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <InviteMemberForm onInvited={() => setRefreshKey((value) => value + 1)} />
      <PendingInvitationsList refreshKey={refreshKey} />
      <MemberList />
    </div>
  );
}
