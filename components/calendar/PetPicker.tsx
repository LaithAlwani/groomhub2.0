"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";

/**
 * Pet selector for the booking dialog — a custom dropdown (matching
 * `ClientPicker`) so the "Add new pet" action can be a styled row at the top,
 * and deceased/banned pets stay visible but unselectable. Queries the chosen
 * client's pets itself.
 */
export function PetPicker({
  clientId,
  value,
  onChange,
  disabled,
  onCreateNew,
  error,
  autoSelectSingle,
}: {
  clientId: Id<"clients"> | null;
  value: Id<"pets"> | null;
  onChange: (id: Id<"pets">) => void;
  disabled?: boolean;
  onCreateNew?: () => void;
  error?: string;
  // When set, and the client has exactly one bookable pet, select it
  // automatically so single-pet clients need no extra tap.
  autoSelectSingle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pets = useQuery(
    api.pets.listForClient,
    clientId ? { clientId } : "skip",
  );

  useEffect(() => {
    if (!autoSelectSingle || value !== null || !pets) return;
    // Deceased / banned pets can't be booked, so only auto-pick when there's
    // exactly one otherwise-eligible pet on file.
    const selectable = pets.filter(
      (pet) => pet.isDeceased !== true && pet.isBanned !== true,
    );
    if (selectable.length === 1) onChange(selectable[0]._id);
  }, [autoSelectSingle, value, pets, onChange]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selected = pets?.find((pet) => pet._id === value) ?? null;
  const triggerLabel = !clientId
    ? "Choose a client first"
    : pets === undefined
      ? "Loading…"
      : selected
        ? `${selected.name} (${selected.species})`
        : pets.length === 0
          ? "No pets on file"
          : "Choose a pet";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Pet
        <RequiredMark />
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        <span className={selected ? "" : "text-zinc-500"}>{triggerLabel}</span>
        <ChevronsUpDown size={14} className="shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
              className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2.5 text-left text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 dark:border-zinc-800 dark:text-orange-400 dark:hover:bg-zinc-900"
            >
              <Plus size={14} aria-hidden />
              Add new pet
            </button>
          )}
          <ul className="max-h-60 overflow-y-auto py-1">
            {pets === undefined && (
              <li className="px-3 py-2 text-xs text-zinc-500">Loading…</li>
            )}
            {pets?.length === 0 && (
              <li className="px-3 py-2 text-xs text-zinc-500">
                No pets on file yet.
              </li>
            )}
            {pets?.map((pet) => {
              const isDeceased = pet.isDeceased === true;
              const isBanned = pet.isBanned === true;
              const isCurrentSelection = value === pet._id;
              // Blocked pets stay visible (so historical context shows) but can't
              // be picked for a new booking.
              const isBlocked = (isDeceased || isBanned) && !isCurrentSelection;
              const suffix = isDeceased
                ? " — Deceased"
                : isBanned
                  ? " — Banned"
                  : "";
              return (
                <li key={pet._id}>
                  <button
                    type="button"
                    disabled={isBlocked}
                    onClick={() => {
                      onChange(pet._id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-900"
                  >
                    <span className="min-w-0 truncate">
                      {pet.name} ({pet.species})
                      {suffix}
                    </span>
                    {isCurrentSelection && (
                      <Check
                        size={14}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
