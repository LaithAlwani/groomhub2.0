"use client";

import type { ComponentType } from "react";
import { Navigate } from "react-big-calendar";
// react-big-calendar v1 exposes TimeGrid only via the internal `lib/` path and
// the upstream type defs don't declare it, so we import the JS module directly
// and type the import as a generic React component below.
// @ts-expect-error -- missing types for lib/TimeGrid
import TimeGrid from "react-big-calendar/lib/TimeGrid";
import { addDays } from "date-fns";

type DayRangeProps = { date: Date } & Record<string, unknown>;

type NavigateAction = (typeof Navigate)[keyof typeof Navigate];

type ViewStatics = {
  range: (date: Date) => Date[];
  navigate: (date: Date, action: NavigateAction) => Date;
  title: (date: Date) => string;
};

/**
 * RBC's TimeGrid filters events to those inside `[range[0],
 * endOfDay(range[last])]`. If `range[0]` carries a mid-day time, earlier events
 * on the first day get dropped — so normalize to start-of-day.
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

const TimeGridComponent = TimeGrid as unknown as ComponentType<
  Record<string, unknown>
>;

/**
 * Build a custom react-big-calendar time-grid view that shows `dayCount`
 * CONSECUTIVE days starting at the focused `date` — a rolling window, NOT
 * week-aligned. This is what lets the toolbar's one-day prev/next arrows shift
 * the visible window by a single day in every multi-day view (the built-in
 * Week view snaps to Sun–Sat, so one-day steps look like they do nothing until
 * the date crosses a week boundary). The `range`/`navigate`/`title` statics are
 * required — RBC reads them to drive the toolbar and heading.
 */
export function createDayRangeView(
  dayCount: number,
): ComponentType<DayRangeProps> & ViewStatics {
  const range = (date: Date): Date[] => {
    const start = startOfDay(date);
    return Array.from({ length: dayCount }, (_, index) =>
      addDays(start, index),
    );
  };

  const navigate = (date: Date, action: NavigateAction): Date => {
    const start = startOfDay(date);
    if (action === Navigate.PREVIOUS) return addDays(start, -dayCount);
    if (action === Navigate.NEXT) return addDays(start, dayCount);
    return start;
  };

  const title = (date: Date): string => {
    const start = startOfDay(date);
    const end = addDays(start, dayCount - 1);
    const startLabel = start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const endLabel = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startLabel} – ${endLabel}`;
  };

  function DayRangeViewFn(props: DayRangeProps) {
    return (
      <TimeGridComponent {...props} range={range(props.date)} eventOffset={15} />
    );
  }

  return Object.assign(DayRangeViewFn, { range, navigate, title });
}
