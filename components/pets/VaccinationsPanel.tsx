"use client";

import { Plus } from "lucide-react";
import { VaccinationRow, type VaccinationDraft } from "./VaccinationRow";

export function VaccinationsPanel({
  rows,
  error,
  onChange,
}: {
  rows: VaccinationDraft[];
  error?: string;
  onChange: (next: VaccinationDraft[]) => void;
}) {
  function addRow() {
    onChange([
      ...rows,
      { type: "", expiresOn: new Date().toISOString().slice(0, 10), verified: false },
    ]);
  }

  function setRow(index: number, next: VaccinationDraft) {
    onChange(rows.map((row, position) => (position === index ? next : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, position) => position !== index));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Vaccinations
        </span>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No vaccinations on file.
        </p>
      )}
      {rows.map((row, index) => (
        <VaccinationRow
          key={index}
          value={row}
          onChange={(next) => setRow(index, next)}
          onRemove={() => removeRow(index)}
        />
      ))}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
