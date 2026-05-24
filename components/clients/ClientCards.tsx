"use client";

import Link from "next/link";
import { CalendarPlus, Mail, Phone } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatPhone } from "@/lib/phone";
import { ClientPetPills } from "./ClientPetPills";
import { ClientRowAvatar } from "./ClientRowAvatar";
import { ClientStatusPill } from "./ClientStatusPill";
import type { ClientRow } from "./ClientsTable";

/**
 * Mobile view of the clients list. One card per client; visible below `md`
 * (the desktop table takes over above that breakpoint).
 */
export function ClientCards({
  rows,
  onBook,
}: {
  rows: ReadonlyArray<ClientRow>;
  onBook: (clientId: Doc<"clients">["_id"]) => void;
}) {
  return (
    <ul className="flex flex-col gap-4 md:hidden">
      {rows.map((row) => (
        <ClientCard key={row.client._id} row={row} onBook={onBook} />
      ))}
    </ul>
  );
}

function ClientCard({
  row,
  onBook,
}: {
  row: ClientRow;
  onBook: (clientId: Doc<"clients">["_id"]) => void;
}) {
  const { client, pets, lastAppointment } = row;
  const memberSince = new Date(client._creationTime).getFullYear();
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/clients/${client._id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ClientRowAvatar client={client} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[#00273c] dark:text-zinc-50">
              {client.fullName}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Member since {memberSince}
            </p>
          </div>
        </Link>
        <ClientStatusPill status={lastAppointment?.status} />
      </div>

      <div className="mt-4 flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
        {client.phone && (
          <span className="inline-flex items-center gap-2">
            <Phone size={14} className="text-zinc-400" aria-hidden />
            {formatPhone(client.phone)}
          </span>
        )}
        {client.email && (
          <span className="inline-flex items-center gap-2 truncate">
            <Mail size={14} className="text-zinc-400" aria-hidden />
            <span className="truncate">{client.email}</span>
          </span>
        )}
        {!client.phone && !client.email && (
          <span className="italic text-zinc-400 dark:text-zinc-500">
            No contact info
          </span>
        )}
      </div>

      <div className="mt-4">
        <ClientPetPills pets={pets} />
      </div>

      <button
        type="button"
        onClick={() => onBook(client._id)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00273c] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#013a58]"
      >
        <CalendarPlus size={14} />
        Book
      </button>
    </li>
  );
}
