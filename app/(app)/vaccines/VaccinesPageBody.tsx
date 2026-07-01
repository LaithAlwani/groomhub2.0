"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Syringe } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AddFAB } from "@/components/app/AddFAB";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VaccineFormDialog } from "@/components/vaccines/VaccineFormDialog";
import { VaccineRow } from "@/components/vaccines/VaccineRow";

/**
 * The Vaccines catalog page body. Section header (count + dark "+ Add"
 * button) lives directly on the page background; the bordered table card
 * holds the dark zinc-900 header strip plus the rows or the empty state —
 * same pattern as the appointments table on `/clients/[id]`.
 */
export function VaccinesPageBody({ canDelete }: { canDelete: boolean }) {
  const vaccines = useQuery(api.vaccines.list, {});
  const archive = useMutation(api.vaccines.archive);

  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; id: Id<"vaccines"> } | null
  >(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"vaccines">; name: string } | null
  >(null);
  const [busyId, setBusyId] = useState<Id<"vaccines"> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        formatError(caught, "Could not delete"),
      );
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  const editing = dialog?.mode === "edit" ? dialog.id : null;
  const count = vaccines?.length ?? 0;

  return (
    <>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Vaccines
          {vaccines !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setDialog({ mode: "new" })}
          className="hidden items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 min-[874px]:inline-flex"
        >
          <Plus size={14} />
          Add vaccine
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="hidden grid-cols-[1.5fr_1.2fr_1fr_auto] items-center gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800 md:grid">
          <span>Name</span>
          <span>Species</span>
          <span>Interval</span>
          <span className="text-right">Actions</span>
        </div>
        {vaccines === undefined ? (
          <ListSkeleton />
        ) : vaccines.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {vaccines.map((vaccine) => (
              <VaccineRow
                key={vaccine._id}
                vaccine={vaccine}
                canDelete={canDelete}
                busy={busyId === vaccine._id}
                onEdit={() => setDialog({ mode: "edit", id: vaccine._id })}
                onArchive={() =>
                  setConfirmTarget({ id: vaccine._id, name: vaccine.name })
                }
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

      <AddFAB label="Add vaccine" onClick={() => setDialog({ mode: "new" })} />

      {dialog && (
        <VaccineFormDialog
          vaccineId={dialog.mode === "edit" ? editing : "new"}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete vaccine?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.name}&rdquo;
              </span>{" "}
              will no longer appear in the pet form dropdown. Pets that already
              reference it keep their record intact.
            </>
          )
        }
        confirmLabel="Delete"
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
        <Syringe size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No vaccines on file yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Add Rabies, Bordetella, DHPP — whatever your shop tracks.
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
