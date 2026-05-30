"use client";

import { useQuery } from "convex/react";
import { CalendarCheck2 } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Next three appointments today (not started yet). Replaces the same-named
 * card that used to live under the calendar; it's a dashboard concern, not
 * a calendar concern.
 */
export function UpcomingTodayCard() {
  const rows = useQuery(api.dashboard.upcomingToday, {});
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-[#00273c] dark:bg-sky-950/40 dark:text-sky-200">
          <CalendarCheck2 size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Upcoming today
        </h3>
      </header>
      {rows === undefined ? (
        <ul className="flex flex-col gap-2">
          {[0, 1, 2].map((index) => (
            <li
              key={index}
              className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
            />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Nothing else booked for today.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row._id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.serviceColor ?? "#f97316" }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.petName} · {formatTime(row.startTime)}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {row.serviceName} · {row.staffName}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
