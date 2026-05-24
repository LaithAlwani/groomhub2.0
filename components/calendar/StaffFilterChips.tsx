"use client";

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
 * Mobile groomer filter — a horizontally-scrollable strip of chips. Mirrors
 * the same `value` / `onChange` shape as `StaffFilterDropdown` so the parent
 * can swap between the two via responsive utilities. Hidden by default; the
 * caller wraps it in `md:hidden`.
 *
 * Active chip = dark navy fill with white text (no color dot when active,
 * since the strong fill already implies selection). Inactive chips have a
 * light sky background, the staff's color dot, and a dark name.
 */
export function StaffFilterChips({
  value,
  staff,
  onChange,
}: {
  value: Id<"memberships"> | "all";
  staff: ReadonlyArray<StaffRow>;
  onChange: (next: Id<"memberships"> | "all") => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max items-center gap-2">
        <Chip
          label="All Groomers"
          active={value === "all"}
          onClick={() => onChange("all")}
        />
        {staff.map((row, index) => (
          <Chip
            key={row.membership._id}
            label={fullName(row.user)}
            active={value === row.membership._id}
            color={PALETTE[index % PALETTE.length]}
            onClick={() => onChange(row.membership._id)}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  const className = active
    ? "inline-flex shrink-0 items-center gap-2 rounded-full bg-[#00273c] px-4 py-2 text-sm font-semibold text-white shadow-sm"
    : "inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-[#00273c] transition-colors hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60";
  return (
    <button type="button" onClick={onClick} className={className}>
      {color && !active && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function fullName(user: Doc<"users">): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unnamed";
}
