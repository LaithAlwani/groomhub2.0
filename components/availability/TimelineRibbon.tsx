"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatRange, QUARTER_HOUR } from "@/lib/time";

const MIN_DURATION = 30;

// snapToQuarter() in lib/time.ts clamps to [0, 24*60] which discards
// negative deltas (= dragging up). Inline a sign-preserving snap instead.
function snapDelta(delta: number): number {
  return Math.round(delta / QUARTER_HOUR) * QUARTER_HOUR;
}

export type TimelineRibbonHandle = "top" | "body" | "bottom";

/**
 * Single shift ribbon inside a day column. Drag the top/bottom edges to
 * resize; drag the body to move; click to open the edit popover (parent
 * decides what that means). All drag deltas snap to 15-min.
 */
export function TimelineRibbon({
  startMin,
  endMin,
  pixelsPerMin,
  startGridMin,
  endGridMin,
  onCommit,
  onEdit,
  onRemove,
  disabled,
}: {
  startMin: number;
  endMin: number;
  pixelsPerMin: number;
  startGridMin: number;
  endGridMin: number;
  onCommit: (range: { startMin: number; endMin: number }) => void;
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<{ startMin: number; endMin: number } | null>(
    null,
  );
  const dragRef = useRef<{
    mode: TimelineRibbonHandle;
    startY: number;
    originalStart: number;
    originalEnd: number;
    moved: boolean;
  } | null>(null);

  const range = draft ?? { startMin, endMin };
  const top = (range.startMin - startGridMin) * pixelsPerMin;
  const height = Math.max(
    18,
    (range.endMin - range.startMin) * pixelsPerMin,
  );

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaMin = (event.clientY - drag.startY) / pixelsPerMin;
      const snapped = snapDelta(deltaMin);
      if (Math.abs(snapped) >= 15) drag.moved = true;
      if (drag.mode === "top") {
        const nextStart = Math.max(
          startGridMin,
          Math.min(drag.originalEnd - MIN_DURATION, drag.originalStart + snapped),
        );
        setDraft({ startMin: nextStart, endMin: drag.originalEnd });
        return;
      }
      if (drag.mode === "bottom") {
        const nextEnd = Math.min(
          endGridMin,
          Math.max(drag.originalStart + MIN_DURATION, drag.originalEnd + snapped),
        );
        setDraft({ startMin: drag.originalStart, endMin: nextEnd });
        return;
      }
      // body — move the whole range
      const duration = drag.originalEnd - drag.originalStart;
      let nextStart = drag.originalStart + snapped;
      if (nextStart < startGridMin) nextStart = startGridMin;
      if (nextStart + duration > endGridMin) nextStart = endGridMin - duration;
      setDraft({ startMin: nextStart, endMin: nextStart + duration });
    }
    function onUp() {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDraft((current) => {
        if (current && drag.moved) onCommit(current);
        return null;
      });
      if (!drag.moved && drag.mode === "body") onEdit();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pixelsPerMin, startGridMin, endGridMin, onCommit, onEdit]);

  function startDrag(mode: TimelineRibbonHandle, event: React.PointerEvent) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      mode,
      startY: event.clientY,
      originalStart: startMin,
      originalEnd: endMin,
      moved: false,
    };
  }

  return (
    <div
      style={{ top, height }}
      className="group absolute inset-x-1 z-10 select-none rounded-md border border-orange-400/50 bg-linear-to-b from-orange-500 to-orange-600 text-white shadow-md transition-shadow hover:shadow-lg"
    >
      <div
        onPointerDown={(event) => startDrag("top", event)}
        className="absolute inset-x-0 top-0 h-2 cursor-ns-resize rounded-t-md hover:bg-white/20"
        aria-label="Resize start"
      />
      <div
        onPointerDown={(event) => startDrag("body", event)}
        className="flex h-full cursor-grab flex-col items-start justify-between px-2 py-1 text-[11px] font-semibold leading-tight active:cursor-grabbing"
      >
        <span className="whitespace-nowrap">
          {formatRange(range.startMin, range.endMin)}
        </span>
        <span className="text-[10px] font-medium text-white/80">
          {Math.round((range.endMin - range.startMin) / 60 * 10) / 10}h
        </span>
      </div>
      <div
        onPointerDown={(event) => startDrag("bottom", event)}
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize rounded-b-md hover:bg-white/20"
        aria-label="Resize end"
      />
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          aria-label="Edit shift"
          className="rounded bg-white/20 p-1 text-white transition-colors hover:bg-white/30"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Remove shift"
          className="rounded bg-white/20 p-1 text-white transition-colors hover:bg-red-500/80"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
