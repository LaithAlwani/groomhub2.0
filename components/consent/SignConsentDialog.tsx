"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Eraser, X } from "lucide-react";
import SignaturePad from "react-signature-canvas";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { buildConsentPdf } from "@/lib/consent/buildConsentPdf";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

/**
 * The tablet-friendly signing modal. Staff opens it from the client detail
 * page, picks a template, types the signer's name, and hands the tablet to
 * the customer to sign. On confirm, we:
 *
 *   1. Capture the signature as a PNG from the canvas.
 *   2. Upload the PNG to Convex storage.
 *   3. Build a PDF (template body + signature image) locally with pdf-lib.
 *   4. Upload the PDF to Convex storage.
 *   5. Call `recordSigning` which writes the immutable `signedConsents` row.
 *
 * The dialog is intentionally tall (`min-h-[80vh]`) and uses big buttons so
 * a finger sign-and-tap works comfortably on a tablet.
 */
export function SignConsentDialog({
  clientId,
  onClose,
}: {
  clientId: Id<"clients">;
  onClose: () => void;
}) {
  const templates = useQuery(api.consentForms.listTemplates, {});
  const org = useQuery(api.organizations.getCurrent);
  const client = useQuery(api.clients.get, { id: clientId });
  const generateUploadUrl = useMutation(api.consentForms.generateUploadUrl);
  const recordSigning = useMutation(api.consentForms.recordSigning);
  const deleteOrphan = useMutation(api.consentForms.deleteOrphanStorage);
  useBodyScrollLock();

  const padRef = useRef<SignaturePad | null>(null);
  const [templateId, setTemplateId] = useState<Id<"consentTemplates"> | "">("");
  const [signerName, setSignerName] = useState("");
  const [signerTouched, setSignerTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // Pre-populate the signer field with the client's name on first load.
  // `signerTouched` guards against overwriting an edit if Convex re-emits
  // the same client row (the staff member may have already typed something
  // else by the time the live query resettles).
  useEffect(() => {
    if (signerTouched) return;
    if (client?.fullName && signerName.length === 0) {
      setSignerName(client.fullName);
    }
  }, [client, signerName, signerTouched]);

  const selectedTemplate = templates?.find((row) => row._id === templateId);

  function clearPad() {
    padRef.current?.clear();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!templateId || !selectedTemplate) {
      setError("Pick a consent template.");
      return;
    }
    const trimmedSigner = signerName.trim();
    if (trimmedSigner.length === 0) {
      setError("Type the signer's full name.");
      return;
    }
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Sign in the box before confirming.");
      return;
    }

    setSubmitting(true);
    let uploadedSignatureId: Id<"_storage"> | null = null;
    let uploadedPdfId: Id<"_storage"> | null = null;
    try {
      // 1. Pull the PNG out of the signature canvas. We decode the
      // base64 manually instead of `fetch(dataUrl)` because a `data:` URL
      // fetch is blocked under strict CSP and can surface as "Failed to
      // fetch" in some browsers — which is exactly the symptom we hit.
      const signatureBytes = decodeDataUrlToBytes(pad.toDataURL("image/png"));
      const signatureBlob = new Blob([signatureBytes as BlobPart], {
        type: "image/png",
      });

      // 2. Upload the signature PNG.
      uploadedSignatureId = await uploadToStorage(
        await generateUploadUrl(),
        signatureBlob,
        "image/png",
      );

      // 3. Assemble the PDF locally.
      const pdfBytes = await buildConsentPdf({
        shopName: org?.name ?? "GroomHub",
        templateName: selectedTemplate.name,
        templateBody: selectedTemplate.body,
        signerName: trimmedSigner,
        signedAt: new Date(),
        signaturePngBytes: signatureBytes,
      });

      // 4. Upload the PDF.
      const pdfBlob = new Blob([pdfBytes as BlobPart], {
        type: "application/pdf",
      });
      uploadedPdfId = await uploadToStorage(
        await generateUploadUrl(),
        pdfBlob,
        "application/pdf",
      );

      // 5. Record the signing event. If this fails we clean the storage
      // objects below to avoid orphans.
      await recordSigning({
        clientId,
        templateId,
        signerName: trimmedSigner,
        signatureStorageId: uploadedSignatureId,
        pdfStorageId: uploadedPdfId,
      });
      onClose();
    } catch (caught) {
      // Best-effort cleanup of any uploaded storage we didn't tie to a row.
      if (uploadedSignatureId) {
        await deleteOrphan({ storageId: uploadedSignatureId }).catch(() => {});
      }
      if (uploadedPdfId) {
        await deleteOrphan({ storageId: uploadedPdfId }).catch(() => {});
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save the signature",
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
      <div className="flex h-[100vh] w-full flex-col overflow-hidden bg-white shadow-xl dark:bg-zinc-950 sm:h-auto sm:min-h-[80vh] sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Sign consent form
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
        <form
          onSubmit={handleSubmit}
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
                  setTemplateId(event.target.value as Id<"consentTemplates">)
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
              onChange={(value) => {
                setSignerName(value);
                setSignerTouched(true);
              }}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>

          {selectedTemplate && (
            <div className="max-h-105 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-base leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {selectedTemplate.body}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Signature
              </span>
              <button
                type="button"
                onClick={clearPad}
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
                  className:
                    "block h-32 w-full touch-none rounded-lg bg-white",
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
              onClick={onClose}
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
      </div>
    </div>
  );
}

/**
 * Decode a `data:image/png;base64,…` URL straight to a `Uint8Array` without
 * going through `fetch()`. Avoids two failure modes seen on the previous
 * fetch-based path: strict CSPs that block `data:` URL fetches, and
 * "Failed to fetch" TypeErrors in some browser configurations.
 */
function decodeDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaAt = dataUrl.indexOf(",");
  if (commaAt < 0) throw new Error("Invalid data URL");
  const payload = dataUrl.slice(commaAt + 1);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function uploadToStorage(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<Id<"_storage">> {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!response.ok) throw new Error("Upload failed");
  const { storageId } = (await response.json()) as {
    storageId: Id<"_storage">;
  };
  return storageId;
}
