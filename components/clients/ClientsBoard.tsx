"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Download, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { LogVisitDialog } from "@/components/calendar/LogVisitDialog";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientCards } from "./ClientCards";
import { ClientsPagination } from "./ClientsPagination";
import { ClientsPromoCards } from "./ClientsPromoCards";
import { ClientsToolbar, type SortKey } from "./ClientsToolbar";
import { ClientsTable, type ClientRow } from "./ClientsTable";
import { exportClientsToCsv } from "./exportClientsToCsv";

const PAGE_SIZE = 10;

export function ClientsBoard({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("lastVisit");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [bookingClientId, setBookingClientId] = useState<Id<"clients"> | null>(
    null,
  );
  const debouncedSearch = useDebouncedValue(search, 500);

  const rows = useQuery(api.clients.listWithPets, {
    search: debouncedSearch || undefined,
  });

  const sortedRows: ReadonlyArray<ClientRow> = useMemo(() => {
    if (!rows) return [];
    const copy = [...rows];
    if (sort === "name") {
      copy.sort((a, b) => a.client.fullName.localeCompare(b.client.fullName));
    } else {
      copy.sort((a, b) => {
        const aTime = a.lastAppointment?.startTime ?? 0;
        const bTime = b.lastAppointment?.startTime ?? 0;
        return bTime - aTime;
      });
    }
    return copy;
  }, [rows, sort]);

  const total = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function handleSearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  function handleSort(next: SortKey) {
    setSort(next);
    setPage(1);
  }

  function handleExport() {
    exportClientsToCsv(sortedRows);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-4 min-[874px]:flex-row min-[874px]:items-end min-[874px]:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#00273c] dark:text-zinc-50">
            Clients
          </h1>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="hidden items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 min-[874px]:inline-flex"
          >
            <Plus size={14} />
            New client
          </button>
        )}
      </header>

      <ClientsToolbar
        search={search}
        onSearch={handleSearch}
        sort={sort}
        onSort={handleSort}
      />

      {rows === undefined ? (
        <BoardSkeleton />
      ) : total === 0 ? (
        <EmptyState search={debouncedSearch} />
      ) : (
        <>
          <ClientsTable rows={pageRows} onBook={setBookingClientId} />
          <ClientCards rows={pageRows} onBook={setBookingClientId} />
          <ClientsPagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={setPage}
            trailingSlot={
              <button
                type="button"
                onClick={handleExport}
                disabled={total === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60"
              >
                <Download size={14} />
                Export CSV
              </button>
            }
          />
        </>
      )}

      <div className="mt-auto">
        <ClientsPromoCards />
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="New client"
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-b from-orange-500 to-orange-600 text-white shadow-lg transition-transform hover:scale-105 min-[874px]:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      {creating && (
        <ClientFormDialog clientId="new" onClose={() => setCreating(false)} />
      )}
      {bookingClientId && (
        <LogVisitDialog
          initialClientId={bookingClientId}
          onClose={() => setBookingClientId(null)}
        />
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      {search
        ? `No clients match “${search}”.`
        : "No clients yet. Add your first one to get started."}
    </p>
  );
}
