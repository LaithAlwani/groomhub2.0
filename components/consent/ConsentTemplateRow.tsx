"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * Single row in the consent-form templates table. Whole row is clickable
 * for everyone — the parent decides whether the dialog opens in edit or
 * read-only mode via its own `readOnly` prop. The pencil icon renders
 * for admin + superAdmin (`canEdit`); the trash icon renders only for
 * superAdmin (`canDelete`). Body preview is truncated to the first ~120
 * chars so the table stays compact.
 */
export function ConsentTemplateRow({
  template,
  canEdit,
  canDelete,
  busy,
  onEdit,
  onArchive,
}: {
  template: Doc<"consentTemplates">;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  // PDF-import templates have no text body — show a label instead of a preview.
  const cleanedBody = (template.body ?? "").replace(/\s+/g, " ").trim();
  const preview = template.fileStorageId
    ? "Imported PDF"
    : cleanedBody.slice(0, 120);
  const truncated = !template.fileStorageId && cleanedBody.length > 120;

  return (
    <li
      onClick={() => {
        if (!busy) onEdit();
      }}
      className="grid cursor-pointer grid-cols-[1fr_2fr_auto] items-center gap-3 border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
    >
      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {template.name}
      </p>
      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
        {preview}
        {truncated && "…"}
      </p>
      <div className="flex shrink-0 items-center justify-end gap-1">
        {canEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            disabled={busy}
            aria-label="Edit template"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <Pencil size={14} />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onArchive();
            }}
            disabled={busy}
            aria-label="Archive template"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </li>
  );
}
