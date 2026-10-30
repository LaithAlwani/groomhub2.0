"use client";

import { useLayoutEffect, useState } from "react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { shouldRunClientSearch } from "./clientSearchGate";

const SEARCH_DEBOUNCE_MS = 900;

/**
 * Search-box state for the clients board.
 *
 * - Typing is debounced so each settled keystroke doesn't fire a server scan.
 * - Clearing the box takes effect immediately (no 900ms of stale results
 *   while the recents / browse view waits to come back).
 * - Next keeps this page mounted but hidden (React `<Activity>`) while the
 *   user is on a client file, so a typed search would otherwise still be there
 *   on "back". The layout-effect cleanup runs as the page hides and resets it,
 *   so returning always lands on the recently-opened / browse view. This is
 *   the pattern Next's "preserving UI state" guide prescribes for transient
 *   state.
 */
export function useClientsBoardSearch() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const debouncedSearch = search.trim() === "" ? "" : debounced;

  useLayoutEffect(() => {
    return () => {
      setSearch("");
    };
  }, []);

  // Only run the server search once the query is long enough to be worth the
  // (whole-table) scan — see `clientSearchGate`. Shorter partial queries stay
  // in recents / browse mode instead of firing a scan per settled keystroke.
  const searchActive = shouldRunClientSearch(debouncedSearch);
  // User has typed something, but not yet enough to search — prompt them
  // rather than silently showing the full list.
  const belowSearchThreshold =
    debouncedSearch.trim().length > 0 && !searchActive;

  return { search, setSearch, debouncedSearch, searchActive, belowSearchThreshold };
}
