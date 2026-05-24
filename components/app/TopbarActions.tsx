"use client";

import Link from "next/link";
import { useOrganization, useUser } from "@clerk/nextjs";
import { Bell, HelpCircle } from "lucide-react";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { UserMenu } from "./UserMenu";

const ROLE_LABEL: Record<string, string> = {
  superAdmin: "Salon Owner",
  admin: "Salon Manager",
  staff: "Groomer",
};

/**
 * Desktop topbar cluster — bell + help icons (placeholders for future
 * notifications + in-app help) on the left of the user pod; on the right a
 * compact name + role label paired with the existing `UserMenu` avatar. On
 * mobile the topbar shows only the avatar (the bell/help icons collapse) to
 * keep the bar uncluttered alongside the burger + shop name.
 */
export function TopbarActions() {
  const { membership } = useOrganization();
  const { user } = useUser();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const roleLabel = ROLE_LABEL[role] ?? "Team member";
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Notifications (coming soon)"
        // TODO: wire to in-app notifications inbox once we have one.
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#00273c] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Bell size={18} />
      </button>
      <Link
        href="#"
        aria-label="Help"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-[#00273c] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <HelpCircle size={18} />
      </Link>
      <span
        aria-hidden
        className="hidden h-6 w-px bg-zinc-200 md:block dark:bg-zinc-800"
      />
      {userName && (
        <div className="hidden flex-col text-right leading-tight md:flex">
          <span className="text-sm font-semibold text-[#00273c] dark:text-zinc-50">
            {userName}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {roleLabel}
          </span>
        </div>
      )}
      <UserMenu />
    </div>
  );
}
