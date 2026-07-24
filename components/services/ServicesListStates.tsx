import { Scissors } from "lucide-react";

/** Empty + loading states for the services catalog table. */

export function ServicesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500"
      >
        <Scissors size={18} />
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No services yet.
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Add a Full Groom, Nail Trim, Bath &amp; Brush — whatever your shop
          offers.
        </p>
      </div>
    </div>
  );
}

export function ServicesListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
