"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type StaffRow = {
  membership: Doc<"memberships">;
  user: Doc<"users">;
};

const PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ef4444", // red
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

/**
 * Custom "Show: <groomer>" dropdown for the calendar header. Replaces the
 * native `<select>` so we can render colored dots next to each groomer and
 * match the design's pill/menu styling. Color is derived deterministically
 * from the staff member's index in the list, so the dot is stable across
 * renders without persisting a per-staff color in the DB.
 *
 * Behaviour:
 * - Click outside or press Escape closes the menu.
 * - Selecting an item calls `onChange` with the membership id (or `"all"`)
 *   and closes the menu.
 */
export function StaffFilterDropdown({
  value,
  staff,
  onChange,
}: {
  value: Id<"memberships"> | "all";
  staff: ReadonlyArray<StaffRow>;
  onChange: (next: Id<"memberships"> | "all") => void;
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

  const selected = staff.find((row) => row.membership._id === value);
  const selectedColor = selected ? colorFor(staff, selected.membership._id) : null;
  const selectedLabel = selected
    ? fullName(selected.user)
    : "All groomers";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Filter by groomer"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#00273c] dark:text-zinc-50">
          {selectedColor ? (
            <Dot color={selectedColor} />
          ) : (
            <Users
              size={14}
              className="text-zinc-400 dark:text-zinc-500"
              aria-hidden
            />
          )}
          {selectedLabel}
        </span>
        <ChevronDown
          size={14}
          className="text-zinc-400 dark:text-zinc-500"
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          <MenuItem
            label="All groomers"
            active={value === "all"}
            onSelect={() => {
              onChange("all");
              setOpen(false);
            }}
            leading={
              <Users
                size={14}
                className="text-zinc-400 dark:text-zinc-500"
                aria-hidden
              />
            }
          />
          {staff.length > 0 && (
            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          )}
          {staff.map((row) => {
            const color = colorFor(staff, row.membership._id);
            return (
              <MenuItem
                key={row.membership._id}
                label={fullName(row.user)}
                active={value === row.membership._id}
                onSelect={() => {
                  onChange(row.membership._id);
                  setOpen(false);
                }}
                leading={<Dot color={color} />}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  active,
  onSelect,
  leading,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  leading: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      <span className="inline-flex items-center gap-2">
        {leading}
        <span className="truncate font-medium">{label}</span>
      </span>
      {active && (
        <Check
          size={14}
          className="text-orange-600 dark:text-orange-400"
          aria-hidden
        />
      )}
    </button>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function fullName(user: Doc<"users">): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unnamed";
}

function colorFor(staff: ReadonlyArray<StaffRow>, id: Id<"memberships">): string {
  const index = staff.findIndex((row) => row.membership._id === id);
  return PALETTE[(index < 0 ? 0 : index) % PALETTE.length]!;
}
