"use client";

import { useQuery } from "convex/react";
import { Archive } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Read-only audit of legacy appointment rows imported from a competitor
 * system. Hidden when the client has no imported history (most clients).
 * Pet / service / staff fields are stored as text — no foreign keys —
 * because the source data rarely lines up with our schema's typed enums.
 */
export function ClientLegacyAppointmentsSection({
  clientId,
}: {
  clientId: Id<"clients">;
}) {
  const rows = useQuery(api.imports.legacyAppointmentsForClient, { clientId });

  if (rows === undefined) return null;
  if (rows.length === 0) return null;

  const sourceSystems = Array.from(
    new Set(rows.map((row) => row.sourceSystem).filter(Boolean)),
  ) as string[];

  return (
    <section className="mt-8">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Archive size={14} className="text-zinc-400" aria-hidden />
          Imported history
          <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            {rows.length}
          </span>
        </h2>
        {sourceSystems.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            Source: {sourceSystems.join(", ")}
          </span>
        )}
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr_0.9fr_0.7fr] items-center gap-2 border-b border-zinc-200 bg-zinc-900 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:border-zinc-800">
          <span>Date</span>
          <span>Service</span>
          <span>Pet</span>
          <span>Staff</span>
          <span className="text-right">Price</span>
        </div>
        <ul>
          {rows.map((row) => (
            <li
              key={row._id}
              className="grid grid-cols-[1.2fr_1.2fr_1fr_0.9fr_0.7fr] items-start gap-2 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-900"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {row.dateLabel || "—"}
                </p>
                {row.timeLabel && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {row.timeLabel}
                  </p>
                )}
              </div>
              <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                {row.serviceName || "—"}
              </p>
              <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                {row.petName || "—"}
              </p>
              <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                {row.staffName || "—"}
              </p>
              <p className="truncate text-right text-sm text-zinc-700 dark:text-zinc-300">
                {row.priceLabel || "—"}
              </p>
              {row.notes && (
                <p className="col-span-5 mt-1 text-xs italic text-zinc-500 dark:text-zinc-400">
                  {row.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
