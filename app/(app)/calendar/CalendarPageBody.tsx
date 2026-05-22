"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { Calendar, type CalendarEvent } from "@/components/calendar/Calendar";
import { AppointmentDialog } from "@/components/calendar/AppointmentDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export function CalendarPageBody() {
  const me = useQuery(api.users.me);
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const isStaffOnly = role === "staff";

  const allStaff = useQuery(api.memberships.forOrg);
  const [filterStaffId, setFilterStaffId] = useState<Id<"memberships"> | "all">(
    "all",
  );
  const [view, setView] = useState<string>("week");
  const [date, setDate] = useState(new Date());
  const [dialog, setDialog] = useState<
    | { mode: "new"; start: Date; staffId?: Id<"memberships"> }
    | { mode: "edit"; id: Id<"appointments"> }
    | null
  >(null);
  const [dropError, setDropError] = useState<string | null>(null);

  // Fetch a 3-week window centred on `date` so navigating either the week
  // view or the 3-day view never lands on a date outside the fetched range.
  const fromTime = useMemo(() => startOfDayMs(date) - 7 * 24 * 60 * 60 * 1000, [date]);
  const toTime = useMemo(() => fromTime + 21 * 24 * 60 * 60 * 1000, [fromTime]);

  const effectiveStaffId =
    isStaffOnly && me ? me.membership._id : filterStaffId === "all" ? null : filterStaffId;

  const appointments = useQuery(api.appointments.listInRange, {
    fromTime,
    toTime,
  });
  const availability = useQuery(
    api.availability.forStaffSlotsInRange,
    effectiveStaffId
      ? {
          staffId: effectiveStaffId,
          fromDate: isoDate(new Date(fromTime)),
          toDate: isoDate(new Date(toTime - 1)),
        }
      : "skip",
  );

  const reschedule = useMutation(api.appointments.reschedule);

  const events = useMemo<CalendarEvent[]>(() => {
    if (!appointments) return [];
    const filtered =
      effectiveStaffId === null
        ? appointments
        : appointments.filter((row) => row.staffId === effectiveStaffId);
    return filtered.map((row) => ({
      id: row._id,
      title: `${row.petName} · ${row.serviceName} (${row.staffName})`,
      start: new Date(row.startTime),
      end: new Date(row.endTime),
      status: row.status,
      color: row.serviceColor,
    }));
  }, [appointments, effectiveStaffId]);

  async function handleEventDrop(info: { id: string; start: Date }) {
    setDropError(null);
    try {
      await reschedule({
        id: info.id as Id<"appointments">,
        startTime: info.start.getTime(),
      });
    } catch (caught) {
      setDropError(formatAppointmentError(caught));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {!isStaffOnly && allStaff && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Show:</span>
            <select
              value={filterStaffId}
              onChange={(event) =>
                setFilterStaffId(
                  event.target.value === "all"
                    ? "all"
                    : (event.target.value as Id<"memberships">),
                )
              }
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="all">All groomers</option>
              {allStaff.map((row) => (
                <option key={row.membership._id} value={row.membership._id}>
                  {row.user.firstName} {row.user.lastName}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => setDialog({ mode: "new", start: roundedNow() })}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={14} />
          New appointment
        </button>
      </div>
      {dropError && <ErrorBanner>{dropError}</ErrorBanner>}
      <Calendar
        events={events}
        availabilityByDate={availability ?? {}}
        view={view}
        date={date}
        onViewChange={setView}
        onDateChange={setDate}
        onSelectSlot={(info) =>
          setDialog({
            mode: "new",
            start: info.start,
            staffId: effectiveStaffId ?? undefined,
          })
        }
        onSelectEvent={(event) =>
          setDialog({ mode: "edit", id: event.id as Id<"appointments"> })
        }
        onEventDrop={handleEventDrop}
      />
      {dialog?.mode === "new" && (
        <AppointmentDialog
          appointmentId="new"
          initialStartTime={dialog.start}
          initialStaffId={dialog.staffId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.mode === "edit" && (
        <AppointmentDialog
          appointmentId={dialog.id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function startOfDayMs(date: Date): number {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result.getTime();
}

function roundedNow(): Date {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return now;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

