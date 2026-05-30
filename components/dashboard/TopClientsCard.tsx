"use client";

import { useQuery } from "convex/react";
import { Crown } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Top 5 clients by spend this month. Enterprise+ AND owner-only — the
 * query refuses non-superAdmin callers entirely (returns []). The parent
 * `DashboardBody` hides this card from non-owners regardless.
 */
export function TopClientsCard() {
  const rows = useQuery(api.dashboard.topClientsMonth, {});
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Crown size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Top clients by spend
        </h3>
      </header>
      {rows === undefined ? (
        <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No paid appointments yet this month.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li
              key={row.clientId}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </span>
                <p className="truncate text-zinc-900 dark:text-zinc-100">{row.name}</p>
              </div>
              <div className="flex shrink-0 items-baseline gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{row.visitCount} visits</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(row.totalCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>
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
