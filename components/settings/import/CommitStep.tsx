"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { PreviewRow } from "@/lib/import/applyMapping";

/**
 * Step 4 — drives `commitBatch` in 50-row chunks with a progress bar and
 * a per-row failure log. Each batch reports its own created counts so the
 * final summary is the sum across batches.
 */

const BATCH_SIZE = 50;

type Tally = {
  clients: number;
  pets: number;
  legacy: number;
  failures: Array<{ rowId: string; reason: string }>;
};

type Phase =
  | { state: "idle" }
  | { state: "running"; sent: number }
  | { state: "done" }
  | { state: "error"; message: string };

export function CommitStep({
  preview,
  sourceSystem,
  onStartOver,
}: {
  preview: PreviewRow[];
  sourceSystem: string;
  onStartOver: () => void;
}) {
  const commit = useMutation(api.imports.commitBatch);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [tally, setTally] = useState<Tally>({
    clients: 0,
    pets: 0,
    legacy: 0,
    failures: [],
  });
  const startedRef = useRef(false);

  const eligibleRows = preview.filter((row) => isEligible(row));
  const total = eligibleRows.length;
  const batchId = useStableBatchId();

  useEffect(() => {
    if (startedRef.current) return;
    if (phase.state !== "idle") return;
    startedRef.current = true;
    void runCommit();
    // The mutation reference + values are captured in closure on first
    // call. Avoid retriggering on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCommit() {
    setPhase({ state: "running", sent: 0 });
    const aggregate: Tally = { clients: 0, pets: 0, legacy: 0, failures: [] };
    try {
      for (let offset = 0; offset < total; offset += BATCH_SIZE) {
        const slice = eligibleRows.slice(offset, offset + BATCH_SIZE);
        const rows = slice.map((row) => stripPreview(row));
        const result = await commit({
          batchId,
          sourceSystem: sourceSystem.trim() || undefined,
          rows,
        });
        aggregate.clients += result.created.clients;
        aggregate.pets += result.created.pets;
        aggregate.legacy += result.created.legacy;
        aggregate.failures.push(...result.failures);
        setTally({ ...aggregate });
        setPhase({ state: "running", sent: offset + slice.length });
      }
      setPhase({ state: "done" });
    } catch (caught) {
      setPhase({
        state: "error",
        message:
          caught instanceof Error ? caught.message : "Import failed mid-batch.",
      });
    }
  }

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nothing to import — every row was skipped or had a blocking error.
        </p>
        <button
          type="button"
          onClick={onStartOver}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <RefreshCw size={14} />
          Start over
        </button>
      </div>
    );
  }

  const sent = phase.state === "running" ? phase.sent : phase.state === "done" ? total : 0;
  const percent = Math.round((sent / total) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {phase.state === "done"
              ? "Import complete"
              : phase.state === "error"
                ? "Import stopped"
                : `Importing ${sent} of ${total}`}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {percent}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
          <div
            className={`h-full rounded-full transition-all ${
              phase.state === "error"
                ? "bg-red-500"
                : phase.state === "done"
                  ? "bg-emerald-500"
                  : "bg-[#00273c]"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Counter label="Clients" value={tally.clients} />
          <Counter label="Pets" value={tally.pets} />
          <Counter label="History rows" value={tally.legacy} />
        </div>
      </div>

      {phase.state === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {phase.message}
        </p>
      )}

      {tally.failures.length > 0 && (
        <FailureList failures={tally.failures} />
      )}

      {phase.state === "done" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 size={14} />
            Imported {tally.clients} clients, {tally.pets} pets, and{" "}
            {tally.legacy} archived appointment rows.
          </p>
          <button
            type="button"
            onClick={onStartOver}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950"
          >
            <RefreshCw size={14} />
            Import another file
          </button>
        </div>
      )}

      {phase.state === "running" && (
        <p className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Loader2 size={12} className="animate-spin" />
          Keep this tab open until the import finishes.
        </p>
      )}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function FailureList({
  failures,
}: {
  failures: Array<{ rowId: string; reason: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/40 dark:bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        <XCircle size={14} />
        {failures.length} row{failures.length === 1 ? "" : "s"} could not be saved
      </div>
      <ul className="max-h-64 overflow-y-auto divide-y divide-red-100 dark:divide-red-900/30">
        {failures.map((failure) => (
          <li
            key={failure.rowId}
            className="flex items-start justify-between gap-3 px-4 py-2 text-xs"
          >
            <span className="text-zinc-500 dark:text-zinc-400">
              Row {Number(failure.rowId) + 1}
            </span>
            <span className="flex-1 text-right text-red-700 dark:text-red-300">
              {failure.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function isEligible(row: PreviewRow): boolean {
  if (row.issues.includes("missing-client-name")) return false;
  if (row.issues.includes("missing-history-lookup")) return false;
  if (row.issues.includes("missing-history-date")) return false;
  if (row.issues.includes("unknown-client")) return false;
  const isDup =
    row.issues.includes("duplicate-email") ||
    row.issues.includes("duplicate-phone");
  if (isDup && row.resolution === "skip") return false;
  return true;
}

function stripPreview(row: PreviewRow) {
  return {
    rowId: row.rowId,
    client: row.built.client,
    pets: row.built.pets,
    legacy: row.built.legacy,
  };
}

function useStableBatchId(): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    ref.current = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return ref.current;
}
