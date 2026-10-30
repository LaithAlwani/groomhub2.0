"use client";

import { useEffect } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ClientRow } from "./ClientsTable";
import { useRecentClientIds } from "./useRecentClientIds";

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
// How many clients to pull per server batch when browsing (no search). Kept at
// the largest page size so the first browse load reads only what the biggest
// page renders (not 4x it); paging deeper pulls the next batch on demand. Each
// batch is one client doc per row (no pet/appointment fan-out), so a cold load
// is ~1 doc/client — lower this only trades read size for more "load more" round
// trips.
const BROWSE_BATCH = 50;

/** Accept a stored page size only if it's still one of the offered options. */
export function parsePageSize(raw: string): number | null {
  const value = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value) ? value : null;
}

export type ClientsBoardMode = "search" | "recents" | "browse";

/**
 * Which rows the clients board shows, and from where:
 *   - `search`  — the user typed enough: bounded match set from `listWithPets`.
 *   - `recents` — no search and this browser has recently opened client files:
 *                 those files (newest first) REPLACE the browse list.
 *   - `browse`  — no search, no recents: cursor-paginated walk of every client.
 *
 * Only the active source's query runs; the others are `"skip"`ped so showing
 * recents never pays for a browse batch nobody sees. Recents that the server
 * no longer returns (archived / removed) are pruned from storage here.
 */
export function useClientsBoardRows({
  searchActive,
  debouncedSearch,
  page,
  pageSize,
}: {
  searchActive: boolean;
  debouncedSearch: string;
  page: number;
  pageSize: number;
}) {
  const recents = useRecentClientIds();
  const showRecents =
    !searchActive && recents.ready && recents.ids.length > 0;
  const browseEnabled =
    !searchActive && recents.ready && recents.ids.length === 0;

  const searchRows = useQuery(
    api.clients.listWithPets,
    searchActive ? { search: debouncedSearch } : "skip",
  );
  const recentRows = useQuery(
    api.clients.listByIds,
    showRecents ? { ids: [...recents.ids] } : "skip",
  );
  const {
    results: browseRows,
    status: browseStatus,
    loadMore,
  } = usePaginatedQuery(
    api.clients.pageWithPets,
    browseEnabled ? {} : "skip",
    { initialNumItems: BROWSE_BATCH },
  );

  // Prune stored ids to what the server still recognises. `null` means auth
  // isn't settled yet — not "nothing exists" — so leave storage alone then.
  const { keepOnly } = recents;
  useEffect(() => {
    if (showRecents && Array.isArray(recentRows)) {
      keepOnly(recentRows.map((row) => row.client._id));
    }
  }, [showRecents, recentRows, keepOnly]);

  const mode: ClientsBoardMode = searchActive
    ? "search"
    : showRecents
      ? "recents"
      : "browse";
  const rows: ReadonlyArray<ClientRow> =
    mode === "search"
      ? (searchRows ?? [])
      : mode === "recents"
        ? (recentRows ?? [])
        : browseRows;
  const loading =
    mode === "search"
      ? searchRows === undefined
      : mode === "recents"
        ? // Also covers the one render where every stored id came back
          // invalid: prune is about to flip us to browse — show a skeleton,
          // not "no clients".
          recentRows === undefined ||
          recentRows === null ||
          recentRows.length === 0
        : !recents.ready || browseStatus === "LoadingFirstPage";

  // Browsing: once the user is within a page of the loaded end, pull the next
  // server batch so they can keep paging through every client.
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  useEffect(() => {
    if (
      mode === "browse" &&
      browseStatus === "CanLoadMore" &&
      pageCount - safePage <= 1
    ) {
      loadMore(BROWSE_BATCH);
    }
  }, [mode, browseStatus, pageCount, safePage, loadMore]);

  return { mode, rows, loading, clearRecents: recents.clear };
}
