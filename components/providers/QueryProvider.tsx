"use client";

import { useMemo } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIdbKeyValPersister } from "@/lib/offline/persister";

/**
 * TanStack Query setup with IndexedDB persistence, layered under our Convex
 * live queries via the `useConvexCachedQuery` wrapper in `lib/offline/`.
 *
 * The cache `buster` is keyed on `clerkUserId:orgId` — when either changes
 * (sign-out, sign-in as a different user, or org switch) we build a brand
 * new `QueryClient` and re-key the persister so:
 *
 *   1. The in-memory cache is dropped immediately (no stale renders from
 *      the previous identity).
 *   2. The persisted blob in IndexedDB is orphaned (next mount starts empty
 *      for the new identity). The cache for the previous identity isn't
 *      explicitly wiped from disk — that would be a privacy concern for
 *      shared devices; revisit when we ship a "log out and clear data"
 *      affordance.
 *
 * On the server (SSR), we render a plain `QueryClientProvider` because
 * IndexedDB doesn't exist — Convex still works fine, you just don't get
 * offline-restored reads until the client takes over.
 */

const STALE_TIME_MS = 1000 * 60 * 5; // 5 min — Convex pushes live updates anyway
const GC_TIME_MS = 1000 * 60 * 60 * 24 * 7; // 1 week — keep cached for offline use

const persister =
  typeof window !== "undefined" ? createIdbKeyValPersister() : null;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { organization } = useOrganization();

  const buster = useMemo(
    () => `v1:${userId ?? "anon"}:${organization?.id ?? "none"}`,
    [userId, organization?.id],
  );

  // Fresh client per buster — when the user or org changes, React swaps the
  // provider tree (`key={buster}` below) and this client goes away with it,
  // taking its in-memory cache along.
  const queryClient = useMemo(() => makeClient(), [buster]);

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      key={buster}
      client={queryClient}
      persistOptions={{
        persister,
        buster,
        maxAge: GC_TIME_MS,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
