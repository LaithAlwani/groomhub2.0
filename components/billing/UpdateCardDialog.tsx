"use client";

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { DialogShell } from "@/components/ui/DialogShell";
import { elementsAppearance, getStripePromise } from "./stripeClient";

/**
 * In-page modal for swapping the org's default payment method. Mounts
 * `<PaymentElement>` against a fresh SetupIntent client secret from
 * `convex/stripe.ts:createSetupIntent`. Stripe attaches the new payment
 * method to the customer and (via SetupIntent's automatic default behavior +
 * the customer's invoice settings) starts billing it on the next invoice.
 */
export function UpdateCardDialog({
  clientSecret,
  onClose,
}: {
  clientSecret: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <DialogShell
      open
      onClose={onClose}
      title="Update payment method"
      maxWidth="md"
      busy={busy}
    >
      <Elements
        stripe={getStripePromise()}
        options={{ clientSecret, appearance: elementsAppearance }}
      >
        <UpdateCardForm onClose={onClose} busy={busy} setBusy={setBusy} />
      </Elements>
    </DialogShell>
  );
}

function UpdateCardForm({
  onClose,
  busy,
  setBusy,
}: {
  onClose: () => void;
  busy: boolean;
  setBusy: (next: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setBusy(true);

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/billing?cardUpdated=1`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Could not save card");
      setBusy(false);
      return;
    }
    setSuccess(true);
    setBusy(false);
  };

  if (success) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Card updated.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your next invoice will charge the new card.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !stripe}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Save card
        </button>
      </div>
    </form>
  );
}
