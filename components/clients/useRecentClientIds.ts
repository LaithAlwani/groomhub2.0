"use client";

import { useCallback, useMemo } from "react";
import { useOrganization } from "@clerk/nextjs";
import { usePersistentState } from "@/lib/usePersistentState";

/** Mirrors `RECENT_CLIENTS_MAX` in `convex/clients.ts` (`listByIds`). */
export const RECENT_CLIENTS_MAX = 20;
const STORAGE_PREFIX = "groomhub:recentClients:";
const EMPTY: ReadonlyArray<string> = [];

function parseIds(raw: string): ReadonlyArray<string> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, RECENT_CLIENTS_MAX);
  } catch {
    return null;
  }
}

function serializeIds(ids: ReadonlyArray<string>): string {
  return JSON.stringify(ids);
}

/**
 * The "recently opened client files" list for this browser, newest first,
 * capped at `RECENT_CLIENTS_MAX`. Per device by design (localStorage via
 * `usePersistentState`), keyed per Clerk org so switching shops never shows
 * another shop's history. Ids are plain strings — the server (`listByIds`)
 * is what decides whether each one is still a real, visible client.
 *
 * Until Clerk has resolved the org (`ready === false`) the list reads as empty
 * and every mutator is a no-op, so nothing is written under the wrong key.
 */
export function useRecentClientIds() {
  const { organization, isLoaded } = useOrganization();
  const orgId = organization?.id ?? null;
  const ready = isLoaded && orgId !== null;
  const key = STORAGE_PREFIX + (orgId ?? "none");
  const [storedIds, setStoredIds] = usePersistentState<ReadonlyArray<string>>(
    key,
    EMPTY,
    parseIds,
    serializeIds,
  );

  // `parseIds` yields a fresh array every render; collapse to a stable
  // reference so effects keyed on `ids` only fire when the contents change.
  const idsKey = ready ? storedIds.join("\n") : "";
  const ids = useMemo<ReadonlyArray<string>>(
    () => (idsKey ? idsKey.split("\n") : EMPTY),
    [idsKey],
  );

  /** Move `id` to the front (no write if it's already there). */
  const record = useCallback(
    (id: string) => {
      if (!ready || ids[0] === id) return;
      setStoredIds(
        [id, ...ids.filter((other) => other !== id)].slice(
          0,
          RECENT_CLIENTS_MAX,
        ),
      );
    },
    [ready, ids, setStoredIds],
  );

  /** Drop ids the server no longer returns. Writes only when something changed. */
  const keepOnly = useCallback(
    (serverIds: ReadonlyArray<string>) => {
      if (!ready) return;
      const keep = new Set(serverIds);
      const next = ids.filter((id) => keep.has(id));
      if (next.length !== ids.length) setStoredIds(next);
    },
    [ready, ids, setStoredIds],
  );

  const clear = useCallback(() => {
    if (ready) setStoredIds(EMPTY);
  }, [ready, setStoredIds]);

  return { ready, ids, record, keepOnly, clear };
}
