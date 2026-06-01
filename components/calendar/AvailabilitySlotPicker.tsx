"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { addDaysIso, todayIsoDate } from "@/lib/time";
import { BookingDatePicker } from "./BookingDatePicker";

const BOOKING_WINDOW_DAYS = 60;
const STEP_MIN = 15;

/**
 * Availability-aware date + time pickers for booking. Offers only the days the
 * chosen groomer works (rendered as a month calendar with closed days disabled)
 * and only start times inside their open slots that (a) fit the service duration
 * and (b) aren't already taken by another appointment.
 *
 * When editing (`allowCurrentSelection`), the appointment's existing date/time
 * stay selectable even if they now fall outside availability, and
 * `excludeAppointmentId` drops the appointment from the booked set so its own
 * slot isn't treated as a conflict (lets the user nudge it by 15–30 min).
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
  const toDate = addDaysIso(today, BOOKING_WINDOW_DAYS);

  const slotsByDate = useQuery(
    api.availability.forStaffSlotsInRange,
    staffId && locationId
      ? { staffId, locationId, fromDate: today, toDate }
      : "skip",
  );
  // Times already taken by this groomer's other appointments, subtracted from
  // the offered start times so we never let them double-book.
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

  // Service needs room to finish inside the slot. Default to one step when no
  // service is picked yet so the date list isn't empty before that choice.
  const duration =
    serviceDurationMin && serviceDurationMin > 0 ? serviceDurationMin : STEP_MIN;

  const availableDates = useMemo(() => {
    const dates = slotsByDate
      ? Object.entries(slotsByDate)
          .filter(
            ([day, slots]) =>
              day >= today &&
              slots.some((slot) => slot.endMin - slot.startMin >= duration),
          )
          .map(([day]) => day)
      : [];
    // Keep the appointment's existing date selectable when editing.
    if (allowCurrentSelection && date && !dates.includes(date)) dates.push(date);
    return dates.sort();
  }, [slotsByDate, today, duration, allowCurrentSelection, date]);

  const startTimes = useMemo(() => {
    const slots = slotsByDate?.[date] ?? [];
    const booked = bookedByDate?.[date] ?? [];
    const minutes = new Set<number>();
    for (const slot of slots) {
      for (let start = slot.startMin; start + duration <= slot.endMin; start += STEP_MIN) {
        const end = start + duration;
        const overlapsBooked = booked.some(
          (appointment) =>
            start < appointment.endMin && end > appointment.startMin,
        );
        if (!overlapsBooked) minutes.add(start);
      }
    }
    // Keep the appointment's existing time selectable when editing.
    if (allowCurrentSelection && time) {
      const current = toMinutes(time);
      if (current >= 0) minutes.add(current);
    }
    return [...minutes].sort((a, b) => a - b);
  }, [slotsByDate, bookedByDate, date, duration, allowCurrentSelection, time]);

  if (!staffId) {
    return (
      <Placeholder text="Choose a groomer to see open dates and times." />
    );
  }
  if (slotsByDate === undefined) {
    return <Placeholder text="Loading availability…" />;
  }
  if (availableDates.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        This groomer has no working hours in the next {BOOKING_WINDOW_DAYS} days.{" "}
        <Link href="/availability" className="font-medium underline">
          Set their hours
        </Link>{" "}
        to book them.
      </p>
    );
  }

  const dateChosen = Boolean(date) && availableDates.includes(date);
  const timeValue = startTimes.includes(toMinutes(time)) ? time : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Date
          <RequiredMark />
        </span>
        <BookingDatePicker
          value={date}
          availableDates={availableDates}
          onChange={onChangeDate}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Start time
          <RequiredMark />
        </span>
        <select
          value={timeValue}
          disabled={!dateChosen || startTimes.length === 0}
          onChange={(event) => onChangeTime(event.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="" disabled>
            {!dateChosen
              ? "Pick a date first"
              : startTimes.length === 0
                ? "No open times that day"
                : "Select a time"}
          </option>
          {startTimes.map((min) => (
            <option key={min} value={minutesToTimeValue(min)}>
              {formatTimeLabel(min)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Date &amp; time
        <RequiredMark />
      </span>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        {text}
      </div>
    </div>
  );
}

function toMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return -1;
  return hh * 60 + mm;
}

function minutesToTimeValue(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function formatTimeLabel(min: number): string {
  const hour = Math.floor(min / 60);
  const minute = min % 60;
  const ampm = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}
