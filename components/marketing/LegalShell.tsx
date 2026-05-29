import Link from "next/link";

export function LegalShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-white dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <Link
          href="/"
          className="text-sm font-medium text-orange-700 hover:text-orange-600 dark:text-orange-400"
        >
          ← Back to home
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#00273c] sm:text-5xl dark:text-zinc-50">
          {title}
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Effective {effectiveDate}
        </p>
        <div className="legal-content mt-10 space-y-8 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          {children}
        </div>
      </div>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#00273c] dark:text-zinc-100">
        {heading}
      </h2>
      <div className="space-y-3 [&_a]:text-orange-700 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-orange-600 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </section>
  );
}
