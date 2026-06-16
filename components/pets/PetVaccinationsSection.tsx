"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { VaccinationsPanel } from "./VaccinationsPanel";
import type { VaccinationDraft } from "./VaccinationRow";

/**
 * Standalone vaccinations editor on the pet detail page. Pulled out of the
 * add/edit pet form to keep that form short. Edits a local draft and commits
 * the whole set via `pets.setVaccinations` on Save. The Save button only
 * enables when the draft is both dirty and valid.
 */
export function PetVaccinationsSection({ pet }: { pet: Doc<"pets"> }) {
  const save = useMutation(api.pets.setVaccinations);
  const persisted: VaccinationDraft[] = pet.vaccinations.map((row) => ({
    ...row,
  }));
  const persistedKey = JSON.stringify(persisted);

  const [rows, setRows] = useState<VaccinationDraft[]>(persisted);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Resync the draft whenever the saved set changes (e.g. after our own save
  // commits, or another session edits it). Keyed on the serialized value so an
  // in-progress edit isn't clobbered by an unrelated query re-run.
  useEffect(() => {
    setRows(JSON.parse(persistedKey) as VaccinationDraft[]);
    setError(null);
  }, [persistedKey]);

  const isDirty = JSON.stringify(rows) !== persistedKey;
  const isValid = rows.every(
    (row) => row.vaccineId !== "" && /^\d{4}-\d{2}-\d{2}$/.test(row.expiresOn),
  );

  async function handleSave() {
    if (!isValid) {
      setError("Each vaccination needs a vaccine and a valid expiry date.");
      return;
    }
    setError(null);
    setServerError(null);
    setSaving(true);
    try {
      await save({
        id: pet._id,
        vaccinations: rows.map((row) => ({
          vaccineId: row.vaccineId as Exclude<typeof row.vaccineId, "">,
          expiresOn: row.expiresOn,
          verified: row.verified,
        })),
      });
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not save",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Vaccinations
      </h2>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <VaccinationsPanel
          rows={rows}
          petSpecies={pet.species}
          error={error ?? undefined}
          onChange={setRows}
        />
        {serverError && (
          <div className="mt-3">
            <ErrorBanner>{serverError}</ErrorBanner>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={() => setRows(JSON.parse(persistedKey))}
              disabled={saving}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || !isValid || saving}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {saving ? "Saving…" : "Save vaccinations"}
          </button>
        </div>
      </div>
    </section>
  );
}
