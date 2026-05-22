"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatLocalDate } from "@/lib/time";
import { TimeRangeRow, type TimeRange } from "./TimeRangeRow";

type Mode = "default" | "off" | "custom";

const DEFAULT_RANGE: TimeRange = { startMin: 9 * 60, endMin: 17 * 60 };

export function DayOverrideDialog({
  date,
  initialKind,
  initialSlots,
  busy,
  onClose,
  onSetOff,
  onSetCustom,
  onClear,
}: {
  date: string;
  initialKind: "off" | "custom" | null;
  initialSlots: ReadonlyArray<TimeRange>;
  busy: boolean;
  onClose: () => void;
  onSetOff: () => Promise<void>;
  onSetCustom: (slots: TimeRange[]) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(initialKind ?? "default");
  const [slots, setSlots] = useState<TimeRange[]>(
    initialSlots.length > 0
      ? initialSlots.map((slot) => ({ ...slot }))
      : [{ ...DEFAULT_RANGE }],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialKind ?? "default");
    setSlots(
      initialSlots.length > 0
        ? initialSlots.map((slot) => ({ ...slot }))
        : [{ ...DEFAULT_RANGE }],
    );
  }, [date, initialKind, initialSlots]);

  async function handleApply() {
    setError(null);
    try {
      if (mode === "default") {
        await onClear();
        return;
      }
      if (mode === "off") {
        await onSetOff();
        return;
      }
      const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
      for (let index = 0; index < sorted.length; index++) {
        const slot = sorted[index];
        if (slot.startMin >= slot.endMin) {
          setError("Each slot's start time must be before its end time.");
          return;
        }
        if (index > 0 && slot.startMin < sorted[index - 1].endMin) {
          setError("Slots can't overlap.");
          return;
        }
      }
      await onSetCustom(sorted);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {formatLocalDate(date)}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Override the weekly schedule for this single day.
        </p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <Option
            checked={mode === "default"}
            onChange={() => setMode("default")}
            label="Use weekly default"
            description="Remove any override for this date."
          />
          <Option
            checked={mode === "off"}
            onChange={() => setMode("off")}
            label="Mark day off"
            description="Day is unavailable for bookings."
          />
          <Option
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
            label="Custom slots"
            description="Replace the weekly pattern with the slots below."
          />
        </fieldset>
        {mode === "custom" && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            {slots.map((slot, index) => (
              <TimeRangeRow
                key={index}
                value={slot}
                onChange={(next) =>
                  setSlots(slots.map((row, position) => (position === index ? next : row)))
                }
                onRemove={() =>
                  setSlots(slots.filter((_, position) => position !== index))
                }
              />
            ))}
            <button
              type="button"
              onClick={() => setSlots([...slots, { ...DEFAULT_RANGE }])}
              className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
            >
              <Plus size={12} />
              Add slot
            </button>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {busy ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Option({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  );
}
