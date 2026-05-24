"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarCheck2,
  MoreVertical,
} from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Three bento info cards beneath the calendar — Upcoming Today (wired),
 * Salon Health + Critical Alerts (placeholder until analytics + alerts ship).
 */
export function CalendarBentoCards() {
  const { fromTime, toTime } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { fromTime: start.getTime(), toTime: end.getTime() };
  }, []);
  const today = useQuery(api.appointments.listInRange, { fromTime, toTime });
  const upcoming = useMemo(() => {
    if (!today) return [];
    const nowMs = Date.now();
    return today
      .filter((row) => row.startTime >= nowMs)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
  }, [today]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <UpcomingTodayCard rows={upcoming} loading={today === undefined} />
      <SalonHealthCard />
      <CriticalAlertsCard />
    </div>
  );
}

type UpcomingRow = {
  _id: string;
  petName: string;
  serviceName: string;
  staffName: string;
  startTime: number;
  serviceColor?: string;
};

function UpcomingTodayCard({
  rows,
  loading,
}: {
  rows: ReadonlyArray<UpcomingRow>;
  loading: boolean;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-[#00273c] dark:bg-sky-950/40 dark:text-sky-200">
          <CalendarCheck2 size={18} />
        </span>
        <h3 className="text-lg font-semibold text-[#00273c] dark:text-zinc-50">
          Upcoming Today
        </h3>
      </header>
      {loading ? (
        <ul className="flex flex-col gap-2">
          {[0, 1].map((index) => (
            <li
              key={index}
              className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
            />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nothing else booked for today.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row._id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition-colors hover:border-[#00273c]/30 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.serviceColor ?? "#f97316" }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#00273c] dark:text-zinc-50">
                    {row.petName} · {formatTime(row.startTime)}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {row.serviceName} · {row.staffName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="More options"
                className="text-zinc-400 transition-colors hover:text-[#00273c] dark:hover:text-zinc-200"
              >
                <MoreVertical size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function SalonHealthCard() {
  // TODO: wire to real analytics (occupancy = booked-mins / available-mins).
  const occupancy = 84;
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-[#00273c] dark:bg-sky-950/40 dark:text-sky-200">
            <BarChart3 size={18} />
          </span>
          <h3 className="text-lg font-semibold text-[#00273c] dark:text-zinc-50">
            Salon Health
          </h3>
        </div>
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          +12%
        </span>
      </header>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <div className="flex items-end justify-between">
          <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Occupancy Rate
          </p>
          <p className="text-2xl font-semibold text-[#00273c] dark:text-zinc-50">
            {occupancy}%
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
          <div
            className="h-full rounded-full bg-[#00273c] dark:bg-sky-400"
            style={{ width: `${occupancy}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          You have 4 slots remaining for tomorrow.
        </p>
      </div>
    </article>
  );
}

function CriticalAlertsCard() {
  // TODO: wire to real alerts (overlap detection, expired vaccinations, etc.).
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-[#00273c] dark:bg-sky-950/40 dark:text-sky-200">
          <Bell size={18} />
        </span>
        <h3 className="text-lg font-semibold text-[#00273c] dark:text-zinc-50">
          Critical Alerts
        </h3>
      </header>
      <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-900 dark:bg-red-950/40 dark:text-red-200">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-semibold">No critical issues</p>
          <p className="mt-0.5 text-xs opacity-80">
            Overlap detection and vaccination expiries surface here.
          </p>
        </div>
      </div>
      <Link
        href="#"
        className="mt-auto inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-orange-700 transition-colors hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
      >
        View all notifications
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
