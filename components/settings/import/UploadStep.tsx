"use client";
import { formatError } from "@/lib/formatError";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { parseImport, type ClientImport } from "@/lib/import/parseImport";

/**
 * Step 1 — file drop / pick. Parses a JSON or CSV file that already matches
 * the import schema and hands the typed `ClientImport[]` back to the parent.
 * papaparse (CSV) is dynamic-imported inside `parseImport` so it only loads
 * when a CSV is actually chosen.
 */
export function UploadStep({
  sourceSystem,
  onSourceSystemChange,
  onParsed,
}: {
  sourceSystem: string;
  onSourceSystemChange: (next: string) => void;
  onParsed: (clients: ClientImport[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setErrorMessage(null);
      setBusy(true);
      try {
        const clients = await parseImport(file);
        onParsed(clients);
      } catch (caught) {
        setErrorMessage(formatError(caught, "Could not parse file."));
      } finally {
        setBusy(false);
      }
    },
    [onParsed],
  );

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-md flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Source system
        </span>
        <input
          type="text"
          value={sourceSystem}
          onChange={(event) => onSourceSystemChange(event.target.value)}
          placeholder="Pawfinity export, Gingr CSV, etc."
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#00273c] focus:outline-none focus:ring-2 focus:ring-[#00273c]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          A short note shown on imported appointment history rows.
        </span>
      </label>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void handleFile(event.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragOver
            ? "border-[#00273c] bg-orange-50/40 dark:border-orange-300 dark:bg-orange-950/20"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
        }`}
      >
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00273c] text-white"
        >
          <Upload size={20} />
        </span>
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Drop a file here, or click to choose
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            JSON or CSV matching the import schema — up to 50 MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".json,.csv,application/json,text/csv"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00273c] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#013a58] disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {busy ? "Parsing…" : "Choose file"}
        </button>
      </div>

      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        <p className="font-semibold text-zinc-700 dark:text-zinc-200">
          Expected shape
        </p>
        <p className="mt-1">
          A top-level array of clients. Each client may carry a{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">pets</code>{" "}
          array and a{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            legacyAppointments
          </code>{" "}
          array. Fields use the same names as the client, pet, and legacy
          appointment records.
        </p>
      </div>
    </div>
  );
}
