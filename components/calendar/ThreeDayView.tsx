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

const range = (date: Date): Date[] => [date, addDays(date, 1), addDays(date, 2)];

const navigate = (date: Date, action: NavigateAction): Date => {
  if (action === Navigate.PREVIOUS) return addDays(date, -3);
  if (action === Navigate.NEXT) return addDays(date, 3);
  return date;
};

const title = (date: Date): string => {
  const end = addDays(date, 2);
  const startLabel = date.toLocaleDateString(undefined, {
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
 */
function ThreeDayViewFn(props: ThreeDayProps) {
  return <TimeGridComponent {...props} range={range(props.date)} eventOffset={15} />;
}

export const ThreeDayView: ComponentType<ThreeDayProps> & ViewStatics = Object.assign(
  ThreeDayViewFn,
  { range, navigate, title },
);
