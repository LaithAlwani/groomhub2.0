"use client";

import type { CalendarEvent } from "./calendarStyles";
import { cardStyles, statusLabel } from "./mobileTimelineHelpers";

/**
 * Custom event renderer for react-big-calendar (desktop). Replaces RBC's
 * default flat block with a card that has a thick colored left border + a
 * two-line content layout (pet name / service · time), matching the reference
 * design. Background and accent are derived from the event status and the
 * service color stamped by `CalendarPageBody.events`.
 *
 * `eventPropGetter` in Calendar.tsx still controls the outer wrapper styling
 * (transparency, padding) — this component renders the interior.
 */
export function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const styles = cardStyles(event);
  const titleParts = event.title.split(" · ");
  const petName = titleParts[0] ?? event.title;
  const detail = titleParts.slice(1).join(" · ");

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-md px-2 py-1.5 text-left"
      style={{
        borderLeft: `4px solid ${styles.accent}`,
        backgroundColor: `${styles.accent}1a`,
      }}
    >
      <p
        className="truncate text-[11px] font-bold leading-tight"
        style={{ color: styles.chipFg }}
      >
        {petName}
      </p>
      {detail && (
        <p
          className="truncate text-[10px] leading-tight opacity-80"
          style={{ color: styles.chipFg }}
        >
          {detail}
        </p>
      )}
      <span className="sr-only">{statusLabel(event.status)}</span>
    </div>
  );
}
