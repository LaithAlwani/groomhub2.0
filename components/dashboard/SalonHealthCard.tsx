"use client";

import { useQuery } from "convex/react";
import { BarChart3 } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Salon occupancy this week + slots remaining tomorrow. Professional+.
 * Operationally informative — no financial figures, so no role gate.
 */
export function SalonHealthCard() {
  const data = useQuery(api.dashboard.salonHealth, {});
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-[#00273c] dark:bg-sky-950/40 dark:text-sky-200">
          <BarChart3 size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Salon health
        </h3>
      </header>
      {data === undefined ? (
        <div className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : data === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to view salon health.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Occupancy this week
            </p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {data.occupancyPct}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className="h-full rounded-full bg-[#00273c] dark:bg-sky-400"
              style={{ width: `${data.occupancyPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatMin(data.bookedMin)} booked of {formatMin(data.availableMin)} available ·{" "}
            {formatMin(data.slotsRemainingMinutes)} open tomorrow
          </p>
        </div>
      )}
    </article>
  );
}

function formatMin(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
