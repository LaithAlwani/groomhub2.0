"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildPreview,
  type ColumnMapping,
  type ImportMode,
  type PreviewIssue,
  type PreviewRow,
} from "@/lib/import/applyMapping";

/**
 * Step 3 — apply the mapping to all rows, look up existing clients for
 * history mode, flag duplicates, and let the user pick Skip vs Insert as
 * new on a per-row basis. The committed result is handed back to the
 * parent (which advances to the Commit step).
 *
 * Duplicate detection is one round-trip: collect every email + phone in
 * the file, ask the server which already exist, then build a `Set` for
 * O(1) row-by-row checks during `buildPreview`.
 */
export function PreviewStep({
  mode,
  rows,
  mapping,
  initialPreview,
  onBack,
  onContinue,
}: {
  mode: ImportMode;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  initialPreview: PreviewRow[] | null;
  onBack: () => void;
  onContinue: (rows: PreviewRow[]) => void;
}) {
  const { emails, phones } = useMemo(
    () => collectEmailsAndPhones(rows, mapping, mode),
    [rows, mapping, mode],
  );
  const duplicates = useQuery(api.imports.checkDuplicates, { emails, phones });
  const clientLookupSeed = useMemo(
    () =>
      mode === "appointmentHistory"
        ? { emails, phones }
        : { emails: [], phones: [] },
    [mode, emails, phones],
  );
  const clientMatches = useQuery(
    api.imports.matchClients,
    clientLookupSeed.emails.length === 0 && clientLookupSeed.phones.length === 0
      ? "skip"
      : clientLookupSeed,
  );

  const [preview, setPreview] = useState<PreviewRow[] | null>(initialPreview);

  useEffect(() => {
    if (duplicates === undefined) return;
    if (mode === "appointmentHistory" && clientMatches === undefined) return;
    const knownEmails = new Set(duplicates.emails);
    const knownPhones = new Set(duplicates.phones);
    const lookup = new Map<string, { id: Id<"clients">; fullName: string }>();
    if (clientMatches) {
      for (const entry of clientMatches) {
        if (entry.email) lookup.set(entry.email, { id: entry.id, fullName: entry.fullName });
        if (entry.phone) lookup.set(entry.phone, { id: entry.id, fullName: entry.fullName });
      }
    }
    setPreview(
      buildPreview({
        mode,
        rows,
        mapping,
        knownEmails,
        knownPhones,
        clientLookup: lookup,
      }),
    );
  }, [duplicates, clientMatches, mode, rows, mapping]);

  if (!preview) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Building preview…
      </div>
    );
  }

  const summary = summarize(preview);

  function setResolution(rowId: string, value: PreviewRow["resolution"]) {
    setPreview((current) =>
      current
        ? current.map((row) =>
            row.rowId === rowId ? { ...row, resolution: value } : row,
          )
        : current,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SummaryBar summary={summary} />

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[40px_1.4fr_1.6fr_1.2fr_1fr] items-center gap-2 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>#</span>
          <span>Client</span>
          <span>Details</span>
          <span>Issues</span>
          <span className="text-right">Action</span>
        </div>
        <ul className="max-h-[480px] overflow-y-auto">
          {preview.map((row, index) => (
            <PreviewRowItem
              key={row.rowId}
              row={row}
              index={index}
              mode={mode}
              onResolutionChange={setResolution}
            />
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} />
          Back to mapping
        </button>
        <button
          type="button"
          onClick={() => onContinue(preview)}
          disabled={summary.insertable === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00273c] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#013a58] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
        >
          Import {summary.insertable} row{summary.insertable === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

function SummaryBar({ summary }: { summary: PreviewSummary }) {
  return (
    <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <Tile label="Total rows" value={summary.total} tone="neutral" />
      <Tile label="Ready" value={summary.insertable} tone="ok" />
      <Tile label="Conflicts" value={summary.conflicts} tone="warn" />
      <Tile label="Errors" value={summary.errors} tone="bad" />
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "ok" | "warn" | "bad";
}) {
  const palette = {
    neutral: "text-zinc-900 dark:text-zinc-100",
    ok: "text-emerald-700 dark:text-emerald-300",
    warn: "text-amber-700 dark:text-amber-300",
    bad: "text-red-700 dark:text-red-300",
  }[tone];
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className={`text-lg font-semibold ${palette}`}>{value}</span>
    </div>
  );
}

function PreviewRowItem({
  row,
  index,
  mode,
  onResolutionChange,
}: {
  row: PreviewRow;
  index: number;
  mode: ImportMode;
  onResolutionChange: (rowId: string, value: PreviewRow["resolution"]) => void;
}) {
  const isDup =
    row.issues.includes("duplicate-email") ||
    row.issues.includes("duplicate-phone");
  const isError = hasBlockingError(row.issues);

  return (
    <li className="grid grid-cols-[40px_1.4fr_1.6fr_1.2fr_1fr] items-center gap-2 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900">
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {index + 1}
      </span>
      <ClientCell row={row} mode={mode} />
      <DetailsCell row={row} mode={mode} />
      <IssuesCell issues={row.issues} />
      <div className="flex justify-end">
        {isError ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Skipped
          </span>
        ) : isDup ? (
          <select
            value={row.resolution}
            onChange={(event) =>
              onResolutionChange(
                row.rowId,
                event.target.value as PreviewRow["resolution"],
              )
            }
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <option value="skip">Skip</option>
            <option value="insertNew">Insert as new</option>
          </select>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Ready
          </span>
        )}
      </div>
    </li>
  );
}

function ClientCell({ row, mode }: { row: PreviewRow; mode: ImportMode }) {
  if (mode === "appointmentHistory") {
    if (row.matchedClient) {
      return (
        <div>
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {row.matchedClient.fullName}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Matched existing
          </p>
        </div>
      );
    }
    return (
      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
        No match
      </p>
    );
  }
  const name = row.built.client?.kind === "insert"
    ? row.built.client.data.fullName
    : null;
  return (
    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
      {name || <span className="italic text-zinc-400">No name</span>}
    </p>
  );
}

function DetailsCell({ row, mode }: { row: PreviewRow; mode: ImportMode }) {
  if (mode === "appointmentHistory") {
    const legacy = row.built.legacy?.[0];
    if (!legacy) return <span className="text-xs text-zinc-400">—</span>;
    const parts = [
      legacy.dateLabel,
      legacy.serviceName,
      legacy.petName,
      legacy.priceLabel,
    ].filter(Boolean);
    return (
      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
        {parts.length > 0 ? parts.join(" · ") : "—"}
      </p>
    );
  }
  const client = row.built.client?.kind === "insert"
    ? row.built.client.data
    : null;
  const pets = row.built.pets ?? [];
  const legacy = row.built.legacy?.[0];
  return (
    <div className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
      {client && (
        <p className="truncate">
          {[client.email, client.phone].filter(Boolean).join(" · ") || "—"}
        </p>
      )}
      {pets.map((pet, index) => (
        <p
          key={index}
          className="mt-0.5 truncate text-zinc-600 dark:text-zinc-300"
        >
          {pet.name} · {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""}
        </p>
      ))}
      {legacy && (
        <p className="mt-0.5 truncate text-orange-600 dark:text-orange-300">
          {[legacy.dateLabel, legacy.serviceName, legacy.priceLabel]
            .filter(Boolean)
            .join(" · ") || "Past appointment"}
        </p>
      )}
    </div>
  );
}

function IssuesCell({ issues }: { issues: PreviewIssue[] }) {
  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={12} /> Looks good
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {issues.map((issue) => (
        <span
          key={issue}
          className={`inline-flex items-center gap-1 text-xs ${issueTone(issue)}`}
        >
          {hasBlockingError([issue]) ? (
            <XCircle size={12} />
          ) : (
            <AlertTriangle size={12} />
          )}
          {ISSUE_LABEL[issue]}
        </span>
      ))}
    </div>
  );
}

function issueTone(issue: PreviewIssue): string {
  if (hasBlockingError([issue])) return "text-red-700 dark:text-red-300";
  return "text-amber-700 dark:text-amber-300";
}

const ISSUE_LABEL: Record<PreviewIssue, string> = {
  "missing-client-name": "Missing client name",
  "missing-history-lookup": "No email or phone to match",
  "missing-history-date": "Missing date",
  "unknown-client": "No matching client",
  "duplicate-email": "Email already on file",
  "duplicate-phone": "Phone already on file",
};

function hasBlockingError(issues: PreviewIssue[]): boolean {
  return issues.some((issue) =>
    issue === "missing-client-name" ||
    issue === "missing-history-lookup" ||
    issue === "missing-history-date" ||
    issue === "unknown-client",
  );
}

type PreviewSummary = {
  total: number;
  insertable: number;
  conflicts: number;
  errors: number;
};

function summarize(rows: PreviewRow[]): PreviewSummary {
  let insertable = 0;
  let conflicts = 0;
  let errors = 0;
  for (const row of rows) {
    if (hasBlockingError(row.issues)) {
      errors += 1;
      continue;
    }
    const isDup =
      row.issues.includes("duplicate-email") ||
      row.issues.includes("duplicate-phone");
    if (isDup) {
      conflicts += 1;
      if (row.resolution === "insertNew") insertable += 1;
    } else {
      insertable += 1;
    }
  }
  return { total: rows.length, insertable, conflicts, errors };
}

function collectEmailsAndPhones(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  mode: ImportMode,
): { emails: string[]; phones: string[] } {
  const emailColumns: string[] = [];
  const phoneColumns: string[] = [];
  for (const [header, target] of Object.entries(mapping)) {
    if (target === "client.email" || target === "history.clientEmail") {
      emailColumns.push(header);
    }
    if (target === "client.phone" || target === "history.clientPhone") {
      phoneColumns.push(header);
    }
  }
  // For clients/clientsAndPets, the dup-check uses the client.* mapped
  // columns; for history mode it uses history.client* — collectors above
  // capture both. Mode is left as a hook for future asymmetric behaviour.
  void mode;
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const row of rows) {
    for (const column of emailColumns) {
      const value = (row[column] ?? "").trim().toLowerCase();
      if (value) emails.add(value);
    }
    for (const column of phoneColumns) {
      const digits = (row[column] ?? "").replace(/\D/g, "");
      if (digits) phones.add(digits);
    }
  }
  return { emails: Array.from(emails), phones: Array.from(phones) };
}
