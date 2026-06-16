"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Camera, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compressImage } from "@/lib/imageCompress";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file (pre-compression)

type AppointmentImage = { storageId: Id<"_storage">; url: string | null };
type Stage = "before" | "after";

/**
 * Before/after photo galleries on the appointment dialog (edit mode only).
 * Each stage holds multiple photos; uploads compress client-side and commit
 * immediately via `addAppointmentImage`, so there's no separate Save step.
 * Clicking a thumbnail opens it full-size in a lightbox.
 */
export function AppointmentImagesSection({
  appointmentId,
  before,
  after,
}: {
  appointmentId: Id<"appointments">;
  before: AppointmentImage[];
  after: AppointmentImage[];
}) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Before &amp; after photos
      </span>
      <ImageStage
        appointmentId={appointmentId}
        stage="before"
        images={before}
        onView={setViewerUrl}
      />
      <ImageStage
        appointmentId={appointmentId}
        stage="after"
        images={after}
        onView={setViewerUrl}
      />
      {viewerUrl && (
        <ImageLightbox
          url={viewerUrl}
          alt="Appointment photo"
          onClose={() => setViewerUrl(null)}
        />
      )}
    </div>
  );
}

function ImageStage({
  appointmentId,
  stage,
  images,
  onView,
}: {
  appointmentId: Id<"appointments">;
  stage: Stage;
  images: AppointmentImage[];
  onView: (url: string) => void;
}) {
  const generateUploadUrl = useMutation(api.appointments.generateImageUploadUrl);
  const addImage = useMutation(api.appointments.addAppointmentImage);
  const removeImage = useMutation(api.appointments.removeAppointmentImage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setError("Please choose image files only.");
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError("Each image must be under 10 MB.");
          continue;
        }
        const compressed = await compressImage(file, {
          maxDim: 1600,
          quality: 0.85,
        });
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": compressed.type || file.type },
          body: compressed,
        });
        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await addImage({ id: appointmentId, stage, storageId });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(storageId: Id<"_storage">) {
    setError(null);
    try {
      await removeImage({ id: appointmentId, stage, storageId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {stage === "before" ? "Before" : "After"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
        >
          <Camera size={12} />
          {busy ? "Uploading…" : "Add photos"}
        </button>
      </div>
      {images.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No {stage} photos yet.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {images.map((image) => (
            <li key={image.storageId} className="relative">
              {image.url && (
                <button
                  type="button"
                  onClick={() => onView(image.url!)}
                  aria-label={`View ${stage} photo`}
                  className="block overflow-hidden rounded-lg border border-zinc-200 transition-opacity hover:opacity-90 dark:border-zinc-800"
                >
                  <img
                    src={image.url}
                    alt={`${stage} photo`}
                    loading="lazy"
                    className="h-20 w-20 cursor-zoom-in object-cover"
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(image.storageId)}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900/80 p-0.5 text-white transition-colors hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
