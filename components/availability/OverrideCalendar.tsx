"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAYS_SHORT, todayIsoDate } from "@/lib/time";

export type OverrideRow = {
  date: string;
  kind: "off" | "custom";
  slots?: Array<{ startMin: number; endMin: number }>;
};

export function OverrideCalendar({
  overrides,
  onSelectDate,
}: {
  overrides: ReadonlyArray<OverrideRow>;
  onSelectDate: (date: string) => void;
}) {
  const today = todayIsoDate();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);

  const overrideByDate = useMemo(() => {
    const map = new Map<string, OverrideRow>();
    for (const row of overrides) map.set(row.date, row);
    return map;
  }, [overrides]);

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
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {monthLabel}
        </h3>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next month"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {WEEKDAYS_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) =>
          cell ? (
            <DayCell
              key={cell.date}
              date={cell.date}
              isToday={cell.date === today}
              override={overrideByDate.get(cell.date)}
              onClick={() => onSelectDate(cell.date)}
            />
          ) : (
            <span key={Math.random()} aria-hidden />
          ),
        )}
      </div>
      <Legend />
    </div>
  );
}

function DayCell({
  date,
  isToday,
  override,
  onClick,
}: {
  date: string;
  isToday: boolean;
  override: OverrideRow | undefined;
  onClick: () => void;
}) {
  const dayNumber = Number(date.slice(8, 10));
  const className = cellClassName(override, isToday);
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={`Override for ${date}`}
    >
      <span>{dayNumber}</span>
      {override?.kind === "off" && (
        <span className="text-[9px] font-medium uppercase tracking-wide">Off</span>
      )}
      {override?.kind === "custom" && (
        <span className="text-[9px] font-medium uppercase tracking-wide">Custom</span>
      )}
    </button>
  );
}

function cellClassName(
  override: OverrideRow | undefined,
  isToday: boolean,
): string {
  const base =
    "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-xs transition-colors";
  if (override?.kind === "off") {
    return `${base} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300`;
  }
  if (override?.kind === "custom") {
    return `${base} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300`;
  }
  if (isToday) {
    return `${base} border border-zinc-300 bg-zinc-50 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`;
  }
  return `${base} border border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900`;
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-red-300 dark:bg-red-700" />
        Off
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-blue-300 dark:bg-blue-700" />
        Custom slots
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        Uses weekly default
      </span>
    </div>
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
  for (let blank = 0; blank < leadingBlanks; blank++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
