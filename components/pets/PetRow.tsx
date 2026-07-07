"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { PetImage } from "./PetImage";
import { formatSubtitle } from "./petCardSubtitle";

export type PetWithImage = Doc<"pets"> & { imageUrl: string | null };

/**
 * One pet card in the client detail page grid. The whole card is clickable →
 * opens the pet page; small icon buttons on the top-right handle edit and
 * archive without triggering the card click.
 *
 * The header row shows the photo, name/badges, and compact metadata (breed ·
 * age · sex · fixed-status · weight). Below it a details block surfaces what a
 * groomer needs before a visit: medical conditions / allergies as amber chips,
 * an expired-vaccine warning, and the free-text care notes.
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
  const medicalConditions =
    pet.medicalConditions?.map((condition) => condition.trim()).filter(Boolean) ??
    [];
  const hasMedical = medicalConditions.length > 0;
  const notes = pet.notes?.trim();
  const hasDetails = hasMedical || expiredVaccines > 0 || Boolean(notes);
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
      className={`flex h-full flex-col rounded-2xl border px-4 py-3 shadow-sm transition-colors ${cardClass} ${hoverClass}`}
    >
      <div className="flex items-center gap-3">
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
      </div>

      {hasDetails && (
        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
          {hasMedical && (
            <div className="flex flex-wrap gap-1.5">
              {medicalConditions.map((condition) => (
                <span
                  key={condition}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <AlertTriangle size={10} aria-hidden />
                  {condition}
                </span>
              ))}
            </div>
          )}
          {expiredVaccines > 0 && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
              <AlertTriangle size={11} aria-hidden />
              {expiredVaccines} vaccine{expiredVaccines === 1 ? "" : "s"} expired
            </p>
          )}
          {notes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Notes
              </p>
              <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                {notes}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
