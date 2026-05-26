"use client";

import { X } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type VaccinationDraft = {
  // Empty string while the form row hasn't picked a vaccine yet. Saving is
  // gated in the parent dialog so we never persist an empty id.
  vaccineId: Id<"vaccines"> | "";
  expiresOn: string;
  verified: boolean;
};

/**
 * One row of the pet form's vaccinations panel. Type is picked from a
 * dropdown of catalog vaccines. Selecting one with a `defaultIntervalMonths`
 * pre-fills `expiresOn` to today + N months unless the user already set a
 * date — so a fresh row jumps to a sensible expiry the moment they pick
 * "Rabies / 12 months", but an in-progress edit isn't clobbered.
 */
export function VaccinationRow({
  value,
  vaccines,
  petSpecies,
  onChange,
  onRemove,
}: {
  value: VaccinationDraft;
  vaccines: Doc<"vaccines">[];
  petSpecies: Doc<"pets">["species"];
  onChange: (next: VaccinationDraft) => void;
  onRemove: () => void;
}) {
  // Show only catalog entries that apply to this pet's species. `species: []`
  // means "applies to all species" and always passes. The currently-selected
  // vaccine is force-included so editing a pet keeps showing the old choice
  // even if its species list later excluded this pet.
  const relevant = vaccines.filter(
    (vaccine) =>
      vaccine.species.length === 0 ||
      vaccine.species.includes(petSpecies) ||
      vaccine._id === value.vaccineId,
  );

  function handleSelect(nextVaccineId: string) {
    const next: VaccinationDraft = {
      ...value,
      vaccineId: nextVaccineId as Id<"vaccines">,
    };
    if (!value.expiresOn) {
      const picked = vaccines.find((vaccine) => vaccine._id === nextVaccineId);
      if (picked?.defaultIntervalMonths) {
        next.expiresOn = addMonthsIso(new Date(), picked.defaultIntervalMonths);
      }
    }
    onChange(next);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value.vaccineId}
        onChange={(event) => handleSelect(event.target.value)}
        className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value="" disabled>
          Select a vaccine
        </option>
        {relevant.map((vaccine) => (
          <option key={vaccine._id} value={vaccine._id}>
            {vaccine.name}
            {vaccine.deletedAt !== undefined ? " (removed)" : ""}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={value.expiresOn}
        onChange={(event) => onChange({ ...value, expiresOn: event.target.value })}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <label className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={value.verified}
          onChange={(event) => onChange({ ...value, verified: event.target.checked })}
          className="h-3.5 w-3.5"
        />
        Verified
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove vaccination"
        className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function addMonthsIso(base: Date, months: number): string {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}
