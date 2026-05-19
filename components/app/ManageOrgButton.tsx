"use client";

import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { mapClerkOrgRole } from "@/convex/lib/roles";

/**
 * Topbar shortcut to the staff management page.
 * Visible only to admin / superAdmin members of the active org.
 */
export function ManageOrgButton() {
  const { membership, isLoaded } = useOrganization();
  if (!isLoaded || !membership) return null;

  const role = mapClerkOrgRole(membership.role);
  if (role !== "admin" && role !== "superAdmin") return null;

  return (
    <Link
      href="/staff"
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
    >
      <Settings size={14} className="text-zinc-500 dark:text-zinc-400" />
      Manage
    </Link>
  );
}
