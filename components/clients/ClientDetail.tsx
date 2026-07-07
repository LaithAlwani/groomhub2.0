"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPhone } from "@/lib/phone";
import { ClientFormDialog } from "./ClientFormDialog";
import { ClientAppointmentsSection } from "./ClientAppointmentsSection";
import { ClientServiceHistorySection } from "./ClientServiceHistorySection";
import { ClientConsentSection } from "./ClientConsentSection";
import { PetList } from "@/components/pets/PetList";

/**
 * Client profile view. One soft-tinted page background with two stacked
 * cards: the header card (identity + contact + address) on top and then the
 * Pets / Appointment history sections rendered as their own cards by
 * `PetList` / `ClientAppointmentsSection`. Sidebar + topbar untouched.
 */
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
        formatError(caught, "Could not archive"),
      );
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  const memberSince = new Date(client._creationTime).getFullYear();
  const showAddress = hasAddress(client);

  return (
    <>
      <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white via-orange-50/30 to-orange-100/40 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-orange-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {client.fullName}
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Member since {memberSince}
            </p>
          </div>
          {(canEdit || canArchive) && (
            <div className="flex shrink-0 gap-1">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Edit client"
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/60 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                >
                  <Pencil size={14} />
                </button>
              )}
              {canArchive && (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  aria-label="Archive client"
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/60 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {client.phone && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <Phone size={12} className="text-zinc-400" aria-hidden />
              {formatPhone(client.phone)}
            </span>
          )}
          {(client.altPhones ?? []).map((alt) => (
            <span
              key={alt}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
            >
              <Phone size={12} className="text-zinc-400" aria-hidden />
              {formatPhone(alt)}
            </span>
          ))}
          {client.email && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <Mail size={12} className="text-zinc-400" aria-hidden />
              {client.email}
            </span>
          )}
        </div>
        {showAddress && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300"
            >
              <MapPin size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Address Details
              </p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-zinc-600 dark:text-zinc-400">
                {formatAddress(client)}
              </p>
            </div>
          </div>
        )}
        {client.notes && (
          <p className="mt-4 whitespace-pre-line rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
            {client.notes}
          </p>
        )}
      </section>
      {errorMessage && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </p>
      )}

      <PetList clientId={clientId} canEdit={canEdit} canArchive={canArchive} />
      <ClientServiceHistorySection
        clientId={clientId}
        canEditLegacy={canArchive}
      />
      <ClientAppointmentsSection clientId={clientId} />
      <ClientConsentSection clientId={clientId} />

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
      <div className="h-32 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
