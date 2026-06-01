"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { RequiredMark } from "@/components/forms/RequiredMark";

export function ClientPicker({
  value,
  onChange,
  disabled,
  onCreateNew,
}: {
  value: Id<"clients"> | null;
  onChange: (id: Id<"clients">) => void;
  disabled?: boolean;
  /** When provided, renders an "Add new client" action in the dropdown so the
   * user can create one without leaving the booking flow. */
  onCreateNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 150);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const results = useQuery(api.clients.list, { search: debounced || undefined });
  const selected = useQuery(api.clients.get, value ? { id: value } : "skip");

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

  const triggerLabel = selected ? selected.fullName : "Choose a client";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Client
        <RequiredMark />
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        <span className={selected ? "" : "text-zinc-500"}>{triggerLabel}</span>
        <ChevronsUpDown size={14} className="shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <label className="relative flex items-center">
              <Search
                size={14}
                aria-hidden
                className="absolute left-2 text-zinc-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or phone…"
                autoFocus
                className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-7 pr-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {results === undefined && (
              <li className="px-3 py-2 text-xs text-zinc-500">Loading…</li>
            )}
            {results?.length === 0 && (
              <li className="px-3 py-2 text-xs text-zinc-500">No matches.</li>
            )}
            {results?.map((client) => (
              <li key={client._id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(client._id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="min-w-0 truncate">{client.fullName}</span>
                  {value === client._id && (
                    <Check size={14} className="text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
              className="flex w-full items-center gap-2 border-t border-zinc-200 px-3 py-2.5 text-left text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50 dark:border-zinc-800 dark:text-orange-400 dark:hover:bg-zinc-900"
            >
              <Plus size={14} aria-hidden />
              Add new client
            </button>
          )}
        </div>
      )}
    </div>
  );
}
