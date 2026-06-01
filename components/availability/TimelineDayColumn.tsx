"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { snapToQuarter } from "@/lib/time";
import { TimelineRibbon } from "./TimelineRibbon";

export type DayRange = { startMin: number; endMin: number };

const NEW_RANGE_DURATION = 60; // minutes when click-adding a new shift

/**
 * One day column in the weekly timeline grid: header (label + on/off
 * toggle), hour-grid background, and the absolutely-positioned shift
 * ribbons. Clicking an empty area inserts a 1-hour ribbon snapped to the
 * click position.
 */
export function TimelineDayColumn({
  label,
  sublabel,
  ranges,
  isToday,
  pixelsPerMin,
  startGridMin,
  endGridMin,
  hourCount,
  onAddRange,
  onUpdateRange,
  onRemoveRange,
  onEditRange,
  onToggleEnabled,
  defaultRange,
  openRanges = [],
  shopConstrained = false,
}: {
  label: string;
  sublabel?: string;
  ranges: ReadonlyArray<DayRange>;
  isToday?: boolean;
  pixelsPerMin: number;
  startGridMin: number;
  endGridMin: number;
  hourCount: number;
  onAddRange: (range: DayRange) => void;
  onUpdateRange: (index: number, range: DayRange) => void;
  onRemoveRange: (index: number) => void;
  onEditRange: (index: number) => void;
  onToggleEnabled: () => void;
  defaultRange: DayRange;
  // The shop's open windows for this weekday. When `shopConstrained` is true the
  // closed times render as blocked bands and can't be added to.
  openRanges?: ReadonlyArray<DayRange>;
  shopConstrained?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const enabled = ranges.length > 0;
  const shopClosedAllDay = shopConstrained && openRanges.length === 0;
  const blockedBands = shopConstrained
    ? complementWithinGrid(openRanges, startGridMin, endGridMin)
    : [];

  function handleAddAtPointer(event: React.MouseEvent<HTMLDivElement>) {
    if (!bodyRef.current) return;
    if ((event.target as HTMLElement).closest("[data-ribbon]")) return;
    const rect = bodyRef.current.getBoundingClientRect();
    const offsetMin = (event.clientY - rect.top) / pixelsPerMin;
    const requestedStart = snapToQuarter(startGridMin + offsetMin);
    let start = Math.max(startGridMin, requestedStart);
    let end = start + NEW_RANGE_DURATION;
    if (end > endGridMin) {
      end = endGridMin;
      start = end - NEW_RANGE_DURATION;
    }
    if (shopConstrained) {
      // Only allow adding inside the shop's open hours; clamp to that window.
      const window = openRanges.find(
        (range) => start >= range.startMin && start < range.endMin,
      );
      if (!window) return;
      end = Math.min(end, window.endMin);
      start = Math.max(window.startMin, Math.min(start, end - 15));
    }
    const conflict = ranges.some(
      (range) => start < range.endMin && end > range.startMin,
    );
    if (conflict) {
      // Fall back to the standard default if the click would overlap an
      // existing ribbon — keeps the click forgiving.
      onAddRange({ ...defaultRange });
      return;
    }
    onAddRange({ startMin: start, endMin: end });
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div
        className={`flex h-14 flex-col items-center justify-center gap-1 border-b border-zinc-200 px-2 dark:border-zinc-800 ${
          isToday ? "bg-orange-50/60 dark:bg-orange-950/20" : ""
        }`}
      >
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            enabled
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {sublabel}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={shopClosedAllDay}
          title={shopClosedAllDay ? "The shop is closed this day" : undefined}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            enabled
              ? "bg-orange-500"
              : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div
        ref={bodyRef}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          if ((event.target as HTMLElement).closest("[data-ribbon]")) return;
          // Defer the add until mouseup so a click-and-drag elsewhere isn't
          // mistaken for an add gesture.
        }}
        onClick={handleAddAtPointer}
        className={`relative flex-1 cursor-copy border-l border-zinc-100 first:border-l-0 dark:border-zinc-900 ${
          !enabled ? "bg-zinc-50/60 dark:bg-zinc-900/40" : ""
        }`}
        style={{ height: hourCount * 60 * pixelsPerMin }}
      >
        {Array.from({ length: hourCount }).map((_, hourIndex) => (
          <div
            key={hourIndex}
            style={{
              top: hourIndex * 60 * pixelsPerMin,
              height: 60 * pixelsPerMin,
            }}
            className="absolute inset-x-0 border-b border-zinc-100 last:border-b-0 dark:border-zinc-900/60"
          />
        ))}
        {blockedBands.map((band, bandIndex) => (
          <div
            key={`blocked-${bandIndex}`}
            aria-hidden
            title="The shop is closed at this time"
            style={{
              top: (band.startMin - startGridMin) * pixelsPerMin,
              height: (band.endMin - band.startMin) * pixelsPerMin,
            }}
            className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(113,113,122,0.18)_6px,rgba(113,113,122,0.18)_12px)] bg-zinc-100/70 dark:bg-zinc-900/60"
          />
        ))}
        {shopClosedAllDay ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-zinc-200/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
              Shop closed
            </span>
          </div>
        ) : (
          !enabled && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-zinc-200/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
                Day off
              </span>
            </div>
          )
        )}
        {ranges.map((range, index) => (
          <div key={index} data-ribbon>
            <TimelineRibbon
              startMin={range.startMin}
              endMin={range.endMin}
              pixelsPerMin={pixelsPerMin}
              startGridMin={startGridMin}
              endGridMin={endGridMin}
              onCommit={(next) => onUpdateRange(index, next)}
              onEdit={() => onEditRange(index)}
              onRemove={() => onRemoveRange(index)}
            />
          </div>
        ))}
        {enabled && ranges.length === 0 && !shopClosedAllDay && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
              <Plus size={10} /> Click to add
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The gaps NOT covered by `open` within the visible [gridStart, gridEnd] window
 * — i.e. the shop-closed bands. An empty `open` means the shop is closed all day,
 * so the whole grid is one blocked band.
 */
function complementWithinGrid(
  open: ReadonlyArray<DayRange>,
  gridStart: number,
  gridEnd: number,
): DayRange[] {
  if (open.length === 0) return [{ startMin: gridStart, endMin: gridEnd }];
  const sorted = [...open].sort((a, b) => a.startMin - b.startMin);
  const blocked: DayRange[] = [];
  let cursor = gridStart;
  for (const range of sorted) {
    const start = Math.max(gridStart, range.startMin);
    const end = Math.min(gridEnd, range.endMin);
    if (start > cursor) blocked.push({ startMin: cursor, endMin: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < gridEnd) blocked.push({ startMin: cursor, endMin: gridEnd });
  return blocked;
}
