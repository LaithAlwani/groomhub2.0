"use client";
import { formatError } from "@/lib/formatError";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

/**
 * Inline editor for the locations a single membership is assigned to. Used in
 * the staff list when the org has more than one location. Owners
 * (`superAdmin`) always see everything — the editor renders the chip as
 * "All locations" and disables the picker for them.
 *
 * Persists via `api.memberships.setLocations`. Empty array = "all locations".
 */
export function MemberLocationsEditor({
  membership,
  locations,
}: {
  membership: Doc<"memberships">;
  locations: Doc<"locations">[];
}) {
  const setLocationsMutation = useMutation(api.memberships.setLocations);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Id<"locations">[]>(membership.locationIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Re-sync draft when the underlying row updates (e.g. live query refresh).
  useEffect(() => {
    setDraft(membership.locationIds);
  }, [membership.locationIds]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isOwner = membership.role === "superAdmin";
  const allLocations = membership.locationIds.length === 0;
  const summary = allLocations
    ? "All locations"
    : namesFor(membership.locationIds, locations);

  function toggle(id: Id<"locations">) {
    setDraft((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await setLocationsMutation({
        membershipId: membership._id,
        locationIds: draft,
      });
      setOpen(false);
    } catch (caught) {
      setError(formatError(caught, "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isOwner}
        onClick={() => setOpen((value) => !value)}
        title={isOwner ? "Owners are at every location" : "Edit locations"}
        className="flex max-w-[14rem] items-center gap-1.5 truncate rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <MapPin size={12} className="shrink-0 text-zinc-400" aria-hidden />
        <span className="truncate">{summary}</span>
        {!isOwner && (
          <ChevronsUpDown
            size={10}
            aria-hidden
            className="shrink-0 text-zinc-400"
          />
        )}
      </button>
      {open && !isOwner && (
        <div
          role="dialog"
          className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <header className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-900">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Assigned locations
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              None checked = every location.
            </p>
          </header>
          <ul className="flex flex-col px-2 py-2">
            {locations.map((location) => {
              const checked = draft.includes(location._id);
              return (
                <li key={location._id}>
                  <button
                    type="button"
                    onClick={() => toggle(location._id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? "border-orange-500 bg-orange-500 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
                    >
                      {checked && <Check size={10} />}
                    </span>
                    <span className="flex-1 truncate">{location.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <p className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-900 dark:bg-zinc-900/40">
            <button
              type="button"
              onClick={() => {
                setDraft(membership.locationIds);
                setOpen(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function namesFor(
  ids: ReadonlyArray<Id<"locations">>,
  locations: ReadonlyArray<Doc<"locations">>,
): string {
  if (ids.length === 0) return "—";
  const byId = new Map(locations.map((row) => [row._id, row.name]));
  const names = ids
    .map((id) => byId.get(id))
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}
