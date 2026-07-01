"use client";
import { formatError } from "@/lib/formatError";

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
  shopHours,
}: {
  initialRanges: ReadonlyArray<WeeklyRange>;
  readOnly: boolean;
  saving: boolean;
  onSave: (ranges: WeeklyRange[]) => Promise<void>;
  // The shop's operating hours. When provided, closed times render as blocked
  // bands the groomer can't schedule into, and a save outside them is rejected
  // with a readable message (instead of a raw server error). Omit it where the
  // editor *is* the shop hours (admin operating-hours editor).
  shopHours?: ReadonlyArray<WeeklyRange>;
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

  const shopByWeekday = useMemo(() => {
    const map = new Map<number, DayRange[]>();
    for (const range of shopHours ?? []) {
      const bucket = map.get(range.weekday) ?? [];
      bucket.push({ startMin: range.startMin, endMin: range.endMin });
      map.set(range.weekday, bucket);
    }
    return map;
  }, [shopHours]);
  const shopConfigured = (shopHours?.length ?? 0) > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-hydrate the editable grid when the saved schedule loads / changes
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
    if (grid[weekday].length > 0) {
      mutate(weekday, []);
      return;
    }
    // Turning a day on: seed it with the shop's open hours for that weekday so
    // the groomer starts inside bounds (falls back to the 9–5 default when the
    // shop hasn't configured hours).
    const open = shopByWeekday.get(weekday) ?? [];
    if (shopConfigured && open.length === 0) return; // shop closed that day
    mutate(
      weekday,
      shopConfigured && open.length > 0
        ? open.map((range) => ({ ...range }))
        : [{ ...DEFAULT_RANGE }],
    );
  }

  // Readable shop-hours check, mirroring the server's `assertWeeklyWithinShopHours`
  // so the groomer gets a clear message at the Save button instead of a raw
  // ConvexError if a dragged ribbon ends up outside the shop's open hours.
  function validateAgainstShopHours(): string | null {
    if (!shopConfigured) return null;
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const open = shopByWeekday.get(weekday) ?? [];
      for (const range of grid[weekday]) {
        const fits = open.some(
          (window) =>
            window.startMin <= range.startMin && range.endMin <= window.endMin,
        );
        if (!fits) {
          const openLabel =
            open.length > 0
              ? open
                  .map((w) => `${formatMin(w.startMin)}–${formatMin(w.endMin)}`)
                  .join(", ")
              : "closed";
          return `${WEEKDAYS_SHORT[weekday]} hours must be within the shop's open hours (${openLabel}).`;
        }
      }
    }
    return null;
  }

  async function handleSave() {
    const validation = validateWeeklyGrid(grid);
    if (validation) {
      setError(validation);
      return;
    }
    const shopViolation = validateAgainstShopHours();
    if (shopViolation) {
      setError(shopViolation);
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
      setError(formatError(caught, "Could not save"));
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

      {error && <ErrorBanner>{error}</ErrorBanner>}

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
              openRanges={shopByWeekday.get(weekday) ?? []}
              shopConstrained={shopConfigured}
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

function formatMin(min: number): string {
  const hour = Math.floor(min / 60);
  const minute = min % 60;
  const ampm = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

