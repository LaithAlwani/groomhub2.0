"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

const STATUS_LABEL: Record<string, string> = {
  pendingApproval: "Pending approval",
  declined: "Declined",
  scheduled: "Scheduled",
  checkedIn: "Checked in",
  inProgress: "In progress",
  completed: "Completed",
  noShow: "No-show",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  pendingApproval:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  checkedIn:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  inProgress:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  noShow: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  cancelled:
    "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

/**
 * Appointment history for a single pet (newest first). Same table styling as
 * the client-level history but scoped to one pet, so no pet filter tabs.
 */
export function PetAppointmentsSection({ petId }: { petId: Id<"pets"> }) {
  const allAppointments = useQuery(api.appointments.listForPet, { petId });
  // Completed visits live in the Service History section now.
  const appointments = allAppointments?.filter(
    (row) => row.status !== "completed",
  );
  const router = useRouter();
  const { locations } = useCurrentLocation();
  const showLocation = locations.length > 1;
  const count = appointments?.length ?? 0;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Appointment history
        {appointments !== undefined && (
          <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            {count}
          </span>
        )}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.4fr_1.2fr_0.9fr] items-center gap-2 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>Date &amp; Time</span>
          <span>Service</span>
          <span className="text-right">Status</span>
        </div>
        {appointments === undefined ? (
          <HistorySkeleton />
        ) : appointments.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {appointments.map((appointment) => (
              <li
                key={appointment._id}
                onClick={() => router.push(`/appointments/${appointment._id}`)}
                className="grid cursor-pointer grid-cols-[1.4fr_1.2fr_0.9fr] items-center gap-2 border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDate(appointment.startTime)}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {formatTime(appointment.startTime)}
                  </p>
                  {showLocation && (
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {appointment.locationName}
                    </p>
                  )}
                </div>
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {appointment.serviceName}
                </p>
                <div className="flex justify-end">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_TONE[appointment.status] ?? STATUS_TONE.scheduled
                    }`}
                  >
                    {STATUS_LABEL[appointment.status] ?? appointment.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <CalendarDays size={18} />
      </span>
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        No appointments for this pet yet.
      </p>
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
