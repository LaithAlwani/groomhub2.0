"use client";

import { FileText } from "lucide-react";

/** Presentational parts for `ConsentTemplateSourceFields`. */

export function PdfSummary({
  fileName,
  fileUrl,
}: {
  fileName: string | null;
  fileUrl: string | null;
}) {
  if (!fileName && !fileUrl) {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        No PDF uploaded yet.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <FileText size={14} className="text-zinc-400" aria-hidden />
      {fileName ?? "Uploaded PDF"}
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
        >
          View
        </a>
      )}
    </span>
  );
}

export function ReadOnlyBody({ body }: { body: string }) {
  return (
    <div className="max-h-105 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      {body}
    </div>
  );
}

export function SourceToggleTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-orange-500 text-white shadow-sm"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
