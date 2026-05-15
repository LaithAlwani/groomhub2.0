import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        For grooming salons
      </span>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl dark:text-zinc-50">
        Run your grooming shop without the chaos.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
        Bookings, client and pet records, staff schedules &mdash; all in one place.
        Works offline so a flaky Wi-Fi never costs you an appointment.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/sign-up"
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Start free
        </Link>
        <Link
          href="/sign-in"
          className="rounded-full border border-zinc-300 px-6 py-3 font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
