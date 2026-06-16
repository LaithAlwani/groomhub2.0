"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { ClientPicker } from "./ClientPicker";
import { PetPicker } from "./PetPicker";
import { SchedulingFields, type AppointmentStatus } from "./SchedulingFields";
import { useBookingInlineCreate } from "./useBookingInlineCreate";

export type { AppointmentStatus };

export type AppointmentFormState = {
  clientId: Id<"clients"> | null;
  petId: Id<"pets"> | null;
  serviceId: Id<"services"> | null;
  staffId: Id<"memberships"> | null;
  date: string;
  time: string;
  notes: string;
};

export type AppointmentFormErrors = Partial<
  Record<keyof AppointmentFormState, string>
>;

export function AppointmentFormFields({
  state,
  errors,
  isEdit,
  lockedClient,
  lockedStaff,
  editingAppointmentId,
  onChange,
}: {
  state: AppointmentFormState;
  errors: AppointmentFormErrors;
  isEdit: boolean;
  lockedClient: boolean;
  lockedStaff: boolean;
  // The appointment being edited (omit for new bookings) — excluded from the
  // booked-slot conflict set so its own time stays selectable.
  editingAppointmentId?: Id<"appointments">;
  onChange: <K extends keyof AppointmentFormState>(
    key: K,
    value: AppointmentFormState[K],
  ) => void;
}) {
  const services = useQuery(api.services.list, {});
  // Drives the availability-aware time picker — only start times that leave room
  // for the service before the slot ends are offered.
  const serviceDurationMin =
    services?.find((service) => service._id === state.serviceId)?.durationMin ??
    null;

  // Inline client/pet creation so a brand-new shop can book without leaving the
  // dialog. Only offered when creating (not editing an existing appointment).
  const inlineCreate = useBookingInlineCreate({
    clientId: state.clientId,
    onClientCreated: (id) => {
      onChange("clientId", id);
      onChange("petId", null);
    },
    onPetCreated: (id) => onChange("petId", id),
  });
  const canInlineCreate = !isEdit;

  return (
    <>
      {lockedClient ? (
        <ClientNameDisplay clientId={state.clientId} />
      ) : (
        <ClientPicker
          value={state.clientId}
          onChange={(id) => {
            onChange("clientId", id);
            onChange("petId", null);
          }}
          disabled={isEdit}
          onCreateNew={canInlineCreate ? inlineCreate.openCreateClient : undefined}
        />
      )}
      <PetPicker
        clientId={state.clientId}
        value={state.petId}
        onChange={(id) => onChange("petId", id)}
        disabled={!state.clientId || isEdit}
        onCreateNew={canInlineCreate ? inlineCreate.openCreatePet : undefined}
        error={errors.petId}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Service
          <RequiredMark />
        </span>
        <select
          value={state.serviceId ?? ""}
          onChange={(event) =>
            onChange("serviceId", event.target.value as Id<"services">)
          }
          disabled={isEdit}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="" disabled>
            {services === undefined ? "Loading…" : "Choose a service"}
          </option>
          {services?.map((service) => (
            <option key={service._id} value={service._id}>
              {service.name} · {service.durationMin} min
            </option>
          ))}
        </select>
      </label>
      <SchedulingFields
        staffId={state.staffId}
        date={state.date}
        time={state.time}
        notes={state.notes}
        isEdit={isEdit}
        lockedStaff={lockedStaff}
        serviceDurationMin={serviceDurationMin}
        excludeAppointmentId={editingAppointmentId}
        onChangeStaff={(value) => onChange("staffId", value)}
        onChangeDate={(value) => onChange("date", value)}
        onChangeTime={(value) => onChange("time", value)}
        onChangeNotes={(value) => onChange("notes", value)}
      />
      {inlineCreate.dialogs}
    </>
  );
}

function ClientNameDisplay({ clientId }: { clientId: Id<"clients"> | null }) {
  const client = useQuery(api.clients.get, clientId ? { id: clientId } : "skip");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Client
        <RequiredMark />
      </span>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {client?.fullName ?? "Loading…"}
      </div>
    </div>
  );
}
