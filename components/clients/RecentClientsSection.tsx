"use client";

import { History, X } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { ClientCards } from "./ClientCards";
import { ClientsTable, type ClientRow } from "./ClientsTable";
import { ExportCsvButton } from "./ExportCsvButton";

/**
 * "Recently opened" view of the clients board: the client files this browser
 * opened most recently, newest first, in the same table / cards as the full
 * list. No pagination (the list is capped at 20). Replaces the browse list
 * until the user searches or clears it.
 */
export function RecentClientsSection({
  rows,
  onBook,
  onClear,
  onExport,
}: {
  rows: ReadonlyArray<ClientRow>;
  onBook: (clientId: Doc<"clients">["_id"]) => void;
  onClear: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <History size={14} className="text-orange-500" aria-hidden />
          Recently opened
          <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            {rows.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <X size={12} aria-hidden />
          Clear
        </button>
      </div>

      <ClientsTable rows={rows} onBook={onBook} />
      <ClientCards rows={rows} onBook={onBook} />

      <div className="flex flex-col gap-3 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
        <p>
          Showing the client files you opened most recently. Search above to
          find anyone else.
        </p>
        <ExportCsvButton onClick={onExport} disabled={rows.length === 0} />
      </div>
    </div>
  );
}
