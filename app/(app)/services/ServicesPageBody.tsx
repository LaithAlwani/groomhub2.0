"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Scissors } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ServiceFormDialog } from "@/components/services/ServiceFormDialog";
import { ServiceLocationOverrideDialog } from "@/components/services/ServiceLocationOverrideDialog";
import { ServiceRow } from "@/components/services/ServiceRow";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

/**
 * Services catalog page body. Mirrors `VaccinesPageBody`: title + subtitle
 * + dark "+ Add service" button live on the left/right of one header row
 * directly on the page background; the bordered table card holds the dark
 * zinc-900 header strip (NAME / DURATION / PRICE / SPECIES / ACTIONS) plus
 * rows or the centered empty state.
 *
 * Multi-location: the per-location override badge + Customize affordance
 * stay on each row, and a small caption above the table reminds the admin
 * which location's prices/durations are showing.
 */
export function ServicesPageBody({ canEdit }: { canEdit: boolean }) {
  const services = useQuery(api.services.list, {});
  const { current: currentLocation, locations } = useCurrentLocation();
  const overrides = useQuery(
    api.services.listOverridesForLocation,
    currentLocation ? { locationId: currentLocation._id } : "skip",
  );
  const archive = useMutation(api.services.archive);

  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; id: Id<"services"> } | null
  >(null);
  const [overridingId, setOverridingId] = useState<Id<"services"> | null>(null);
  const [busyId, setBusyId] = useState<Id<"services"> | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"services">; name: string } | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Map service id → override row for fast lookup in the list. While the
  // overrides query is in flight we keep the map empty so rows render at
  // the org-wide values (truthful for single-location orgs anyway).
  const overrideByServiceId = useMemo(() => {
    const result = new Map<Id<"services">, Doc<"serviceLocationOverrides">>();
    for (const row of overrides ?? []) result.set(row.serviceId, row);
    return result;
  }, [overrides]);

  const editingId = dialog?.mode === "edit" ? dialog.id : null;
  const overridingService = overridingId
    ? (services?.find((row) => row._id === overridingId) ?? null)
    : null;
  const multiLocation = locations.length > 1;
  const count = services?.length ?? 0;

  async function confirmArchive() {
    if (!confirmTarget) return;
    const { id } = confirmTarget;
    setBusyId(id);
    setErrorMessage(null);
    try {
      await archive({ id });
      setConfirmTarget(null);
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not archive",
      );
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Services
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your shop&apos;s service menu. Set durations and prices so
        they&apos;re ready when booking.
      </p>

      {multiLocation && currentLocation && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Showing prices and durations at{" "}
          <strong>{currentLocation.name}</strong>. Switch locations in the
          sidebar to view other rosters.
        </p>
      )}

      <header className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Services
          {services !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog({ mode: "new" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00273c] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#013a58]"
          >
            <Plus size={12} />
            Add service
          </button>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="hidden grid-cols-[1.6fr_0.7fr_0.8fr_1fr_auto] items-center gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800 md:grid">
          <span>Name</span>
          <span>Duration</span>
          <span>Price</span>
          <span>Species</span>
          <span className="text-right">Actions</span>
        </div>
        {services === undefined ? (
          <ListSkeleton />
        ) : services.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {services.map((service) => (
              <ServiceRow
                key={service._id}
                service={service}
                override={overrideByServiceId.get(service._id) ?? null}
                currentLocation={currentLocation}
                multiLocation={multiLocation}
                canEdit={canEdit}
                isBusy={busyId === service._id}
                onEdit={() =>
                  setDialog({ mode: "edit", id: service._id })
                }
                onArchive={() =>
                  setConfirmTarget({ id: service._id, name: service.name })
                }
                onCustomizeForLocation={() => setOverridingId(service._id)}
              />
            ))}
          </ul>
        )}
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      {dialog && (
        <ServiceFormDialog
          serviceId={editingId ?? "new"}
          onClose={() => setDialog(null)}
        />
      )}
      {overridingId && overridingService && currentLocation && (
        <ServiceLocationOverrideDialog
          service={overridingService}
          location={currentLocation}
          override={overrideByServiceId.get(overridingId) ?? null}
          onClose={() => setOverridingId(null)}
        />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Archive service?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.name}&rdquo;
              </span>{" "}
              will stop appearing in booking menus. Past appointments stay
              intact and you can restore it later.
            </>
          )
        }
        confirmLabel="Archive"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmArchive}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <Scissors size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No services yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Add a Full Groom, Nail Trim, Bath &amp; Brush — whatever your shop
          offers.
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
