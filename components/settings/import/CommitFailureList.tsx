"use client";

import { XCircle } from "lucide-react";

/**
 * Per-row failure log shown under the progress bar when `commitBatch`
 * reports rows it couldn't save. Row numbers are 1-based for the user.
 */
export function CommitFailureList({
  failures,
}: {
  failures: Array<{ rowId: string; reason: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/40 dark:bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        <XCircle size={14} />
        {failures.length} row{failures.length === 1 ? "" : "s"} could not be
        saved
      </div>
      <ul className="max-h-64 divide-y divide-red-100 overflow-y-auto dark:divide-red-900/30">
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
