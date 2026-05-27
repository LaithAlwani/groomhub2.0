"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  type ColumnMapping,
  type ImportMode,
  type PreviewRow,
  detectImportMode,
  suggestMapping,
} from "@/lib/import/applyMapping";
import { UploadStep } from "@/components/settings/import/UploadStep";
import { MappingStep } from "@/components/settings/import/MappingStep";
import { PreviewStep } from "@/components/settings/import/PreviewStep";
import { CommitStep } from "@/components/settings/import/CommitStep";

/**
 * Four-step wizard for the legacy data importer.
 *   1. Upload      — file pick + parse → headers + rows.
 *   2. Mapping     — radio for mode + dropdown per source column.
 *   3. Preview     — apply mapping, flag duplicates, let user resolve.
 *   4. Commit      — batched mutation calls with progress.
 * All state lives here; each step component is a controlled view.
 */
type Step = "upload" | "mapping" | "preview" | "commit";

type Parsed = { headers: string[]; rows: Record<string, string>[] };

const STEP_ORDER: ReadonlyArray<{ key: Step; label: string }> = [
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Map columns" },
  { key: "preview", label: "Preview" },
  { key: "commit", label: "Import" },
];

export function ImportFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [sourceSystem, setSourceSystem] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mode, setMode] = useState<ImportMode>("clientsAndPets");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  // Preview is owned here so resolutions survive Back → Preview round-trips.
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  const stepIndex = useMemo(
    () => STEP_ORDER.findIndex((entry) => entry.key === step),
    [step],
  );

  function handleParsed(next: Parsed) {
    setParsed(next);
    // Auto-detect the right mode from the file's headers so the radio
    // opens on the correct option without the user clicking through.
    const detected = detectImportMode(next.headers);
    setMode(detected);
    setMapping(suggestMapping(next.headers, detected));
    setPreview(null);
    setStep("mapping");
  }

  function handleModeChange(next: ImportMode, mappingOverride?: ColumnMapping) {
    setMode(next);
    // `mappingOverride` lets callers (e.g. the AI suggest button) hand us
    // a mode + mapping atomically. Without it we reset to the heuristic
    // map for the new mode, since the previous mapping's targets may not
    // be valid for the mode the user just picked.
    if (parsed) {
      setMapping(mappingOverride ?? suggestMapping(parsed.headers, next));
    }
    setPreview(null);
  }

  function handleMappingContinue() {
    setPreview(null);
    setStep("preview");
  }

  function handlePreviewBack() {
    setStep("mapping");
  }

  function handlePreviewContinue(rows: PreviewRow[]) {
    setPreview(rows);
    setStep("commit");
  }

  function handleStartOver() {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setPreview(null);
    setSourceSystem("");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Import data
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Bring over your clients, pets, and past appointment history from a
          previous system. Upload a CSV, Excel, JSON, or XML export — map the
          columns to GroomHub fields — review — import.
        </p>
      </header>

      <StepRail currentIndex={stepIndex} />

      <div>
        {step === "upload" && (
          <UploadStep
            sourceSystem={sourceSystem}
            onSourceSystemChange={setSourceSystem}
            onParsed={handleParsed}
          />
        )}
        {step === "mapping" && parsed && (
          <MappingStep
            headers={parsed.headers}
            rows={parsed.rows}
            mode={mode}
            mapping={mapping}
            onModeChange={handleModeChange}
            onMappingChange={setMapping}
            onContinue={handleMappingContinue}
            onBack={() => setStep("upload")}
          />
        )}
        {step === "preview" && parsed && (
          <PreviewStep
            mode={mode}
            rows={parsed.rows}
            mapping={mapping}
            initialPreview={preview}
            onBack={handlePreviewBack}
            onContinue={handlePreviewContinue}
          />
        )}
        {step === "commit" && preview && (
          <CommitStep
            preview={preview}
            sourceSystem={sourceSystem}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </div>
  );
}

function StepRail({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-sm">
      {STEP_ORDER.map((entry, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={entry.key} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                active
                  ? "bg-[#00273c] text-white"
                  : done
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active
                    ? "bg-white/15 text-white"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {done ? <Check size={10} /> : index + 1}
              </span>
              {entry.label}
            </span>
            {index < STEP_ORDER.length - 1 && (
              <ChevronRight
                size={14}
                className="text-zinc-300 dark:text-zinc-700"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
