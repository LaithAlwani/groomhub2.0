"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { PetImage } from "./PetImage";

const SPECIES_LABEL: Record<Doc<"pets">["species"], string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
};

export type PetWithImage = Doc<"pets"> & { imageUrl: string | null };

export function PetRow({
  pet,
  canEdit,
  canArchive,
  busy,
  onEdit,
  onArchive,
}: {
  pet: PetWithImage;
  canEdit: boolean;
  canArchive: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const expiredCount = pet.vaccinations.filter((row) => row.expiresOn < today).length;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <PetImage imageUrl={pet.imageUrl} alt={pet.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {pet.name}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {SPECIES_LABEL[pet.species]}
          {pet.sex && ` · ${pet.sex === "female" ? "Female" : "Male"}`}
          {pet.isFixed &&
            ` · ${pet.sex === "female" ? "Spayed" : pet.sex === "male" ? "Neutered" : "Fixed"}`}
          {pet.breed && ` · ${pet.breed}`}
          {pet.sizeKg !== undefined && ` · ${pet.sizeKg} kg`}
          {pet.coatType && ` · ${pet.coatType}`}
        </p>
        {pet.temperament && (
          <p className="mt-1 text-xs italic text-zinc-500 dark:text-zinc-400">
            {pet.temperament}
          </p>
        )}
        {pet.medicalConditions && pet.medicalConditions.length > 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Medical: {pet.medicalConditions.join(", ")}
          </p>
        )}
        {pet.vaccinations.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {pet.vaccinations.length} vaccination
            {pet.vaccinations.length === 1 ? "" : "s"}
            {expiredCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {expiredCount} expired
              </span>
            )}
          </p>
        )}
        {pet.notes && (
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {pet.notes}
          </p>
        )}
      </div>
      {(canEdit || canArchive) && (
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              aria-label="Edit pet"
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              <Pencil size={16} />
            </button>
          )}
          {canArchive && (
            <button
              type="button"
              onClick={onArchive}
              disabled={busy}
              aria-label="Archive pet"
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
