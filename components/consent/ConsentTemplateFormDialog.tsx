"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { X } from "lucide-react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  body: z
    .string()
    .trim()
    .min(1, "Body is required")
    .max(20_000, "Body is too long"),
});

type FieldErrors = Partial<Record<keyof typeof schema.shape, string>>;

/**
 * Create / edit dialog for a consent-form template. Fields: Name (single
 * line) + Body (long textarea — 12 rows). Body is where the legal text
 * lives, so the textarea is generous. Orange primary button matches the
 * recent dialog redesigns.
 */
export function ConsentTemplateFormDialog({
  templateId,
  readOnly = false,
  onClose,
}: {
  templateId: Id<"consentTemplates"> | "new" | null;
  // True when the caller wants the dialog to render an existing template
  // as view-only: inputs disabled, no Save button. Used by staff + admin
  // who can read every template but cannot edit them.
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
  useBodyScrollLock();

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setBody(existing.body);
  }, [existing]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({ name, body });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (isEdit && templateId !== "new" && templateId !== null) {
        await update({
          id: templateId,
          name: parsed.data.name,
          body: parsed.data.body,
        });
      } else {
        await create({ name: parsed.data.name, body: parsed.data.body });
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-zinc-950 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {readOnly ? "View template" : isEdit ? "Edit template" : "New template"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            placeholder="Grooming Consent"
            readOnly={readOnly}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Body
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={12}
              placeholder="By signing below, you authorise our staff to groom your pet…"
              readOnly={readOnly}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 read-only:cursor-default read-only:bg-zinc-50 read-only:focus:border-zinc-300 read-only:focus:ring-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:read-only:bg-zinc-900"
            />
            {fieldErrors.body && !readOnly && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.body}
              </span>
            )}
            {!readOnly && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Plain text. Each blank line creates a paragraph in the PDF.
              </span>
            )}
          </label>
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
                {submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create template"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
