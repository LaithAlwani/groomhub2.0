"use client";
import { formatError } from "@/lib/formatError";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Camera, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compressImage } from "@/lib/imageCompress";
import { PetImage } from "./PetImage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Uploader behaviour depends on whether the parent already has a `petId`:
 *
 * - **Edit mode** (`petId` set): every successful upload + every Remove is
 *   committed to the pet record immediately via `pets.setImage`. No more
 *   waiting for the parent's Save button — and no more orphan files if the
 *   user cancels the dialog after picking a photo.
 *
 * - **Create mode** (`petId` undefined): the new pet doesn't exist yet, so
 *   we just hand the storageId back to the parent via `onUploaded`. The
 *   parent links it on `pets.create`. If the parent later wants to clean
 *   up an unsaved upload, it calls `pets.deleteOrphanStorage`.
 */
export function PetImageUploader({
  petId,
  petName,
  imageUrl,
  hasImage,
  onUploaded,
  onCleared,
}: {
  petId?: Id<"pets">;
  petName: string;
  imageUrl: string | null;
  hasImage: boolean;
  onUploaded: (storageId: Id<"_storage">, localPreviewUrl: string) => void;
  onCleared: () => void;
}) {
  const generateUploadUrl = useMutation(api.pets.generateImageUploadUrl);
  const setImage = useMutation(api.pets.setImage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Keep it under 10 MB.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Compress before upload — pet photos are displayed at avatar sizes
      // (≤ 96px), so 512px @ 0.85 quality is plenty. A 4 MB phone photo
      // lands around 50–80 KB after this.
      const compressed = await compressImage(file, { maxDim: 512, quality: 0.85 });
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
      const localPreviewUrl = URL.createObjectURL(compressed);
      // Edit mode: commit the new image to the pet right now. The mutation
      // also deletes the previous file in the same call.
      if (petId) {
        await setImage({ id: petId, storageId });
      }
      onUploaded(storageId, localPreviewUrl);
    } catch (caught) {
      setError(formatError(caught, "Could not upload"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!hasImage) return;
    setError(null);
    setBusy(true);
    try {
      if (petId) await setImage({ id: petId, storageId: null });
      onCleared();
    } catch (caught) {
      setError(formatError(caught, "Could not remove"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <PetImage imageUrl={imageUrl} alt={petName || "Pet photo"} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <Camera size={14} />
            {busy ? "Saving photo…" : hasImage ? "Replace photo" : "Add photo"}
          </button>
          {hasImage && !busy && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {petId
            ? "Photo saves automatically when you upload."
            : "Tap to snap a photo or pick one from your library — saved when you create the pet."}
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
