"use client";

import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RequiredMark } from "@/components/forms/RequiredMark";
import { ClientPicker } from "./ClientPicker";
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
  status: AppointmentStatus;
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
  const pets = useQuery(
    api.pets.listForClient,
    state.clientId ? { clientId: state.clientId } : "skip",
  );
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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Pet
          <RequiredMark />
        </span>
        <select
          value={state.petId ?? ""}
          onChange={(event) => onChange("petId", event.target.value as Id<"pets">)}
          disabled={!state.clientId || isEdit}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="" disabled>
            {!state.clientId
              ? "Choose a client first"
              : pets === undefined
                ? "Loading…"
                : pets.length === 0
                  ? "No pets on file"
                  : "Choose a pet"}
          </option>
          {pets?.map((pet) => {
            const isDeceased = pet.isDeceased === true;
            const isBanned = pet.isBanned === true;
            // Keep blocked pets visible but disabled so admins editing a
            // historical appointment can still see which pet it was for,
            // while new bookings can't pick a deceased OR banned pet.
            const isBlocked = isDeceased || isBanned;
            const isCurrentSelection = state.petId === pet._id;
            const suffix = isDeceased
              ? " — Deceased"
              : isBanned
                ? " — Banned"
                : "";
            return (
              <option
                key={pet._id}
                value={pet._id}
                disabled={isBlocked && !isCurrentSelection}
              >
                {pet.name} ({pet.species})
                {suffix}
              </option>
            );
          })}
        </select>
        {errors.petId && (
          <span className="text-xs text-red-600 dark:text-red-400">{errors.petId}</span>
        )}
        {canInlineCreate && state.clientId && (
          <button
            type="button"
            onClick={inlineCreate.openCreatePet}
            className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-orange-700 transition-colors hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
          >
            <Plus size={12} aria-hidden />
            New pet
          </button>
        )}
      </label>
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
        status={state.status}
        notes={state.notes}
        isEdit={isEdit}
        lockedStaff={lockedStaff}
        serviceDurationMin={serviceDurationMin}
        excludeAppointmentId={editingAppointmentId}
        onChangeStaff={(value) => onChange("staffId", value)}
        onChangeDate={(value) => onChange("date", value)}
        onChangeTime={(value) => onChange("time", value)}
        onChangeStatus={(value) => onChange("status", value)}
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
