"use client";

import { WEEKDAYS, minutesToHHMM } from "@/lib/time";
import type { DayRange } from "./TimelineDayColumn";

const DEFAULT_RANGE: DayRange = { startMin: 9 * 60, endMin: 17 * 60 };

/**
 * Mobile fallback for the weekly schedule. Drag interactions don't translate
 * well on small screens, so each day collapses to a row with a day-off
 * toggle and clickable time-range pills that open the edit dialog.
 */
export function MobileWeekList({
  grid,
  readOnly,
  onMutate,
  onEdit,
}: {
  grid: DayRange[][];
  readOnly: boolean;
  onMutate: (weekday: number, next: DayRange[]) => void;
  onEdit: (weekday: number, index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
      {WEEKDAYS.map((label, weekday) => {
        const enabled = grid[weekday].length > 0;
        return (
          <div
            key={weekday}
            className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-2 last:border-b-0 last:pb-0 dark:border-zinc-900"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  onMutate(weekday, enabled ? [] : [{ ...DEFAULT_RANGE }])
                }
                role="switch"
                aria-checked={enabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  enabled ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {label}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {enabled ? (
                grid[weekday].map((range, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onEdit(weekday, index)}
                    className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 transition-colors hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:hover:bg-orange-900/40"
                  >
                    {minutesToHHMM(range.startMin)}–{minutesToHHMM(range.endMin)}
                  </button>
                ))
              ) : (
                <span className="text-xs italic text-zinc-400 dark:text-zinc-500">
                  Day off
                </span>
              )}
              {enabled && !readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    onMutate(weekday, [...grid[weekday], { ...DEFAULT_RANGE }])
                  }
                  className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  + Add
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
