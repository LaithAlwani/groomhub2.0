"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";

/**
 * Read-only client field for flows where the client is already fixed (booking
 * from a client's own page, or logging a visit for them). Shared by the full
 * booking dialog and the minimal "Log a visit" form.
 */
export function ClientNameDisplay({
  clientId,
}: {
  clientId: Id<"clients"> | null;
}) {
  const client = useQuery(api.clients.get, clientId ? { id: clientId } : "skip");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Client
        <RequiredMark />
      </span>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {client?.fullName ?? "Loading…"}
      </div>
    </div>
  );
}
