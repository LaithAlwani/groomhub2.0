"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
  PetFormFields,
  type PetFormErrors,
  type PetFormState,
} from "./PetFormFields";
import { INITIAL_PET_STATE, petFormSnapshot } from "./petFormState";

export function PetFormDialog({
  clientId,
  petId,
  onClose,
}: {
  clientId: Id<"clients">;
  petId: Id<"pets"> | "new";
  onClose: () => void;
}) {
  const isEdit = petId !== "new";
  const existing = useQuery(api.pets.get, isEdit ? { id: petId } : "skip");
  // In edit mode the uploader gets the live pet id and saves photos immediately.
  // In create mode it's undefined and we track the pending storageId here so we
  // can clean it up if the user closes the dialog without saving.
  const editingId = isEdit ? (petId as Id<"pets">) : undefined;
  const [pendingCreateStorageId, setPendingCreateStorageId] = useState<
    Id<"_storage"> | null
  >(null);

  const create = useMutation(api.pets.create);
  const update = useMutation(api.pets.update);
  const deleteOrphan = useMutation(api.pets.deleteOrphanStorage);

  const [state, setState] = useState<PetFormState>(INITIAL_PET_STATE);
  const [errors, setErrors] = useState<PetFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    const next: PetFormState = {
      name: existing.name,
      species: existing.species,
      sex: existing.sex ?? "",
      isFixed: existing.isFixed ?? false,
      breed: existing.breed ?? "",
      coatType: existing.coatType ?? "",
      sizeLb: existing.sizeLb !== undefined ? String(existing.sizeLb) : "",
      birthDate: existing.birthDate ?? "",
      temperament: existing.temperament ?? "",
      medicalConditions: (existing.medicalConditions ?? []).join(", "),
      notes: existing.notes ?? "",
      vaccinations: existing.vaccinations.map((row) => ({ ...row })),
      imageStorageId: existing.imageStorageId,
      imagePreviewUrl: existing.imageUrl,
    };
    setState(next);
    // `imagePreviewUrl` is excluded from the snapshot because it's a transient
    // CDN URL — its identity doesn't reflect a user change. We track image
    // intent via `imageStorageId` only.
    setInitialSnapshot(petFormSnapshot(next));
  }, [existing]);

  const isDirty = isEdit
    ? initialSnapshot === null || initialSnapshot !== petFormSnapshot(state)
    : true;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: PetFormErrors = {};
    if (state.name.trim().length === 0) next.name = "Name is required";
    const sizeLbNumber = state.sizeLb ? Number(state.sizeLb) : undefined;
    if (sizeLbNumber !== undefined && (Number.isNaN(sizeLbNumber) || sizeLbNumber < 0)) {
      next.sizeLb = "Must be 0 or greater";
    }
    for (const row of state.vaccinations) {
      if (row.type.trim().length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.expiresOn)) {
        next.vaccinations = "Each vaccination needs a type and a valid expiry date";
        break;
      }
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const conditions = state.medicalConditions
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      const sharedPayload = {
        name: state.name,
        species: state.species,
        sex: state.sex === "" ? undefined : state.sex,
        isFixed: state.isFixed,
        breed: state.breed || undefined,
        coatType: state.coatType || undefined,
        sizeLb: sizeLbNumber,
        birthDate: state.birthDate || undefined,
        temperament: state.temperament || undefined,
        medicalConditions: conditions.length > 0 ? conditions : undefined,
        notes: state.notes || undefined,
        vaccinations: state.vaccinations,
      };
      if (isEdit) {
        // The photo is already saved by the uploader's `setImage` call, so we
        // intentionally don't send `imageStorageId` here — keeps the update
        // atomic for the other fields and avoids overwriting a more-recent
        // upload made from a parallel session.
        await update({ id: petId, ...sharedPayload });
      } else {
        await create({
          clientId,
          ...sharedPayload,
          imageStorageId: state.imageStorageId,
        });
        // Create succeeded — the storageId is now linked to the new pet.
        setPendingCreateStorageId(null);
      }
      onClose();
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  function setField<K extends keyof PetFormState>(key: K, value: PetFormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    // Track every storageId the create flow hands us so we can clean up the
    // *most recent* one on cancel. (Replacements in create mode call setImage
    // for the previous attempt only if we're in edit mode — see uploader.)
    if (!isEdit && key === "imageStorageId") {
      setPendingCreateStorageId((value ?? null) as Id<"_storage"> | null);
    }
  }

  async function handleCancel() {
    if (!isEdit && pendingCreateStorageId) {
      try {
        await deleteOrphan({ storageId: pendingCreateStorageId });
      } catch {
        // Best-effort cleanup; ignore failures.
      }
    }
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4"
      onClick={handleCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {isEdit ? "Edit pet" : "New pet"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <PetFormFields
            petId={editingId}
            state={state}
            errors={errors}
            onChange={setField}
          />
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isDirty}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create pet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

