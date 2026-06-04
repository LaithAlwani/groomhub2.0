"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export function PaymentMethodSection({
  hasSubscription,
  onUpdateCard,
  busy,
}: {
  hasSubscription: boolean;
  onUpdateCard: () => void;
  busy: boolean;
}) {
  const getPaymentMethod = useAction(api.stripe.getPaymentMethod);
  // Tri-state: `undefined` = still loading, `null` = no PM, value = the PM.
  // Derived `loading` keeps the effect free of synchronous setState calls.
  const [paymentMethod, setPaymentMethod] = useState<
    PaymentMethod | null | undefined
  >(hasSubscription ? undefined : null);

  useEffect(() => {
    if (!hasSubscription) return;
    let cancelled = false;
    getPaymentMethod({})
      .then((result) => {
        if (!cancelled) setPaymentMethod(result);
      })
      .catch(() => {
        if (!cancelled) setPaymentMethod(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSubscription, getPaymentMethod]);

  const loading = paymentMethod === undefined;

  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Payment method
      </h2>
      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <CreditCard size={16} />
          </span>
          <PaymentMethodLine
            paymentMethod={paymentMethod ?? null}
            loading={loading}
            hasSubscription={hasSubscription}
          />
        </div>
        <button
          type="button"
          onClick={onUpdateCard}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {paymentMethod ? "Update card" : "Add a card"}
        </button>
      </div>
    </section>
  );
}

function PaymentMethodLine({
  paymentMethod,
  loading,
  hasSubscription,
}: {
  paymentMethod: PaymentMethod | null;
  loading: boolean;
  hasSubscription: boolean;
}) {
  if (loading) {
    return (
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading…
      </span>
    );
  }
  if (!paymentMethod) {
    return (
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {hasSubscription
          ? "No default card on file."
          : "No card needed during trial."}
      </span>
    );
  }
  const brand = paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1);
  return (
    <div>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {brand} ending in {paymentMethod.last4}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
      </p>
    </div>
  );
}
