"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PetFormDialog } from "./PetFormDialog";
import { PetRow } from "./PetRow";

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
      setErrorMessage(caught instanceof Error ? caught.message : "Could not archive");
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={14} />
            Add pet
          </button>
        </div>
      )}
      {pets === undefined ? (
        <ListSkeleton />
      ) : pets.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No pets on file yet.
        </p>
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
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
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
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
