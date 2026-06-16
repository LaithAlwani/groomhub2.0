"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, CalendarDays, MapPin, Pencil, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { AppointmentDialog } from "./AppointmentDialog";
import { AppointmentImagesSection } from "./AppointmentImagesSection";
import { AppointmentReleaseSection } from "./AppointmentReleaseSection";
import { AppointmentStatusControl } from "./AppointmentStatusControl";

/**
 * Appointment detail / working page. Hosts the documentation side of an
 * appointment — summary, before/after photos, notes (and release forms in a
 * later phase). Scheduling and status changes still happen in the
 * `AppointmentDialog`, opened from the "Edit" button here.
 */
export function AppointmentDetailBody({
  appointmentId,
}: {
  appointmentId: Id<"appointments">;
}) {
  const appointment = useQuery(api.appointments.get, { id: appointmentId });
  const { current, locations } = useCurrentLocation();
  const showLocation = locations.length > 1;
  const timezone =
    current?.timezone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");
  const [editing, setEditing] = useState(false);

  if (appointment === undefined) return <DetailSkeleton />;
  if (appointment === null) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        This appointment doesn&apos;t exist or you don&apos;t have access to it.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/pets/${appointment.petId}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={14} />
          {appointment.petName}
        </Link>
        <AppointmentStatusControl
          appointmentId={appointment._id}
          status={appointment.status}
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white via-orange-50/30 to-orange-100/40 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-orange-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {appointment.serviceName}
            </h1>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              <Detail icon={<CalendarDays size={14} />}>
                {formatDateTime(appointment.startTime)} –{" "}
                {formatTime(appointment.endTime)}
              </Detail>
              <Detail icon={<User size={14} />}>
                <Link
                  href={`/clients/${appointment.clientId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {appointment.clientName}
                </Link>
                {" · "}
                <Link
                  href={`/pets/${appointment.petId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {appointment.petName}
                </Link>
                {" · "}
                {appointment.staffName}
              </Detail>
              {showLocation && (
                <Detail icon={<MapPin size={14} />}>
                  {appointment.locationName}
                </Detail>
              )}
            </dl>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
        {appointment.notes && (
          <p className="mt-4 whitespace-pre-line rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
            {appointment.notes}
          </p>
        )}
      </section>

      <div className="mt-8">
        <AppointmentImagesSection
          appointmentId={appointment._id}
          before={appointment.beforeImages}
          after={appointment.afterImages}
        />
      </div>

      <AppointmentReleaseSection
        appointmentId={appointment._id}
        petId={appointment.petId}
      />

      {editing && (
        <AppointmentDialog
          appointmentId={appointment._id}
          locationTimezone={timezone}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function Detail({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <dd className="flex items-center gap-2">
      <span className="text-zinc-400" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </dd>
  );
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-48 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
