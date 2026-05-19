"use client";

import { X } from "lucide-react";

export type VaccinationDraft = {
  type: string;
  expiresOn: string;
  verified: boolean;
};

export function VaccinationRow({
  value,
  onChange,
  onRemove,
}: {
  value: VaccinationDraft;
  onChange: (next: VaccinationDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value.type}
        onChange={(event) => onChange({ ...value, type: event.target.value })}
        placeholder="Rabies"
        className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <input
        type="date"
        value={value.expiresOn}
        onChange={(event) => onChange({ ...value, expiresOn: event.target.value })}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <label className="inline-flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={value.verified}
          onChange={(event) => onChange({ ...value, verified: event.target.checked })}
          className="h-3.5 w-3.5"
        />
        Verified
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove vaccination"
        className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}
