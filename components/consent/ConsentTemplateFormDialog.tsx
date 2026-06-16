"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
  ConsentTemplateSourceFields,
  type TemplateSourceMode,
} from "./ConsentTemplateSourceFields";

/**
 * Create / edit dialog for a consent-form template. A template is authored as
 * typed text OR an uploaded PDF (toggled in `ConsentTemplateSourceFields`).
 */
export function ConsentTemplateFormDialog({
  templateId,
  readOnly = false,
  onClose,
}: {
  templateId: Id<"consentTemplates"> | "new" | null;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const isEdit = templateId !== null && templateId !== "new";
  const templates = useQuery(api.consentForms.listTemplates, {});
  const existing = isEdit
    ? templates?.find((row) => row._id === templateId)
    : undefined;

  const create = useMutation(api.consentForms.createTemplate);
  const update = useMutation(api.consentForms.updateTemplate);
  const deleteOrphan = useMutation(api.consentForms.deleteOrphanStorage);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<TemplateSourceMode>("text");
  const [body, setBody] = useState("");
  const [fileStorageId, setFileStorageId] = useState<Id<"_storage"> | null>(
    null,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  // A PDF uploaded this session but not yet committed — cleaned up on cancel.
  const [freshUploadId, setFreshUploadId] = useState<Id<"_storage"> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    if (existing.fileStorageId) {
      setMode("pdf");
      setFileStorageId(existing.fileStorageId);
      setFileName("Current PDF");
    } else {
      setMode("text");
      setBody(existing.body ?? "");
    }
  }, [existing]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) handleCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, submitting, freshUploadId, existing]);

  async function cleanupFreshUpload() {
    if (freshUploadId && freshUploadId !== existing?.fileStorageId) {
      await deleteOrphan({ storageId: freshUploadId }).catch(() => {});
    }
  }

  async function handleCancel() {
    await cleanupFreshUpload();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    if (name.trim().length === 0) {
      setError("Name is required.");
      return;
    }
    if (mode === "text" && body.trim().length === 0) {
      setError("Add the consent text, or switch to Upload PDF.");
      return;
    }
    if (mode === "pdf" && !fileStorageId) {
      setError("Upload a PDF, or switch to Type text.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload =
        mode === "pdf"
          ? { name: name.trim(), fileStorageId: fileStorageId! }
          : { name: name.trim(), body: body.trim() };
      if (isEdit && templateId !== "new" && templateId !== null) {
        await update({ id: templateId, ...payload });
      } else {
        await create(payload);
      }
      onClose();
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not save",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleModeChange(next: TemplateSourceMode) {
    setMode(next);
    setError(null);
  }

  return (
    <DialogShell
      open
      onClose={handleCancel}
      busy={submitting}
      title={readOnly ? "View template" : isEdit ? "Edit template" : "New template"}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Grooming Consent"
          readOnly={readOnly}
        />
        <ConsentTemplateSourceFields
          mode={mode}
          onModeChange={handleModeChange}
          body={body}
          onBodyChange={setBody}
          fileName={fileName}
          fileUrl={existing?.fileUrl ?? null}
          onUploaded={(storageId, uploadedName) => {
            setFileStorageId(storageId);
            setFileName(uploadedName);
            setFreshUploadId(storageId);
          }}
          readOnly={readOnly}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create template"}
            </button>
          )}
        </div>
      </form>
    </DialogShell>
  );
}
