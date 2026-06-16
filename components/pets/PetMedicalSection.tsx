"use client";

import { AlertTriangle } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Medical conditions on the pet detail page (read-only here; edited via the
 * pet form). Vaccinations live in their own editable section
 * (`PetVaccinationsSection`).
 */
export function PetMedicalSection({ pet }: { pet: Doc<"pets"> }) {
  const conditions = pet.medicalConditions ?? [];

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Medical conditions
      </h2>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {conditions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            None on file.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {conditions.map((condition) => (
              <li
                key={condition}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <AlertTriangle size={11} aria-hidden />
                {condition}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
