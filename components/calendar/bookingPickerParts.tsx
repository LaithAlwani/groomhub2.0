"use client";

import { RequiredMark } from "@/components/forms/RequiredMark";

/** Small presentational + time helpers for `AvailabilitySlotPicker`. */

export function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Date &amp; time
        <RequiredMark />
      </span>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        {text}
      </div>
    </div>
  );
}

export function TimeHint({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
      {text}
    </p>
  );
}

/** The wrap of tappable slot chips (or an inline hint) for the chosen date. */
export function SlotChips({
  dateChosen,
  slots,
  currentMin,
  onPick,
}: {
  dateChosen: boolean;
  slots: ReadonlyArray<{ startMin: number; endMin: number }>;
  currentMin: number;
  onPick: (startMin: number) => void;
}) {
  if (!dateChosen) return <TimeHint text="Pick a date first" />;
  if (slots.length === 0) return <TimeHint text="No open slots that day" />;
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => {
        const selected = slot.startMin === currentMin;
        return (
          <button
            key={slot.startMin}
            type="button"
            onClick={() => onPick(slot.startMin)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-orange-500/40 dark:hover:bg-orange-950/20"
            }`}
          >
            {formatTimeLabel(slot.startMin)} – {formatTimeLabel(slot.endMin)}
          </button>
        );
      })}
    </div>
  );
}

export function toMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return -1;
  return hh * 60 + mm;
}

export function minutesToTimeValue(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function formatTimeLabel(min: number): string {
  const hour = Math.floor(min / 60);
  const minute = min % 60;
  const ampm = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

type OpenSlot = { startMin: number; endMin: number };

/**
 * Where a fresh booking should land: `null` if the current (date,time) is
 * already a valid slot; otherwise snap to the slot containing the current time,
 * else the first available slot for the groomer.
 */
export function firstAvailableSelection(
  slotsByDate: Record<string, ReadonlyArray<OpenSlot>>,
  availableDates: ReadonlyArray<string>,
  date: string,
  time: string,
): { date?: string; time: string } | null {
  const daySlots = (date && slotsByDate[date]) || [];
  const cur = toMinutes(time);
  if (daySlots.some((slot) => slot.startMin === cur)) return null;
  const containing = daySlots.find(
    (slot) => cur >= slot.startMin && cur < slot.endMin,
  );
  if (containing) return { time: minutesToTimeValue(containing.startMin) };
  const firstDate = [...availableDates].sort()[0];
  if (!firstDate) return null;
  const first = slotsByDate[firstDate]?.[0];
  return {
    date: firstDate,
    time: first ? minutesToTimeValue(first.startMin) : "",
  };
}
