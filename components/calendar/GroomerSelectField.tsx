"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Optional name-only groomer picker for the "Log a service" and edit-record
 * forms. Fed by the admin-managed `groomers` list. Renders nothing at all
 * when the shop has no active groomers, so shops that don't use the feature
 * never see an empty dropdown.
 *
 * `currentLabel` covers an old record whose groomer has since been archived:
 * the id isn't in the active list, so we add a disabled option carrying the
 * name rather than letting the native select show blank.
 */
export function GroomerSelectField({
  value,
  onChange,
  currentLabel,
  disabled,
}: {
  value: Id<"groomers"> | null;
  onChange: (id: Id<"groomers"> | null) => void;
  currentLabel?: string;
  disabled?: boolean;
}) {
  const groomers = useQuery(api.groomers.list, {});
  if (groomers !== undefined && groomers.length === 0 && value === null) {
    return null;
  }
  const valueIsActive =
    value !== null && groomers?.some((groomer) => groomer._id === value);
  const showArchivedOption =
    value !== null && groomers !== undefined && !valueIsActive;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Groomer
      </span>
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? null
              : (event.target.value as Id<"groomers">),
          )
        }
        disabled={disabled || groomers === undefined}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value="">
          {groomers === undefined ? "Loading…" : "No groomer"}
        </option>
        {showArchivedOption && (
          <option value={value} disabled>
            {currentLabel ?? "Archived groomer"} (archived)
          </option>
        )}
        {groomers?.map((groomer) => (
          <option key={groomer._id} value={groomer._id}>
            {groomer.name}
          </option>
        ))}
      </select>
    </label>
  );
}
