import type { ReactNode } from "react";

/** Small presentational bits for the appointment detail page. */

export function Detail({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <dd className="flex items-center gap-2">
      <span className="text-zinc-400" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </dd>
  );
}

export function AppointmentDetailSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-48 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a cents amount as currency, guarding against a missing/invalid
 * currency on older rows (Intl throws without a currency code).
 */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
