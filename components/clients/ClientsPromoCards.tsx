import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";

/**
 * Two pieces of info-real-estate beneath the clients table:
 * - "Automate Reminders" — encourages the user to enable SMS reminders.
 * - "Weekly Goal" — a navy progress card showing the new-clients-this-month
 *   target. Both are presentational only today — the link/CTA goes nowhere
 *   until we ship the corresponding feature.
 */
export function ClientsPromoCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <article className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-950">
        <MessageSquareText
          aria-hidden
          size={120}
          className="pointer-events-none absolute -right-4 -bottom-6 text-zinc-100 dark:text-zinc-900"
        />
        <h3 className="text-lg font-semibold text-[#00273c] dark:text-zinc-50">
          Automate Reminders
        </h3>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
          Clients who receive SMS reminders are 40% more likely to arrive on
          time. Set up your automated notification flow now.
        </p>
        {/* TODO: link to the SMS reminders settings page once it exists. */}
        <Link
          href="#"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 transition-colors hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
        >
          Enable Smart Reminders
          <ArrowRight size={14} />
        </Link>
      </article>

      <article className="rounded-2xl bg-[#00273c] p-6 text-white">
        <h3 className="text-lg font-semibold">Weekly Goal</h3>
        <p className="mt-2 text-sm text-zinc-300">
          You&apos;ve reached 85% of your target new clients for this month.
        </p>
        <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-linear-to-r from-orange-400 to-orange-500"
            style={{ width: "80%" }}
          />
        </div>
        <p className="mt-4 text-right text-2xl font-semibold tracking-tight">
          12 / 15
        </p>
      </article>
    </div>
  );
}
