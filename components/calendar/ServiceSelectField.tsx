"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";

/**
 * Service picker shared by the full booking dialog and the minimal
 * "Log a visit" form. Loads the org's active services and renders them with
 * their duration so the person entering the visit sees what they're picking.
 */
export function ServiceSelectField({
  value,
  onChange,
  disabled,
}: {
  value: Id<"services"> | null;
  onChange: (id: Id<"services">) => void;
  disabled?: boolean;
}) {
  const services = useQuery(api.services.list, {});
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Service
        <RequiredMark />
      </span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value as Id<"services">)}
        disabled={disabled}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <option value="" disabled>
          {services === undefined ? "Loading…" : "Choose a service"}
        </option>
        {services?.map((service) => (
          <option key={service._id} value={service._id}>
            {service.name} · {service.durationMin} min
          </option>
        ))}
      </select>
    </label>
  );
}
