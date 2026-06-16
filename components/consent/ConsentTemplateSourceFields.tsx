"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { FileText, Upload } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PdfSummary,
  ReadOnlyBody,
  SourceToggleTab,
} from "./templateSourceParts";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

export type TemplateSourceMode = "text" | "pdf";

/**
 * Source editor for a consent template: a Text/PDF toggle, the body textarea
 * (text mode), or a PDF uploader (pdf mode). Uploads go straight to storage
 * and hand the parent a `fileStorageId`. Read-only mode shows the body or a
 * link to the uploaded PDF.
 */
export function ConsentTemplateSourceFields({
  mode,
  onModeChange,
  body,
  onBodyChange,
  bodyError,
  fileName,
  fileUrl,
  onUploaded,
  readOnly = false,
}: {
  mode: TemplateSourceMode;
  onModeChange: (mode: TemplateSourceMode) => void;
  body: string;
  onBodyChange: (value: string) => void;
  bodyError?: string;
  fileName: string | null;
  fileUrl: string | null;
  onUploaded: (storageId: Id<"_storage">, fileName: string) => void;
  readOnly?: boolean;
}) {
  const generateUploadUrl = useMutation(api.consentForms.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setUploadError("PDF is too large. Keep it under 20 MB.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      onUploaded(storageId, file.name);
    } catch (caught) {
      setUploadError(
        caught instanceof Error ? caught.message : "Could not upload",
      );
    } finally {
      setUploading(false);
    }
  }

  if (readOnly) {
    return mode === "pdf" ? (
      <PdfSummary fileName={fileName} fileUrl={fileUrl} />
    ) : (
      <ReadOnlyBody body={body} />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex w-fit rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
        <SourceToggleTab
          active={mode === "text"}
          onClick={() => onModeChange("text")}
          icon={<FileText size={13} />}
          label="Type text"
        />
        <SourceToggleTab
          active={mode === "pdf"}
          onClick={() => onModeChange("pdf")}
          icon={<Upload size={13} />}
          label="Upload PDF"
        />
      </div>

      {mode === "text" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Body
          </span>
          <textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            rows={12}
            placeholder="By signing below, you authorise our staff to groom your pet…"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {bodyError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {bodyError}
            </span>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Plain text. Each blank line creates a paragraph in the PDF.
          </span>
        </label>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Upload size={14} />
            {uploading ? "Uploading…" : fileName ? "Replace PDF" : "Upload PDF"}
          </button>
          <PdfSummary fileName={fileName} fileUrl={fileUrl} />
          {bodyError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {bodyError}
            </span>
          )}
          {uploadError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {uploadError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
