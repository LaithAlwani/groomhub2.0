"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { LogVisitFields, type LogVisitFormState } from "./LogVisitFields";
import { useBookingInlineCreate } from "./useBookingInlineCreate";

/**
 * Simplified "log a visit"-style editor for an existing appointment. Edits
 * pet / service / price / notes only — the client stays put and date / time /
 * staff / status are untouched (managed elsewhere). Backed by
 * `appointments.editDetails`. Opened from the appointment detail page.
 */
export function EditVisitDialog({
  appointmentId,
  onClose,
}: {
  appointmentId: Id<"appointments">;
  onClose: () => void;
}) {
  const appointment = useQuery(api.appointments.get, { id: appointmentId });
  const services = useQuery(api.services.list, {});
  const editDetails = useMutation(api.appointments.editDetails);
  const { current: currentLocation } = useCurrentLocation();

  const [state, setState] = useState<LogVisitFormState>({
    clientId: null,
    petId: null,
    serviceId: null,
    price: "",
    notes: "",
  });
  const [seededId, setSeededId] = useState<Id<"appointments"> | null>(null);
  const [petError, setPetError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed the form the first time the appointment resolves, adjusting state
  // during render (React's recommended alternative to a hydration effect).
  // Price prefills from the charged total — override if set, else the snapshot.
  if (appointment && seededId !== appointment._id) {
    setSeededId(appointment._id);
    const charged = appointment.totalPriceCents ?? appointment.priceCentsSnapshot;
    setState({
      clientId: appointment.clientId,
      petId: appointment.petId,
      serviceId: appointment.serviceId,
      price: (charged / 100).toFixed(2),
      notes: appointment.notes ?? "",
    });
  }
  const hydrated = seededId !== null;

  const inlineCreate = useBookingInlineCreate({
    clientId: state.clientId,
    onClientCreated: () => {},
    onPetCreated: (id) => setState((current) => ({ ...current, petId: id })),
  });

  const selectedService = services?.find(
    (service) => service._id === state.serviceId,
  );
  const currency =
    selectedService?.currency ?? currentLocation?.currency ?? "USD";

  // Picking a service prefills the price with its list price (dollars), same
  // one-tap behaviour as the log-a-visit form.
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
      setPetError("Pick a pet");
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
    setSubmitting(true);
    try {
      await editDetails({
        id: appointmentId,
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
      title="Edit appointment"
      maxWidth="md"
    >
      <div className="px-5 py-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <LogVisitFields
            state={state}
            lockedClient
            petError={petError ?? undefined}
            currency={currency}
            onChangeClient={() => {}}
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
              disabled={submitting || !hydrated}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
            >
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
          {inlineCreate.dialogs}
        </form>
      </div>
    </DialogShell>
  );
}
