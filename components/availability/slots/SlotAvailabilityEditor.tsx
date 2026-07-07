"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { DateStrip } from "./DateStrip";
import { DayPanel } from "./DayPanel";
import { useSlotAvailability } from "./useSlotAvailability";

/**
 * Slot-based availability editor: a scrollable day strip + per-day slot editor.
 * Pick a day, add start–end slots; "Repeat weekly" keeps the pattern on that
 * weekday, "Book off" blocks the single day. Backed by the existing
 * `staffWeeklySchedule` + `staffDayOverride` tables.
 */
export function SlotAvailabilityEditor({
  locationId,
}: {
  locationId: Id<"locations">;
}) {
  const {
    ready,
    pills,
    atToday,
    setSelectedDate,
    selectedDate,
    effective,
    error,
    handlers,
    dirty,
    saving,
    serverError,
    save,
    discard,
    loadMore,
    goToToday,
  } = useSlotAvailability(locationId);

  if (!ready) return <EditorSkeleton />;

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pick a day below, then add time slots. &ldquo;Repeat weekly&rdquo;
          keeps that pattern every week; &ldquo;Book off&rdquo; blocks just that
          one day.
        </p>
        {!atToday && (
          <button
            type="button"
            onClick={goToToday}
            className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-orange-400 dark:hover:bg-orange-950/20"
          >
            Today
          </button>
        )}
      </div>

      <DateStrip
        pills={pills}
        onSelect={setSelectedDate}
        onReachEnd={loadMore}
      />

      <DayPanel
        dateStr={selectedDate}
        effective={effective}
        error={error}
        onToggleBookOff={handlers.toggleBookOff}
        onToggleRepeat={handlers.toggleRepeat}
        onAddSlot={handlers.addSlot}
        onRemoveSlot={handlers.removeSlot}
        onSlotTimeChange={handlers.slotTimeChange}
      />

      {serverError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={discard}
          disabled={!dirty || saving}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4">
      <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
