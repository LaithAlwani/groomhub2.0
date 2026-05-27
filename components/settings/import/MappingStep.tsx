"use client";

import { useMemo, useState } from "react";
import { useAction } from "convex/react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  type ColumnMapping,
  type ImportMode,
  type TargetField,
  suggestMapping,
} from "@/lib/import/applyMapping";

/**
 * Step 2 — what does each source column become? The radio at the top
 * controls which target fields appear in every column's dropdown; the
 * table previews the first three rows of values so the user can sanity-
 * check the mapping while they pick.
 */

const MODE_OPTIONS: ReadonlyArray<{
  value: ImportMode;
  label: string;
  helper: string;
}> = [
  {
    value: "clients",
    label: "Clients only",
    helper: "One row per client. No pets, no appointment history.",
  },
  {
    value: "clientsAndPets",
    label: "Clients, pets & last appointment",
    helper:
      "Each row creates a client, up to 3 pets, and one past appointment if history columns are mapped.",
  },
  {
    value: "appointmentHistory",
    label: "Appointment history only",
    helper:
      "Each row is an old visit, matched to an existing client by email or phone.",
  },
];

const COMMON_TARGETS: ReadonlyArray<{ value: TargetField; label: string }> = [
  { value: "skip", label: "— Skip this column —" },
];

const CLIENT_TARGETS: ReadonlyArray<{ value: TargetField; label: string }> = [
  { value: "client.fullName", label: "Client · Full name" },
  { value: "client.firstName", label: "Client · First name" },
  { value: "client.middleName", label: "Client · Middle name" },
  { value: "client.lastName", label: "Client · Last name" },
  { value: "client.email", label: "Client · Email" },
  { value: "client.phone", label: "Client · Phone" },
  { value: "client.phone2", label: "Client · Alt phone" },
  { value: "client.phone3", label: "Client · Alt phone 2" },
  { value: "client.addressLine1", label: "Client · Address" },
  { value: "client.city", label: "Client · City" },
  { value: "client.state", label: "Client · State / Province" },
  { value: "client.postalCode", label: "Client · Postal / ZIP" },
  { value: "client.country", label: "Client · Country" },
  { value: "client.notes", label: "Client · Notes" },
];

const PET_TARGETS: ReadonlyArray<{ value: TargetField; label: string }> = [
  { value: "pet.name", label: "Pet 1 · Name" },
  { value: "pet.species", label: "Pet 1 · Species" },
  { value: "pet.breed", label: "Pet 1 · Breed" },
  { value: "pet.birthDate", label: "Pet 1 · Birth date" },
  { value: "pet.sex", label: "Pet 1 · Sex" },
  { value: "pet.sizeLb", label: "Pet 1 · Weight (lb)" },
  { value: "pet.notes", label: "Pet 1 · Notes" },
  { value: "pet2.name", label: "Pet 2 · Name" },
  { value: "pet2.species", label: "Pet 2 · Species" },
  { value: "pet2.breed", label: "Pet 2 · Breed" },
  { value: "pet2.birthDate", label: "Pet 2 · Birth date" },
  { value: "pet2.sex", label: "Pet 2 · Sex" },
  { value: "pet2.sizeLb", label: "Pet 2 · Weight (lb)" },
  { value: "pet2.notes", label: "Pet 2 · Notes" },
  { value: "pet3.name", label: "Pet 3 · Name" },
  { value: "pet3.species", label: "Pet 3 · Species" },
  { value: "pet3.breed", label: "Pet 3 · Breed" },
  { value: "pet3.birthDate", label: "Pet 3 · Birth date" },
  { value: "pet3.sex", label: "Pet 3 · Sex" },
  { value: "pet3.sizeLb", label: "Pet 3 · Weight (lb)" },
  { value: "pet3.notes", label: "Pet 3 · Notes" },
];

const HISTORY_TARGETS: ReadonlyArray<{ value: TargetField; label: string }> = [
  { value: "history.clientEmail", label: "Match client · Email" },
  { value: "history.clientPhone", label: "Match client · Phone" },
  { value: "history.petName", label: "History · Pet name" },
  { value: "history.serviceName", label: "History · Service" },
  { value: "history.staffName", label: "History · Staff / Groomer" },
  { value: "history.dateLabel", label: "History · Date" },
  { value: "history.timeLabel", label: "History · Time" },
  { value: "history.priceLabel", label: "History · Price" },
  { value: "history.notes", label: "History · Notes" },
];

export function MappingStep({
  headers,
  rows,
  mode,
  mapping,
  onModeChange,
  onMappingChange,
  onContinue,
  onBack,
}: {
  headers: string[];
  rows: Record<string, string>[];
  mode: ImportMode;
  mapping: ColumnMapping;
  onModeChange: (next: ImportMode, mappingOverride?: ColumnMapping) => void;
  onMappingChange: (next: ColumnMapping) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const targets = useMemo(() => buildTargetOptions(mode), [mode]);
  const previewRows = rows.slice(0, 3);
  const requirementError = useMemo(
    () => validateRequiredFields(mapping, mode),
    [mapping, mode],
  );
  const suggestFromAI = useAction(api.imports.suggestMappingFromAI);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function handleTargetChange(header: string, value: TargetField) {
    onMappingChange({ ...mapping, [header]: value });
  }

  async function handleAISuggest() {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await suggestFromAI({
        mode,
        headers,
        samples: previewRows,
      });
      if (Object.keys(result.mapping).length === 0 && result.mode === mode) {
        setAiError("Claude couldn't read a useful mapping from this file.");
        return;
      }
      const aiMapping = result.mapping as ColumnMapping;
      if (result.mode !== mode) {
        // Mode changed — rebuild the dropdown base from the new mode's
        // heuristic so we don't carry over targets that are invalid for
        // the new mode, then layer AI's choices on top. Single atomic
        // update via the parent so React doesn't flash an inconsistent
        // intermediate state.
        const base = suggestMapping(headers, result.mode);
        onModeChange(result.mode, { ...base, ...aiMapping });
      } else {
        onMappingChange({ ...mapping, ...aiMapping });
      }
    } catch (caught) {
      setAiError(
        caught instanceof Error ? caught.message : "AI suggestion failed.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          What does each row represent?
        </p>
        <button
          type="button"
          onClick={handleAISuggest}
          disabled={aiBusy || headers.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50"
        >
          {aiBusy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {aiBusy ? "Asking Claude…" : "Suggest with AI"}
        </button>
      </div>

      {aiError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {aiError}
        </p>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">What does each row represent?</legend>
        {MODE_OPTIONS.map((option) => {
          const active = option.value === mode;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-4 py-3 text-sm transition-colors ${
                active
                  ? "border-[#00273c] bg-[#00273c]/5 text-zinc-900 dark:border-orange-300 dark:bg-orange-950/20 dark:text-zinc-100"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="import-mode"
                  className="h-3.5 w-3.5"
                  checked={active}
                  onChange={() => onModeChange(option.value)}
                />
                {option.label}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {option.helper}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.2fr_1.4fr_2fr] items-center gap-2 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>Source column</span>
          <span>Target field</span>
          <span>Sample values</span>
        </div>
        <ul>
          {headers.map((header) => (
            <li
              key={header}
              className="grid grid-cols-[1.2fr_1.4fr_2fr] items-center gap-2 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900"
            >
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {header}
              </span>
              <select
                value={mapping[header] ?? "skip"}
                onChange={(event) =>
                  handleTargetChange(header, event.target.value as TargetField)
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-[#00273c] focus:outline-none focus:ring-2 focus:ring-[#00273c]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {targets.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                {previewRows.map((row, index) => {
                  const value = (row[header] ?? "").trim();
                  if (!value) return null;
                  return (
                    <span
                      key={index}
                      className="truncate rounded-md bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-900"
                    >
                      {value.length > 28 ? `${value.slice(0, 28)}…` : value}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {requirementError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {requirementError}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={Boolean(requirementError)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00273c] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#013a58] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
        >
          Continue
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// History fields that make sense when the row also creates a fresh client.
// `clientEmail` / `clientPhone` are intentionally dropped — they're for the
// standalone history mode where rows are matched against EXISTING clients;
// in clientsAndPets mode the client comes from the same row.
const INLINE_HISTORY_TARGETS: ReadonlyArray<{
  value: TargetField;
  label: string;
}> = HISTORY_TARGETS.filter(
  (target) =>
    target.value !== "history.clientEmail" &&
    target.value !== "history.clientPhone",
);

function buildTargetOptions(
  mode: ImportMode,
): ReadonlyArray<{ value: TargetField; label: string }> {
  if (mode === "appointmentHistory") {
    return [...COMMON_TARGETS, ...HISTORY_TARGETS];
  }
  if (mode === "clientsAndPets") {
    return [
      ...COMMON_TARGETS,
      ...CLIENT_TARGETS,
      ...PET_TARGETS,
      ...INLINE_HISTORY_TARGETS,
    ];
  }
  return [...COMMON_TARGETS, ...CLIENT_TARGETS];
}

function validateRequiredFields(
  mapping: ColumnMapping,
  mode: ImportMode,
): string | null {
  const targets = new Set(Object.values(mapping));
  if (mode === "appointmentHistory") {
    if (
      !targets.has("history.clientEmail") &&
      !targets.has("history.clientPhone")
    ) {
      return "Map at least one column to Match client · Email or Match client · Phone so we can attach history to existing clients.";
    }
    if (!targets.has("history.dateLabel")) {
      return "Map a column to History · Date — without it the imported rows have no timestamp.";
    }
    return null;
  }
  if (
    !targets.has("client.fullName") &&
    !(targets.has("client.firstName") && targets.has("client.lastName"))
  ) {
    return "Map a column to Client · Full name — or map both First name + Last name so we can combine them.";
  }
  if (
    mode === "clientsAndPets" &&
    !targets.has("pet.name") &&
    !targets.has("pet2.name") &&
    !targets.has("pet3.name")
  ) {
    return "Map at least one column to Pet · Name (Pet 1, 2, or 3), or switch the mode back to Clients only.";
  }
  return null;
}
