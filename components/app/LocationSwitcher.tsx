"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

/**
 * Sidebar location picker shown only when the org has more than one active
 * location. Single-location orgs (everyone on Essential / Professional, plus
 * Enterprise orgs that haven't added a second location yet) get nothing —
 * `useCurrentLocation` returns the lone row automatically.
 *
 * The selected location is persisted in localStorage by `useCurrentLocation`
 * keyed by Clerk orgId, so switching shops + coming back picks up the right
 * remembered location.
 */
export function LocationSwitcher() {
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
    <div ref={containerRef} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <MapPin size={14} className="shrink-0 text-zinc-400" aria-hidden />
        <span className="flex-1 truncate">{current.name}</span>
        <ChevronsUpDown size={12} aria-hidden className="shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
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
