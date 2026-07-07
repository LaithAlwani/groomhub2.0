"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
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
 * Appointment history section. Section title sits as bare text on the page;
 * the table itself is a single rounded card with a dark "DATE & TIME /
 * SERVICE / PET / STATUS" header strip and rows (or the empty state) beneath.
 * Matches the design's separation of title bar from table card.
 */
export function ClientAppointmentsSection({
  clientId,
}: {
  clientId: Id<"clients">;
}) {
  const allAppointments = useQuery(api.appointments.listForClient, { clientId });
  // Completed visits live in the Service History section now — this section is
  // scheduled/upcoming (and cancelled/no-show) appointments only.
  const appointments = useMemo(
    () => allAppointments?.filter((row) => row.status !== "completed"),
    [allAppointments],
  );
  const { locations } = useCurrentLocation();
  const showLocation = locations.length > 1;
  const router = useRouter();
  // null = "All pets" tab. Reset implicitly when the underlying query
  // changes (e.g. appointment booked) — useMemo recomputes the pet list
  // and an invalid pet name just falls back to "All" via the filter.
  const [selectedPet, setSelectedPet] = useState<string | null>(null);

  // Unique pet names across the client's appointment history, in first-seen
  // order. Empty / falsy names are dropped so a half-imported appointment
  // doesn't add a blank tab.
  const petTabs = useMemo(() => {
    if (!appointments) return [] as string[];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const appointment of appointments) {
      const name = appointment.petName?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push(name);
    }
    return result;
  }, [appointments]);

  const visibleAppointments = useMemo(() => {
    if (!appointments) return undefined;
    if (!selectedPet) return appointments;
    return appointments.filter((entry) => entry.petName === selectedPet);
  }, [appointments, selectedPet]);

  const totalCount = appointments?.length ?? 0;
  const visibleCount = visibleAppointments?.length ?? 0;
  // Show "{visible} of {total}" only when a pet filter is narrowing the
  // list; otherwise just the total reads cleanest.
  const countLabel =
    selectedPet && visibleCount !== totalCount
      ? `${visibleCount} of ${totalCount}`
      : `${totalCount}`;

  // Hide the whole section when there are no scheduled/upcoming appointments
  // (completed visits live in Service history). Also hidden while loading so
  // an empty card never flashes in.
  if (appointments === undefined || appointments.length === 0) return null;

  return (
    <section className="mt-8">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Appointments
          {appointments !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {countLabel}
            </span>
          )}
        </h2>
      </header>

      {/* Pet filter tabs — only render with 2+ pets, otherwise the tab row
          is just noise. "All" pseudo-tab clears the filter. */}
      {petTabs.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <PetTab
            label="All"
            active={selectedPet === null}
            onClick={() => setSelectedPet(null)}
          />
          {petTabs.map((petName) => (
            <PetTab
              key={petName}
              label={petName}
              active={selectedPet === petName}
              onClick={() => setSelectedPet(petName)}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.4fr_1.2fr_1fr_0.9fr] items-center gap-2 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>Date &amp; Time</span>
          <span>Service</span>
          <span>Pet</span>
          <span className="text-right">Status</span>
        </div>
        {visibleAppointments === undefined ? (
          <HistorySkeleton />
        ) : visibleAppointments.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {visibleAppointments.map((appointment) => (
              <li
                key={appointment._id}
                onClick={() =>
                  router.push(`/appointments/${appointment._id}`)
                }
                className="grid cursor-pointer grid-cols-[1.4fr_1.2fr_1fr_0.9fr] items-center gap-2 border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDate(appointment.startTime)}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {formatTime(appointment.startTime)}
                  </p>
                  {showLocation && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      <MapPin size={10} className="text-zinc-400" aria-hidden />
                      {appointment.locationName}
                    </p>
                  )}
                </div>
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {appointment.serviceName}
                </p>
                <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {appointment.petName}
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
                {appointment.notes && (
                  <p className="col-span-4 mt-1 whitespace-pre-line text-xs italic text-zinc-500 dark:text-zinc-400">
                    {appointment.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PetTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-sm"
          : "rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }
    >
      {label}
    </button>
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
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No appointments yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Schedule the first grooming session for this
          <br />
          client&apos;s pets.
        </p>
      </div>
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
