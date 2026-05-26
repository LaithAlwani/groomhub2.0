"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

/**
 * Source of truth for "which location is the user looking at right now".
 * Provider mounts once at the authed layout; every consumer subscribes via
 * `useCurrentLocation()` so a sidebar switch propagates to the calendar,
 * appointment dialog, availability editor, etc. without page reload.
 *
 * Selection is persisted in localStorage keyed by Clerk orgId so re-entering
 * the same shop restores the same picked location.
 */

const STORAGE_PREFIX = "groomhub:currentLocation:";

type CurrentLocationValue = {
  loading: boolean;
  locations: Doc<"locations">[];
  current: Doc<"locations"> | null;
  setCurrentId: (id: Id<"locations">) => void;
};

const CurrentLocationContext = createContext<CurrentLocationValue | null>(null);

export function CurrentLocationProvider({ children }: { children: ReactNode }) {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  const allLocations = useQuery(api.locations.list);
  // `me.membership.locationIds` scopes a staff to a subset of the org's
  // locations. `[]` means "all locations" (default for admins/owners and
  // single-location orgs). We intersect the org's locations with that list
  // so the switcher / consumers only ever see what the current user is
  // allowed at — a one-location staff can't switch to anywhere else.
  const me = useQuery(api.users.me);
  const [selectedId, setSelectedId] = useState<Id<"locations"> | null>(null);

  useEffect(() => {
    if (!orgId) {
      setSelectedId(null);
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + orgId);
      setSelectedId(stored ? (stored as Id<"locations">) : null);
    } catch {
      setSelectedId(null);
    }
  }, [orgId]);

  const setCurrentId = useCallback(
    (id: Id<"locations">) => {
      setSelectedId(id);
      if (!orgId) return;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + orgId, id);
      } catch {
        // localStorage unavailable (private mode, etc.) — selection lives only
        // in component state for this session.
      }
    },
    [orgId],
  );

  const value = useMemo<CurrentLocationValue>(() => {
    if (allLocations === undefined || me === undefined) {
      return { loading: true, locations: [], current: null, setCurrentId };
    }
    const allowedIds = me?.membership.locationIds ?? [];
    const locations =
      allowedIds.length === 0
        ? allLocations
        : allLocations.filter((row) => allowedIds.includes(row._id));
    const remembered = selectedId
      ? locations.find((row) => row._id === selectedId)
      : null;
    const fallback = locations[0] ?? null;
    return {
      loading: false,
      locations,
      current: remembered ?? fallback,
      setCurrentId,
    };
  }, [allLocations, me, selectedId, setCurrentId]);

  return (
    <CurrentLocationContext.Provider value={value}>
      {children}
    </CurrentLocationContext.Provider>
  );
}

/**
 * Reads the active location selection from the surrounding
 * `<CurrentLocationProvider>`. Returns a safe `loading` default when called
 * outside the provider (e.g. on the marketing surface) so this hook is
 * tree-shakable from any route without crashing.
 */
export function useCurrentLocation(): CurrentLocationValue {
  const ctx = useContext(CurrentLocationContext);
  if (!ctx) {
    return {
      loading: true,
      locations: [],
      current: null,
      setCurrentId: () => {
        /* no-op outside the provider */
      },
    };
  }
  return ctx;
}
