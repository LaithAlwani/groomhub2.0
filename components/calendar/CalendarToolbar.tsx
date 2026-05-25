"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ToolbarProps, View } from "react-big-calendar";

const VIEW_OPTIONS: Array<{ key: View; label: string }> = [
  { key: "day" as View, label: "Day" },
  { key: "threeDay" as View, label: "3 days" },
  { key: "week" as View, label: "Week" },
  { key: "agenda" as View, label: "Agenda" },
];

/**
 * Replacement for react-big-calendar's default toolbar. Left cluster:
 * Today button + prev/next arrows + the resolved label (e.g. "May 17 — 23, 2024").
 * Right cluster: pill segmented control for Week / 3 days / Day / Agenda.
 *
 * The prev/next arrows always step by **one day**, regardless of the active
 * view — RBC's default `PREV`/`NEXT` actions delegate to the view's
 * `navigate` static (1 day for Day, 3 for 3-Day, 7 for Week). We override by
 * computing the next date ourselves and dispatching `onNavigate("DATE", ...)`
 * which simply sets the date without invoking the view's stepper.
 *
 * Passed to <BigCalendar components={{ toolbar: CalendarToolbar }}> from
 * `Calendar.tsx`.
 */
export function CalendarToolbar({
  date,
  label,
  onNavigate,
  onView,
  view,
}: ToolbarProps) {
  function stepDay(delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    onNavigate("DATE", next);
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate("TODAY")}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Today
        </button>
        <div className="flex items-center overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => stepDay(-1)}
            className="border-r border-zinc-200 bg-white p-2 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => stepDay(1)}
            className="bg-white p-2 text-zinc-600 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="ml-2 text-lg font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        {VIEW_OPTIONS.map((option) => {
          const active = view === option.key;
          const className = active
            ? "rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-[#00273c] shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
            : "rounded-md px-4 py-1.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-[#00273c] dark:text-zinc-400 dark:hover:text-zinc-100";
          return (
            <button
              key={String(option.key)}
              type="button"
              onClick={() => onView(option.key)}
              className={className}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
