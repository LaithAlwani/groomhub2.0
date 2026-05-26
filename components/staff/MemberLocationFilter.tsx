"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

/**
 * Inline duplicate of the sidebar's location switcher, rendered in the
 * top-right of the Active Members card. Both share the
 * `useCurrentLocation` context so picking a location here updates the
 * sidebar switcher and every other location-aware surface live.
 *
 * Hidden for single-location orgs — no point showing a chip with only
 * one option.
 */
export function MemberLocationFilter() {
  const { locations, current, setCurrentId } = useCurrentLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (locations.length <= 1 || !current) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <MapPin size={12} className="text-zinc-400" aria-hidden />
        <span>{current.name}</span>
        <ChevronsUpDown
          size={10}
          aria-hidden
          className="ml-0.5 text-zinc-400"
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          {locations.map((location) => {
            const isActive = location._id === current._id;
            return (
              <button
                key={location._id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setCurrentId(location._id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <span className="flex-1 truncate">{location.name}</span>
                {isActive && (
                  <Check size={12} className="text-emerald-500" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
