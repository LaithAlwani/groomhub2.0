"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Sidebar pill that surfaces how many days are left in the org's 14-day free
 * trial. Only renders during the trial — once `trialEndsAt` has passed it
 * disappears (and the effective plan falls back to whatever subscription
 * exists, or `essential`). Admin-only audience — staff don't see billing nudges.
 *
 * Day count is frozen to mount time so the render stays pure; a fresh
 * navigation re-reads the clock, which is more than precise enough for a
 * "days left" pill.
 */
export function TrialBanner({ canManageBilling }: { canManageBilling: boolean }) {
  const org = useQuery(api.organizations.getCurrent);
  const [nowAtMount] = useState(() => Date.now());
  if (!canManageBilling) return null;
  if (!org || !org.isTrialing || org.trialEndsAt === undefined) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((org.trialEndsAt - nowAtMount) / 86_400_000),
  );

  return (
    <Link
      href="/settings/billing"
      className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-900 transition-colors hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100 dark:hover:bg-orange-950/50"
    >
      <Sparkles size={14} className="shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {daysLeft} {daysLeft === 1 ? "day" : "days"} left in trial
        </p>
        <p className="mt-0.5 text-[11px] text-orange-700/90 dark:text-orange-300/80">
          Pick a plan to keep Pro features
        </p>
      </div>
    </Link>
  );
}
