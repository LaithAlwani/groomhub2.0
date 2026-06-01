import Link from "next/link";
import { ArrowRight, CalendarCheck2, PawPrint, Sparkles } from "lucide-react";
import { landingPage } from "@/lib/landingPage";
import { marketingHref } from "@/lib/urls";

export function HeroSection() {
  const { hero } = landingPage;

  return (
    <section className="relative overflow-hidden bg-[#00273c]">
      {/* Full-bleed background video. `playsInline` + `muted` are required
          for autoplay on iOS Safari and most mobile browsers. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        // Decorative — readable copy lives above it; no a11y label needed.
        aria-hidden
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      {/* Dark gradient overlay — heavier on the left so the headline copy
          stays readable, lighter on the right so the dashboard mockup
          card has contrast without being washed out. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-r from-[#00273c]/85 via-[#00273c]/60 to-[#00273c]/30"
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-200 backdrop-blur">
            <Sparkles size={12} aria-hidden />
            {hero.eyebrow}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
            {hero.subtitle}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={marketingHref(hero.primaryCtaHref)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-orange-600 to-orange-500 px-6 py-3 font-medium text-white shadow-md transition-transform hover:scale-[1.02] hover:shadow-lg"
            >
              {hero.primaryCtaLabel}
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href={hero.secondaryCtaHref}
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 font-medium text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              {hero.secondaryCtaLabel}
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/70">
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
      <div className="absolute -inset-4 rounded-3xl bg-linear-to-br from-orange-300/40 via-sky-200/30 to-transparent blur-2xl" />
      <div className="relative rounded-2xl border border-white/20 bg-white/55 p-5 shadow-2xl backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/55">
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
