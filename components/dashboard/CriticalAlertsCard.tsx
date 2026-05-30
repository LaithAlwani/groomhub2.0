"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { AlertTriangle, Bell } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Surfaces three operational red-flags: expired vaccinations, banned pets,
 * deceased pets that may still have future bookings. Replaces the
 * "No critical issues" placeholder that used to live under the calendar.
 */
export function CriticalAlertsCard() {
  const data = useQuery(api.dashboard.criticalAlerts, {});
  const totalAlerts =
    (data?.expiredVaccinations.length ?? 0) +
    (data?.bannedPets.length ?? 0) +
    (data?.deceasedPets.length ?? 0);
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Bell size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Critical alerts
        </h3>
      </header>
      {data === undefined ? (
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : totalAlerts === 0 ? (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="text-sm font-medium">All clear — no alerts today.</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.expiredVaccinations.slice(0, 5).map((alert) => (
            <li
              key={`${alert.petId}-${alert.vaccineName}`}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/30"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
              <Link
                href={`/clients`}
                className="min-w-0 flex-1 text-zinc-700 hover:underline dark:text-zinc-200"
              >
                <span className="font-semibold">{alert.petName}</span>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  · {alert.vaccineName} expired {alert.expiresOn}
                </span>
              </Link>
            </li>
          ))}
          {data.bannedPets.map((alert) => (
            <li
              key={`banned-${alert.petId}`}
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm dark:border-red-900/40 dark:bg-red-950/30"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
              <span className="text-zinc-700 dark:text-zinc-200">
                <span className="font-semibold">{alert.petName}</span> is flagged as banned
              </span>
            </li>
          ))}
          {data.deceasedPets.map((alert) => (
            <li
              key={`deceased-${alert.petId}`}
              className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden />
              <span className="text-zinc-700 dark:text-zinc-200">
                <span className="font-semibold">{alert.petName}</span> is marked deceased
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
