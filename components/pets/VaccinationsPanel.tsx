"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ExternalLink, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { VaccinationRow, type VaccinationDraft } from "./VaccinationRow";

/**
 * Vaccinations sub-panel inside the pet form. Lists the pet's current
 * vaccination rows and surfaces an "Add" affordance that appends a blank
 * row for the user to fill in via the catalog dropdown.
 *
 * When the org's vaccine catalog is empty, the panel shows an inline link
 * to `/vaccines` so the user can populate it before recording anything on
 * the pet — otherwise the dropdown has nothing to offer.
 */
export function VaccinationsPanel({
  rows,
  petSpecies,
  error,
  onChange,
}: {
  rows: VaccinationDraft[];
  petSpecies: Doc<"pets">["species"];
  error?: string;
  onChange: (next: VaccinationDraft[]) => void;
}) {
  const vaccines = useQuery(api.vaccines.list, {});
  const catalogReady = vaccines !== undefined;
  const catalogEmpty = catalogReady && vaccines.length === 0;

  function addRow() {
    onChange([
      ...rows,
      { vaccineId: "", expiresOn: "", verified: false },
    ]);
  }

  function setRow(index: number, next: VaccinationDraft) {
    onChange(rows.map((row, position) => (position === index ? next : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, position) => position !== index));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Vaccinations
        </span>
        <button
          type="button"
          onClick={addRow}
          disabled={!catalogReady || catalogEmpty}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {catalogEmpty && (
        <p className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          No vaccine types yet —
          <Link
            href="/vaccines"
            className="inline-flex items-center gap-0.5 font-medium underline"
          >
            add one in /vaccines
            <ExternalLink size={10} aria-hidden />
          </Link>
          first.
        </p>
      )}
      {rows.length === 0 && !catalogEmpty && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No vaccinations on file.
        </p>
      )}
      {rows.map((row, index) => (
        <VaccinationRow
          key={index}
          value={row}
          vaccines={vaccines ?? []}
          petSpecies={petSpecies}
          onChange={(next) => setRow(index, next)}
          onRemove={() => removeRow(index)}
        />
      ))}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
