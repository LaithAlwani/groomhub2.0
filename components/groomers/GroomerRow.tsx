"use client";

import { Archive, Pencil, Scissors } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * One active groomer in the Staff page list. Whole row opens the rename
 * dialog; the archive button (never "delete") moves the groomer to the
 * archived list below.
 */
export function GroomerRow({
  groomer,
  busy,
  onEdit,
  onArchive,
}: {
  groomer: Doc<"groomers">;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <li
      onClick={() => {
        if (!busy) onEdit();
      }}
      className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300"
        >
          <Scissors size={14} />
        </span>
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {groomer.name}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          disabled={busy}
          aria-label={`Rename ${groomer.name}`}
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onArchive();
          }}
          disabled={busy}
          aria-label={`Archive ${groomer.name}`}
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-amber-700 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-amber-300"
        >
          <Archive size={14} />
        </button>
      </div>
    </li>
  );
}
