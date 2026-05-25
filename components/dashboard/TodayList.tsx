"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useConvexCachedQuery } from "@/lib/offline/useConvexCachedQuery";

const STATUS_TONE: Record<string, string> = {
  pendingApproval:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  declined:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  checkedIn: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  inProgress: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  noShow: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  cancelled: "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

export function TodayList() {
  const start = todayStartMs();
  const end = start + 24 * 60 * 60 * 1000;
  const appointments = useConvexCachedQuery(api.appointments.listInRange, {
    fromTime: start,
    toTime: end,
  });

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Today&apos;s appointments
        </h2>
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          Open calendar
          <ArrowRight size={12} />
        </Link>
      </header>
      {appointments === undefined ? (
        <Skeleton />
      ) : appointments.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Nothing booked for today.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {appointments
            .slice()
            .sort((a, b) => a.startTime - b.startTime)
            .map((appointment) => (
              <li
                key={appointment._id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <Clock size={12} className="text-zinc-400" />
                  {formatTime(appointment.startTime)}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">
                  {appointment.clientName} · {appointment.petName} ·{" "}
                  {appointment.serviceName}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    STATUS_TONE[appointment.status] ?? STATUS_TONE.scheduled
                  }`}
                >
                  {appointment.staffName}
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function todayStartMs(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Skeleton() {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
