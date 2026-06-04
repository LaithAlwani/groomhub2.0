"use client";

/**
 * Browser Stripe.js singleton. `loadStripe` returns a promise the first time
 * it's called; we cache it module-side so every `<Elements>` provider in the
 * app re-uses the same instance.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (stripePromise === null) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(publishableKey);
    }
  }
  return stripePromise;
}

/**
 * Appearance config for the embedded `<PaymentElement>` so Stripe's iframe
 * blends with the GroomHub design language (orange accent, zinc neutrals,
 * 8px radius matching the rest of the app's cards).
 */
export const elementsAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#f97316",
    colorBackground: "#ffffff",
    colorText: "#18181b",
    colorDanger: "#dc2626",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    borderRadius: "8px",
    spacingUnit: "4px",
  },
};
