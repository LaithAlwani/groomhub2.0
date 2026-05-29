"use client";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = [0, 15, 30, 45] as const;

/**
 * 15-minute time picker rendered as two selects (hour + minute) inside one
 * bordered shell. Native `<input type="time">` ignores `step` for its picker
 * UI on every browser we care about, so users would still see all 60 minutes —
 * this enforces 00/15/30/45 visually.
 *
 * Value + onChange use the same "HH:MM" 24-hour shape the rest of the app
 * uses, so it drops into existing form state without conversion.
 */
export function TimeSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
}) {
  const [hh, mm] = value.split(":");
  const hour = clampNumber(Number(hh), 0, 23);
  const minute = snapToQuarter(clampNumber(Number(mm), 0, 59));

  function emit(nextHour: number, nextMinute: number) {
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-stretch rounded-lg border border-zinc-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <select
        value={hour}
        onChange={(event) => emit(Number(event.target.value), minute)}
        aria-label="Hour"
        className="min-w-14 appearance-none rounded-l-lg bg-transparent py-2 pl-3 pr-2 text-base text-zinc-900 focus:outline-none dark:text-zinc-100 sm:text-sm"
      >
        {HOURS.map((value) => (
          <option key={value} value={value}>
            {pad(value)}
          </option>
        ))}
      </select>
      <span className="self-center text-sm text-zinc-400" aria-hidden>
        :
      </span>
      <select
        value={minute}
        onChange={(event) => emit(hour, Number(event.target.value))}
        aria-label="Minute"
        className="min-w-14 appearance-none rounded-r-lg bg-transparent py-2 pl-2 pr-3 text-base text-zinc-900 focus:outline-none dark:text-zinc-100 sm:text-sm"
      >
        {MINUTES.map((value) => (
          <option key={value} value={value}>
            {pad(value)}
          </option>
        ))}
      </select>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function snapToQuarter(minute: number): number {
  const snapped = Math.round(minute / 15) * 15;
  return snapped >= 60 ? 45 : snapped;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
