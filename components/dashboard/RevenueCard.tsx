"use client";

import { useQuery } from "convex/react";
import { DollarSign } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Today's revenue + paid-count tile. Owner-only by design — this whole
 * card is hidden by `DashboardBody` for non-superAdmin callers. The query
 * itself also enforces the gate (returns `null` for non-owners), so a
 * bypassed UI can't leak the number.
 */
export function RevenueCard() {
  const data = useQuery(api.dashboard.revenueToday, {});
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <DollarSign size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Today&apos;s revenue
        </h3>
      </header>
      {data === undefined ? (
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : data === null ? (
        // Shouldn't render in practice (parent hides for non-owners), but
        // a safe fallback if the role flipped mid-render.
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in as the shop owner to see revenue.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatCurrency(data.revenueCents)}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {data.paidCount} paid · {data.bookedCount} booked today
          </p>
        </div>
      )}
    </article>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
