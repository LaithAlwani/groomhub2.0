import Link from "next/link";
import { Check } from "lucide-react";
import { landingPage, type PricingTier } from "@/lib/landingPage";

export function PricingSection() {
  const { pricing } = landingPage;

  return (
    <section id="pricing" className="bg-white py-20 md:py-28 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            {pricing.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#00273c] sm:text-4xl dark:text-zinc-50">
            {pricing.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            {pricing.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pricing.tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({ tier }: { tier: PricingTier }) {
  const recommended = tier.recommended === true;
  const cardClassName = recommended
    ? "relative flex flex-col overflow-hidden rounded-2xl border-2 border-orange-500 bg-white shadow-xl dark:bg-zinc-900"
    : "relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
  const ctaClassName = recommended
    ? "mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-3 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.01] hover:shadow"
    : "mt-6 inline-flex w-full items-center justify-center rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className={cardClassName}>
      {recommended && (
        <div className="bg-[#00273c] py-2 text-center text-xs font-semibold uppercase tracking-wider text-white">
          Most popular
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold text-[#00273c] dark:text-zinc-50">
          {tier.name}
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {tier.tagline}
        </p>
        <p className="mt-6 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
            ${tier.priceMonthly}
          </span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {tier.priceSuffix}
          </span>
        </p>
        <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-200">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check
                size={16}
                className="mt-0.5 shrink-0 text-orange-600 dark:text-orange-400"
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link href={tier.ctaHref} className={ctaClassName}>
          {tier.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
