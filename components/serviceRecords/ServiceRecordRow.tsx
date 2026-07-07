"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Pencil, Scissors } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import {
  formatDateTime,
  formatMoney,
} from "@/components/calendar/appointmentDetailParts";
import {
  ServiceRecordEditForm,
  recordToDraft,
  type RecordDraft,
} from "./ServiceRecordEditForm";
import type { ServiceRecordItem } from "./types";

/**
 * One service-record row: read view mirrors the appointment-history look
 * (icon + heading + details). Author/admins get a pencil that swaps in the
 * inline edit form, and a delete behind a confirm dialog. The confirm dialog
 * is rendered regardless of edit/read state so Delete works from either.
 */
export function ServiceRecordRow({
  record,
  showPet,
}: {
  record: ServiceRecordItem;
  showPet?: boolean;
}) {
  const update = useMutation(api.serviceRecords.update);
  const remove = useMutation(api.serviceRecords.remove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RecordDraft>(() => recordToDraft(record));
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  async function handleSave() {
    const priceTrimmed = draft.price.trim();
    let priceCents = 0;
    if (priceTrimmed !== "") {
      const parsed = Number(priceTrimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setErrorMessage("Enter a valid price.");
        return;
      }
      priceCents = Math.round(parsed * 100);
    }
    const weightNum = Number(draft.weight.trim());
    setBusy(true);
    setErrorMessage(null);
    try {
      await update({
        id: record._id,
        serviceId: draft.serviceId ?? undefined,
        priceCents,
        notes: draft.notes || undefined,
        weightLb:
          draft.weight.trim() !== "" && Number.isFinite(weightNum)
            ? weightNum
            : undefined,
        productsUsed: draft.products
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
      setEditing(false);
    } catch (caught) {
      setErrorMessage(formatError(caught, "Could not save changes."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await remove({ id: record._id });
      // Row disappears from the list on success; no local reset needed.
    } catch (caught) {
      setErrorMessage(formatError(caught, "Could not delete."));
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  const heading = [
    formatDateTime(record.date),
    showPet ? record.petName : null,
    record.serviceName,
    record.priceCentsSnapshot
      ? formatMoney(record.priceCentsSnapshot, record.currency)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const photos = [...record.beforeImages, ...record.afterImages].filter(
    (image) => image.url,
  );

  return (
    <>
      {editing ? (
        <ServiceRecordEditForm
          record={record}
          draft={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          busy={busy}
          errorMessage={errorMessage}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          onDelete={() => setConfirmDelete(true)}
        />
      ) : (
        <li className="group flex items-start gap-2 border-b border-zinc-100 px-4 py-3 text-xs last:border-b-0 dark:border-zinc-900">
          <Scissors
            size={12}
            className="mt-0.5 shrink-0 text-orange-500"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {heading || "Service"}
            </p>
            <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
              {record.staffName}
              {record.weightLb ? ` · ${record.weightLb} lb` : ""}
              {record.appointmentId ? " · from appointment" : ""}
            </p>
            {record.notes && (
              <p className="mt-1 whitespace-pre-line text-zinc-600 dark:text-zinc-300">
                {record.notes}
              </p>
            )}
            {record.productsUsed && record.productsUsed.length > 0 && (
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                Products: {record.productsUsed.join(", ")}
              </p>
            )}
            {photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {photos.map((image) => (
                  <button
                    key={image.storageId}
                    type="button"
                    onClick={() => setViewerUrl(image.url)}
                    className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
                  >
                    <img
                      src={image.url!}
                      alt="Service photo"
                      loading="lazy"
                      className="h-12 w-12 cursor-zoom-in object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          {record.canManage && (
            <button
              type="button"
              onClick={() => {
                setDraft(recordToDraft(record));
                setErrorMessage(null);
                setEditing(true);
              }}
              className="shrink-0 rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              aria-label="Edit record"
            >
              <Pencil size={12} />
            </button>
          )}
          {viewerUrl && (
            <ImageLightbox
              url={viewerUrl}
              alt="Service photo"
              onClose={() => setViewerUrl(null)}
            />
          )}
        </li>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this record?"
        description="This permanently removes the service record and its photos."
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
