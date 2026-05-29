"use client";

import { CalendarPlus } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { StaffFilterChips } from "./StaffFilterChips";
import { StaffFilterDropdown } from "./StaffFilterDropdown";

type StaffRow = {
  membership: Doc<"memberships">;
  user: Doc<"users">;
};

/**
 * Page header above the calendar card. Title + subtitle on the left, "Show:"
 * dropdown + "+ New appointment" CTA pinned on the right (always in a single
 * row — the title shrinks via `min-w-0 flex-1` to accommodate).
 *
 * Below the 874px breakpoint the right cluster collapses; the mobile chip
 * strip + the `+` FAB rendered by `CalendarPageBody` replace it.
 */
export function CalendarHeader({
  isStaffOnly,
  allStaff,
  filterStaffId,
  onFilterStaffId,
  onNewAppointment,
}: {
  isStaffOnly: boolean;
  allStaff: ReadonlyArray<StaffRow> | undefined;
  filterStaffId: Id<"memberships"> | "all";
  onFilterStaffId: (next: Id<"memberships"> | "all") => void;
  onNewAppointment: () => void;
}) {
  const showStaffFilter = !isStaffOnly && allStaff;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-row items-start justify-between gap-4 min-[874px]:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
            Calendar
          </h1>
        </div>
        <div className="hidden shrink-0 items-center gap-3 min-[874px]:flex">
          {showStaffFilter && (
            <StaffFilterDropdown
              value={filterStaffId}
              staff={allStaff}
              onChange={onFilterStaffId}
            />
          )}
          <button
            type="button"
            onClick={onNewAppointment}
            className="inline-flex items-center gap-2 rounded-lg bg-linear-to-b from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow"
          >
            <CalendarPlus size={16} />
            New appointment
          </button>
        </div>
      </div>
      {showStaffFilter && (
        <div className="min-[874px]:hidden">
          <StaffFilterChips
            value={filterStaffId}
            staff={allStaff}
            onChange={onFilterStaffId}
          />
        </div>
      )}
    </header>
  );
}
