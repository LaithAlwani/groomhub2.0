"use client";

import { useQuery } from "convex/react";
import { Archive } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LegacyAppointmentRow } from "./LegacyAppointmentRow";

/**
 * Audit of legacy appointment rows imported from a competitor system. Hidden
 * when the client has no imported history (most clients). Pet / service /
 * staff fields are stored as text — no foreign keys — because the source
 * data rarely lines up with our schema's typed enums. Admins (`canEdit`) can
 * edit or delete individual rows inline.
 */
export function ClientLegacyAppointmentsSection({
  clientId,
  canEdit,
}: {
  clientId: Id<"clients">;
  canEdit: boolean;
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
        <ul className="flex flex-col">
          {rows.map((row) => (
            <LegacyAppointmentRow key={row._id} row={row} canEdit={canEdit} />
          ))}
        </ul>
      </div>
    </section>
  );
}
