"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { generateClientUuid } from "@/lib/uuid";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { LogVisitFields, type LogVisitFormState } from "./LogVisitFields";
import { useBookingInlineCreate } from "./useBookingInlineCreate";

/**
 * Minimal "Log a visit" dialog for the pilot front desk: client + pet +
 * service + price + notes. The groomer is assumed to be the signed-in member
 * and the visit is recorded as completed *now* server-side
 * (`appointments.logVisit`) — no staff/date/time/status to fill in. The price
 * lands directly on `priceCentsSnapshot`, so opening the appointment later
 * shows the right total with no follow-up edit. The full scheduler still lives
 * in `AppointmentDialog` for the calendar.
 */
export function LogVisitDialog({
  initialClientId,
  onClose,
}: {
  initialClientId?: Id<"clients">;
  onClose: () => void;
}) {
  const { current: currentLocation } = useCurrentLocation();
  const services = useQuery(api.services.list, {});
  const logVisit = useMutation(api.appointments.logVisit);
  const [state, setState] = useState<LogVisitFormState>({
    clientId: initialClientId ?? null,
    petId: null,
    serviceId: null,
    price: "",
    notes: "",
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

  // Picking a service prefills the price with its list price (in dollars) so
  // the common case is one tap; the groomer can still edit it.
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
    if (!state.clientId || !state.petId) {
      setPetError(state.clientId ? "Pick a pet" : "Pick a client");
      return;
    }
    if (!state.serviceId) {
      setServerError("Pick a service.");
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
    if (!currentLocation) {
      setServerError(
        "Pick a location before logging a visit — your shop has no active location yet.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await logVisit({
        clientUuid: generateClientUuid(),
        locationId: currentLocation._id,
        clientId: state.clientId,
        petId: state.petId,
        serviceId: state.serviceId,
        priceCents,
        notes: state.notes || undefined,
      });
      onClose();
    } catch (caught) {
      setServerError(formatAppointmentError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      open
      onClose={onClose}
      busy={submitting}
      title="Log a visit"
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
              setState((current) => ({
                ...current,
                clientId: id,
                petId: null,
              }))
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
              {submitting ? "Saving…" : "Log visit"}
            </button>
          </div>
          {inlineCreate.dialogs}
        </form>
      </div>
    </DialogShell>
  );
}
