"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DayPill } from "./availabilitySlots";

/**
 * Horizontal day-pill strip (month · weekday · number · status dot). The
 * scrollbar is hidden on every platform — on desktop the flanking arrow
 * buttons scroll it; on mobile it scrolls by touch. `onReachEnd` fires as the
 * strip nears its right edge so the parent can lazily extend the window; an
 * optional Today button and auto-scroll-to-selected keep navigation easy.
 */
export function DateStrip({
  pills,
  onSelect,
  onReachEnd,
}: {
  pills: ReadonlyArray<DayPill>;
  onSelect: (dateKey: string) => void;
  onReachEnd?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const selectedKey = pills.find((pill) => pill.isSelected)?.key;

  // Bring the selected pill into view (Today / auto-select) by scrolling only
  // the strip — never the page — and only when it's off-screen.
  useEffect(() => {
    const container = scrollRef.current;
    const selected = selectedRef.current;
    if (!container || !selected) return;
    const c = container.getBoundingClientRect();
    const s = selected.getBoundingClientRect();
    if (s.left < c.left || s.right > c.right) {
      const delta =
        s.left - c.left - (container.clientWidth - selected.clientWidth) / 2;
      container.scrollBy({ left: delta, behavior: "smooth" });
    }
  }, [selectedKey]);

  function page(direction: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
    if (direction > 0) onReachEnd?.();
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !onReachEnd) return;
    if (el.scrollWidth - el.scrollLeft - el.clientWidth < 200) onReachEnd();
  }

  return (
    <div className="flex items-center gap-1.5">
      <Arrow direction="left" onClick={() => page(-1)} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scroll-snap-type:x_proximity] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pills.map((pill) => (
          <button
            key={pill.key}
            ref={pill.isSelected ? selectedRef : null}
            type="button"
            disabled={pill.disabled}
            onClick={() => onSelect(pill.key)}
            className={`w-[58px] shrink-0 snap-start rounded-xl border px-1 pb-2.5 pt-2 text-center transition-colors ${
              pill.disabled
                ? "cursor-not-allowed border-zinc-200 bg-white opacity-40 dark:border-zinc-800 dark:bg-zinc-950"
                : pill.isSelected
                  ? "border-orange-500 bg-orange-500"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            } ${pill.isToday && !pill.isSelected ? "!border-orange-300 dark:!border-orange-500/40" : ""}`}
          >
            <span className="block h-3 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              {pill.month}
            </span>
            <span
              className={`mt-0.5 block text-[10px] font-bold uppercase tracking-wide ${
                pill.isSelected ? "text-white" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {pill.dow}
            </span>
            <span
              className={`mt-0.5 block text-base font-bold ${
                pill.isSelected ? "text-white" : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {pill.num}
            </span>
            <span
              className={`mx-auto mt-1.5 block h-[5px] w-[5px] rounded-full ${
                pill.tone === "off"
                  ? "bg-red-500"
                  : pill.tone === "on"
                    ? "bg-orange-500"
                    : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            />
          </button>
        ))}
      </div>
      <Arrow direction="right" onClick={() => page(1)} />
    </div>
  );
}

function Arrow({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Earlier days" : "Later days"}
      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 min-[874px]:flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <Icon size={16} />
    </button>
  );
}
