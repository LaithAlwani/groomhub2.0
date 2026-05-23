"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Store, Trash2 } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw file cap before compression

/**
 * Onboarding-only logo picker. The parent (NewShopForm) owns the File until
 * the user clicks "Create shop"; we only show a preview here. No Convex
 * upload happens at this stage — that defers to submit so closing the wizard
 * never leaves an orphan file in storage.
 */
export function ShopLogoUploader({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (next: File | null) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manage the blob preview URL lifecycle — revoke when the file changes so
  // we don't leak object URLs on the page.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("Image is too large. Keep it under 10 MB.");
      return;
    }
    setError(null);
    onChange(picked);
  }

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-blue-50 text-blue-600 dark:border-zinc-800 dark:bg-blue-950/40 dark:text-blue-300"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-16 w-16 object-cover"
          />
        ) : (
          <Store size={22} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePick}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <Camera size={14} />
            {file ? "Replace logo" : "Upload logo"}
          </button>
          {file && !disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Optional. We&apos;ll compress it and save when you click Create shop.
        </p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
