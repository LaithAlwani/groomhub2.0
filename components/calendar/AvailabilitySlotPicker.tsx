"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { addDaysIso, todayIsoDate } from "@/lib/time";
import { DateStrip } from "@/components/availability/slots/DateStrip";
import { buildBookingPills } from "@/components/availability/slots/availabilitySlots";
import {
  Placeholder,
  SlotChips,
  firstAvailableSelection,
  toMinutes,
  minutesToTimeValue,
} from "./bookingPickerParts";

const MAX_BOOKING_DAYS = 120;
const VISIBLE_STEP = 21; // days loaded initially / added per "load more"
const STEP_MIN = 15;

/**
 * Booking date + time picker (slot design): a day-pill strip (only days the
 * groomer works are selectable) + tappable slot chips that fit the service and
 * aren't taken. Edit mode (`allowCurrentSelection` + `excludeAppointmentId`)
 * keeps the appointment's own slot selectable/non-conflicting.
 */
export function AvailabilitySlotPicker({
  staffId,
  locationId,
  date,
  time,
  serviceDurationMin,
  onChangeDate,
  onChangeTime,
  excludeAppointmentId,
  allowCurrentSelection = false,
}: {
  staffId: Id<"memberships"> | null;
  locationId: Id<"locations"> | null;
  date: string;
  time: string;
  serviceDurationMin: number | null;
  onChangeDate: (value: string) => void;
  onChangeTime: (value: string) => void;
  excludeAppointmentId?: Id<"appointments">;
  allowCurrentSelection?: boolean;
}) {
  const today = todayIsoDate();
  const [visibleDays, setVisibleDays] = useState(VISIBLE_STEP);
  const toDate = addDaysIso(today, visibleDays);

  const slotsByDate = useQuery(
    api.availability.forStaffSlotsInRange,
    staffId && locationId
      ? { staffId, locationId, fromDate: today, toDate }
      : "skip",
  );
  const bookedByDate = useQuery(
    api.appointments.bookedSlotsForStaffInRange,
    staffId && locationId
      ? {
          staffId,
          locationId,
          fromDate: today,
          toDate,
          ...(excludeAppointmentId ? { excludeAppointmentId } : {}),
        }
      : "skip",
  );

  const duration =
    serviceDurationMin && serviceDurationMin > 0 ? serviceDurationMin : STEP_MIN;

  // The groomer's own slots, per date, that fit the service and aren't already
  // taken. These ARE the bookable options — clients pick a whole slot, not an
  // arbitrary start time inside it.
  const availableSlotsByDate = useMemo(() => {
    const result: Record<string, Array<{ startMin: number; endMin: number }>> =
      {};
    if (!slotsByDate) return result;
    for (const [day, slots] of Object.entries(slotsByDate)) {
      if (day < today) continue;
      const booked = bookedByDate?.[day] ?? [];
      const open = slots.filter(
        (slot) =>
          slot.endMin - slot.startMin >= duration &&
          !booked.some(
            (appointment) =>
              slot.startMin < appointment.endMin &&
              slot.endMin > appointment.startMin,
          ),
      );
      if (open.length > 0) result[day] = open;
    }
    return result;
  }, [slotsByDate, bookedByDate, today, duration]);

  const availableDates = useMemo(() => {
    const dates = Object.keys(availableSlotsByDate);
    if (allowCurrentSelection && date && !dates.includes(date)) dates.push(date);
    return dates;
  }, [availableSlotsByDate, allowCurrentSelection, date]);

  const currentMin = toMinutes(time);
  const daySlots = useMemo(() => {
    const slots = [...(availableSlotsByDate[date] ?? [])];
    // Keep the appointment's existing time selectable when editing, even if it
    // no longer lines up with a defined slot.
    if (
      allowCurrentSelection &&
      currentMin >= 0 &&
      !slots.some((slot) => slot.startMin === currentMin)
    ) {
      slots.push({ startMin: currentMin, endMin: currentMin + duration });
    }
    return slots.sort((a, b) => a.startMin - b.startMin);
  }, [availableSlotsByDate, date, allowCurrentSelection, currentMin, duration]);

  const pills = useMemo(
    () =>
      buildBookingPills(
        new Date(`${today}T00:00:00`),
        visibleDays,
        date,
        new Set(availableDates),
      ),
    [today, visibleDays, date, availableDates],
  );

  function loadMore() {
    setVisibleDays((days) => Math.min(days + VISIBLE_STEP, MAX_BOOKING_DAYS));
  }

  // Fresh booking: land on a real slot (snap the pre-filled time to its slot,
  // else jump to the first available). Editing keeps the existing selection.
  useEffect(() => {
    if (slotsByDate === undefined || allowCurrentSelection) return;
    const target = firstAvailableSelection(
      availableSlotsByDate,
      availableDates,
      date,
      time,
    );
    if (!target) return;
    if (target.date) onChangeDate(target.date);
    onChangeTime(target.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsByDate, availableDates, availableSlotsByDate, date, time]);

  if (!staffId) {
    return <Placeholder text="Choose a groomer to see open dates and times." />;
  }
  if (slotsByDate === undefined) {
    return <Placeholder text="Loading availability…" />;
  }
  if (availableDates.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        This groomer has no upcoming working hours.{" "}
        <Link href="/availability" className="font-medium underline">
          Set their hours
        </Link>{" "}
        to book them.
      </p>
    );
  }

  const dateChosen = Boolean(date) && availableDates.includes(date);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Date
          <RequiredMark />
        </span>
        <DateStrip
          pills={pills}
          onSelect={onChangeDate}
          onReachEnd={loadMore}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Time slot
          <RequiredMark />
        </span>
        <SlotChips
          dateChosen={dateChosen}
          slots={daySlots}
          currentMin={currentMin}
          onPick={(startMin) => onChangeTime(minutesToTimeValue(startMin))}
        />
      </div>
    </div>
  );
}
