"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { PetImage } from "./PetImage";

const SPECIES_LABEL: Record<Doc<"pets">["species"], string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
};

export type PetWithImage = Doc<"pets"> & { imageUrl: string | null };

/**
 * One pet card in the client detail page. Whole row is clickable → opens
 * the edit dialog; small icon buttons on the right handle edit (redundant
 * affordance) and archive without triggering the row click.
 *
 * Surfaces compact useful metadata under the name: breed · age · sex ·
 * fixed-status · weight. A warning line appears below when the pet has
 * medical conditions or expired vaccinations so the groomer sees it at a
 * glance before opening the booking dialog.
 */
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
  const router = useRouter();
  const subtitle = formatSubtitle(pet);
  const today = new Date().toISOString().slice(0, 10);
  const expiredVaccines = pet.vaccinations.filter(
    (row) => row.expiresOn < today,
  ).length;
  const hasMedical =
    pet.medicalConditions !== undefined && pet.medicalConditions.length > 0;
  const showWarning = expiredVaccines > 0 || hasMedical;
  // Status modifiers — banned wins for border colour (front-desk needs to
  // see it loudest); deceased gets a muted look + badge in the title row.
  const cardClass = pet.isBanned
    ? "border-red-300 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20"
    : pet.isDeceased
      ? "border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
  const hoverClass = pet.isBanned
    ? "cursor-pointer hover:border-red-400 hover:bg-red-50 dark:hover:border-red-900 dark:hover:bg-red-950/30"
    : "cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <li
      onClick={() => {
        if (!busy) router.push(`/pets/${pet._id}`);
      }}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-colors ${cardClass} ${hoverClass}`}
    >
      <PetImage imageUrl={pet.imageUrl} alt={pet.name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`truncate text-sm font-semibold ${
              pet.isDeceased
                ? "text-zinc-500 dark:text-zinc-400"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {pet.name}
          </p>
          {pet.isDeceased && (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Deceased
            </span>
          )}
          {pet.isBanned && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 dark:bg-red-950/60 dark:text-red-300">
              Banned
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
        {showWarning && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle size={11} aria-hidden />
            {hasMedical && expiredVaccines > 0
              ? `${pet.medicalConditions!.length} medical · ${expiredVaccines} vaccine${expiredVaccines === 1 ? "" : "s"} expired`
              : hasMedical
                ? `${pet.medicalConditions!.length} medical condition${pet.medicalConditions!.length === 1 ? "" : "s"}`
                : `${expiredVaccines} vaccine${expiredVaccines === 1 ? "" : "s"} expired`}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            disabled={busy}
            aria-label="Edit pet"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <Pencil size={14} />
          </button>
        )}
        {canArchive && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onArchive();
            }}
            disabled={busy}
            aria-label="Archive pet"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        )}
        <ChevronRight
          size={16}
          aria-hidden
          className="ml-0.5 text-zinc-400 dark:text-zinc-500"
        />
      </div>
    </li>
  );
}

function formatSubtitle(pet: Doc<"pets">): string {
  const parts: string[] = [];
  if (pet.breed?.trim()) parts.push(pet.breed.trim());
  else parts.push(SPECIES_LABEL[pet.species]);
  const age = formatAge(pet.birthDate);
  if (age) parts.push(age);
  if (pet.sex) parts.push(pet.sex === "female" ? "Female" : "Male");
  if (pet.isFixed) {
    if (pet.sex === "female") parts.push("Spayed");
    else if (pet.sex === "male") parts.push("Neutered");
    else parts.push("Fixed");
  }
  if (pet.sizeLb !== undefined) parts.push(`${pet.sizeLb} lb`);
  return parts.join(" · ");
}

function formatAge(birthDate?: string): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  const now = new Date();
  if (birth.getTime() > now.getTime()) return null;
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years === 0) {
    if (months <= 0) return "<1 mo";
    return `${months} mo`;
  }
  return years === 1 ? "1 yr" : `${years} yrs`;
}
