"use client";

import { useState } from "react";
import { DialogShell } from "@/components/ui/DialogShell";
import { WEEKDAYS } from "@/lib/time";
import { TimeRangeRow, type TimeRange } from "./TimeRangeRow";

/**
 * Edit / delete dialog opened from clicking a weekly-schedule ribbon.
 * Separate from `DayOverrideDialog` (which targets specific dates) because
 * weekly ranges don't have a kind / off mode — they're just time ranges.
 */
export function EditRangeDialog({
  weekday,
  range,
  onClose,
  onSave,
  onRemove,
}: {
  weekday: number;
  range: TimeRange;
  onClose: () => void;
  onSave: (range: TimeRange) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<TimeRange>(range);
  return (
    <DialogShell open onClose={onClose} title={`Edit shift · ${WEEKDAYS[weekday]}`}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <TimeRangeRow value={draft} onChange={setDraft} onRemove={onRemove} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            Save
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
