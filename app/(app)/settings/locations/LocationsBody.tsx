"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { MapPin, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { PlanFeatureGate } from "@/components/ui/PlanFeatureGate";
import { usePlanFeature } from "@/lib/usePlanFeature";
import { LocationFormDialog } from "@/components/settings/LocationFormDialog";

export function LocationsBody() {
  const locations = useQuery(api.locations.list);
  const { allowed: canAddMore } = usePlanFeature("multipleLocations");
  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; location: Doc<"locations"> }
    | null
  >(null);

  if (locations === undefined) return <Skeleton />;

  const hasExisting = locations.length > 0;
  const needsPlanForNext = hasExisting && !canAddMore;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {locations.map((location) => (
          <LocationCard
            key={location._id}
            location={location}
            onEdit={() => setDialog({ mode: "edit", location })}
          />
        ))}
      </div>

      {!hasExisting && (
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-[#00273c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#013a58]"
        >
          <Plus size={14} />
          Add location
        </button>
      )}

      {hasExisting && (
        <div>
          <PlanFeatureGate
            feature="multipleLocations"
            fallback={
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />
                <div className="flex-1">
                  <p className="font-medium">Upgrade to Enterprise</p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
                    Adding a second location requires the Enterprise plan.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border border-amber-300 bg-white/60 px-3 py-1.5 text-xs font-medium text-amber-700 opacity-70 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                >
                  Add location
                </button>
              </div>
            }
          >
            <button
              type="button"
              onClick={() => setDialog({ mode: "create" })}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00273c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#013a58]"
            >
              <Plus size={14} />
              Add location
            </button>
          </PlanFeatureGate>
        </div>
      )}

      {dialog && (
        <LocationFormDialog
          mode={dialog.mode}
          existing={dialog.mode === "edit" ? dialog.location : undefined}
          onClose={() => setDialog(null)}
        />
      )}

      {/* Quiet hint suppressing dead-code lint when the gate's disabled state hides the second branch */}
      {needsPlanForNext ? null : null}
    </div>
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
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <MapPin size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {location.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {location.timezone} · {location.currency}
          </p>
          {addressLines.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {addressLines.join(" · ")}
            </p>
          )}
          {location.contactEmail && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Reply-To: {location.contactEmail}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
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
