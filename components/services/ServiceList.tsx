"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ServiceFormDialog } from "./ServiceFormDialog";
import { ServiceLocationOverrideDialog } from "./ServiceLocationOverrideDialog";
import { ServiceRow } from "./ServiceRow";

export function ServiceList() {
  const services = useQuery(api.services.list, {});
  const { membership } = useOrganization();
  const { current: currentLocation, locations } = useCurrentLocation();
  const overrides = useQuery(
    api.services.listOverridesForLocation,
    currentLocation ? { locationId: currentLocation._id } : "skip",
  );
  const archive = useMutation(api.services.archive);

  const [editingId, setEditingId] = useState<Id<"services"> | null>(null);
  const [overridingId, setOverridingId] = useState<Id<"services"> | null>(null);
  const [busyId, setBusyId] = useState<Id<"services"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"services">; name: string } | null
  >(null);

  // Map service id → override row for fast lookup in the list. While the
  // overrides query is in flight we keep the map empty so rows render at
  // the org-wide values (truthful for single-location orgs anyway).
  const overrideByServiceId = useMemo(() => {
    const result = new Map<Id<"services">, Doc<"serviceLocationOverrides">>();
    for (const row of overrides ?? []) result.set(row.serviceId, row);
    return result;
  }, [overrides]);

  if (services === undefined) return <ListSkeleton />;
  if (services.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        No services yet. Add your first one to get started.
      </p>
    );
  }

  const role = mapClerkOrgRole(membership?.role ?? null);
  const canEdit = role === "admin" || role === "superAdmin";
  const multiLocation = locations.length > 1;
  const overridingService = overridingId
    ? (services.find((row) => row._id === overridingId) ?? null)
    : null;

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
      {multiLocation && currentLocation && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Showing prices and durations at <strong>{currentLocation.name}</strong>.
          Switch locations in the sidebar to view other rosters.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {services.map((service) => (
          <ServiceRow
            key={service._id}
            service={service}
            override={overrideByServiceId.get(service._id) ?? null}
            currentLocation={currentLocation}
            multiLocation={multiLocation}
            canEdit={canEdit}
            isBusy={busyId === service._id}
            onEdit={() => setEditingId(service._id)}
            onArchive={() =>
              setConfirmTarget({ id: service._id, name: service.name })
            }
            onCustomizeForLocation={() => setOverridingId(service._id)}
          />
        ))}
      </ul>
      {errorMessage && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}
      {editingId && (
        <ServiceFormDialog
          serviceId={editingId}
          onClose={() => setEditingId(null)}
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
              will stop appearing in booking menus. Past appointments stay intact
              and you can restore it later.
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

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
