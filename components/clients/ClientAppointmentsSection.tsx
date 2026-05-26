"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { MapPin, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppointmentDialog } from "@/components/calendar/AppointmentDialog";
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
  declined:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  checkedIn: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  inProgress: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  noShow: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  cancelled: "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

export function ClientAppointmentsSection({
  clientId,
}: {
  clientId: Id<"clients">;
}) {
  const appointments = useQuery(api.appointments.listForClient, { clientId });
  const { locations } = useCurrentLocation();
  // Show the location chip per row only when the org has multiple locations
  // — single-location shops would just see "Main" repeated.
  const showLocation = locations.length > 1;
  const [dialog, setDialog] = useState<
    | { mode: "new" }
    | { mode: "edit"; id: Id<"appointments"> }
    | null
  >(null);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Appointment history
        </h2>
        <button
          type="button"
          onClick={() => setDialog({ mode: "new" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={14} />
          Book appointment
        </button>
      </div>
      {appointments === undefined ? (
        <HistorySkeleton />
      ) : appointments.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No appointments yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {appointments.map((appointment) => (
            <li
              key={appointment._id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-900"
              onClick={() => setDialog({ mode: "edit", id: appointment._id })}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {appointment.petName} · {appointment.serviceName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDateTime(appointment.startTime)} · with{" "}
                  {appointment.staffName}
                </p>
                {showLocation && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <MapPin size={11} aria-hidden className="text-zinc-400" />
                    {appointment.locationName}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_TONE[appointment.status] ?? STATUS_TONE.scheduled
                }`}
              >
                {STATUS_LABEL[appointment.status] ?? appointment.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      {dialog?.mode === "new" && (
        <AppointmentDialog
          appointmentId="new"
          initialClientId={clientId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.mode === "edit" && (
        <AppointmentDialog
          appointmentId={dialog.id}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function HistorySkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
