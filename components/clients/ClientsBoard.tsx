"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { usePersistentState } from "@/lib/usePersistentState";
import { LogVisitDialog } from "@/components/calendar/LogVisitDialog";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientCards } from "./ClientCards";
import { ClientsBoardHeader } from "./ClientsBoardHeader";
import { BoardSkeleton, EmptyState } from "./ClientsBoardStates";
import { ClientsPagination } from "./ClientsPagination";
import { ClientsPromoCards } from "./ClientsPromoCards";
import { ClientsToolbar, type SortKey } from "./ClientsToolbar";
import { ClientsTable, type ClientRow } from "./ClientsTable";
import { ExportCsvButton } from "./ExportCsvButton";
import { RecentClientsSection } from "./RecentClientsSection";
import { MIN_PHONE_DIGITS, MIN_TEXT_CHARS } from "./clientSearchGate";
import { exportClientsToCsv } from "./exportClientsToCsv";
import {
  PAGE_SIZE_OPTIONS,
  parsePageSize,
  useClientsBoardRows,
} from "./useClientsBoardRows";
import { useClientsBoardSearch } from "./useClientsBoardSearch";

const PAGE_SIZE_STORAGE_KEY = "clients:pageSize";

export function ClientsBoard({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const {
    search,
    setSearch,
    debouncedSearch,
    searchActive,
    belowSearchThreshold,
  } = useClientsBoardSearch();
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
  // Back to page 1 as the page hides (see `useClientsBoardSearch` for why the
  // page stays mounted) so "back" never lands on a stale deep page.
  useLayoutEffect(() => {
    return () => {
      setPage(1);
    };
  }, []);

  const { mode, rows, loading, clearRecents } = useClientsBoardRows({
    searchActive,
    debouncedSearch,
    page,
    pageSize,
  });

  const sortedRows: ReadonlyArray<ClientRow> = useMemo(() => {
    // Search keeps the server's relevance order; recents keep "newest opened
    // first". The toolbar sort only governs the browse list.
    if (mode !== "browse") return [...rows];
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
  }, [rows, sort, mode]);

  const total = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

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
      <ClientsBoardHeader canEdit={canEdit} onCreate={() => setCreating(true)} />

      <ClientsToolbar
        search={search}
        onSearch={handleSearch}
        sort={sort}
        onSort={handleSort}
      />

      {belowSearchThreshold ? (
        <p className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Keep typing to search — at least {MIN_PHONE_DIGITS} digits of a phone
          number or {MIN_TEXT_CHARS} letters of a name.
        </p>
      ) : loading ? (
        <BoardSkeleton />
      ) : mode === "recents" ? (
        <RecentClientsSection
          rows={sortedRows}
          onBook={setBookingClientId}
          onClear={clearRecents}
          onExport={handleExport}
        />
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
              <ExportCsvButton onClick={handleExport} disabled={total === 0} />
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
