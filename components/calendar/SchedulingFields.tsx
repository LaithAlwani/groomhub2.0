"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { AvailabilitySlotPicker } from "./AvailabilitySlotPicker";

// `pendingApproval` is intentionally omitted: that status is only set when
// admin books for another groomer, and transitions out via the Confirm /
// Decline buttons in the dialog. Showing it as a dropdown option would let
// a user move *back* into pending, which makes no business sense.
const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "checkedIn", label: "Checked in" },
  { value: "inProgress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "noShow", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type AppointmentStatus =
  | (typeof STATUS_OPTIONS)[number]["value"]
  | "pendingApproval"
  | "declined";

export function SchedulingFields({
  staffId,
  date,
  time,
  notes,
  isEdit,
  lockedStaff,
  serviceDurationMin,
  excludeAppointmentId,
  onChangeStaff,
  onChangeDate,
  onChangeTime,
  onChangeNotes,
}: {
  staffId: Id<"memberships"> | null;
  date: string;
  time: string;
  notes: string;
  isEdit: boolean;
  lockedStaff: boolean;
  serviceDurationMin: number | null;
  excludeAppointmentId?: Id<"appointments">;
  onChangeStaff: (value: Id<"memberships">) => void;
  onChangeDate: (value: string) => void;
  onChangeTime: (value: string) => void;
  onChangeNotes: (value: string) => void;
}) {
  const allStaff = useQuery(api.memberships.forOrg, {});
  const { current: currentLocation } = useCurrentLocation();
  // Hide staff whose `locationIds` doesn't include the active location. `[]`
  // means "all locations" so those rows pass through. When the locked-staff
  // path is in play (a staff user opening their own dialog), keep them in
  // the list even if they happen to be scoped elsewhere — otherwise the
  // form goes blank.
  const staff = useMemo(() => {
    if (!allStaff) return allStaff;
    if (!currentLocation) return allStaff;
    return allStaff.filter((row) => {
      if (row.membership.locationIds.length === 0) return true;
      if (row.membership.locationIds.includes(currentLocation._id)) return true;
      if (lockedStaff && row.membership._id === staffId) return true;
      return false;
    });
  }, [allStaff, currentLocation, lockedStaff, staffId]);
  const lockedStaffName =
    lockedStaff && staff
      ? staff.find((row) => row.membership._id === staffId)
      : null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Staff
          <RequiredMark />
        </span>
        {lockedStaff ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {lockedStaffName
              ? `${lockedStaffName.user.firstName} ${lockedStaffName.user.lastName}`
              : "Loading…"}
          </div>
        ) : (
          <select
            value={staffId ?? ""}
            onChange={(event) =>
              onChangeStaff(event.target.value as Id<"memberships">)
            }
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="" disabled>
              {staff === undefined ? "Loading…" : "Choose a groomer"}
            </option>
            {staff?.map((row) => (
              <option key={row.membership._id} value={row.membership._id}>
                {row.user.firstName} {row.user.lastName}
              </option>
            ))}
          </select>
        )}
      </div>
      {/* Date + time constrained to the groomer's open, unbooked slots. When
          editing, the appointment's own slot stays selectable so it can be
          kept or nudged by 15–30 min. */}
      <AvailabilitySlotPicker
        staffId={staffId}
        locationId={currentLocation?._id ?? null}
        date={date}
        time={time}
        serviceDurationMin={serviceDurationMin}
        onChangeDate={onChangeDate}
        onChangeTime={onChangeTime}
        excludeAppointmentId={excludeAppointmentId}
        allowCurrentSelection={isEdit}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Notes
        </span>
        <textarea
          value={notes}
          onChange={(event) => onChangeNotes(event.target.value)}
          rows={2}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
    </>
  );
}
