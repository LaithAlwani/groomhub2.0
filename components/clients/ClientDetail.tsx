"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPhone } from "@/lib/phone";
import { ClientFormDialog } from "./ClientFormDialog";
import { PetList } from "@/components/pets/PetList";

export function ClientDetail({
  clientId,
  canEdit,
  canArchive,
}: {
  clientId: Id<"clients">;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const client = useQuery(api.clients.get, { id: clientId });
  const archive = useMutation(api.clients.archive);
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (client === undefined) return <DetailSkeleton />;
  if (client === null) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        This client doesn&apos;t exist or you don&apos;t have access to it.
      </p>
    );
  }

  async function handleArchive() {
    setArchiving(true);
    setErrorMessage(null);
    try {
      await archive({ id: clientId });
      setConfirmArchive(false);
      router.push("/clients");
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : "Could not archive",
      );
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {client.fullName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {client.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={14} aria-hidden />
                {formatPhone(client.phone)}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} aria-hidden />
                {client.email}
              </span>
            )}
          </div>
          {hasAddress(client) && (
            <div className="mt-2 inline-flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span className="whitespace-pre-line">{formatAddress(client)}</span>
            </div>
          )}
        </div>
        {(canEdit || canArchive) && (
          <div className="flex shrink-0 gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit client"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <Pencil size={14} />
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                aria-label="Archive client"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      {client.notes && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {client.notes}
        </p>
      )}
      {errorMessage && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}
      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Pets
        </h2>
        <PetList
          clientId={clientId}
          canEdit={canEdit}
          canArchive={canArchive}
        />
      </section>
      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Appointment history
        </h2>
        <p className="mt-2 rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Coming in Phase 5.
        </p>
      </section>

      {editing && (
        <ClientFormDialog clientId={clientId} onClose={() => setEditing(false)} />
      )}
      <ConfirmDialog
        open={confirmArchive}
        title="Archive client?"
        description={
          <>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              &ldquo;{client.fullName}&rdquo;
            </span>{" "}
            and their pets will be hidden from lists. Past appointments stay
            intact and you can restore later.
          </>
        }
        confirmLabel="Archive"
        tone="danger"
        busy={archiving}
        onConfirm={handleArchive}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  );
}

function hasAddress(client: Doc<"clients">): boolean {
  return Boolean(
    client.addressLine1 ||
      client.addressLine2 ||
      client.city ||
      client.state ||
      client.postalCode ||
      client.country,
  );
}

function formatAddress(client: Doc<"clients">): string {
  const lines: string[] = [];
  if (client.addressLine1) lines.push(client.addressLine1);
  if (client.addressLine2) lines.push(client.addressLine2);
  const cityState = [client.city, client.state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, client.postalCode]
    .filter((part) => part && part.length > 0)
    .join(" ");
  if (cityStateZip) lines.push(cityStateZip);
  if (client.country) lines.push(client.country);
  return lines.join("\n");
}

function DetailSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="h-8 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
