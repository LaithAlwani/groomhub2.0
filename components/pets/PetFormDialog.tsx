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

const INITIAL_STATE: PetFormState = {
  name: "",
  species: "dog",
  sex: "",
  isFixed: false,
  breed: "",
  coatType: "",
  sizeKg: "",
  birthDate: "",
  temperament: "",
  medicalConditions: "",
  notes: "",
  vaccinations: [],
  imageStorageId: undefined,
  imagePreviewUrl: null,
};

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

  const create = useMutation(api.pets.create);
  const update = useMutation(api.pets.update);

  const [state, setState] = useState<PetFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<PetFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setState({
      name: existing.name,
      species: existing.species,
      sex: existing.sex ?? "",
      isFixed: existing.isFixed ?? false,
      breed: existing.breed ?? "",
      coatType: existing.coatType ?? "",
      sizeKg: existing.sizeKg !== undefined ? String(existing.sizeKg) : "",
      birthDate: existing.birthDate ?? "",
      temperament: existing.temperament ?? "",
      medicalConditions: (existing.medicalConditions ?? []).join(", "),
      notes: existing.notes ?? "",
      vaccinations: existing.vaccinations.map((row) => ({ ...row })),
      imageStorageId: existing.imageStorageId,
      imagePreviewUrl: existing.imageUrl,
    });
  }, [existing]);

  function setField<K extends keyof PetFormState>(key: K, value: PetFormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: PetFormErrors = {};
    if (state.name.trim().length === 0) next.name = "Name is required";
    const sizeKgNumber = state.sizeKg ? Number(state.sizeKg) : undefined;
    if (sizeKgNumber !== undefined && (Number.isNaN(sizeKgNumber) || sizeKgNumber < 0)) {
      next.sizeKg = "Must be 0 or greater";
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
      const payload = {
        name: state.name,
        species: state.species,
        sex: state.sex === "" ? undefined : state.sex,
        isFixed: state.isFixed,
        breed: state.breed || undefined,
        coatType: state.coatType || undefined,
        sizeKg: sizeKgNumber,
        birthDate: state.birthDate || undefined,
        temperament: state.temperament || undefined,
        medicalConditions: conditions.length > 0 ? conditions : undefined,
        notes: state.notes || undefined,
        vaccinations: state.vaccinations,
        imageStorageId: state.imageStorageId,
      };
      if (isEdit) {
        await update({ id: petId, ...payload });
      } else {
        await create({ clientId, ...payload });
      }
      onClose();
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {isEdit ? "Edit pet" : "New pet"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <PetFormFields state={state} errors={errors} onChange={setField} />
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
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create pet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
