"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatError } from "@/lib/formatError";
import { compressImage } from "@/lib/imageCompress";
import { AddPhotoMenu } from "./AddPhotoMenu";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file (pre-compression)

export type AppointmentImage = { storageId: Id<"_storage">; url: string | null };
export type Stage = "before" | "after";

/**
 * One before/after gallery. The "Add" tile opens a small menu with "Take
 * photo" and "Choose from library". Each backs a separate hidden input: the
 * camera one uses `capture` (single shot, rear camera), the library one allows
 * multi-select. We split them because iOS skips the camera option entirely
 * when a single `image/*` input also has `multiple` — so one combined input
 * can't offer both on iPhones.
 */
export function AppointmentImageStage({
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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
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
      setError(formatError(caught, "Could not upload"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(storageId: Id<"_storage">) {
    setError(null);
    try {
      await removeImage({ id: appointmentId, stage, storageId });
    } catch (caught) {
      setError(formatError(caught, "Could not remove"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {stage === "before" ? "Before" : "After"}
      </span>
      {/* Camera: single shot from the rear camera. `capture` is ignored on
          desktop, where it just opens the normal file dialog. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFiles}
        className="hidden"
      />
      {/* Library: multi-select from the photo roll / file system. */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
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
        <li>
          <AddPhotoMenu
            stage={stage}
            busy={busy}
            onCamera={() => cameraInputRef.current?.click()}
            onLibrary={() => libraryInputRef.current?.click()}
          />
        </li>
      </ul>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
