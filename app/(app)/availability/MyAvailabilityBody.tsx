"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarRange, CalendarOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { WeeklyTimelineEditor } from "@/components/availability/WeeklyTimelineEditor";
import { OverrideCalendar } from "@/components/availability/OverrideCalendar";
import { DayOverrideDialog } from "@/components/availability/DayOverrideDialog";
import { addDaysIso, todayIsoDate } from "@/lib/time";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

export function MyAvailabilityBody() {
  const fromDate = addDaysIso(todayIsoDate(), -30);
  const toDate = addDaysIso(todayIsoDate(), 90);

  const { current, loading } = useCurrentLocation();
  const locationId = current?._id ?? null;
  const weekly = useQuery(
    api.availability.myWeekly,
    locationId ? { locationId } : "skip",
  );
  const overrides = useQuery(
    api.availability.myOverridesInRange,
    locationId ? { locationId, fromDate, toDate } : "skip",
  );
  const shopHoursRows = useQuery(
    api.locationHours.getLocationHours,
    locationId ? { locationId } : "skip",
  );
  const upsertWeekly = useMutation(api.availability.upsertMyWeekly);
  const upsertOverride = useMutation(api.availability.upsertMyOverride);
  const clearOverride = useMutation(api.availability.clearMyOverride);

  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  // Memoised so the WeeklyTimelineEditor's `useEffect([initialRanges])`
  // doesn't re-fire on every parent render and wipe out the user's in-flight
  // drag/edits before the Convex mutation round-trips.
  const weeklyRanges = useMemo(
    () =>
      (weekly ?? []).map(({ weekday, startMin, endMin }) => ({
        weekday,
        startMin,
        endMin,
      })),
    [weekly],
  );
  const shopHours = useMemo(
    () =>
      (shopHoursRows ?? []).map(({ weekday, startMin, endMin }) => ({
        weekday,
        startMin,
        endMin,
      })),
    [shopHoursRows],
  );

  if (loading || !locationId) return <EditorSkeleton />;
  if (
    weekly === undefined ||
    overrides === undefined ||
    shopHoursRows === undefined
  ) {
    return <EditorSkeleton />;
  }

  const active = activeDate
    ? overrides.find((row) => row.date === activeDate) ?? null
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <CalendarRange size={14} className="text-orange-600" />
          Weekly schedule
        </header>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Set the hours you work every week. Drag the orange ribbons to resize,
          click any empty space to add a shift, or use the toggle at the top of
          a column to mark the day off.
        </p>
        <WeeklyTimelineEditor
          initialRanges={weeklyRanges}
          shopHours={shopHours}
          readOnly={false}
          saving={savingWeekly}
          onSave={async (ranges) => {
            setSavingWeekly(true);
            try {
              await upsertWeekly({ locationId, ranges });
            } finally {
              setSavingWeekly(false);
            }
          }}
        />
      </section>

      <section>
        <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <CalendarOff size={14} className="text-orange-600" />
          Day overrides
        </header>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Tap a date to mark it off (vacation, sick day) or replace the weekly
          hours with one-off slots for that day only.
        </p>
        <OverrideCalendar
          overrides={overrides}
          onSelectDate={setActiveDate}
        />
      </section>

      {activeDate && (
        <DayOverrideDialog
          date={activeDate}
          initialKind={active?.kind ?? null}
          initialSlots={active?.slots ?? []}
          busy={savingOverride}
          onClose={() => setActiveDate(null)}
          onSetOff={async () => {
            setSavingOverride(true);
            try {
              await upsertOverride({
                locationId,
                date: activeDate,
                kind: "off",
              });
            } finally {
              setSavingOverride(false);
            }
            setActiveDate(null);
          }}
          onSetCustom={async (slots) => {
            setSavingOverride(true);
            try {
              await upsertOverride({
                locationId,
                date: activeDate,
                kind: "custom",
                slots,
              });
            } finally {
              setSavingOverride(false);
            }
            setActiveDate(null);
          }}
          onClear={async () => {
            setSavingOverride(true);
            try {
              await clearOverride({ locationId, date: activeDate });
            } finally {
              setSavingOverride(false);
            }
            setActiveDate(null);
          }}
        />
      )}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-150 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
