"use client";

import { useMemo } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { ThreeDayView } from "./ThreeDayView";
import {
  computeBounds,
  eventStyle,
  isoDateKey,
  pastSlotStyle,
  unavailableSlotStyle,
  type CalendarEvent,
} from "./calendarStyles";

export type { CalendarEvent };

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date | number) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(BigCalendar);

const VIEWS = {
  week: true,
  threeDay: ThreeDayView,
  day: true,
  agenda: true,
} as const;

const MESSAGES = {
  week: "Week",
  day: "Day",
  agenda: "Agenda",
  threeDay: "3 days",
} as const;

export function Calendar({
  events,
  availabilityByDate,
  view,
  date,
  onViewChange,
  onDateChange,
  onSelectSlot,
  onSelectEvent,
  onEventDrop,
}: {
  events: ReadonlyArray<CalendarEvent>;
  availabilityByDate: Record<string, Array<{ startMin: number; endMin: number }>>;
  view: string;
  date: Date;
  onViewChange: (view: string) => void;
  onDateChange: (date: Date) => void;
  onSelectSlot: (info: { start: Date; end: Date }) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEventDrop: (info: { id: string; start: Date }) => void;
}) {
  const bounds = useMemo(() => computeBounds(availabilityByDate), [availabilityByDate]);
  const now = useMemo(() => Date.now(), [date]);

  const slotPropGetter = useMemo(
    () => (slotDate: Date) => {
      if (view === "month" || view === "agenda") return {};
      if (slotDate.getTime() < now) return { style: pastSlotStyle };
      const slots = availabilityByDate[isoDateKey(slotDate)];
      if (!slots) return {};
      const minutes = slotDate.getHours() * 60 + slotDate.getMinutes();
      const isAvailable = slots.some(
        (slot) => slot.startMin <= minutes && minutes < slot.endMin,
      );
      if (!isAvailable) return { style: unavailableSlotStyle };
      return {};
    },
    [availabilityByDate, view, now],
  );

  const dayPropGetter = useMemo(
    () => (day: Date) => {
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      if (endOfDay.getTime() < now) {
        return { style: { backgroundColor: "rgba(228, 228, 231, 0.25)" } };
      }
      return {};
    },
    [now],
  );

  return (
    <div className="rbc-wrapper rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      <DnDCalendar
        localizer={localizer}
        events={events as unknown as object[]}
        view={view as never}
        date={date}
        onView={(next) => onViewChange(next as string)}
        onNavigate={onDateChange}
        defaultView="week"
        views={VIEWS as never}
        messages={MESSAGES as never}
        step={15}
        timeslots={4}
        min={bounds.min}
        max={bounds.max}
        selectable={true}
        longPressThreshold={100}
        resizable={false}
        onSelectSlot={(info) => {
          if (info.start.getTime() < Date.now()) return;
          onSelectSlot({ start: info.start, end: info.end });
        }}
        onSelectEvent={(event) => onSelectEvent(event as CalendarEvent)}
        onEventDrop={({ event, start }) =>
          onEventDrop({ id: (event as CalendarEvent).id, start: new Date(start) })
        }
        slotPropGetter={slotPropGetter}
        dayPropGetter={dayPropGetter}
        eventPropGetter={(event) => eventStyle(event as CalendarEvent)}
        style={{ height: "70vh" }}
      />
    </div>
  );
}
