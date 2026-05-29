"use client";

import { CalendarClock, RotateCcw, Save } from "lucide-react";

export function WeeklyToolbar({
  activeDays,
  totalHours,
  dirty,
  saving,
  readOnly,
  onSave,
  onReset,
}: {
  activeDays: number;
  totalHours: number;
  dirty: boolean;
  saving: boolean;
  readOnly: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
        <CalendarClock size={16} className="text-orange-600" />
        <span className="font-medium">{activeDays}</span>
        <span className="text-zinc-500">active days</span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className="font-medium">{totalHours.toFixed(1)}h</span>
        <span className="text-zinc-500">per week</span>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <Save size={12} />
            {saving ? "Saving…" : dirty ? "Save schedule" : "Saved"}
          </button>
        </div>
      )}
    </div>
  );
}
