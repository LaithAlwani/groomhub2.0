"use client";

import { Share } from "lucide-react";
import { DialogShell } from "@/components/ui/DialogShell";

/**
 * iOS Add-to-Home-Screen instructions. Shown when the user taps "Install app"
 * on iOS Safari, which has no programmatic install prompt.
 */
export function InstallInstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <DialogShell open onClose={onClose} title="Get the GroomHub app" maxWidth="sm">
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo_new.webp"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-800"
          />
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Add GroomHub to your home screen for full-screen, one-tap access.
          </p>
        </div>
        <ol className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <li className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              1.
            </span>
            Tap the Share button
            <Share size={15} className="text-blue-600 dark:text-blue-400" aria-hidden />
            in Safari&apos;s toolbar.
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              2.
            </span>
            Choose <strong>Add to Home Screen</strong>.
          </li>
        </ol>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 sm:py-2"
          >
            Got it
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
