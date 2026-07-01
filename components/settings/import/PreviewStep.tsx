"use client";

import { ArrowLeft, PawPrint, History } from "lucide-react";
import type { ClientImport } from "@/lib/import/parseImport";
import { formatPhone } from "@/lib/phone";

/**
 * Step 2 — show the first handful of parsed clients so the user can eyeball
 * that the file mapped correctly (contact details, pets, and legacy
 * appointment history), then save the whole set to the database.
 */
const PREVIEW_LIMIT = 8;
// Cap legacy appointments shown per client card so heavy-history clients
// (some have 20+) don't blow up the preview. The full set is still imported.
const LEGACY_LIMIT = 5;
// Size of the "test import" — save just the first N clients to sanity-check
// the whole pipeline against a real database without committing thousands.
const TEST_LIMIT = 50;

export function PreviewStep({
  clients,
  onBack,
  onContinue,
}: {
  clients: ClientImport[];
  onBack: () => void;
  onContinue: (limit?: number) => void;
}) {
  const preview = clients.slice(0, PREVIEW_LIMIT);
  const petCount = clients.reduce((sum, client) => sum + client.pets.length, 0);
  const legacyCount = clients.reduce(
    (sum, client) => sum + client.legacyAppointments.length,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <Tile label="Clients" value={clients.length} />
        <Tile label="Pets" value={petCount} />
        <Tile label="Legacy appointments" value={legacyCount} />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Showing the first {preview.length} of {clients.length} client
          {clients.length === 1 ? "" : "s"}
        </p>
        {preview.map((client, index) => (
          <ClientCard key={index} client={client} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <ArrowLeft size={14} />
          Choose a different file
        </button>
        <div className="flex flex-wrap items-center gap-3">
          {clients.length > TEST_LIMIT && (
            <button
              type="button"
              onClick={() => onContinue(TEST_LIMIT)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#00273c] px-4 py-2 text-sm font-medium text-[#00273c] transition-colors hover:bg-[#00273c]/5 dark:border-orange-300 dark:text-orange-200 dark:hover:bg-orange-950/20"
            >
              Save first {TEST_LIMIT} only (test)
            </button>
          )}
          <button
            type="button"
            onClick={() => onContinue()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00273c] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#013a58]"
          >
            Save {clients.length === 1 ? "1 client" : `all ${clients.length} clients`}{" "}
            to database
          </button>
        </div>
      </div>
    </div>
  );
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}

function ClientCard({ client }: { client: ClientImport }) {
  const contact = [
    client.email,
    client.phone ? formatPhone(client.phone) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {client.fullName || (
            <span className="italic text-red-500">Missing name</span>
          )}
        </p>
        {contact && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{contact}</p>
        )}
      </div>

      {client.pets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {client.pets.map((pet, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"
            >
              <PawPrint size={12} className="shrink-0 text-zinc-400" />
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                {pet.name}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {[pet.species, pet.breed].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {client.legacyAppointments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          {client.legacyAppointments.slice(0, LEGACY_LIMIT).map((legacy, index) => {
            const heading =
              [
                legacy.dateLabel,
                legacy.serviceName,
                legacy.petName,
                legacy.priceLabel,
              ]
                .filter(Boolean)
                .join(" · ") || "Past appointment";
            return (
              <li key={index} className="flex items-start gap-2 text-xs">
                <History
                  size={12}
                  className="mt-0.5 shrink-0 text-orange-500"
                />
                <div className="min-w-0">
                  <p className="text-orange-600 dark:text-orange-300">
                    {heading}
                  </p>
                  {legacy.notes && (
                    <p className="mt-0.5 whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                      {truncate(legacy.notes, 220)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {client.legacyAppointments.length > LEGACY_LIMIT && (
            <li className="pl-5 text-xs text-zinc-400 dark:text-zinc-500">
              + {client.legacyAppointments.length - LEGACY_LIMIT} more
              appointment
              {client.legacyAppointments.length - LEGACY_LIMIT === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
