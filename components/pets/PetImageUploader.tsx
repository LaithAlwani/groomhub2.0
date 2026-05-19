"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Camera, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PetImage } from "./PetImage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function PetImageUploader({
  petName,
  imageUrl,
  hasImage,
  onUploaded,
  onCleared,
}: {
  petName: string;
  imageUrl: string | null;
  hasImage: boolean;
  onUploaded: (storageId: Id<"_storage">, localPreviewUrl: string) => void;
  onCleared: () => void;
}) {
  const generateUploadUrl = useMutation(api.pets.generateImageUploadUrl);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
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
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      const localPreviewUrl = URL.createObjectURL(file);
      onUploaded(storageId, localPreviewUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload");
    } finally {
      setUploading(false);
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
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Camera size={14} />
            {uploading ? "Uploading…" : hasImage ? "Replace photo" : "Add photo"}
          </button>
          {hasImage && !uploading && (
            <button
              type="button"
              onClick={onCleared}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Tap to snap a photo with your camera or choose one from your library.
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
