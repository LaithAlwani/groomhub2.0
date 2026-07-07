"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { formatError } from "@/lib/formatError";
import { LogVisitFields, type LogVisitFormState } from "./LogVisitFields";
import { useBookingInlineCreate } from "./useBookingInlineCreate";

/**
 * "Log a service" dialog: client + pet + (optional) service + price + weight +
 * products + notes. Creates a permanent `serviceRecords` entry — NOT an
 * appointment (walk-in / manual history). The acting member is the groomer.
 * A record with no service is a plain note. Photos are added afterward on the
 * record in the Service History list.
 */
export function LogVisitDialog({
  initialClientId,
  initialPetId,
  onClose,
}: {
  initialClientId?: Id<"clients">;
  initialPetId?: Id<"pets">;
  onClose: () => void;
}) {
  const { current: currentLocation } = useCurrentLocation();
  const services = useQuery(api.services.list, {});
  const createRecord = useMutation(api.serviceRecords.create);
  const [state, setState] = useState<LogVisitFormState>({
    clientId: initialClientId ?? null,
    petId: initialPetId ?? null,
    serviceId: null,
    price: "",
    notes: "",
    weight: "",
    products: "",
  });
  const [petError, setPetError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inlineCreate = useBookingInlineCreate({
    clientId: state.clientId,
    onClientCreated: (id) =>
      setState((current) => ({ ...current, clientId: id, petId: null })),
    onPetCreated: (id) => setState((current) => ({ ...current, petId: id })),
  });

  const lockedClient = initialClientId !== undefined;
  const selectedService = services?.find(
    (service) => service._id === state.serviceId,
  );
  const currency =
    selectedService?.currency ?? currentLocation?.currency ?? "USD";

  // Picking a service prefills the price with its list price (dollars).
  function handleService(serviceId: Id<"services">) {
    const service = services?.find((entry) => entry._id === serviceId);
    setState((current) => ({
      ...current,
      serviceId,
      price: service ? (service.priceCents / 100).toFixed(2) : current.price,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setPetError(null);
    if (!state.petId) {
      setPetError(state.clientId ? "Pick a pet" : "Pick a client");
      return;
    }
    let priceCents: number | undefined;
    const priceTrimmed = state.price.trim();
    if (priceTrimmed !== "") {
      const parsed = Number(priceTrimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setServerError("Enter a valid price.");
        return;
      }
      priceCents = Math.round(parsed * 100);
    }
    const weightRaw = (state.weight ?? "").trim();
    const weightNum = Number(weightRaw);
    setSubmitting(true);
    try {
      await createRecord({
        petId: state.petId,
        locationId: currentLocation?._id,
        serviceId: state.serviceId ?? undefined,
        priceCents,
        notes: state.notes || undefined,
        weightLb:
          weightRaw !== "" && Number.isFinite(weightNum) ? weightNum : undefined,
        productsUsed: (state.products ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
      onClose();
    } catch (caught) {
      setServerError(formatError(caught, "Could not log the service."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title="Log a service"
      maxWidth="md"
    >
      <div className="px-5 py-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <LogVisitFields
            state={state}
            lockedClient={lockedClient}
            petError={petError ?? undefined}
            currency={currency}
            onChangeClient={(id) =>
              setState((current) => ({ ...current, clientId: id, petId: null }))
            }
            onChangePet={(id) =>
              setState((current) => ({ ...current, petId: id }))
            }
            onChangeService={handleService}
            onChangePrice={(value) =>
              setState((current) => ({ ...current, price: value }))
            }
            onChangeNotes={(value) =>
              setState((current) => ({ ...current, notes: value }))
            }
            onChangeWeight={(value) =>
              setState((current) => ({ ...current, weight: value }))
            }
            onChangeProducts={(value) =>
              setState((current) => ({ ...current, products: value }))
            }
            openCreateClient={inlineCreate.openCreateClient}
            openCreatePet={inlineCreate.openCreatePet}
          />
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : "Log service"}
            </button>
          </div>
          {inlineCreate.dialogs}
        </form>
      </div>
    </DialogShell>
  );
}
