"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Clock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  WeeklyTimelineEditor,
  type WeeklyRange,
} from "@/components/availability/WeeklyTimelineEditor";

/**
 * Shop operating-hours editor for the locations settings page. These are the
 * hours new groomers inherit by default; each groomer can still adjust their
 * own from /availability. Admin / superAdmin only (the mutation enforces it).
 *
 * Single-location shops edit the one location's hours directly; multi-location
 * shops get a small picker to choose which location's hours to edit.
 */
export function LocationHoursSection({
  locations,
}: {
  locations: ReadonlyArray<Doc<"locations">>;
}) {
  const [selectedId, setSelectedId] = useState<Id<"locations"> | null>(
    locations[0]?._id ?? null,
  );
  const locationId = selectedId ?? locations[0]?._id ?? null;

  const hours = useQuery(
    api.locationHours.getLocationHours,
    locationId ? { locationId } : "skip",
  );
  const setHours = useMutation(api.locationHours.setLocationHours);
  const [saving, setSaving] = useState(false);

  const ranges = useMemo<WeeklyRange[]>(
    () =>
      (hours ?? []).map(({ weekday, startMin, endMin }) => ({
        weekday,
        startMin,
        endMin,
      })),
    [hours],
  );

  if (locations.length === 0 || !locationId) return null;

  return (
    <section className="mt-10">
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <Clock size={14} className="text-orange-600" />
        Operating hours
      </header>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Your shop&apos;s default working hours. New team members start with
        these, and each can fine-tune their own from their availability page.
      </p>

      {locations.length > 1 && (
        <label className="mb-4 flex max-w-xs flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Location
          </span>
          <select
            value={locationId}
            onChange={(event) =>
              setSelectedId(event.target.value as Id<"locations">)
            }
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {locations.map((location) => (
              <option key={location._id} value={location._id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {hours === undefined ? (
        <div className="h-150 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      ) : (
        <WeeklyTimelineEditor
          // Re-mount when the location changes so the editor's initial grid
          // resets to the newly-selected location's hours.
          key={locationId}
          initialRanges={ranges}
          readOnly={false}
          saving={saving}
          onSave={async (next) => {
            setSaving(true);
            try {
              await setHours({ locationId, ranges: next });
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </section>
  );
}
