"use client";

import { useQuery } from "convex/react";
import { TrendingDown, TrendingUp, Activity } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { OwnerOnlyCell } from "./OwnerOnlyCell";

/**
 * Operational + financial snapshot for the current week. Professional+.
 * Count / delta / no-show rate are visible to anyone with the plan;
 * revenue / unpaid AR / avg ticket are owner-only (server returns null
 * for those fields when caller isn't superAdmin → inline lock renders).
 */
export function WeekMetricsCard() {
  const data = useQuery(api.dashboard.weekMetrics, {});
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          <Activity size={18} />
        </span>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          This week
        </h3>
      </header>
      {data === undefined ? (
        <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : data === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to see weekly metrics.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Bookings"
            value={`${data.thisWeekCount}`}
            sub={
              data.deltaPct === null
                ? `vs ${data.lastWeekCount} last week`
                : `${data.deltaPct >= 0 ? "+" : ""}${data.deltaPct}% vs last week`
            }
            trend={data.deltaPct}
          />
          <Metric
            label="No-show rate"
            value={data.noShowRatePct === null ? "—" : `${data.noShowRatePct}%`}
            sub="of completed + no-show"
          />
          <Metric
            label="Revenue"
            value={
              data.revenueWeekCents === null ? null : formatCurrency(data.revenueWeekCents)
            }
            sub={data.revenueWeekCents === null ? "" : "this week, paid only"}
          />
          <Metric
            label="Avg ticket"
            value={
              data.avgTicketCents === null ? null : formatCurrency(data.avgTicketCents)
            }
            sub="per paid appointment"
          />
          <div className="col-span-2">
            <Metric
              label="Unpaid AR"
              value={data.unpaidArCents === null ? null : formatCurrency(data.unpaidArCents)}
              sub="completed but not paid"
            />
          </div>
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | null;
  sub: string;
  trend?: number | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        {value === null ? (
          <OwnerOnlyCell />
        ) : (
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
        )}
        {typeof trend === "number" && trend !== 0 && value !== null && (
          <span
            className={`inline-flex items-center text-xs ${
              trend > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
            }`}
          >
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </span>
        )}
      </div>
      {sub && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{sub}</p>
      )}
    </div>
  );
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
