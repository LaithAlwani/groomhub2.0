"use client";

import { useState } from "react";
import { WeeklyScheduleEditor, type WeeklyRange } from "./WeeklyScheduleEditor";
import { OverrideCalendar, type OverrideRow } from "./OverrideCalendar";
import { DayOverrideDialog } from "./DayOverrideDialog";

export function AvailabilityEditor({
  weeklyRanges,
  overrides,
  canEdit,
  savingWeekly,
  savingOverride,
  onSaveWeekly,
  onUpsertOverride,
  onClearOverride,
}: {
  weeklyRanges: ReadonlyArray<WeeklyRange>;
  overrides: ReadonlyArray<OverrideRow>;
  canEdit: boolean;
  savingWeekly: boolean;
  savingOverride: boolean;
  onSaveWeekly: (ranges: WeeklyRange[]) => Promise<void>;
  onUpsertOverride: (input: {
    date: string;
    kind: "off" | "custom";
    slots?: Array<{ startMin: number; endMin: number }>;
  }) => Promise<void>;
  onClearOverride: (date: string) => Promise<void>;
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const active = activeDate
    ? overrides.find((row) => row.date === activeDate) ?? null
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Weekly schedule
        </h2>
        <WeeklyScheduleEditor
          initialRanges={weeklyRanges}
          readOnly={!canEdit}
          saving={savingWeekly}
          onSave={onSaveWeekly}
        />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Per-day overrides
        </h2>
        <OverrideCalendar
          overrides={overrides}
          onSelectDate={canEdit ? setActiveDate : () => undefined}
        />
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Tap any day to override the weekly schedule for that date.
        </p>
      </section>
      {activeDate && (
        <DayOverrideDialog
          date={activeDate}
          initialKind={active?.kind ?? null}
          initialSlots={active?.slots ?? []}
          busy={savingOverride}
          onClose={() => setActiveDate(null)}
          onSetOff={async () => {
            await onUpsertOverride({ date: activeDate, kind: "off" });
            setActiveDate(null);
          }}
          onSetCustom={async (slots) => {
            await onUpsertOverride({ date: activeDate, kind: "custom", slots });
            setActiveDate(null);
          }}
          onClear={async () => {
            await onClearOverride(activeDate);
            setActiveDate(null);
          }}
        />
      )}
    </div>
  );
}
