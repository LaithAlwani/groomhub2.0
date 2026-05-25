"use client";

import type { ComponentType } from "react";
import { Navigate } from "react-big-calendar";
// react-big-calendar v1 exposes TimeGrid only via the internal `lib/` path and
// the upstream type defs don't declare it, so we import the JS module directly
// and type the import as a generic React component below.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- missing types for lib/TimeGrid
import TimeGrid from "react-big-calendar/lib/TimeGrid";
import { addDays } from "date-fns";

type ThreeDayProps = { date: Date } & Record<string, unknown>;

type NavigateAction = (typeof Navigate)[keyof typeof Navigate];

type ViewStatics = {
  range: (date: Date) => Date[];
  navigate: (date: Date, action: NavigateAction) => Date;
  title: (date: Date) => string;
};

/**
 * RBC's TimeGrid filters events to those that fall inside `[range[0],
 * endOfDay(range[range.length-1])]`. If `range[0]` carries a mid-day time
 * (because the user switched views while `date` was set to a non-midnight
 * value), every event earlier than that wall time on the first day gets
 * silently dropped. Normalizing to start-of-day keeps the filter aligned
 * with the user's mental "this day, that day, the next day" model.
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

const range = (date: Date): Date[] => {
  const start = startOfDay(date);
  return [start, addDays(start, 1), addDays(start, 2)];
};

const navigate = (date: Date, action: NavigateAction): Date => {
  const start = startOfDay(date);
  if (action === Navigate.PREVIOUS) return addDays(start, -3);
  if (action === Navigate.NEXT) return addDays(start, 3);
  return start;
};

const title = (date: Date): string => {
  const start = startOfDay(date);
  const end = addDays(start, 2);
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

const TimeGridComponent = TimeGrid as unknown as ComponentType<
  Record<string, unknown>
>;

/**
 * Custom 3-day view for react-big-calendar. Statics `range` / `navigate` /
 * `title` are required — the calendar toolbar reads them to drive prev/next
 * and the heading. Renders the underlying TimeGrid with a 3-day window.
 *
 * The `range` prop passed to TimeGrid is always normalized to start-of-day so
 * event filtering covers the full first day, not from whatever time-of-day
 * the focused `date` happened to carry.
 */
function ThreeDayViewFn(props: ThreeDayProps) {
  return <TimeGridComponent {...props} range={range(props.date)} eventOffset={15} />;
}

export const ThreeDayView: ComponentType<ThreeDayProps> & ViewStatics = Object.assign(
  ThreeDayViewFn,
  { range, navigate, title },
);
