"use client";

import { X } from "lucide-react";
import {
  QUARTER_HOUR_SECONDS,
  hhmmToMinutes,
  minutesToHHMM,
  snapToQuarter,
} from "@/lib/time";

export type TimeRange = { startMin: number; endMin: number };

export function TimeRangeRow({
  value,
  onChange,
  onRemove,
}: {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        step={QUARTER_HOUR_SECONDS}
        value={minutesToHHMM(value.startMin)}
        onChange={(event) => {
          const parsed = hhmmToMinutes(event.target.value);
          if (parsed !== null) {
            onChange({ ...value, startMin: snapToQuarter(parsed) });
          }
        }}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">to</span>
      <input
        type="time"
        step={QUARTER_HOUR_SECONDS}
        value={minutesToHHMM(value.endMin)}
        onChange={(event) => {
          const parsed = hhmmToMinutes(event.target.value);
          if (parsed !== null) {
            onChange({ ...value, endMin: snapToQuarter(parsed) });
          }
        }}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove range"
        className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}
