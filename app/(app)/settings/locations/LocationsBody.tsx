"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { MapPin, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlanFeature } from "@/lib/usePlanFeature";
import { AddFAB } from "@/components/app/AddFAB";
import { LocationFormDialog } from "@/components/settings/LocationFormDialog";

export function LocationsBody() {
  const locations = useQuery(api.locations.list);
  const { allowed: canAddMore } = usePlanFeature("multipleLocations");
  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; location: Doc<"locations"> }
    | null
  >(null);

  const hasExisting = (locations?.length ?? 0) > 0;
  // First location is always free; the *second* one (and beyond) is gated on
  // the Enterprise plan. So the add button is enabled when either no
  // locations exist yet or the plan allows multiple.
  const canAddNow = !hasExisting || canAddMore;

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Locations
          </h1>
        </div>
        <button
          type="button"
          onClick={() => canAddNow && setDialog({ mode: "create" })}
          disabled={!canAddNow}
          title={
            canAddNow ? undefined : "Upgrade to Enterprise to add more locations."
          }
          className="hidden shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 min-[874px]:inline-flex"
        >
          <Plus size={14} />
          Add location
        </button>
      </header>

      {hasExisting && !canAddMore && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Upgrade to Enterprise</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
              Adding a second location requires the Enterprise plan.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        {locations === undefined ? (
          <Skeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {locations.map((location) => (
              <LocationCard
                key={location._id}
                location={location}
                onEdit={() => setDialog({ mode: "edit", location })}
              />
            ))}
          </div>
        )}
      </div>

      {canAddNow && (
        <AddFAB
          label="Add location"
          onClick={() => setDialog({ mode: "create" })}
        />
      )}

      {dialog && (
        <LocationFormDialog
          mode={dialog.mode}
          existing={dialog.mode === "edit" ? dialog.location : undefined}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function LocationCard({
  location,
  onEdit,
}: {
  location: Doc<"locations">;
  onEdit: () => void;
}) {
  const addressLines = [
    location.addressLine1,
    location.addressLine2,
    [location.city, location.state, location.postalCode]
      .filter(Boolean)
      .join(", ") || undefined,
    location.country,
  ].filter(Boolean) as string[];
  // Mobile (< sm): flex-row line card — icon left, content middle, Edit right.
  // Desktop (>= sm): flex-col square-ish tile — icon top-left, Edit floats
  // top-right via absolute positioning, content stacks below.
  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-col sm:gap-4 sm:p-5">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <MapPin size={16} />
      </span>
      <div className="min-w-0 flex-1 sm:w-full sm:pr-16">
        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base">
          {location.name}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {location.timezone} · {location.currency}
        </p>
        {addressLines.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {addressLines.join(" · ")}
          </p>
        )}
        {location.contactEmail && (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            Reply-To: {location.contactEmail}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 sm:absolute sm:right-4 sm:top-4"
      >
        Edit
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
