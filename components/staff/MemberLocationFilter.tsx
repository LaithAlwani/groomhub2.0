"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

/**
 * Location filter for the Staff page's Active Members card. Local to the
 * page — picking a location here only narrows the visible member list, it
 * does NOT change the sidebar's current location (which controls things
 * like calendar rendering and booking defaults).
 *
 * Special `null` value = "All locations" — bypasses the filter entirely
 * so admins can see every member across the org at once. Hidden for
 * single-location orgs.
 */
export function MemberLocationFilter({
  locations,
  selectedId,
  onChange,
}: {
  locations: ReadonlyArray<Doc<"locations">>;
  selectedId: Id<"locations"> | null;
  onChange: (next: Id<"locations"> | null) => void;
}) {
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

  if (locations.length <= 1) return null;

  const selectedLocation =
    selectedId === null
      ? null
      : (locations.find((row) => row._id === selectedId) ?? null);
  const label = selectedLocation ? selectedLocation.name : "All locations";

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
        <span>{label}</span>
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
          <FilterOption
            label="All locations"
            active={selectedId === null}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          {locations.map((location) => (
            <FilterOption
              key={location._id}
              label={location.name}
              active={location._id === selectedId}
              onClick={() => {
                onChange(location._id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      <span className="flex-1 truncate">{label}</span>
      {active && (
        <Check size={12} className="text-emerald-500" aria-hidden />
      )}
    </button>
  );
}
