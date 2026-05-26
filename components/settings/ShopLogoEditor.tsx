"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Store, Trash2, Upload } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compressImage } from "@/lib/imageCompress";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB raw file cap before compression

/**
 * Settings-page logo editor. Unlike the onboarding uploader (which defers
 * the upload until the user submits the new-shop form), this editor commits
 * each pick atomically: file → compress → upload → `organizations.setLogo`.
 * That way the user immediately sees their new logo and isn't relying on a
 * "Save changes" button alongside the contact-info form.
 *
 * Cleanup of the previous file is handled inside `setLogo` — we don't need
 * to track the old `storageId` here.
 */
export function ShopLogoEditor({
  logoUrl,
}: {
  logoUrl: string | null;
}) {
  const generateUploadUrl = useMutation(api.organizations.generateLogoUploadUrl);
  const setLogo = useMutation(api.organizations.setLogo);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
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
    setBusy("upload");
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
      setError(caught instanceof Error ? caught.message : "Could not upload");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy("remove");
    try {
      await setLogo({ storageId: null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove");
    } finally {
      setBusy(null);
    }
  }

  const showRemove = logoUrl !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Shop logo
      </span>
      <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-200 bg-white text-[#00273c] dark:border-sky-900/40 dark:bg-zinc-950 dark:text-sky-200"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-16 w-16 object-cover" />
          ) : (
            <Store size={24} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePick}
            className="hidden"
            disabled={busy !== null}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            <Upload size={14} />
            {busy === "upload"
              ? "Uploading…"
              : logoUrl
                ? "Replace"
                : "Upload logo"}
          </button>
          {showRemove && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
            >
              <Trash2 size={14} />
              {busy === "remove" ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Shows up at the top of every booking email and the public shop page.
        PNG or JPG. We compress to 512&nbsp;px on upload.
      </span>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
