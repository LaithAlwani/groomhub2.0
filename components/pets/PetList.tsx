"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { PawPrint, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PetFormDialog } from "./PetFormDialog";
import { PetRow } from "./PetRow";

/**
 * Pets section on the client detail page. Renders only the section header
 * (title + count + add button) and the rows or empty state directly inside
 * the page background — no wrapper card. Matches the design where Pets
 * sits as a bare section beneath the client header card.
 */
export function PetList({
  clientId,
  canEdit,
  canArchive,
}: {
  clientId: Id<"clients">;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const pets = useQuery(api.pets.listForClient, { clientId });
  const archive = useMutation(api.pets.archive);

  const [editingId, setEditingId] = useState<Id<"pets"> | "new" | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: Id<"pets">; name: string } | null
  >(null);
  const [busyId, setBusyId] = useState<Id<"pets"> | null>(null);
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
        caught instanceof Error ? caught.message : "Could not archive",
      );
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  const count = pets?.length ?? 0;

  return (
    <section className="mt-8">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Pets
          {pets !== undefined && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {count}
            </span>
          )}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00273c] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#013a58]"
          >
            <Plus size={12} />
            Add pet
          </button>
        )}
      </header>
      {pets === undefined ? (
        <ListSkeleton />
      ) : pets.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-2">
          {pets.map((pet) => (
            <PetRow
              key={pet._id}
              pet={pet}
              canEdit={canEdit}
              canArchive={canArchive}
              busy={busyId === pet._id}
              onEdit={() => setEditingId(pet._id)}
              onArchive={() =>
                setConfirmTarget({ id: pet._id, name: pet.name })
              }
            />
          ))}
        </ul>
      )}
      {errorMessage && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}
      {editingId && (
        <PetFormDialog
          clientId={clientId}
          petId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
      <ConfirmDialog
        open={confirmTarget !== null}
        title="Archive pet?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{confirmTarget.name}&rdquo;
              </span>{" "}
              will be hidden from booking lists. Past appointments stay intact
              and you can restore later.
            </>
          )
        }
        confirmLabel="Archive"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmArchive}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-16 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <PawPrint size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No pets on file yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Start by adding a pet profile to manage their
          <br />
          grooming history and preferences.
        </p>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
