"use client";

import { useEffect, useState } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { MemberLocationFilter } from "./MemberLocationFilter";
import { MemberRow } from "./MemberRow";

/**
 * Active members card on the team page. The whole card (header, subtitle,
 * location filter chip, list of rows, "View N more inactive" toggle) lives
 * inside this component so the parent stays a thin composition wrapper.
 *
 * Filter rules — single source of truth: `useCurrentLocation`. Members with
 * `locationIds: []` (admins / owners) always pass. Inactive (removed)
 * memberships are hidden by default; the "View N more inactive members"
 * toggle pulls them in via the separate `forOrgIncludingInactive` query.
 */
export function MemberList() {
  const baseMembers = useQuery(api.memberships.forOrg, {});
  const [showInactive, setShowInactive] = useState(false);
  const expandedMembers = useQuery(
    api.memberships.forOrgIncludingInactive,
    showInactive ? {} : "skip",
  );
  const { organization } = useOrganization();
  const { user: currentClerkUser } = useUser();
  const { locations, current: currentLocation } = useCurrentLocation();
  const isMultiLocation = locations.length > 1;

  // Local filter state. Defaults to the sidebar's active location, but can
  // be set to `null` ("All locations") to see every member at once — that
  // option doesn't exist in the sidebar's switcher since it controls
  // booking defaults / calendar rendering, where "all" makes no sense.
  const [filterLocationId, setFilterLocationId] = useState<
    Id<"locations"> | null
  >(currentLocation?._id ?? null);

  // Re-sync when the sidebar's location changes (e.g. user switches in the
  // sidebar after landing on the staff page). Only follow when the filter
  // was on a specific location — leave "All" alone since that's an
  // explicit override.
  useEffect(() => {
    if (filterLocationId === null) return;
    if (currentLocation && currentLocation._id !== filterLocationId) {
      setFilterLocationId(currentLocation._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?._id]);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    { clerkUserId: string; displayName: string } | null
  >(null);

  if (baseMembers === undefined) return <ListSkeleton />;

  // Filter by the active filter location: members with `locationIds: []`
  // always show, plus anyone whose assignment includes the filter
  // location. `filterLocationId === null` = "All locations" → no filtering.
  const filterByLocation = <
    T extends { membership: { locationIds: readonly unknown[] } },
  >(
    rows: T[],
  ): T[] =>
    isMultiLocation && filterLocationId !== null
      ? rows.filter(
          (row) =>
            row.membership.locationIds.length === 0 ||
            (row.membership.locationIds as string[]).includes(
              filterLocationId,
            ),
        )
      : rows;

  const activeFiltered = filterByLocation(baseMembers);
  const allFiltered = expandedMembers ? filterByLocation(expandedMembers) : null;
  const inactiveFiltered = allFiltered
    ? allFiltered.filter((row) => !row.membership.isActive)
    : null;
  const hiddenInactiveCount =
    inactiveFiltered === null
      ? // While the expanded query hasn't loaded, fall back to "?" — but we
        // only render the "View N more" link when we know the actual count,
        // so undefined-here just hides the link.
        null
      : inactiveFiltered.length;

  const visibleMembers =
    showInactive && allFiltered ? allFiltered : activeFiltered;

  async function confirmRemove() {
    if (!organization || !confirmTarget) return;
    const { clerkUserId } = confirmTarget;
    setRemovingId(clerkUserId);
    setRemoveError(null);
    try {
      await organization.removeMember(clerkUserId);
      setConfirmTarget(null);
    } catch (caught) {
      setRemoveError(
        caught instanceof Error ? caught.message : "Could not remove member",
      );
      setConfirmTarget(null);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5 dark:border-zinc-900">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Active members
          </h2>
          {isMultiLocation && filterLocationId !== null && currentLocation ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Showing members at{" "}
              <strong>
                {locations.find((row) => row._id === filterLocationId)?.name ??
                  currentLocation.name}
              </strong>
              . Switch to <em>All locations</em> to see everyone.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Everyone with access to this shop.
            </p>
          )}
        </div>
        <MemberLocationFilter
          locations={locations}
          selectedId={filterLocationId}
          onChange={setFilterLocationId}
        />
      </header>

      {visibleMembers.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No members at this location yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibleMembers.map((row) => {
            const member = row.user;
            const link = row.membership;
            const isSelf = member.clerkUserId === currentClerkUser?.id;
            const isRemoving = removingId === member.clerkUserId;
            return (
              <MemberRow
                key={link._id}
                member={member}
                link={link}
                locations={locations}
                isMultiLocation={isMultiLocation}
                isSelf={isSelf}
                isRemoving={isRemoving}
                canRemove={Boolean(organization)}
                onRemove={() =>
                  setConfirmTarget({
                    clerkUserId: member.clerkUserId,
                    displayName: nameOrEmail(member),
                  })
                }
              />
            );
          })}
        </ul>
      )}

      {removeError && (
        <p className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {removeError}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowInactive((value) => !value)}
        className="block w-full rounded-b-xl bg-zinc-50 px-6 py-3 text-center text-xs font-semibold text-orange-600 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-orange-300 dark:hover:bg-zinc-900/70"
      >
        {showInactive
          ? "Hide inactive members"
          : hiddenInactiveCount === null
            ? "View inactive members"
            : hiddenInactiveCount === 0
              ? "No inactive members"
              : `View ${hiddenInactiveCount} more inactive member${hiddenInactiveCount === 1 ? "" : "s"}`}
      </button>

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Remove member?"
        description={
          confirmTarget && (
            <>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {confirmTarget.displayName}
              </span>{" "}
              will lose access to this shop immediately. You can re-invite them
              later.
            </>
          )
        }
        confirmLabel="Remove"
        tone="danger"
        busy={removingId !== null}
        onConfirm={confirmRemove}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
}

function nameOrEmail(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const fullName = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  return fullName || user.email || "Unnamed member";
}

function ListSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-6 py-5">
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="flex flex-col gap-px bg-zinc-100 dark:bg-zinc-900">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-16 bg-white dark:bg-zinc-950"
          />
        ))}
      </div>
    </div>
  );
}
