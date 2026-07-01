"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { ClientImport } from "@/lib/import/parseImport";
import { UploadStep } from "@/components/settings/import/UploadStep";
import { PreviewStep } from "@/components/settings/import/PreviewStep";
import { CommitStep } from "@/components/settings/import/CommitStep";

/**
 * Three-step importer. The file is assumed to already match the import
 * schema (see `lib/import/parseImport.ts`), so there is no column-mapping
 * step:
 *   1. Upload   — pick a JSON / CSV file → typed `ClientImport[]`.
 *   2. Preview  — show the first handful of clients (pets + legacy history).
 *   3. Save     — batched mutation calls with progress.
 * All state lives here; each step component is a controlled view.
 */
type Step = "upload" | "preview" | "commit";

const STEP_ORDER: ReadonlyArray<{ key: Step; label: string }> = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "commit", label: "Save" },
];

export function ImportFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [sourceSystem, setSourceSystem] = useState("");
  const [clients, setClients] = useState<ClientImport[] | null>(null);
  // The exact subset handed to the commit step — the whole file, or just the
  // first N when the user picks the "test import" option on the preview.
  const [commitClients, setCommitClients] = useState<ClientImport[] | null>(
    null,
  );

  const stepIndex = useMemo(
    () => STEP_ORDER.findIndex((entry) => entry.key === step),
    [step],
  );

  function handleParsed(next: ClientImport[]) {
    setClients(next);
    setStep("preview");
  }

  function handleContinue(limit?: number) {
    if (!clients) return;
    setCommitClients(limit ? clients.slice(0, limit) : clients);
    setStep("commit");
  }

  function handleStartOver() {
    setStep("upload");
    setClients(null);
    setCommitClients(null);
    setSourceSystem("");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Import data
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Upload a JSON or CSV file that already matches the import schema. We
          show a preview of the first few clients — with their pets and legacy
          appointments — then save everything to your database.
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
        {step === "preview" && clients && (
          <PreviewStep
            clients={clients}
            onBack={() => setStep("upload")}
            onContinue={handleContinue}
          />
        )}
        {step === "commit" && commitClients && (
          <CommitStep
            clients={commitClients}
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
