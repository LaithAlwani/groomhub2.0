"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { ClientList } from "@/components/clients/ClientList";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export function ClientsPageBody({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search
            size={16}
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Plus size={14} />
            New client
          </button>
        )}
      </div>
      <ClientList search={debouncedSearch} />
      {creating && (
        <ClientFormDialog
          clientId="new"
          onClose={() => setCreating(false)}
          onSuccess={(id) => router.push(`/clients/${id}`)}
        />
      )}
    </div>
  );
}
