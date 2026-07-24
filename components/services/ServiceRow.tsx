"use client";

import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

const SPECIES_LABEL: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
};

/**
 * One row in the services table — grid layout matching the dark zinc-900
 * header strip (NAME / DURATION / PRICE / SPECIES / ACTIONS). Whole row is
 * clickable → edit dialog when the caller has edit rights; the pencil and
 * trash icons are explicit affordances that stop propagation.
 *
 * Effective price + duration reflect any per-location override; the
 * "Custom here" / "Hidden here" badge tells the admin why this row differs
 * from the org-wide values.
 */
export function ServiceRow({
  service,
  override,
  currentLocation,
  multiLocation,
  canEdit,
  canManage,
  isBusy,
  onEdit,
  onArchive,
  onCustomizeForLocation,
  dragRef,
  dragStyle,
  dragHandle,
  isDragging,
}: {
  service: Doc<"services">;
  override: Doc<"serviceLocationOverrides"> | null;
  currentLocation: Doc<"locations"> | null;
  multiLocation: boolean;
  // Add / edit — staff+.
  canEdit: boolean;
  // Archive + per-location price override — admin+.
  canManage: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onCustomizeForLocation: () => void;
  // Drag-to-reorder wiring (from the sortable wrapper). Absent when not sortable.
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: React.CSSProperties;
  dragHandle?: React.ReactNode;
  isDragging?: boolean;
}) {
  const effectivePriceCents = override?.priceCents ?? service.priceCents;
  const effectiveDuration = override?.durationMin ?? service.durationMin;
  const hiddenHere = override?.isActive === false;
  const isLocationOnly = service.locationId !== undefined;
  const showOverride = override !== null;
  const speciesLabel = service.species
    .map((entry) => SPECIES_LABEL[entry] ?? entry)
    .join(", ");

  return (
    <li
      ref={dragRef}
      style={dragStyle}
      onClick={() => {
        if (canEdit && !isBusy) onEdit();
      }}
      className={`flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 dark:border-zinc-900 md:grid md:grid-cols-[1.6fr_0.7fr_0.8fr_1fr_auto] md:items-center ${
        canEdit
          ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
          : ""
      } ${isDragging ? "bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {service.color && (
            <span
              aria-hidden
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: service.color }}
            />
          )}
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {service.name}
          </p>
          {showOverride && !hiddenHere && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              Custom here
            </span>
          )}
          {hiddenHere && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Hidden here
            </span>
          )}
          {isLocationOnly && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Location-only
            </span>
          )}
        </div>
        {service.description && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {service.description}
          </p>
        )}
        {/* Mobile-only meta line — folds duration / price / species into one
            row so the card fits cleanly on narrow phones. */}
        <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400 md:hidden">
          {effectiveDuration} min ·{" "}
          {formatPrice(effectivePriceCents, service.currency)} · {speciesLabel}
        </p>
      </div>
      <p className="hidden truncate text-sm text-zinc-700 dark:text-zinc-300 md:block">
        {effectiveDuration} min
      </p>
      <p className="hidden truncate text-sm text-zinc-700 dark:text-zinc-300 md:block">
        {formatPrice(effectivePriceCents, service.currency)}
      </p>
      <p className="hidden truncate text-sm text-zinc-700 dark:text-zinc-300 md:block">
        {speciesLabel}
      </p>
      <div className="flex shrink-0 items-center justify-end gap-1">
        {canManage && multiLocation && currentLocation && !isLocationOnly && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCustomizeForLocation();
            }}
            disabled={isBusy}
            title={`Customize at ${currentLocation.name}`}
            className="hidden items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900 md:inline-flex"
          >
            <MapPin size={12} className="text-zinc-400" aria-hidden />
            {showOverride ? "Edit local" : "Customize"}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            disabled={isBusy}
            aria-label="Edit service"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <Pencil size={14} />
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onArchive();
            }}
            disabled={isBusy}
            aria-label="Archive service"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        )}
        {dragHandle}
      </div>
    </li>
  );
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
