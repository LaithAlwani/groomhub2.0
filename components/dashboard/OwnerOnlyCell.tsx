import { Lock } from "lucide-react";

/**
 * Inline placeholder rendered in place of a financial figure when the
 * caller can see the surrounding widget (plan allows it) but isn't the
 * shop owner (`superAdmin`). Keeps the widget's layout intact while
 * suppressing sensitive numbers.
 */
export function OwnerOnlyCell({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 ${className ?? ""}`}
      title="Visible to shop owners only"
    >
      <Lock size={10} aria-hidden />
      Owner only
    </span>
  );
}
