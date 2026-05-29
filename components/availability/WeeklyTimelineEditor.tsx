"use client";

import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS_SHORT } from "@/lib/time";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { TimelineDayColumn, type DayRange } from "./TimelineDayColumn";
import { TimeGutterColumn } from "./TimeGutterColumn";
import { MobileWeekList } from "./MobileWeekList";
import { EditRangeDialog } from "./EditRangeDialog";
import { WeeklyToolbar } from "./WeeklyToolbar";
import {
  fromWeeklyRanges,
  validateWeeklyGrid,
  type WeeklyRange,
} from "./weeklyGrid";
import type { TimeRange } from "./TimeRangeRow";

export type { WeeklyRange };

const PIXELS_PER_MIN = 0.95;
const START_HOUR = 7;
const END_HOUR = 21;
const START_GRID_MIN = START_HOUR * 60;
const END_GRID_MIN = END_HOUR * 60;
const HOUR_COUNT = END_HOUR - START_HOUR;
const DEFAULT_RANGE: TimeRange = { startMin: 9 * 60, endMin: 17 * 60 };

export function WeeklyTimelineEditor({
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
  const [grid, setGrid] = useState<DayRange[][]>(() =>
    fromWeeklyRanges(initialRanges),
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    weekday: number;
    index: number;
  } | null>(null);

  useEffect(() => {
    setGrid(fromWeeklyRanges(initialRanges));
    setDirty(false);
  }, [initialRanges]);

  function mutate(weekday: number, next: DayRange[]) {
    setGrid((current) =>
      current.map((rows, day) => (day === weekday ? next : rows)),
    );
    setDirty(true);
  }

  function toggleDay(weekday: number) {
    if (grid[weekday].length === 0) {
      mutate(weekday, [{ ...DEFAULT_RANGE }]);
    } else {
      mutate(weekday, []);
    }
  }

  async function handleSave() {
    const validation = validateWeeklyGrid(grid);
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

  const today = new Date().getDay();
  const totalHours = useMemo(
    () =>
      grid.reduce(
        (sum, day) =>
          sum +
          day.reduce((acc, range) => acc + (range.endMin - range.startMin), 0),
        0,
      ) / 60,
    [grid],
  );
  const activeDays = grid.filter((day) => day.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <WeeklyToolbar
        activeDays={activeDays}
        totalHours={totalHours}
        dirty={dirty}
        saving={saving}
        readOnly={readOnly}
        onSave={handleSave}
        onReset={() => {
          setGrid(fromWeeklyRanges(initialRanges));
          setDirty(false);
          setError(null);
        }}
      />

      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <TimeGutterColumn
            pixelsPerMin={PIXELS_PER_MIN}
            hourCount={HOUR_COUNT}
            startHour={START_HOUR}
          />
          {WEEKDAYS_SHORT.map((label, weekday) => (
            <TimelineDayColumn
              key={weekday}
              label={label}
              ranges={grid[weekday]}
              isToday={weekday === today}
              pixelsPerMin={PIXELS_PER_MIN}
              startGridMin={START_GRID_MIN}
              endGridMin={END_GRID_MIN}
              hourCount={HOUR_COUNT}
              onAddRange={(range) => mutate(weekday, [...grid[weekday], range])}
              onUpdateRange={(index, range) =>
                mutate(
                  weekday,
                  grid[weekday].map((row, position) =>
                    position === index ? range : row,
                  ),
                )
              }
              onRemoveRange={(index) =>
                mutate(
                  weekday,
                  grid[weekday].filter((_, position) => position !== index),
                )
              }
              onEditRange={(index) => setEditing({ weekday, index })}
              onToggleEnabled={() => toggleDay(weekday)}
              defaultRange={DEFAULT_RANGE}
            />
          ))}
        </div>
      </div>

      <MobileWeekList
        grid={grid}
        readOnly={readOnly}
        onMutate={mutate}
        onEdit={(weekday, index) => setEditing({ weekday, index })}
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {editing && grid[editing.weekday][editing.index] && (
        <EditRangeDialog
          weekday={editing.weekday}
          range={grid[editing.weekday][editing.index]}
          onClose={() => setEditing(null)}
          onSave={(range) => {
            mutate(
              editing.weekday,
              grid[editing.weekday].map((row, position) =>
                position === editing.index ? range : row,
              ),
            );
            setEditing(null);
          }}
          onRemove={() => {
            mutate(
              editing.weekday,
              grid[editing.weekday].filter(
                (_, position) => position !== editing.index,
              ),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

