"use client";

import { useMemo } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./calendarTheme.css";
import { ThreeDayView } from "./ThreeDayView";
import { CalendarDayHeader } from "./CalendarDayHeader";
import { CalendarEventCard } from "./CalendarEventCard";
import { CalendarToolbar } from "./CalendarToolbar";
import { MobileCalendarTimeline } from "./MobileCalendarTimeline";
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

const FORMATS = {
  // Hour gutter labels: "08:00 AM" / "01:00 PM"
  timeGutterFormat: (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
};

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
  const bounds = useMemo(
    () => computeBounds(availabilityByDate),
    [availabilityByDate],
  );
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
    <>
      <div className="min-[874px]:hidden">
        <MobileCalendarTimeline
          events={events}
          availabilityByDate={availabilityByDate}
          date={date}
          onDateChange={onDateChange}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
        />
      </div>
      <div className="rbc-wrapper hidden min-[874px]:block">
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
          formats={FORMATS as never}
          components={
            {
              toolbar: CalendarToolbar,
              event: CalendarEventCard,
              week: { header: CalendarDayHeader },
              day: { header: CalendarDayHeader },
              threeDay: { header: CalendarDayHeader },
            } as never
          }
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
            onEventDrop({
              id: (event as CalendarEvent).id,
              start: new Date(start),
            })
          }
          slotPropGetter={slotPropGetter}
          dayPropGetter={dayPropGetter}
          eventPropGetter={(event) => eventStyle(event as CalendarEvent)}
          style={{ height: "70vh" }}
        />
      </div>
    </>
  );
}
