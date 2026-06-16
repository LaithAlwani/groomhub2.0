"use client";

import type { RefObject } from "react";
import { Eraser } from "lucide-react";
import SignaturePad from "react-signature-canvas";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type TemplateOption = { _id: Id<"consentTemplates">; name: string };
type SelectedTemplate = {
  name: string;
  body?: string;
  fileStorageId?: Id<"_storage">;
  fileUrl?: string | null;
};

/**
 * Presentational body of the signing modal: template picker, signer name,
 * the template preview (text or imported-PDF link), the signature pad, and the
 * action buttons. State + submission live in `SignConsentDialog`.
 */
export function SignConsentForm({
  templates,
  selectedTemplate,
  templateId,
  onTemplateChange,
  signerName,
  onSignerChange,
  padRef,
  error,
  submitting,
  onSubmit,
  onCancel,
}: {
  templates: TemplateOption[] | undefined;
  selectedTemplate: SelectedTemplate | undefined;
  templateId: Id<"consentTemplates"> | "";
  onTemplateChange: (id: Id<"consentTemplates">) => void;
  signerName: string;
  onSignerChange: (value: string) => void;
  padRef: RefObject<SignaturePad | null>;
  error: string | null;
  submitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Template
          </span>
          <select
            value={templateId}
            onChange={(event) =>
              onTemplateChange(event.target.value as Id<"consentTemplates">)
            }
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="" disabled>
              {templates === undefined
                ? "Loading…"
                : templates.length === 0
                  ? "No templates yet — add one in /consent-forms"
                  : "Pick a template"}
            </option>
            {templates?.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Signer's full name"
          value={signerName}
          onChange={onSignerChange}
          placeholder="Jane Doe"
          autoComplete="name"
        />
      </div>

      {selectedTemplate?.fileStorageId ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Imported PDF document.{" "}
          {selectedTemplate.fileUrl && (
            <a
              href={selectedTemplate.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
            >
              Open to review
            </a>
          )}
          . The signature is appended to it on confirm.
        </div>
      ) : (
        selectedTemplate && (
          <div className="max-h-105 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-base leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {selectedTemplate.body}
          </div>
        )
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Signature
          </span>
          <button
            type="button"
            onClick={() => padRef.current?.clear()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Eraser size={12} />
            Clear
          </button>
        </div>
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          <SignaturePad
            ref={padRef}
            penColor="#0f172a"
            canvasProps={{
              className: "block h-32 w-full touch-none rounded-lg bg-white",
            }}
          />
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Sign with your finger or a stylus.
        </span>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 sm:py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 sm:py-2"
        >
          {submitting ? "Saving…" : "Confirm signature"}
        </button>
      </div>
    </form>
  );
}
