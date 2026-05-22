"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { WEEKDAYS } from "@/lib/time";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { TimeRangeRow, type TimeRange } from "./TimeRangeRow";

export type WeeklyRange = { weekday: number; startMin: number; endMin: number };

const DEFAULT_RANGE: TimeRange = { startMin: 9 * 60, endMin: 17 * 60 };

export function WeeklyScheduleEditor({
  initialRanges,
  readOnly,
  saving,
  onSave,
}: {
  initialRanges: ReadonlyArray<WeeklyRange>;
  readOnly: boolean;
  saving: boolean;
  onSave: (ranges: WeeklyRange[]) => Promise<void>;
}) {
  const [grid, setGrid] = useState<TimeRange[][]>(() => fromRanges(initialRanges));
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setGrid(fromRanges(initialRanges));
    setDirty(false);
  }, [initialRanges]);

  function setWeekday(weekday: number, next: TimeRange[]) {
    setGrid((current) => current.map((rows, day) => (day === weekday ? next : rows)));
    setDirty(true);
  }

  function addRange(weekday: number) {
    setWeekday(weekday, [...grid[weekday], { ...DEFAULT_RANGE }]);
  }

  async function handleSave() {
    const validation = validate(grid);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    const flat: WeeklyRange[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      for (const range of grid[weekday]) {
        flat.push({ weekday, startMin: range.startMin, endMin: range.endMin });
      }
    }
    try {
      await onSave(flat);
      setDirty(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {WEEKDAYS.map((label, weekday) => (
          <div
            key={weekday}
            className="flex flex-col gap-2 border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-900 sm:flex-row sm:items-start sm:gap-4"
          >
            <span className="w-24 shrink-0 pt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {label}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {grid[weekday].length === 0 && (
                <span className="text-xs italic text-zinc-500 dark:text-zinc-400">
                  Day off
                </span>
              )}
              {grid[weekday].map((range, index) => (
                <TimeRangeRow
                  key={index}
                  value={range}
                  onChange={(next) =>
                    setWeekday(
                      weekday,
                      grid[weekday].map((row, position) =>
                        position === index ? next : row,
                      ),
                    )
                  }
                  onRemove={() =>
                    setWeekday(
                      weekday,
                      grid[weekday].filter((_, position) => position !== index),
                    )
                  }
                />
              ))}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => addRange(weekday)}
                  className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
                >
                  <Plus size={12} />
                  Add range
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {saving ? "Saving…" : dirty ? "Save weekly schedule" : "Saved"}
          </button>
        </div>
      )}
    </div>
  );
}

function fromRanges(ranges: ReadonlyArray<WeeklyRange>): TimeRange[][] {
  const grid: TimeRange[][] = Array.from({ length: 7 }, () => []);
  for (const range of ranges) {
    grid[range.weekday].push({ startMin: range.startMin, endMin: range.endMin });
  }
  for (const day of grid) day.sort((a, b) => a.startMin - b.startMin);
  return grid;
}

function validate(grid: TimeRange[][]): string | null {
  for (let weekday = 0; weekday < 7; weekday++) {
    const rows = [...grid[weekday]].sort((a, b) => a.startMin - b.startMin);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (row.startMin >= row.endMin) {
        return `${WEEKDAYS[weekday]}: start time must be before end time.`;
      }
      if (index > 0 && row.startMin < rows[index - 1].endMin) {
        return `${WEEKDAYS[weekday]}: ranges overlap.`;
      }
    }
  }
  return null;
}
