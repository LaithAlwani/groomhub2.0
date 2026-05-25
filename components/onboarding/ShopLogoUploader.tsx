"use client";

import { useEffect, useRef, useState } from "react";
import { Store, Trash2, Upload } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw file cap before compression

/**
 * Onboarding-only logo picker. The parent (NewShopForm) owns the File until
 * the user clicks "Create shop"; we only show a preview here. No Convex
 * upload happens at this stage — that defers to submit so closing the wizard
 * never leaves an orphan file in storage.
 *
 * Vertical centered layout: circular avatar at the top, orange CTA below,
 * helper text at the bottom, divider underneath separating from the form.
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
    <div className="flex flex-col items-center gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
      <span
        aria-hidden
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-200 bg-sky-50 text-[#00273c] dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-20 w-20 object-cover" />
        ) : (
          <Store size={28} />
        )}
      </span>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="hidden"
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-linear-to-b from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow disabled:cursor-not-allowed disabled:bg-none disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          <Upload size={14} />
          {file ? "Replace logo" : "Upload logo"}
        </button>
        {file && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        Optional. We&apos;ll compress it and save when you click Create shop.
      </p>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
