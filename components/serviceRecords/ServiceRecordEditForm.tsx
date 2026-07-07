"use client";

import { Loader2, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { ServiceSelectField } from "@/components/calendar/ServiceSelectField";
import { ServiceRecordImages } from "./ServiceRecordImages";
import type { ServiceRecordItem } from "./types";

export type RecordDraft = {
  serviceId: Id<"services"> | null;
  price: string;
  notes: string;
  weight: string;
  products: string;
};

export function recordToDraft(record: ServiceRecordItem): RecordDraft {
  return {
    serviceId: record.serviceId ?? null,
    price: record.priceCentsSnapshot
      ? (record.priceCentsSnapshot / 100).toFixed(2)
      : "",
    notes: record.notes ?? "",
    weight: record.weightLb ? String(record.weightLb) : "",
    products: (record.productsUsed ?? []).join(", "),
  };
}

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-[#00273c] focus:outline-none focus:ring-2 focus:ring-[#00273c]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const labelClass =
  "text-[10px] font-semibold uppercase tracking-wide text-zinc-400";

/**
 * Inline editor for one service record. Presentational — the parent row owns
 * the draft + mutation state. Photos are edited in place via
 * `ServiceRecordImages`.
 */
export function ServiceRecordEditForm({
  record,
  draft,
  onChange,
  busy,
  errorMessage,
  onSave,
  onCancel,
  onDelete,
}: {
  record: ServiceRecordItem;
  draft: RecordDraft;
  onChange: (patch: Partial<RecordDraft>) => void;
  busy: boolean;
  errorMessage: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900">
      <div className="grid gap-2 sm:grid-cols-2">
        <ServiceSelectField
          value={draft.serviceId}
          onChange={(serviceId) => onChange({ serviceId })}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Price ({record.currency})
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={draft.price}
            onChange={(event) => onChange({ price: event.target.value })}
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Weight (lb)</span>
          <input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={draft.weight}
            onChange={(event) => onChange({ weight: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Products used (comma-separated)</span>
          <input
            type="text"
            value={draft.products}
            onChange={(event) => onChange({ products: event.target.value })}
            placeholder="Oatmeal shampoo, cologne"
            className={inputClass}
          />
        </label>
      </div>
      <label className="mt-2 flex flex-col gap-1">
        <span className={labelClass}>Notes</span>
        <textarea
          value={draft.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          rows={3}
          className={inputClass}
        />
      </label>

      <div className="mt-3">
        <span className={labelClass}>Photos</span>
        <div className="mt-1">
          <ServiceRecordImages
            recordId={record._id}
            before={record.beforeImages}
            after={record.afterImages}
          />
        </div>
      </div>

      {errorMessage && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <Trash2 size={12} />
          Delete
        </button>
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
    </li>
  );
}
