"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

const SPECIES_LABEL: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
};

/**
 * Single row in the vaccines catalog table. Whole row is clickable → edit
 * dialog; pencil button on the right is a redundant explicit affordance.
 * The trash icon only renders when `canDelete` is true (admin / superAdmin).
 *
 * `species: []` reads as "All species" — every vaccine is available to every
 * pet in the form dropdown by default.
 */
export function VaccineRow({
  vaccine,
  canDelete,
  busy,
  onEdit,
  onArchive,
}: {
  vaccine: Doc<"vaccines">;
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const speciesLabel =
    vaccine.species.length === 0
      ? "All species"
      : vaccine.species
          .map((entry) => SPECIES_LABEL[entry] ?? entry)
          .join(", ");
  const intervalLabel =
    vaccine.defaultIntervalMonths !== undefined
      ? `${vaccine.defaultIntervalMonths} mo`
      : "—";

  return (
    <li
      onClick={() => {
        if (!busy) onEdit();
      }}
      className="grid cursor-pointer grid-cols-[1.5fr_1.2fr_1fr_auto] items-center gap-3 border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {vaccine.name}
        </p>
        {vaccine.description && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {vaccine.description}
          </p>
        )}
      </div>
      <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
        {speciesLabel}
      </p>
      <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
        {intervalLabel}
      </p>
      <div className="flex shrink-0 items-center justify-end gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          disabled={busy}
          aria-label="Edit vaccine"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <Pencil size={14} />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onArchive();
            }}
            disabled={busy}
            aria-label="Delete vaccine"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </li>
  );
}
