"use client";

import { Plus, X } from "lucide-react";
import { formatPhone } from "@/lib/phone";

/**
 * Phone-list editor for the client form. The first entry is the primary
 * phone (used everywhere — click-to-call, SMS, formatPhone()); any extras
 * become `altPhones[]` on save. Numbers get auto-formatted on blur via
 * `formatPhone` for a consistent xxx-xxx-xxxx surface.
 */
export function PhonesField({
  phones,
  onChange,
  error,
}: {
  phones: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  function updateAt(index: number, value: string) {
    const next = phones.slice();
    next[index] = value;
    onChange(next);
  }

  function addPhone() {
    onChange([...phones, ""]);
  }

  function removeAt(index: number) {
    if (phones.length === 1) {
      onChange([""]);
      return;
    }
    onChange(phones.filter((_, current) => current !== index));
  }

  function formatOnBlur(index: number) {
    const value = phones[index] ?? "";
    if (!value.trim()) return;
    updateAt(index, formatPhone(value));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Phone (optional)
      </span>
      <div className="flex flex-col gap-2">
        {phones.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="tel"
              value={value}
              onChange={(event) => updateAt(index, event.target.value)}
              onBlur={() => formatOnBlur(index)}
              inputMode="tel"
              placeholder={index === 0 ? "Primary · 555-123-4567" : "Alternate phone"}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
            />
            {(phones.length > 1 || value.trim().length > 0) && (
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Remove phone"
                className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addPhone}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <Plus size={12} />
        Add another phone
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
