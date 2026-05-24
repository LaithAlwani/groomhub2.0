import { Mail } from "lucide-react";
import { landingPage } from "@/lib/landingPage";

export function ContactSection() {
  const { contact } = landingPage;

  return (
    <section
      id="contact"
      className="bg-zinc-50 py-20 md:py-28 dark:bg-zinc-950"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-2 md:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            {contact.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#00273c] sm:text-4xl dark:text-zinc-50">
            {contact.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            {contact.subtitle}
          </p>
          <a
            href={`mailto:${contact.email}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Mail size={14} aria-hidden />
            {contact.email}
          </a>
        </div>

        <form
          action={`mailto:${contact.email}`}
          method="post"
          encType="text/plain"
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                Name
              </span>
              <input
                type="text"
                name="name"
                required
                placeholder={contact.formNamePlaceholder}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder={contact.formEmailPlaceholder}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                Message
              </span>
              <textarea
                name="message"
                required
                rows={4}
                placeholder={contact.formMessagePlaceholder}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-orange-900"
              />
            </label>
            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-3 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.01] hover:shadow"
            >
              {contact.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
