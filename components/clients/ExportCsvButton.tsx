"use client";

import { Download } from "lucide-react";

/** "Export CSV" button used under both the browse/search table and the recents list. */
export function ExportCsvButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60"
    >
      <Download size={14} />
      Export CSV
    </button>
  );
}
