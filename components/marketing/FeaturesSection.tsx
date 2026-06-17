import {
  BellRing,
  CalendarDays,
  PawPrint,
  ShieldCheck,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { landingPage, type Feature } from "@/lib/landingPage";

const ICONS: Record<Feature["icon"], LucideIcon> = {
  CalendarDays,
  BellRing,
  PawPrint,
  Smartphone,
  ShieldCheck,
  Users,
};

export function FeaturesSection() {
  const { features } = landingPage;

  return (
    <section
      id="features"
      className="bg-zinc-50 py-20 md:py-28 dark:bg-zinc-950"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            {features.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#00273c] sm:text-4xl dark:text-zinc-50">
            {features.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            {features.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {features.items.map((feature, index) => {
            const Icon = ICONS[feature.icon];
            const span =
              index === 0
                ? "md:col-span-2 md:row-span-1"
                : "md:col-span-1";
            return (
              <article
                key={feature.title}
                className={`group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${span}`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.accentClassName ?? "bg-orange-50 text-orange-700"} dark:bg-opacity-20`}
                >
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[#00273c] dark:text-zinc-50">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
