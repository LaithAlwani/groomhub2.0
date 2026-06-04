"use client";

import { Check, Loader2 } from "lucide-react";
import type { Plan } from "@/convex/lib/plans";
import { landingPage } from "@/lib/landingPage";

export function PlanSwitcher({
  currentSubscriptionTier,
  highlightedTier,
  onSelectTier,
  busy,
}: {
  /** The tier the org is actively paying for, or null when free / trial. */
  currentSubscriptionTier: Plan | null;
  /** Optional tier to visually emphasize, deep-linked from upgrade CTAs. */
  highlightedTier: Plan | null;
  onSelectTier: (tier: Plan) => void;
  busy: boolean;
}) {
  const tiers = landingPage.pricing.tiers;

  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Choose your plan
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Switch at any time. Plan changes prorate based on the remaining days in
        your current billing period.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => {
          const tierKey = tier.name.toLowerCase() as Plan;
          const isCurrent = currentSubscriptionTier === tierKey;
          const isHighlighted = highlightedTier === tierKey;
          return (
            <TierCard
              key={tier.name}
              tierKey={tierKey}
              name={tier.name}
              price={tier.priceMonthly}
              tagline={tier.tagline}
              features={tier.features}
              isCurrent={isCurrent}
              isHighlighted={isHighlighted}
              onSelect={() => onSelectTier(tierKey)}
              busy={busy}
            />
          );
        })}
      </div>
    </section>
  );
}

function TierCard({
  tierKey,
  name,
  price,
  tagline,
  features,
  isCurrent,
  isHighlighted,
  onSelect,
  busy,
}: {
  tierKey: Plan;
  name: string;
  price: number;
  tagline: string;
  features: ReadonlyArray<string>;
  isCurrent: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  busy: boolean;
}) {
  const ringClass = isHighlighted
    ? "ring-2 ring-orange-500"
    : "ring-0";
  const buttonClass = isCurrent
    ? "mt-6 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    : "mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:opacity-50";

  return (
    <article
      id={`tier-${tierKey}`}
      className={`relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${ringClass}`}
    >
      <header>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {name}
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {tagline}
        </p>
      </header>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          ${price}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">CAD/mo</span>
      </p>
      <ul className="mt-5 flex flex-1 flex-col gap-2 text-xs text-zinc-700 dark:text-zinc-200">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check
              size={12}
              className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400"
              aria-hidden
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        disabled={busy || isCurrent}
        className={buttonClass}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {isCurrent ? "Current plan" : `Switch to ${name}`}
      </button>
    </article>
  );
}
