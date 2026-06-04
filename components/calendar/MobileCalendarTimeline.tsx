"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { nowInTimezone } from "@/lib/locationTime";
import type { CalendarEvent } from "./calendarStyles";
import { isoDateKey } from "./calendarStyles";
import { MobileTimelineEventCard } from "./MobileTimelineEventCard";
import {
  addDays,
  atHour,
  bounds,
  formatHourLabel,
  HOUR_HEIGHT,
  isSameDay,
  sameDayEvents,
} from "./mobileTimelineHelpers";

/**
 * Mobile-only vertical timeline view of the calendar. The desktop
 * `react-big-calendar` instance is hidden below `md` and this takes its place.
 * Renders one day at a time; the prev/next arrows step by a single day.
 *
 * Events are positioned absolutely against an hour grid (`top` derived from the
 * minute offset, `height` from the duration).
 */
export function MobileCalendarTimeline({
  events,
  availabilityByDate,
  date,
  locationTimezone,
  onDateChange,
  onSelectEvent,
  onSelectSlot,
}: {
  events: ReadonlyArray<CalendarEvent>;
  availabilityByDate: Record<string, Array<{ startMin: number; endMin: number }>>;
  date: Date;
  /** IANA timezone for the active location; drives "now" / "today" so they
   *  agree with the wall-clock the timeline is rendering. */
  locationTimezone: string;
  onDateChange: (next: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (info: { start: Date; end: Date }) => void;
}) {
  const dayEvents = useMemo(() => sameDayEvents(events, date), [events, date]);
  const daySlots = availabilityByDate[isoDateKey(date)];
  const { startHour, endHour } = useMemo(
    () => bounds(dayEvents, daySlots),
    [dayEvents, daySlots],
  );

  // Track "now" as a pseudo-Date getTime() in the location TZ so that
  // `new Date(nowMs).getHours()` returns the shop's wall-clock hour, not
  // the viewer's. Refreshes every minute.
  const [nowMs, setNowMs] = useState(
    () => nowInTimezone(locationTimezone).getTime(),
  );
  useEffect(() => {
    const id = window.setInterval(
      () => setNowMs(nowInTimezone(locationTimezone).getTime()),
      60 * 1000,
    );
    return () => window.clearInterval(id);
  }, [locationTimezone]);

  const isToday = isSameDay(new Date(nowMs), date);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, index) => startHour + index,
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The hour-of-day currently anchored at the top of the viewport. Updated
  // on scroll; used to preserve the user's time-of-day across re-renders
  // when `startHour` shifts (e.g. switching staff brings in different
  // availability, which rebounds the timeline). Without this, the grid
  // translates under the user and the time they were looking at jumps.
  const anchorHourRef = useRef<number | null>(null);

  function handleScroll() {
    if (!scrollRef.current) return;
    anchorHourRef.current =
      startHour + scrollRef.current.scrollTop / HOUR_HEIGHT;
  }

  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    const now = new Date(nowMs);
    const offsetMin = (now.getHours() - startHour) * 60 + now.getMinutes();
    if (offsetMin <= 0) return;
    const targetScrollTop = (offsetMin / 60) * HOUR_HEIGHT - 120;
    scrollRef.current.scrollTop = targetScrollTop;
    anchorHourRef.current = startHour + targetScrollTop / HOUR_HEIGHT;
    // Mount-only auto-scroll so we don't yank the user's pan position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the timeline rebounds (different staff, different day's availability)
  // re-snap scrollTop so the same time-of-day stays in view. Uses layout
  // effect so the correction happens before paint — no visible flicker.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    if (anchorHourRef.current === null) return;
    const targetScrollTop =
      (anchorHourRef.current - startHour) * HOUR_HEIGHT;
    if (Math.abs(scrollRef.current.scrollTop - targetScrollTop) < 1) return;
    scrollRef.current.scrollTop = Math.max(0, targetScrollTop);
  }, [startHour]);

  return (
    <div className="flex h-[70vh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          {isToday && (
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
              Today
            </p>
          )}
          <p className="text-xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
            {date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StepButton
            label="Previous day"
            onClick={() => onDateChange(addDays(date, -1))}
          >
            <ChevronLeft size={16} />
          </StepButton>
          <StepButton
            label="Next day"
            onClick={() => onDateChange(addDays(date, 1))}
          >
            <ChevronRight size={16} />
          </StepButton>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-4 py-2"
      >
        <div
          className="relative ml-14"
          style={{ height: hours.length * HOUR_HEIGHT }}
        >
          {hours.map((hour) => (
            <button
              key={hour}
              type="button"
              onClick={() =>
                onSelectSlot({
                  start: atHour(date, hour),
                  end: atHour(date, hour + 1),
                })
              }
              className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800"
              style={{
                top: (hour - startHour) * HOUR_HEIGHT,
                height: HOUR_HEIGHT,
              }}
              aria-label={`Book ${formatHourLabel(hour)}`}
            >
              <span className="absolute -left-14 top-0 -translate-y-1/2 bg-white px-2 text-xs font-medium text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
                {formatHourLabel(hour)}
              </span>
            </button>
          ))}

          {dayEvents.map((event) => (
            <MobileTimelineEventCard
              key={event.id}
              event={event}
              startHour={startHour}
              onClick={() => onSelectEvent(event)}
            />
          ))}

          {isToday && (
            <CurrentTimeLine
              startHour={startHour}
              endHour={endHour}
              nowMs={nowMs}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentTimeLine({
  startHour,
  endHour,
  nowMs,
}: {
  startHour: number;
  endHour: number;
  nowMs: number;
}) {
  const now = new Date(nowMs);
  const offsetMin = (now.getHours() - startHour) * 60 + now.getMinutes();
  // Hide the indicator when the shop is closed (before today's availability
  // starts or after it ends) — no value in pointing at a slot that doesn't
  // exist on the rendered grid.
  if (offsetMin < 0 || offsetMin > (endHour - startHour) * 60) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top: (offsetMin / 60) * HOUR_HEIGHT }}
    >
      <span className="absolute -left-2 h-3 w-3 -translate-y-1/2 rounded-full bg-orange-500" />
      <span className="h-px flex-1 bg-orange-500" />
      <span className="absolute right-0 -translate-y-1/2 rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
        {now.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}
