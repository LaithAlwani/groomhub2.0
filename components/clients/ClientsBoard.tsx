"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Download, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { usePersistentState } from "@/lib/usePersistentState";
import { LogVisitDialog } from "@/components/calendar/LogVisitDialog";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientCards } from "./ClientCards";
import { BoardSkeleton, EmptyState } from "./ClientsBoardStates";
import { ClientsPagination } from "./ClientsPagination";
import { ClientsPromoCards } from "./ClientsPromoCards";
import { ClientsToolbar, type SortKey } from "./ClientsToolbar";
import { ClientsTable, type ClientRow } from "./ClientsTable";
import { exportClientsToCsv } from "./exportClientsToCsv";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
// How many clients to pull per server batch when browsing (no search).
const BROWSE_BATCH = 200;
const PAGE_SIZE_STORAGE_KEY = "clients:pageSize";

/** Accept a stored page size only if it's still one of the offered options. */
function parsePageSize(raw: string): number | null {
  const value = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value) ? value : null;
}

export function ClientsBoard({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("lastVisit");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>(
    PAGE_SIZE_STORAGE_KEY,
    PAGE_SIZE_OPTIONS[0],
    parsePageSize,
    String,
  );
  const [creating, setCreating] = useState(false);
  const [bookingClientId, setBookingClientId] = useState<Id<"clients"> | null>(
    null,
  );
  const debouncedSearch = useDebouncedValue(search, 500);
  const searchActive = debouncedSearch.trim().length > 0;

  // Search: bounded match set (a single query). Browse: cursor-paginated so we
  // pull the next batch as the user pages past what's loaded.
  const searchRows = useQuery(
    api.clients.listWithPets,
    searchActive ? { search: debouncedSearch } : "skip",
  );
  const {
    results: browseRows,
    status: browseStatus,
    loadMore,
  } = usePaginatedQuery(
    api.clients.pageWithPets,
    searchActive ? "skip" : {},
    { initialNumItems: BROWSE_BATCH },
  );

  const rows = searchActive ? searchRows : browseRows;
  const loading = searchActive
    ? searchRows === undefined
    : browseStatus === "LoadingFirstPage";

  const sortedRows: ReadonlyArray<ClientRow> = useMemo(() => {
    if (!rows) return [];
    // While searching, keep the server's relevance order (best match first);
    // the toolbar sort only governs the browse list.
    if (searchActive) return [...rows];
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
  }, [rows, sort, searchActive]);

  const total = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  // Browsing: once the user is within a page of the loaded end, pull the next
  // server batch so they can keep paging through every client (not just 200).
  useEffect(() => {
    if (
      !searchActive &&
      browseStatus === "CanLoadMore" &&
      pageCount - safePage <= 1
    ) {
      loadMore(BROWSE_BATCH);
    }
  }, [searchActive, browseStatus, pageCount, safePage, loadMore]);

  function handlePage(next: number) {
    setPage(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

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

      {loading ? (
        <BoardSkeleton />
      ) : total === 0 ? (
        <EmptyState search={debouncedSearch} />
      ) : (
        <>
          <ClientsTable rows={pageRows} onBook={setBookingClientId} />
          <ClientCards rows={pageRows} onBook={setBookingClientId} />
          <ClientsPagination
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPage={handlePage}
            onPageSize={handlePageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
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
        <ClientFormDialog
          clientId="new"
          onClose={() => setCreating(false)}
          onSuccess={(id) => router.push(`/clients/${id}`)}
        />
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
