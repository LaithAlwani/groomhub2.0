"use client";

import { Plus, X } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { RequiredMark } from "@/components/forms/RequiredMark";
import {
  digitsOnly,
  formatAsYouType,
  PHONE_LABEL_SUGGESTIONS,
} from "@/lib/phone";
import { EMPTY_PHONE, type PhoneFormEntry } from "./clientPhones";
import { COUNTRY_OPTIONS } from "./phoneCountries";

const LABEL_SUGGESTIONS_ID = "phone-label-suggestions";

const fieldClass =
  "rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100";

/**
 * Phone-list editor for the client form. Each row has a country picker, the
 * number (formatted live for that country via libphonenumber's AsYouType), and
 * an optional label. The first row is the primary phone; extras become
 * `altPhones[]`. Numbers are parsed to E.164 on save (see `clientPhones.ts`).
 */
export function PhonesField({
  phones,
  onChange,
  defaultCountry,
  error,
  required = false,
}: {
  phones: PhoneFormEntry[];
  onChange: (next: PhoneFormEntry[]) => void;
  defaultCountry: CountryCode;
  error?: string;
  required?: boolean;
}) {
  function updateAt(index: number, patch: Partial<PhoneFormEntry>) {
    const next = phones.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function changeNumber(index: number, raw: string) {
    const entry = phones[index];
    let next = formatAsYouType(raw, entry.country);
    // If a backspace deleted a formatting char that AsYouType just re-added,
    // drop a digit so deletion isn't stuck on the separator.
    if (raw.length < entry.number.length && next === entry.number) {
      next = formatAsYouType(digitsOnly(raw).slice(0, -1), entry.country);
    }
    updateAt(index, { number: next });
  }

  function changeCountry(index: number, country: CountryCode) {
    // Re-run formatting under the new country's rules.
    updateAt(index, {
      country,
      number: formatAsYouType(digitsOnly(phones[index].number), country),
    });
  }

  function addPhone() {
    onChange([...phones, { ...EMPTY_PHONE, country: defaultCountry }]);
  }

  function removeAt(index: number) {
    if (phones.length === 1) {
      onChange([{ ...EMPTY_PHONE, country: defaultCountry }]);
      return;
    }
    onChange(phones.filter((_, current) => current !== index));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Phone
        {required && <RequiredMark />}
      </span>
      <div className="flex flex-col gap-2">
        {phones.map((entry, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={entry.country}
              onChange={(event) =>
                changeCountry(index, event.target.value as CountryCode)
              }
              aria-label="Country"
              className={`${fieldClass} w-[7.5rem] shrink-0`}
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} +{option.calling}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={entry.number}
              onChange={(event) => changeNumber(index, event.target.value)}
              inputMode="tel"
              placeholder={index === 0 ? "Primary phone" : "Alternate phone"}
              className={`${fieldClass} min-w-0 flex-1 px-3`}
            />
            <input
              type="text"
              list={LABEL_SUGGESTIONS_ID}
              value={entry.label}
              onChange={(event) =>
                updateAt(index, { label: event.target.value })
              }
              aria-label="Phone label"
              placeholder="Label"
              className={`${fieldClass} w-24 shrink-0 px-2.5`}
            />
            {(phones.length > 1 || entry.number.trim().length > 0) && (
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
      <datalist id={LABEL_SUGGESTIONS_ID}>
        {PHONE_LABEL_SUGGESTIONS.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
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
