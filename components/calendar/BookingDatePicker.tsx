"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS_SHORT, todayIsoDate } from "@/lib/time";

/**
 * Month-grid date picker for booking. Days the groomer can't be booked (outside
 * their working hours, days off, or fully booked) render disabled/struck-through
 * so the booker sees the whole month at a glance instead of a flat dropdown.
 */
export function BookingDatePicker({
  value,
  availableDates,
  onChange,
}: {
  value: string;
  availableDates: ReadonlyArray<string>;
  onChange: (date: string) => void;
}) {
  const today = todayIsoDate();
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const anchor = value || availableDates[0] || today;
  const [year, setYear] = useState(() => Number(anchor.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(anchor.slice(5, 7)) - 1);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  function goPrev() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }
  function goNext() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next month"
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {WEEKDAYS_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) =>
          cell ? (
            <DayCell
              key={cell.date}
              date={cell.date}
              disabled={!availableSet.has(cell.date)}
              selected={cell.date === value}
              isToday={cell.date === today}
              onClick={() => onChange(cell.date)}
            />
          ) : (
            <span key={`blank-${index}`} aria-hidden />
          ),
        )}
      </div>
    </div>
  );
}

function DayCell({
  date,
  disabled,
  selected,
  isToday,
  onClick,
}: {
  date: string;
  disabled: boolean;
  selected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const day = Number(date.slice(8, 10));
  const base =
    "flex aspect-square items-center justify-center rounded-md text-xs transition-colors";
  const className = disabled
    ? `${base} cursor-not-allowed text-zinc-300 line-through dark:text-zinc-700`
    : selected
      ? `${base} bg-orange-500 font-semibold text-white`
      : isToday
        ? `${base} border border-orange-300 text-zinc-900 hover:bg-orange-50 dark:border-orange-700 dark:text-zinc-100 dark:hover:bg-orange-950/40`
        : `${base} text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900`;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {day}
    </button>
  );
}

function buildMonthCells(
  year: number,
  month: number,
): ReadonlyArray<{ date: string } | null> {
  const first = new Date(year, month, 1);
  const leadingBlanks = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string } | null> = [];
  for (let blank = 0; blank < leadingBlanks; blank += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
