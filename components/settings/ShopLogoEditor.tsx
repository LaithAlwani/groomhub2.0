"use client";
import { formatError } from "@/lib/formatError";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Camera, Loader2, Store } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compressImage } from "@/lib/imageCompress";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Settings-page logo editor. Atomic per pick: file → compress → upload →
 * `organizations.setLogo`. Avatar IS the click target — hovering reveals a
 * dark "Change photo" overlay (Instagram / WhatsApp pattern) instead of a
 * fixed corner badge, which kept fighting the brand orange used for CTAs
 * everywhere else. Replace-only: there's no remove path since the logo
 * appears in transactional emails and the public shop page.
 */
export function ShopLogoEditor({
  logoUrl,
}: {
  logoUrl: string | null;
}) {
  const generateUploadUrl = useMutation(api.organizations.generateLogoUploadUrl);
  const setLogo = useMutation(api.organizations.setLogo);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
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
    setBusy(true);
    try {
      const compressed = await compressImage(picked, {
        maxDim: 512,
        quality: 0.85,
      });
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": compressed.type || picked.type },
        body: compressed,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await setLogo({ storageId });
    } catch (caught) {
      setError(formatError(caught, "Could not upload"));
    } finally {
      setBusy(false);
    }
  }

  function openPicker() {
    if (busy) return;
    fileInputRef.current?.click();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="hidden"
        disabled={busy}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        aria-label={logoUrl ? "Change shop logo" : "Upload shop logo"}
        className="group relative inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200 transition-all hover:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Store
            size={32}
            className="text-zinc-300 dark:text-zinc-700"
            aria-hidden
          />
        )}
        {/* Hover overlay — appears on hover or while busy. Mirrors the
            native "tap photo to change" UX from messaging apps. */}
        <span
          aria-hidden
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-900/55 text-white transition-opacity ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {busy ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Camera size={18} />
              <span className="text-[10px] font-medium uppercase tracking-wider">
                Change
              </span>
            </>
          )}
        </span>
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {logoUrl ? "Tap to change shop logo" : "Tap to add a shop logo"}
      </p>
      {error && (
        <p className="self-stretch rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
