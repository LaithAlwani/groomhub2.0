"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TimeSelect } from "@/components/forms/TimeSelect";
import { todayIsoDate } from "@/lib/time";

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
  status,
  notes,
  isEdit,
  lockedStaff,
  allowPastDate,
  onChangeStaff,
  onChangeDate,
  onChangeTime,
  onChangeStatus,
  onChangeNotes,
}: {
  staffId: Id<"memberships"> | null;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes: string;
  isEdit: boolean;
  lockedStaff: boolean;
  allowPastDate: boolean;
  onChangeStaff: (value: Id<"memberships">) => void;
  onChangeDate: (value: string) => void;
  onChangeTime: (value: string) => void;
  onChangeStatus: (value: AppointmentStatus) => void;
  onChangeNotes: (value: string) => void;
}) {
  const staff = useQuery(api.memberships.forOrg);
  const lockedStaffName =
    lockedStaff && staff
      ? staff.find((row) => row.membership._id === staffId)
      : null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Staff
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Date
          </span>
          <input
            type="date"
            value={date}
            min={allowPastDate ? undefined : todayIsoDate()}
            onChange={(event) => onChangeDate(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Start time
          </span>
          <TimeSelect value={time} onChange={onChangeTime} ariaLabel="Start time" />
        </div>
      </div>
      {isEdit && status !== "pendingApproval" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Status
          </span>
          <select
            value={status}
            onChange={(event) =>
              onChangeStatus(event.target.value as AppointmentStatus)
            }
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Notes (optional)
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
