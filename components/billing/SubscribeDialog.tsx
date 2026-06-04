"use client";

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import type { Plan } from "@/convex/lib/plans";
import { DialogShell } from "@/components/ui/DialogShell";
import { elementsAppearance, getStripePromise } from "./stripeClient";

const PLAN_LABEL: Record<Plan, string> = {
  essential: "Essential",
  professional: "Professional",
  enterprise: "Enterprise",
};

/**
 * In-page subscribe modal: renders Stripe's `<PaymentElement>` against the
 * SubscriptionService PaymentIntent's client secret returned by
 * `convex/stripe.ts:createSubscription`. On submit the user's card is charged
 * for the first invoice; the `customer.subscription.created|updated` webhook
 * then writes the subscription row, which the page picks up reactively.
 */
export function SubscribeDialog({
  tier,
  clientSecret,
  onClose,
}: {
  tier: Plan;
  clientSecret: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <DialogShell
      open
      onClose={onClose}
      title={`Subscribe to ${PLAN_LABEL[tier]}`}
      maxWidth="md"
      busy={busy}
    >
      <Elements
        stripe={getStripePromise()}
        options={{ clientSecret, appearance: elementsAppearance }}
      >
        <SubscribeForm
          onClose={onClose}
          busy={busy}
          setBusy={setBusy}
        />
      </Elements>
    </DialogShell>
  );
}

function SubscribeForm({
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

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/billing?subscribed=1`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Payment failed");
      setBusy(false);
      return;
    }
    // No redirect means card didn't need 3DS — we're good.
    setSuccess(true);
    setBusy(false);
  };

  if (success) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          You&apos;re subscribed!
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your plan is being activated. This page will refresh in a moment.
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
          Subscribe
        </button>
      </div>
    </form>
  );
}
