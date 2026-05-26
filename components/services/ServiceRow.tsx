"use client";

import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Single row in the services list. Renders the effective price + duration
 * for the active location when an override is in play; shows the override
 * badge + a "Customize" button when the org has multiple locations.
 *
 * Pure presentation — every action goes through callback props so the
 * parent owns the dialogs / mutations.
 */
export function ServiceRow({
  service,
  override,
  currentLocation,
  multiLocation,
  canEdit,
  isBusy,
  onEdit,
  onArchive,
  onCustomizeForLocation,
}: {
  service: Doc<"services">;
  override: Doc<"serviceLocationOverrides"> | null;
  currentLocation: Doc<"locations"> | null;
  multiLocation: boolean;
  canEdit: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onCustomizeForLocation: () => void;
}) {
  const effectivePriceCents = override?.priceCents ?? service.priceCents;
  const effectiveDuration = override?.durationMin ?? service.durationMin;
  const hiddenHere = override?.isActive === false;
  const isLocationOnly = service.locationId !== undefined;
  const showOverride = override !== null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
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
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              Custom here
            </span>
          )}
          {hiddenHere && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Hidden here
            </span>
          )}
          {isLocationOnly && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Location-only
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {effectiveDuration} min · {formatPrice(effectivePriceCents, service.currency)} ·{" "}
          {service.species.join(", ")}
        </p>
        {showOverride && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Default: {service.durationMin} min ·{" "}
            {formatPrice(service.priceCents, service.currency)}
          </p>
        )}
        {service.description && (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {service.description}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          {multiLocation && currentLocation && !isLocationOnly && (
            <button
              type="button"
              onClick={onCustomizeForLocation}
              disabled={isBusy}
              title={`Customize at ${currentLocation.name}`}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <MapPin size={12} className="text-zinc-400" aria-hidden />
              {showOverride ? "Edit local" : "Customize"}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={isBusy}
            aria-label="Edit service"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onArchive}
            disabled={isBusy}
            aria-label="Archive service"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
