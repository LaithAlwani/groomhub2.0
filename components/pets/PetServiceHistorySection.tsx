"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Plus, Scissors } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LogVisitDialog } from "@/components/calendar/LogVisitDialog";
import { ServiceRecordRow } from "@/components/serviceRecords/ServiceRecordRow";

/**
 * Permanent service history for one pet — the record of what was actually
 * done, separate from scheduled appointments. Any member can log a service;
 * authors/admins can edit or delete individual records.
 */
export function PetServiceHistorySection({
  petId,
  clientId,
}: {
  petId: Id<"pets">;
  clientId: Id<"clients">;
}) {
  const records = useQuery(api.serviceRecords.listForPet, { petId });
  const [logging, setLogging] = useState(false);

  return (
    <section className="mt-8">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Scissors size={14} className="text-zinc-400" aria-hidden />
          Service history
          {records && records.length > 0 && (
            <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
              {records.length}
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
        {records === undefined ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">Loading…</p>
        ) : records.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No services logged yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {records.map((record) => (
              <ServiceRecordRow key={record._id} record={record} />
            ))}
          </ul>
        )}
      </div>

      {logging && (
        <LogVisitDialog
          initialClientId={clientId}
          initialPetId={petId}
          onClose={() => setLogging(false)}
        />
      )}
    </section>
  );
}
