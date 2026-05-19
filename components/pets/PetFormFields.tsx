"use client";

import { Field } from "@/components/forms/Field";
import type { Id } from "@/convex/_generated/dataModel";
import { VaccinationsPanel } from "./VaccinationsPanel";
import type { VaccinationDraft } from "./VaccinationRow";
import { PetImageUploader } from "./PetImageUploader";

const SPECIES_OPTIONS = ["dog", "cat", "other"] as const;
type Species = (typeof SPECIES_OPTIONS)[number];
type Sex = "male" | "female" | "";

export type PetFormState = {
  name: string;
  species: Species;
  sex: Sex;
  isFixed: boolean;
  breed: string;
  coatType: string;
  sizeKg: string;
  birthDate: string;
  temperament: string;
  medicalConditions: string;
  notes: string;
  vaccinations: VaccinationDraft[];
  imageStorageId: Id<"_storage"> | undefined;
  imagePreviewUrl: string | null;
};

export type PetFormErrors = Partial<Record<keyof PetFormState, string>>;

export function PetFormFields({
  state,
  errors,
  onChange,
}: {
  state: PetFormState;
  errors: PetFormErrors;
  onChange: <K extends keyof PetFormState>(key: K, value: PetFormState[K]) => void;
}) {
  const fixedLabel =
    state.sex === "female"
      ? "Spayed"
      : state.sex === "male"
        ? "Neutered"
        : "Spayed / neutered";

  return (
    <>
      <PetImageUploader
        petName={state.name}
        imageUrl={state.imagePreviewUrl}
        hasImage={state.imageStorageId !== undefined}
        onUploaded={(storageId, localPreviewUrl) => {
          onChange("imageStorageId", storageId);
          onChange("imagePreviewUrl", localPreviewUrl);
        }}
        onCleared={() => {
          onChange("imageStorageId", undefined);
          onChange("imagePreviewUrl", null);
        }}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          value={state.name}
          onChange={(value) => onChange("name", value)}
          error={errors.name}
          placeholder="Luna"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Species
          </span>
          <select
            value={state.species}
            onChange={(event) => onChange("species", event.target.value as Species)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {SPECIES_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Sex
          </span>
          <select
            value={state.sex}
            onChange={(event) => onChange("sex", event.target.value as Sex)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Unspecified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={state.isFixed}
            onChange={(event) => onChange("isFixed", event.target.checked)}
            className="h-4 w-4"
          />
          {fixedLabel}
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Breed (optional)"
          value={state.breed}
          onChange={(value) => onChange("breed", value)}
        />
        <Field
          label="Coat type (optional)"
          value={state.coatType}
          onChange={(value) => onChange("coatType", value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Size (kg, optional)"
          type="number"
          inputMode="decimal"
          value={state.sizeKg}
          onChange={(value) => onChange("sizeKg", value)}
          error={errors.sizeKg}
        />
        <Field
          label="Birth date (optional)"
          type="date"
          value={state.birthDate}
          onChange={(value) => onChange("birthDate", value)}
        />
      </div>
      <Field
        label="Temperament (optional)"
        value={state.temperament}
        onChange={(value) => onChange("temperament", value)}
        placeholder="Friendly · anxious around clippers"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Medical conditions (optional)
        </span>
        <textarea
          value={state.medicalConditions}
          onChange={(event) => onChange("medicalConditions", event.target.value)}
          rows={2}
          placeholder="Hip dysplasia, diabetes, skin allergy"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Separate each condition with a comma.
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Notes (optional)
        </span>
        <textarea
          value={state.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          rows={2}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <VaccinationsPanel
        rows={state.vaccinations}
        error={errors.vaccinations}
        onChange={(next) => onChange("vaccinations", next)}
      />
    </>
  );
}
