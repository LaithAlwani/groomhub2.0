"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useMutation } from "convex/react";
import { History, Pencil } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  LegacyAppointmentEditForm,
  toDraft,
  type Draft,
  type EditableKey,
} from "./LegacyAppointmentEditForm";

/**
 * One row of the client's "Imported history" list. Read view mirrors the
 * import preview (orange clock + heading + notes). Admins get a pencil that
 * swaps the row for an inline edit form backed by `updateLegacyAppointment`
 * / `deleteLegacyAppointment`.
 */
export function LegacyAppointmentRow({
  row,
  canEdit,
}: {
  row: Doc<"legacyAppointments">;
  canEdit: boolean;
}) {
  const update = useMutation(api.imports.updateLegacyAppointment);
  const remove = useMutation(api.imports.deleteLegacyAppointment);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(row));
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function startEditing() {
    setDraft(toDraft(row));
    setErrorMessage(null);
    setEditing(true);
  }

  async function handleSave() {
    setBusy(true);
    setErrorMessage(null);
    try {
      await update({ id: row._id, ...draft });
      setEditing(false);
    } catch (caught) {
      setErrorMessage(formatError(caught, "Could not save changes."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setErrorMessage(null);
    try {
      await remove({ id: row._id });
    } catch (caught) {
      setErrorMessage(formatError(caught, "Could not delete."));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <LegacyAppointmentEditForm
        clientId={row.clientId}
        draft={draft}
        onChange={(key: EditableKey, value: string) =>
          setDraft({ ...draft, [key]: value })
        }
        busy={busy}
        errorMessage={errorMessage}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        onDelete={handleDelete}
      />
    );
  }

  const heading =
    [
      row.dateLabel,
      row.timeLabel,
      row.serviceName,
      row.petName,
      row.staffName,
      row.priceLabel,
    ]
      .filter(Boolean)
      .join(" · ") || "Past appointment";

  return (
    <li className="group flex items-start gap-2 border-b border-zinc-100 px-4 py-3 text-xs last:border-b-0 dark:border-zinc-900">
      <History size={12} className="mt-0.5 shrink-0 text-orange-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-orange-600 dark:text-orange-300">{heading}</p>
        {row.notes && (
          <p className="mt-0.5 whitespace-pre-line text-zinc-500 dark:text-zinc-400">
            {row.notes}
          </p>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={startEditing}
          className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          aria-label="Edit appointment"
        >
          <Pencil size={12} />
        </button>
      )}
    </li>
  );
}
