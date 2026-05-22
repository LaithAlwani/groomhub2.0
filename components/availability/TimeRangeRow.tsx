"use client";

import { X } from "lucide-react";
import { TimeSelect } from "@/components/forms/TimeSelect";
import { hhmmToMinutes, minutesToHHMM, snapToQuarter } from "@/lib/time";

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
      <TimeSelect
        value={minutesToHHMM(value.startMin)}
        onChange={(next) => {
          const parsed = hhmmToMinutes(next);
          if (parsed !== null) onChange({ ...value, startMin: snapToQuarter(parsed) });
        }}
        ariaLabel="Start time"
      />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">to</span>
      <TimeSelect
        value={minutesToHHMM(value.endMin)}
        onChange={(next) => {
          const parsed = hhmmToMinutes(next);
          if (parsed !== null) onChange({ ...value, endMin: snapToQuarter(parsed) });
        }}
        ariaLabel="End time"
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
