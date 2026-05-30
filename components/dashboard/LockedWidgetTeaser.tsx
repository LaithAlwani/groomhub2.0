import Link from "next/link";
import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Plan } from "@/convex/lib/plans";

const PLAN_LABEL: Record<Plan, string> = {
  essential: "Essential",
  professional: "Professional",
  enterprise: "Enterprise",
};

/**
 * Drop-in replacement card shown when the active plan tier doesn't include
 * the widget's feature. Same outer dimensions and visual rhythm as the
 * live widgets so the dashboard grid stays balanced.
 */
export function LockedWidgetTeaser({
  title,
  icon: Icon,
  requiredPlan,
  tagline,
}: {
  title: string;
  icon: LucideIcon;
  requiredPlan: Plan;
  tagline: string;
}) {
  const planLabel = PLAN_LABEL[requiredPlan];
  return (
    <article className="relative flex flex-col gap-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
          <Icon size={18} />
        </span>
        <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-700 dark:text-zinc-300">
          {title}
          <Lock size={14} aria-hidden className="text-zinc-400" />
        </h3>
      </header>
      <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        {tagline}
      </p>
      <Link
        href="/#pricing"
        className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
      >
        Upgrade to {planLabel}
      </Link>
    </article>
  );
}
