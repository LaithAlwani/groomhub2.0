"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatPhone } from "@/lib/phone";

export function ClientList({ search }: { search: string }) {
  const clients = useQuery(api.clients.list, {
    search: search || undefined,
  });

  if (clients === undefined) return <ListSkeleton />;
  if (clients.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {search
          ? `No clients match “${search}”.`
          : "No clients yet. Add your first one to get started."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {clients.map((client) => (
        <ClientRow key={client._id} client={client} />
      ))}
    </ul>
  );
}

function ClientRow({ client }: { client: Doc<"clients"> }) {
  return (
    <li>
      <Link
        href={`/clients/${client._id}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {client.fullName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {client.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} aria-hidden />
                {formatPhone(client.phone)}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1">
                <Mail size={12} aria-hidden />
                {client.email}
              </span>
            )}
            {!client.phone && !client.email && (
              <span className="italic">No contact info</span>
            )}
          </div>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
