"use client";

import { Plus } from "lucide-react";

/**
 * Mobile-only floating "+" action button shown in the bottom-right corner
 * (visible under 874px, hidden above). Used on list pages that have a
 * single primary "Add X" action so it stays thumb-reachable while the
 * user scrolls. Desktop layouts keep the inline header button instead.
 */
export function AddFAB({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-b from-orange-500 to-orange-600 text-white shadow-lg transition-transform hover:scale-105 min-[874px]:hidden"
    >
      <Plus size={24} />
    </button>
  );
}
