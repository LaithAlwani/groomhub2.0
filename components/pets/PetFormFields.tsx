"use client";

import { Field } from "@/components/forms/Field";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { SwitchRow } from "@/components/forms/Switch";
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
  isDeceased: boolean;
  isBanned: boolean;
  breed: string;
  coatType: string;
  sizeLb: string;
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
  petId,
  state,
  errors,
  onChange,
}: {
  petId?: Id<"pets">;
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
        petId={petId}
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
          required
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Species
            <RequiredMark />
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
            <RequiredMark />
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
          {errors.sex && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {errors.sex}
            </span>
          )}
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
          label="Breed"
          value={state.breed}
          onChange={(value) => onChange("breed", value)}
          error={errors.breed}
          required
        />
        <Field
          label="Coat type"
          value={state.coatType}
          onChange={(value) => onChange("coatType", value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Size (lb)"
          type="number"
          inputMode="decimal"
          value={state.sizeLb}
          onChange={(value) => onChange("sizeLb", value)}
          error={errors.sizeLb}
          required
        />
        <Field
          label="Birth date"
          type="date"
          value={state.birthDate}
          onChange={(value) => onChange("birthDate", value)}
        />
      </div>
      <Field
        label="Temperament"
        value={state.temperament}
        onChange={(value) => onChange("temperament", value)}
        placeholder="Friendly · anxious around clippers"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Medical conditions
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
          Notes
        </span>
        <textarea
          value={state.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          rows={2}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      {/* Status toggles — switches sit on the right so the label/helper
          column reads naturally on the left. Either flag changes how the
          pet card looks; `isDeceased` additionally blocks new bookings. */}
      <fieldset className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Status
        </legend>
        <SwitchRow
          title="Deceased"
          helper="Blocks new appointments"
          checked={state.isDeceased}
          onChange={(next) => onChange("isDeceased", next)}
        />
        <SwitchRow
          title="Banned"
          helper="Blocks new appointments + highlights the card in red"
          checked={state.isBanned}
          onChange={(next) => onChange("isBanned", next)}
        />
      </fieldset>
      <VaccinationsPanel
        rows={state.vaccinations}
        petSpecies={state.species}
        error={errors.vaccinations}
        onChange={(next) => onChange("vaccinations", next)}
      />
    </>
  );
}
