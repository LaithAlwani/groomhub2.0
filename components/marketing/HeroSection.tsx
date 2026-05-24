import Link from "next/link";
import { ArrowRight, CalendarCheck2, PawPrint, Sparkles } from "lucide-react";
import { landingPage } from "@/lib/landingPage";

export function HeroSection() {
  const { hero } = landingPage;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white dark:from-[#00273c] dark:via-[#00273c] dark:to-zinc-950">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-500/10" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
            <Sparkles size={12} aria-hidden />
            {hero.eyebrow}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#00273c] sm:text-5xl md:text-6xl dark:text-zinc-50">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
            {hero.subtitle}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={hero.primaryCtaHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-3 font-medium text-white shadow-md transition-transform hover:scale-[1.02] hover:shadow-lg"
            >
              {hero.primaryCtaLabel}
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href={hero.secondaryCtaHref}
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {hero.secondaryCtaLabel}
            </Link>
          </div>
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            {hero.socialProof}
          </p>
        </div>

        <div className="relative">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-orange-200/60 via-sky-200/60 to-transparent blur-2xl dark:from-orange-500/20 dark:via-sky-500/10" />
      <div className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00273c] text-white">
              <PawPrint size={16} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400">Today</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Posh Paws Grooming
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CalendarCheck2 size={12} /> 6 booked
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {[
            { time: "9:00", pet: "Luna", service: "Full groom", color: "bg-orange-500" },
            { time: "10:30", pet: "Cooper", service: "Bath & brush", color: "bg-sky-500" },
            { time: "12:00", pet: "Daisy", service: "Nail trim", color: "bg-emerald-500" },
            { time: "14:00", pet: "Milo", service: "Full groom", color: "bg-violet-500" },
          ].map((row) => (
            <li
              key={row.time}
              className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <span className={`h-10 w-1 shrink-0 rounded-full ${row.color}`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {row.pet}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {row.service}
                </p>
              </div>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {row.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
