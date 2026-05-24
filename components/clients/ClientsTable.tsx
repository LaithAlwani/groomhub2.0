"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronRight, Mail, Phone } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatPhone } from "@/lib/phone";
import { ClientPetPills } from "./ClientPetPills";
import { ClientRowAvatar } from "./ClientRowAvatar";
import { ClientStatusPill } from "./ClientStatusPill";

export type ClientRow = {
  client: Doc<"clients">;
  pets: ReadonlyArray<Doc<"pets">>;
  lastAppointment: {
    startTime: number;
    status: Doc<"appointments">["status"];
  } | null;
};

/**
 * Desktop clients table. Hidden below the `md` breakpoint where `ClientCards`
 * takes over. Status / last-visit columns are powered by the most recent
 * appointment that `clients.listWithPets` joins in.
 */
export function ClientsTable({
  rows,
  onBook,
}: {
  rows: ReadonlyArray<ClientRow>;
  onBook: (clientId: Doc<"clients">["_id"]) => void;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm min-[874px]:block dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full min-w-240 table-fixed text-left">
        <colgroup>
          <col className="w-64" />
          <col className="w-64" />
          <col className="w-72" />
          <col className="w-32" />
          <col className="w-32" />
          <col className="w-40" />
        </colgroup>
        <thead className="bg-[#00273c] text-white">
          <tr>
            <Th>Client Name</Th>
            <Th>Contact Details</Th>
            <Th>Pet(s)</Th>
            <Th>Last Visit</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => (
            <ClientTableRow key={row.client._id} row={row} onBook={onBook} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`truncate px-6 py-4 text-xs font-semibold uppercase tracking-wider ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function ClientTableRow({
  row,
  onBook,
}: {
  row: ClientRow;
  onBook: (clientId: Doc<"clients">["_id"]) => void;
}) {
  const { client, pets, lastAppointment } = row;
  const memberSince = new Date(client._creationTime).getFullYear();
  const router = useRouter();
  const href = `/clients/${client._id}`;

  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer bg-white align-middle transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/60"
    >
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <ClientRowAvatar client={client} />
          <div className="min-w-0">
            <Link
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-sm font-semibold text-[#00273c] hover:underline dark:text-zinc-50"
            >
              {client.fullName}
            </Link>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Member since {memberSince}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5 text-sm">
        <div className="flex flex-col gap-1.5 text-zinc-700 dark:text-zinc-200">
          {client.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone size={12} className="text-zinc-400" aria-hidden />
              {formatPhone(client.phone)}
            </span>
          )}
          {client.email && (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Mail size={12} className="text-zinc-400" aria-hidden />
              <span className="truncate">{client.email}</span>
            </span>
          )}
          {!client.phone && !client.email && (
            <span className="italic text-zinc-400 dark:text-zinc-500">
              No contact info
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-5">
        <ClientPetPills pets={pets} />
      </td>
      <td className="px-6 py-5 text-sm text-zinc-700 dark:text-zinc-200">
        {lastAppointment ? formatDate(lastAppointment.startTime) : "—"}
      </td>
      <td className="px-6 py-5">
        <ClientStatusPill status={lastAppointment?.status} />
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBook(client._id);
            }}
            aria-label={`Book appointment for ${client.fullName}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00273c] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#013a58]"
          >
            <CalendarPlus size={12} />
            Book
          </button>
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open ${client.fullName}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-[#00273c] dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
