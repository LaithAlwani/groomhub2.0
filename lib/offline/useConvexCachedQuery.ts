"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import {
  getFunctionName,
  type FunctionReference,
} from "convex/server";

// Convex's `useQuery` accepts either the query args or the string `"skip"`
// (which short-circuits the subscription). Convex doesn't export the union
// type publicly, so we mirror it here. Mirrors the shape of `OptionalRestArgs`.
type SkipOrArgs<Q extends FunctionReference<"query">> = Q["_args"] extends Record<
  string,
  never
>
  ? [args?: Q["_args"] | "skip"]
  : [args: Q["_args"] | "skip"];

/**
 * Drop-in replacement for `useQuery` from `convex/react` that mirrors every
 * successful result into the TanStack Query cache and falls back to the
 * cached value when Convex hasn't returned yet (offline, or first paint
 * after refresh while the WS is still connecting).
 *
 * Reads remain reactive — Convex's WebSocket subscription is still the
 * source of truth when it's live. We just give the UI something to render
 * during the gap between mount and first Convex response, and during a
 * total network outage.
 *
 * Cache key shape: `[functionPath, args]`. `args === "skip"` short-circuits
 * both Convex AND the cache lookup (consistent with Convex's own behaviour).
 *
 * Usage is identical to `useQuery`:
 *
 *   const events = useConvexCachedQuery(api.appointments.listInRange, {
 *     fromTime, toTime,
 *   });
 */
export function useConvexCachedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: SkipOrArgs<Query>
): Query["_returnType"] | undefined {
  const queryClient = useQueryClient();
  // Cast to `never` — Convex's `useQuery` has the exact same arg shape we
  // accept above, but its type parameter is harder to thread through.
  const convexResult = useConvexQuery(query, ...(args as never));

  const argsValue = args[0];
  const queryKey = useMemo(() => {
    if (argsValue === "skip") return null;
    return [getFunctionName(query), argsValue ?? null] as const;
  }, [query, argsValue]);

  // Mirror live Convex results into TanStack so they're persisted to IDB.
  useEffect(() => {
    if (queryKey && convexResult !== undefined) {
      queryClient.setQueryData(queryKey as readonly unknown[], convexResult);
    }
  }, [queryKey, convexResult, queryClient]);

  // Fall back to the cached snapshot if Convex hasn't loaded yet.
  if (queryKey && convexResult === undefined) {
    const cached = queryClient.getQueryData<Query["_returnType"]>(
      queryKey as readonly unknown[],
    );
    if (cached !== undefined) return cached;
  }

  return convexResult;
}
