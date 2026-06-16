"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import SignaturePad from "react-signature-canvas";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { assembleSignedPdf } from "@/lib/consent/buildConsentPdf";
import {
  decodeDataUrlToBytes,
  uploadToStorage,
} from "@/lib/consent/signingHelpers";
import { SignConsentForm } from "./SignConsentForm";

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
  petId,
  appointmentId,
  onClose,
}: {
  petId: Id<"pets">;
  appointmentId?: Id<"appointments">;
  onClose: () => void;
}) {
  const templates = useQuery(api.consentForms.listTemplates, {});
  const org = useQuery(api.organizations.getCurrent);
  const pet = useQuery(api.pets.getDetail, { id: petId });
  const generateUploadUrl = useMutation(api.consentForms.generateUploadUrl);
  const recordSigning = useMutation(api.consentForms.recordSigning);
  const deleteOrphan = useMutation(api.consentForms.deleteOrphanStorage);

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
    const ownerName = pet?.owner?.fullName;
    if (ownerName && signerName.length === 0) {
      setSignerName(ownerName);
    }
  }, [pet, signerName, signerTouched]);

  const selectedTemplate = templates?.find((row) => row._id === templateId);

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
      uploadedSignatureId = (await uploadToStorage(
        await generateUploadUrl(),
        signatureBlob,
        "image/png",
      )) as Id<"_storage">;

      // 3. Assemble the PDF locally (text template or imported-PDF template).
      const pdfBytes = await assembleSignedPdf({
        shopName: org?.name ?? "GroomHub",
        template: selectedTemplate,
        signerName: trimmedSigner,
        signedAt: new Date(),
        signaturePngBytes: signatureBytes,
      });

      // 4. Upload the PDF.
      const pdfBlob = new Blob([pdfBytes as BlobPart], {
        type: "application/pdf",
      });
      uploadedPdfId = (await uploadToStorage(
        await generateUploadUrl(),
        pdfBlob,
        "application/pdf",
      )) as Id<"_storage">;

      // 5. Record the signing event. If this fails we clean the storage
      // objects below to avoid orphans.
      await recordSigning({
        petId,
        appointmentId,
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
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title="Sign consent form"
      maxWidth="lg"
    >
      <SignConsentForm
        templates={templates}
        selectedTemplate={selectedTemplate}
        templateId={templateId}
        onTemplateChange={setTemplateId}
        signerName={signerName}
        onSignerChange={(value) => {
          setSignerName(value);
          setSignerTouched(true);
        }}
        padRef={padRef}
        error={error}
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </DialogShell>
  );
}
