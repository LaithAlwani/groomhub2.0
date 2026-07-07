"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { ClientNameDisplay } from "./ClientNameDisplay";
import { ClientPicker } from "./ClientPicker";
import { PetPicker } from "./PetPicker";
import { ServiceSelectField } from "./ServiceSelectField";

export type LogVisitFormState = {
  clientId: Id<"clients"> | null;
  petId: Id<"pets"> | null;
  serviceId: Id<"services"> | null;
  price: string;
  notes: string;
  // Service-record only (walk-in). Appointments don't carry these.
  weight?: string;
  products?: string;
};

/**
 * Field layout for the "Log a service" form — client, pet, service, price,
 * weight, products, notes. Split out of `LogVisitDialog` to keep each file
 * focused; the dialog owns state, prefill, and submission. Service is optional
 * (a record with none is a plain note).
 */
export function LogVisitFields({
  state,
  lockedClient,
  petError,
  currency,
  onChangeClient,
  onChangePet,
  onChangeService,
  onChangePrice,
  onChangeNotes,
  onChangeWeight,
  onChangeProducts,
  openCreateClient,
  openCreatePet,
}: {
  state: LogVisitFormState;
  lockedClient: boolean;
  petError?: string;
  currency: string;
  onChangeClient: (id: Id<"clients">) => void;
  onChangePet: (id: Id<"pets">) => void;
  onChangeService: (id: Id<"services">) => void;
  onChangePrice: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onChangeWeight?: (value: string) => void;
  onChangeProducts?: (value: string) => void;
  openCreateClient: () => void;
  openCreatePet: () => void;
}) {
  return (
    <>
      {lockedClient ? (
        <ClientNameDisplay clientId={state.clientId} />
      ) : (
        <ClientPicker
          value={state.clientId}
          onChange={onChangeClient}
          onCreateNew={openCreateClient}
        />
      )}
      <PetPicker
        clientId={state.clientId}
        value={state.petId}
        onChange={onChangePet}
        disabled={!state.clientId}
        onCreateNew={openCreatePet}
        error={petError}
        autoSelectSingle
      />
      <ServiceSelectField value={state.serviceId} onChange={onChangeService} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Price
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {currency}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={state.price}
            onChange={(event) => onChangePrice(event.target.value)}
            placeholder="0.00"
            className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </label>
      {onChangeWeight && onChangeProducts && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Weight (lb)
            </span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={state.weight ?? ""}
              onChange={(event) => onChangeWeight(event.target.value)}
              placeholder="—"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Products used
            </span>
            <input
              type="text"
              value={state.products ?? ""}
              onChange={(event) => onChangeProducts(event.target.value)}
              placeholder="Comma-separated"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Notes
        </span>
        <textarea
          value={state.notes}
          onChange={(event) => onChangeNotes(event.target.value)}
          rows={3}
          placeholder="What was done, how the pet was, anything to remember…"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
    </>
  );
}
