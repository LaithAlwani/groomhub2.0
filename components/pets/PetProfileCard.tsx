"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PetImage } from "./PetImage";
import { PetStatusToggles } from "./PetStatusToggles";

const SPECIES_LABEL: Record<Doc<"pets">["species"], string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
};

type PetWithOwner = Doc<"pets"> & {
  imageUrl: string | null;
  owner: { id: Id<"clients">; fullName: string } | null;
};

/**
 * Header card for the pet detail page: photo, name + status badges, a
 * breadcrumb back to the owning client, the key at-a-glance facts, and
 * edit/archive actions. Mirrors the client header card's tinted style.
 */
export function PetProfileCard({
  pet,
  canEdit,
  canArchive,
  onEdit,
  onArchive,
}: {
  pet: PetWithOwner;
  canEdit: boolean;
  canArchive: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const facts = formatFacts(pet);
  return (
    <>
      {pet.owner ? (
        <Link
          href={`/clients/${pet.owner.id}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={14} />
          {pet.owner.fullName}
        </Link>
      ) : (
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={14} />
          Back to clients
        </Link>
      )}
      <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white via-orange-50/30 to-orange-100/40 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-orange-950/20">
        <div className="flex items-start gap-4">
          <PetImage imageUrl={pet.imageUrl} alt={pet.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1
              className={`truncate text-2xl font-semibold tracking-tight ${
                pet.isDeceased
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {pet.name}
            </h1>
            {facts && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {facts}
              </p>
            )}
            {pet.temperament?.trim() && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Temperament: {pet.temperament.trim()}
              </p>
            )}
            {canEdit && (
              <PetStatusToggles
                petId={pet._id}
                isDeceased={pet.isDeceased ?? false}
                isBanned={pet.isBanned ?? false}
              />
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit pet"
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/60 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                <Pencil size={14} />
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={onArchive}
                aria-label="Archive pet"
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/60 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {pet.notes?.trim() && (
          <p className="mt-4 whitespace-pre-line rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
            {pet.notes.trim()}
          </p>
        )}
      </section>
    </>
  );
}

function formatFacts(pet: Doc<"pets">): string {
  const parts: string[] = [];
  if (pet.breed?.trim()) parts.push(pet.breed.trim());
  else parts.push(SPECIES_LABEL[pet.species]);
  if (pet.coatType?.trim()) parts.push(pet.coatType.trim());
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
  if (years === 0) return months <= 0 ? "<1 mo" : `${months} mo`;
  return years === 1 ? "1 yr" : `${years} yrs`;
}
