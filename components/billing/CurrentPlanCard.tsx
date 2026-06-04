"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Plan } from "@/convex/lib/plans";

const PLAN_LABEL: Record<Plan, string> = {
  essential: "Essential",
  professional: "Professional",
  enterprise: "Enterprise",
};

const PLAN_PRICE: Record<Plan, string> = {
  essential: "$49 CAD / month",
  professional: "$99 CAD / month",
  enterprise: "$179 CAD / month",
};

export function CurrentPlanCard({
  effectivePlan,
  isTrialing,
  trialEndsAt,
  subscription,
  onResume,
  onCancel,
  busy,
}: {
  effectivePlan: Plan;
  isTrialing: boolean;
  trialEndsAt: number | null;
  subscription: Doc<"subscriptions"> | null;
  onResume: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  // Freeze "now" at mount so render stays pure; the count is good enough
  // for the day-granularity display we show.
  const [nowAtMount] = useState(() => Date.now());
  const trialDaysLeft =
    isTrialing && trialEndsAt !== null
      ? Math.max(0, Math.ceil((trialEndsAt - nowAtMount) / 86_400_000))
      : null;

  const renewLabel = subscription
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
            <Sparkles size={20} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Current plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {PLAN_LABEL[effectivePlan]}
              {isTrialing && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                  Free trial
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {subscription ? PLAN_PRICE[subscription.plan] : "Free during trial"}
            </p>
          </div>
        </div>

        <StatusPanel
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          subscription={subscription}
          renewLabel={renewLabel}
          onResume={onResume}
          onCancel={onCancel}
          busy={busy}
        />
      </div>
    </div>
  );
}

function StatusPanel({
  isTrialing,
  trialDaysLeft,
  subscription,
  renewLabel,
  onResume,
  onCancel,
  busy,
}: {
  isTrialing: boolean;
  trialDaysLeft: number | null;
  subscription: Doc<"subscriptions"> | null;
  renewLabel: string | null;
  onResume: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  if (subscription === null) {
    if (isTrialing && trialDaysLeft !== null) {
      return (
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left in trial
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pick a plan below to keep your Pro features.
          </p>
        </div>
      );
    }
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Pick a plan below to start a subscription.
      </p>
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Cancels on {renewLabel}
        </p>
        <button
          type="button"
          onClick={onResume}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Resume subscription
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Renews on {renewLabel}
      </p>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        Cancel subscription
      </button>
    </div>
  );
}
