"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DialogShell } from "@/components/ui/DialogShell";

/**
 * Confirmation dialog for canceling the active subscription. Defaults to
 * `cancel_at_period_end: true` — the org keeps Pro/Enterprise features until
 * the period rolls over, then `getEffectivePlan` falls back to essential (or
 * trial if still within the 14-day window).
 */
export function CancelDialog({ onClose }: { onClose: () => void }) {
  const cancelSubscription = useAction(api.stripe.cancelSubscription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await cancelSubscription({ atPeriodEnd: true });
      setSuccess(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not cancel subscription",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      open
      onClose={onClose}
      title="Cancel subscription"
      maxWidth="sm"
      busy={busy}
    >
      {success ? (
        <div className="px-5 py-8 text-center">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Cancellation scheduled.
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;ll keep your current features until the end of the billing
            period. You can resume any time before then.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="px-5 py-5">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Your subscription will end at the close of the current billing
            period. You&apos;ll keep access to your current features until
            then, and you can resume any time before the period ends.
          </p>
          {error && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Keep subscription
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Cancel subscription
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}
