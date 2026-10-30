"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { formatError } from "@/lib/formatError";
import { todayIsoDate } from "@/lib/time";
import { ServiceRecordPhotoStage } from "@/components/serviceRecords/ServiceRecordPhotoStage";
import { buildServiceRecordPayload } from "./buildServiceRecordPayload";
import { LogVisitFields, type LogVisitFormState } from "./LogVisitFields";
import { useBookingInlineCreate } from "./useBookingInlineCreate";

/**
 * "Log a service" dialog: client + pet + (optional) service + groomer + price
 * + weight + products + notes. Creates a permanent `serviceRecords` entry —
 * NOT an appointment (walk-in / manual history). The acting member is recorded
 * as `staffId`; the optional groomer dropdown attributes the work to a
 * name-only groomer from the Staff page list. A record with no service is a
 * plain note. Photos can be staged before saving.
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
    date: todayIsoDate(),
    weight: "",
    products: "",
    groomerId: null,
  });
  const [beforeIds, setBeforeIds] = useState<Id<"_storage">[]>([]);
  const [afterIds, setAfterIds] = useState<Id<"_storage">[]>([]);
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

  // Pick a service but leave the price field alone — groomers routinely
  // charge a different amount, and clearing a prefilled value every time is
  // annoying. An empty price still records the service's list price (the
  // backend snapshots it when priceCents is omitted).
  function handleService(serviceId: Id<"services">) {
    setState((current) => ({ ...current, serviceId }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setPetError(null);
    if (!state.petId) {
      setPetError(state.clientId ? "Pick a pet" : "Pick a client");
      return;
    }
    let payload;
    try {
      payload = buildServiceRecordPayload({
        state,
        petId: state.petId,
        locationId: currentLocation?._id,
        beforeIds,
        afterIds,
      });
    } catch (caught) {
      setServerError((caught as Error).message);
      return;
    }
    setSubmitting(true);
    try {
      await createRecord(payload);
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
            onChangeDate={(value) =>
              setState((current) => ({ ...current, date: value }))
            }
            onChangeWeight={(value) =>
              setState((current) => ({ ...current, weight: value }))
            }
            onChangeProducts={(value) =>
              setState((current) => ({ ...current, products: value }))
            }
            onChangeGroomer={(groomerId) =>
              setState((current) => ({ ...current, groomerId }))
            }
            openCreateClient={inlineCreate.openCreateClient}
            openCreatePet={inlineCreate.openCreatePet}
          />
          <ServiceRecordPhotoStage
            beforeIds={beforeIds}
            afterIds={afterIds}
            onChangeBefore={setBeforeIds}
            onChangeAfter={setAfterIds}
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
