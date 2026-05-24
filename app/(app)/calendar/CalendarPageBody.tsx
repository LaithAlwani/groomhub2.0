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
import { CalendarBentoCards } from "@/components/calendar/CalendarBentoCards";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
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
    <div className="flex flex-1 flex-col gap-6">
      <CalendarHeader
        isStaffOnly={isStaffOnly}
        allStaff={allStaff}
        filterStaffId={filterStaffId}
        onFilterStaffId={setFilterStaffId}
        onNewAppointment={() => setDialog({ mode: "new", start: roundedNow() })}
      />

      {dropError && <ErrorBanner>{dropError}</ErrorBanner>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
      </div>

      <CalendarBentoCards />

      <button
        type="button"
        onClick={() => setDialog({ mode: "new", start: roundedNow() })}
        aria-label="New appointment"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-b from-orange-500 to-orange-600 text-white shadow-lg transition-transform hover:scale-105 min-[874px]:hidden"
      >
        <Plus size={24} />
      </button>

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
