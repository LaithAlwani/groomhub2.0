"use client";

import { Clock } from "lucide-react";
import type { CalendarEvent } from "./calendarStyles";
import {
  cardStyles,
  formatTimeRange,
  HOUR_HEIGHT,
  statusLabel,
} from "./mobileTimelineHelpers";

export function MobileTimelineEventCard({
  event,
  startHour,
  onClick,
}: {
  event: CalendarEvent;
  startHour: number;
  onClick: () => void;
}) {
  const startMin =
    (event.start.getHours() - startHour) * 60 + event.start.getMinutes();
  const durationMin = Math.max(
    30,
    (event.end.getTime() - event.start.getTime()) / 60000,
  );
  const styles = cardStyles(event);
  const titleParts = event.title.split(" · ");
  const petName = titleParts[0] ?? event.title;
  const detail = titleParts.slice(1).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-2 right-2 overflow-hidden rounded-xl bg-white text-left shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900"
      style={{
        top: (startMin / 60) * HOUR_HEIGHT,
        height: Math.max(56, (durationMin / 60) * HOUR_HEIGHT - 6),
        borderLeft: `4px solid ${styles.accent}`,
      }}
    >
      <div className="flex h-full items-start gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-semibold text-[#00273c] dark:text-zinc-50">
            {petName}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            <Clock size={11} aria-hidden />
            {formatTimeRange(event.start, event.end)}
          </p>
          {detail && (
            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {detail}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: styles.chipBg, color: styles.chipFg }}
        >
          {statusLabel(event.status)}
        </span>
      </div>
    </button>
  );
}
