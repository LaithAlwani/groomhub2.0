"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ServiceFormDialog } from "./ServiceFormDialog";

export function ServiceList() {
  const services = useQuery(api.services.list, {});
  const { membership } = useOrganization();
  const archive = useMutation(api.services.archive);

  const [editingId, setEditingId] = useState<Id<"services"> | null>(null);
  const [busyId, setBusyId] = useState<Id<"services"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"services">; name: string } | null
  >(null);

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

  async function confirmArchive() {
    if (!confirmTarget) return;
    const { id } = confirmTarget;
    setBusyId(id);
    setErrorMessage(null);
    try {
      await archive({ id });
      setConfirmTarget(null);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : "Could not archive");
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {services.map((service) => (
          <ServiceRow
            key={service._id}
            service={service}
            canEdit={canEdit}
            isBusy={busyId === service._id}
            onEdit={() => setEditingId(service._id)}
            onArchive={() =>
              setConfirmTarget({ id: service._id, name: service.name })
            }
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
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Archive service?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.name}&rdquo;
              </span>{" "}
              will stop appearing in booking menus. Past appointments stay intact and
              you can restore it later.
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

function ServiceRow({
  service,
  canEdit,
  isBusy,
  onEdit,
  onArchive,
}: {
  service: Doc<"services">;
  canEdit: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {service.durationMin} min · {formatPrice(service.priceCents, service.currency)} ·{" "}
          {service.species.join(", ")}
        </p>
        {service.description && (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {service.description}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
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
