"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { Calendar, type CalendarEvent } from "@/components/calendar/Calendar";
import { AppointmentDialog } from "@/components/calendar/AppointmentDialog";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import {
  isoDateInTimezone,
  nowInTimezone,
  roundedNowInTimezone,
  startOfDayInTimezone,
  utcToZonedPseudoDate,
  zonedPseudoDateToUtc,
} from "@/lib/locationTime";

export function CalendarPageBody() {
  const me = useQuery(api.users.me);
  const { membership } = useOrganization();
  const role = mapClerkOrgRole(membership?.role ?? null);
  const isStaffOnly = role === "staff";
  const { current: currentLocation } = useCurrentLocation();
  const locationId = currentLocation?._id ?? null;
  // Every Date the calendar reasons about — events, click positions, "now",
  // day boundaries — is a pseudo-Date in the location's timezone so that
  // viewers in other timezones still see the shop's wall-clock hours. Falls
  // back to the browser's TZ while `currentLocation` is loading so the
  // calendar doesn't render with empty/wrong dates during that brief window.
  const locationTimezone =
    currentLocation?.timezone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC");

  const allOrgStaff = useQuery(api.memberships.forOrg, {});
  // Filter staff dropdown by active location — `locationIds: []` rows
  // (admins, owners, single-location staff) always pass through.
  const allStaff = useMemo(() => {
    if (!allOrgStaff) return allOrgStaff;
    if (!locationId) return allOrgStaff;
    return allOrgStaff.filter(
      (row) =>
        row.membership.locationIds.length === 0 ||
        row.membership.locationIds.includes(locationId),
    );
  }, [allOrgStaff, locationId]);
  const [filterStaffId, setFilterStaffId] = useState<Id<"memberships"> | "all">(
    "all",
  );
  // Two-phase mount: SSR + first client paint use the safe default ("week").
  // `useEffect` reads the persisted view and flips `hydrated`, which gates the
  // Calendar render below — so we never paint with the wrong view first.
  const [view, setView] = useState<string>("week");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setView(readStoredView());
    setHydrated(true);
  }, []);
  const [date, setDate] = useState(() => nowInTimezone(locationTimezone));
  const [dialog, setDialog] = useState<
    | { mode: "new"; start: Date; staffId?: Id<"memberships"> }
    | { mode: "edit"; id: Id<"appointments"> }
    | null
  >(null);
  const [dropError, setDropError] = useState<string | null>(null);

  // Re-anchor the displayed day when the active location changes. Each
  // location has its own clock — switching from a Toronto location to a
  // Vancouver location should land the user on "today in Vancouver", not
  // the prior pseudo-Date frozen in Toronto's frame.
  useEffect(() => {
    setDate(nowInTimezone(locationTimezone));
  }, [locationTimezone]);

  // Fetch a 3-week window centred on `date` so navigating either the week
  // view or the 3-day view never lands on a date outside the fetched range.
  // Day boundaries are in LOCATION TZ so the range aligns with shop days.
  const fromTime = useMemo(() => {
    const dateUtc = zonedPseudoDateToUtc(date, locationTimezone);
    return startOfDayInTimezone(dateUtc, locationTimezone) - 7 * 24 * 60 * 60 * 1000;
  }, [date, locationTimezone]);
  const toTime = useMemo(() => fromTime + 21 * 24 * 60 * 60 * 1000, [fromTime]);

  const effectiveStaffId =
    isStaffOnly && me ? me.membership._id : filterStaffId === "all" ? null : filterStaffId;

  const appointments = useQuery(
    api.appointments.listInRange,
    locationId
      ? { fromTime, toTime, locationId }
      : { fromTime, toTime },
  );
  const fromDate = useMemo(
    () => isoDateInTimezone(fromTime, locationTimezone),
    [fromTime, locationTimezone],
  );
  const toDate = useMemo(
    () => isoDateInTimezone(toTime - 1, locationTimezone),
    [toTime, locationTimezone],
  );
  // Two queries (one always skipped) because Convex requires the query
  // reference to be stable per useQuery call — we swap between staff-scoped
  // and org-wide based on the active filter. Both need a locationId; while
  // the current location is still loading we skip and let the calendar
  // render with empty availability.
  const staffAvailability = useQuery(
    api.availability.forStaffSlotsInRange,
    locationId && effectiveStaffId
      ? { locationId, staffId: effectiveStaffId, fromDate, toDate }
      : "skip",
  );
  const orgAvailability = useQuery(
    api.availability.forOrgSlotsInRange,
    locationId && !effectiveStaffId
      ? { locationId, fromDate, toDate }
      : "skip",
  );
  const availability = effectiveStaffId ? staffAvailability : orgAvailability;

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
      // Events are positioned by their wall-clock in the LOCATION TZ — viewers
      // outside that timezone still see "9 AM" on the shop's clock.
      start: utcToZonedPseudoDate(row.startTime, locationTimezone),
      end: utcToZonedPseudoDate(row.endTime, locationTimezone),
      status: row.status,
      color: row.serviceColor,
    }));
  }, [appointments, effectiveStaffId, locationTimezone]);

  async function handleEventDrop(info: { id: string; start: Date }) {
    setDropError(null);
    try {
      await reschedule({
        id: info.id as Id<"appointments">,
        // `info.start` is a pseudo-Date — reinterpret in the location's TZ.
        startTime: zonedPseudoDateToUtc(info.start, locationTimezone),
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
        onNewAppointment={() =>
          setDialog({ mode: "new", start: roundedNowInTimezone(locationTimezone) })
        }
      />

      {dropError && <ErrorBanner>{dropError}</ErrorBanner>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {hydrated ? (
          <Calendar
            events={events}
            availabilityByDate={availability ?? {}}
            view={view}
            date={date}
            locationTimezone={locationTimezone}
            onViewChange={(next) => {
              setView(next);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(VIEW_STORAGE_KEY, next);
              }
            }}
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
        ) : (
          <div className="h-[70vh] animate-pulse bg-zinc-50 dark:bg-zinc-900" />
        )}
      </div>

      <button
        type="button"
        onClick={() =>
          setDialog({ mode: "new", start: roundedNowInTimezone(locationTimezone) })
        }
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
          locationTimezone={locationTimezone}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.mode === "edit" && (
        <AppointmentDialog
          appointmentId={dialog.id}
          locationTimezone={locationTimezone}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

const VIEW_STORAGE_KEY = "groomhub:calendar-view";
const VALID_VIEWS = ["day", "threeDay", "week", "agenda"] as const;
type ViewKey = (typeof VALID_VIEWS)[number];

function readStoredView(): string {
  if (typeof window === "undefined") return "week";
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return (VALID_VIEWS as readonly string[]).includes(stored ?? "")
    ? (stored as ViewKey)
    : "week";
}

