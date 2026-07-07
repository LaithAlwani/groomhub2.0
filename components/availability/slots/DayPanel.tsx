"use client";

import { RotateCw, X } from "lucide-react";
import {
  TIME_OPTIONS,
  longDateLabel,
  WEEKDAY_NAMES,
  dowOf,
  type EffectiveDay,
} from "./availabilitySlots";

/**
 * The selected-day panel: booked-off toggle, "repeat weekly" toggle, and the
 * list of start–end slot selects with add/remove. Edits are lifted to the
 * parent, which decides whether they land on the weekly template (when the day
 * is following the repeat) or a per-date override.
 */
export function DayPanel({
  dateStr,
  effective,
  error,
  onToggleBookOff,
  onToggleRepeat,
  onAddSlot,
  onRemoveSlot,
  onSlotTimeChange,
}: {
  dateStr: string;
  effective: EffectiveDay;
  error: string;
  onToggleBookOff: () => void;
  onToggleRepeat: () => void;
  onAddSlot: () => void;
  onRemoveSlot: (slotId: number) => void;
  onSlotTimeChange: (slotId: number, which: "start" | "end", value: string) => void;
}) {
  const weekdayName = WEEKDAY_NAMES[dowOf(dateStr)];
  const slots = [...effective.slots].sort((a, b) => a.start - b.start);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">
            {longDateLabel(dateStr)}
          </div>
          {effective.repeat && (
            <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <RotateCw size={11} />
              Following weekly repeat
            </div>
          )}
        </div>
        <label
          className={`flex cursor-pointer items-center gap-2 text-[13px] font-semibold ${
            effective.bookedOff
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <input
            type="checkbox"
            checked={effective.bookedOff}
            onChange={onToggleBookOff}
            className="h-4 w-4 cursor-pointer accent-red-600"
          />
          Book off
        </label>
      </div>

      {effective.bookedOff ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-[13.5px] text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          This day is booked off. No bookings will be taken.
        </div>
      ) : (
        <>
          <label className="mb-3.5 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={effective.repeat}
              onChange={onToggleRepeat}
              className="h-4 w-4 cursor-pointer accent-orange-500"
            />
            <RotateCw size={12} className="text-orange-500" />
            Repeat weekly on {weekdayName}s
          </label>

          {slots.length > 0 ? (
            <div className="flex flex-col gap-2">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-2">
                  <TimeSelect
                    value={String(slot.start)}
                    onChange={(value) => onSlotTimeChange(slot.id, "start", value)}
                  />
                  <span className="text-xs text-zinc-400">–</span>
                  <TimeSelect
                    value={String(slot.end)}
                    onChange={(value) => onSlotTimeChange(slot.id, "end", value)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveSlot(slot.id)}
                    aria-label="Remove slot"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2.5 text-[13px] text-zinc-400 dark:text-zinc-500">
              No slots yet — this day is closed. Add one below to open it.
            </p>
          )}

          <button
            type="button"
            onClick={onAddSlot}
            className="mt-2.5 rounded-lg border border-dashed border-orange-300 bg-orange-50/60 px-3 py-2 text-[13px] font-semibold text-orange-600 transition-colors hover:bg-orange-100/60 dark:border-orange-500/40 dark:bg-orange-950/20 dark:text-orange-300"
          >
            + Add a slot
          </button>

          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </>
      )}
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-[13.5px] text-zinc-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {TIME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
