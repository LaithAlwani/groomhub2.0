"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Plus, Scissors } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { LogVisitDialog } from "@/components/calendar/LogVisitDialog";
import { ServiceRecordRow } from "@/components/serviceRecords/ServiceRecordRow";
import { LegacyAppointmentRow } from "./LegacyAppointmentRow";
import type { ServiceRecordItem } from "@/components/serviceRecords/types";

/**
 * Permanent service history for a client, aggregated across all their pets.
 * Presentation-only merge: real `serviceRecords` and imported
 * `legacyAppointments` are separate tables, but shown here as one list sorted
 * newest-first. Each row keeps its own editor. Separate from scheduled
 * appointments.
 */
type MergedItem =
  | { kind: "record"; sortDate: number; record: ServiceRecordItem }
  | { kind: "legacy"; sortDate: number; legacy: Doc<"legacyAppointments"> };

/** Best-effort timestamp for a legacy row so it can interleave by date. */
function legacySortDate(legacy: Doc<"legacyAppointments">): number {
  const parsed = legacy.dateLabel ? Date.parse(legacy.dateLabel) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ClientServiceHistorySection({
  clientId,
  canEditLegacy,
  canDeleteLegacy,
}: {
  clientId: Id<"clients">;
  canEditLegacy: boolean;
  canDeleteLegacy: boolean;
}) {
  const records = useQuery(api.serviceRecords.listForClient, { clientId });
  const legacy = useQuery(api.imports.legacyAppointmentsForClient, { clientId });
  const [logging, setLogging] = useState(false);

  const loading = records === undefined || legacy === undefined;
  const merged = useMemo<MergedItem[]>(() => {
    const items: MergedItem[] = [
      ...(records ?? []).map(
        (record): MergedItem => ({
          kind: "record",
          sortDate: record.date,
          record,
        }),
      ),
      ...(legacy ?? []).map(
        (row): MergedItem => ({
          kind: "legacy",
          sortDate: legacySortDate(row),
          legacy: row,
        }),
      ),
    ];
    return items.sort((a, b) => b.sortDate - a.sortDate);
  }, [records, legacy]);

  return (
    <section className="mt-8">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Scissors size={14} className="text-zinc-400" aria-hidden />
          Service history
          {!loading && merged.length > 0 && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {merged.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setLogging(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <Plus size={14} />
          Log a service
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">Loading…</p>
        ) : merged.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No services logged yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {merged.map((item) =>
              item.kind === "record" ? (
                <ServiceRecordRow
                  key={`r-${item.record._id}`}
                  record={item.record}
                  showPet
                />
              ) : (
                <LegacyAppointmentRow
                  key={`l-${item.legacy._id}`}
                  row={item.legacy}
                  canEdit={canEditLegacy}
                  canDelete={canDeleteLegacy}
                />
              ),
            )}
          </ul>
        )}
      </div>

      {logging && (
        <LogVisitDialog
          initialClientId={clientId}
          onClose={() => setLogging(false)}
        />
      )}
    </section>
  );
}
