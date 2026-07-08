"use client";

import { useQuery } from "convex/react";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  NameSelect,
  TextField,
  inputClass,
  labelClass,
} from "./LegacyFieldInputs";

/**
 * Edit form body for one imported legacy appointment, rendered inside a
 * `DialogShell`. Owned by `LegacyAppointmentRow`, which holds the draft +
 * mutation state. Pet and Service are dropdowns fed by the client's pets and
 * the shop's services; the remaining fields are free text. The `Draft` shape
 * and `toDraft` seed live here so the whole editable surface is in one file.
 */
export type EditableKey =
  | "dateLabel"
  | "timeLabel"
  | "serviceName"
  | "petName"
  | "staffName"
  | "priceLabel"
  | "notes";

export type Draft = Record<EditableKey, string>;

export function toDraft(row: Doc<"legacyAppointments">): Draft {
  return {
    dateLabel: row.dateLabel ?? "",
    timeLabel: row.timeLabel ?? "",
    serviceName: row.serviceName ?? "",
    petName: row.petName ?? "",
    staffName: row.staffName ?? "",
    priceLabel: row.priceLabel ?? "",
    notes: row.notes ?? "",
  };
}

export function LegacyAppointmentEditForm({
  clientId,
  draft,
  onChange,
  busy,
  errorMessage,
  onSave,
  onCancel,
  onDelete,
}: {
  clientId: Id<"clients">;
  draft: Draft;
  onChange: (key: EditableKey, value: string) => void;
  busy: boolean;
  errorMessage: string | null;
  onSave: () => void;
  onCancel: () => void;
  /** Omitted for staff who may edit but not delete imported rows. */
  onDelete?: () => void;
}) {
  const pets = useQuery(api.pets.listForClient, { clientId });
  const services = useQuery(api.services.list, {});
  const petNames = pets?.map((pet) => pet.name) ?? [];
  const serviceNames = services?.map((service) => service.name) ?? [];

  return (
    <div className="px-5 py-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Date"
          value={draft.dateLabel}
          onChange={(value) => onChange("dateLabel", value)}
        />
        <TextField
          label="Time"
          value={draft.timeLabel}
          onChange={(value) => onChange("timeLabel", value)}
        />
        <NameSelect
          label="Service"
          value={draft.serviceName}
          options={serviceNames}
          onChange={(value) => onChange("serviceName", value)}
        />
        <NameSelect
          label="Pet"
          value={draft.petName}
          options={petNames}
          onChange={(value) => onChange("petName", value)}
        />
        <TextField
          label="Staff"
          value={draft.staffName}
          onChange={(value) => onChange("staffName", value)}
        />
        <TextField
          label="Price"
          value={draft.priceLabel}
          onChange={(value) => onChange("priceLabel", value)}
        />
      </div>
      <label className="mt-2 flex flex-col gap-1">
        <span className={labelClass}>Notes</span>
        <textarea
          value={draft.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          rows={3}
          className={inputClass}
        />
      </label>

      {errorMessage && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <Trash2 size={12} />
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00273c] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#013a58] disabled:opacity-60"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
