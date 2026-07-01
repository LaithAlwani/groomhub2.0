"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { ArrowLeft, CalendarDays, MapPin, Pencil, User } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { EditVisitDialog } from "./EditVisitDialog";
import { AppointmentImagesSection } from "./AppointmentImagesSection";
import { AppointmentReleaseSection } from "./AppointmentReleaseSection";
import { AppointmentStatusControl } from "./AppointmentStatusControl";
import {
  AppointmentDetailSkeleton,
  Detail,
  formatDateTime,
  formatMoney,
  formatTime,
} from "./appointmentDetailParts";

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
  const me = useQuery(api.users.me);
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const { locations } = useCurrentLocation();
  const showLocation = locations.length > 1;
  const [editing, setEditing] = useState(false);

  if (appointment === undefined) return <AppointmentDetailSkeleton />;
  if (appointment === null) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        This appointment doesn&apos;t exist or you don&apos;t have access to it.
      </p>
    );
  }

  // Editing opens the dialog, whose slot picker reads the assigned groomer's
  // availability — staff may only view their own. So only admins or the
  // assigned groomer can edit; others just see a note.
  const canEdit =
    role === "admin" ||
    role === "superAdmin" ||
    me?.membership?._id === appointment.staffId;

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
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Pencil size={14} />
              Edit
            </button>
          ) : (
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
              Only the assigned groomer or an admin can edit this booking.
            </span>
          )}
        </div>
        <div className="mt-4 border-t border-zinc-200/70 pt-4 dark:border-zinc-800/70">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total
          </span>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {formatMoney(
              appointment.totalPriceCents ?? appointment.priceCentsSnapshot,
              appointment.serviceCurrency,
            )}
          </p>
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
          before={appointment.beforeImages ?? []}
          after={appointment.afterImages ?? []}
        />
      </div>

      <AppointmentReleaseSection
        appointmentId={appointment._id}
        petId={appointment.petId}
      />

      {editing && canEdit && (
        <EditVisitDialog
          appointmentId={appointment._id}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
