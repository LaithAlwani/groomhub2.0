"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AddFAB } from "@/components/app/AddFAB";
import { InviteMemberDialog } from "@/components/staff/InviteMemberDialog";
import { MemberList } from "@/components/staff/MemberList";
import { PendingInvitationsList } from "@/components/staff/PendingInvitationsList";

/**
 * Staff page body. Owns the page header (title + invite button), the
 * invite-member dialog state, and stacks the pending-invitations + active-
 * members cards. Mobile shows the orange "+ Invite member" FAB instead of
 * the top button — same pattern as the other list pages.
 */
export function StaffPageBody() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Realtime active-members count. This subscribes to the same query
  // `MemberList` already uses, so the Convex client dedupes it — no extra
  // subscription cost. When the count changes (an invite was accepted, or a
  // member was removed), it nudges the non-realtime Clerk invitations list to
  // refetch so accepted invites drop off without a manual refresh.
  const members = useQuery(api.memberships.forOrg, {});
  const memberCount = members?.length ?? 0;
  // `refreshKey` covers "invite just sent"; `memberCount` covers "invite
  // accepted / member removed". Either change refetches the invitations list.
  const revalidateSignal = `${refreshKey}:${memberCount}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Staff
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="hidden items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 min-[874px]:inline-flex"
        >
          <Plus size={14} />
          Invite member
        </button>
      </header>

      <PendingInvitationsList revalidateSignal={revalidateSignal} />
      <MemberList />

      <AddFAB label="Invite member" onClick={() => setInviteOpen(true)} />

      {inviteOpen && (
        <InviteMemberDialog
          onClose={() => setInviteOpen(false)}
          onInvited={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  );
}
