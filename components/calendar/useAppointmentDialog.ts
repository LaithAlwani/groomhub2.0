"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import { useCurrentLocation } from "@/lib/useCurrentLocation";
import { generateClientUuid } from "@/lib/uuid";
import {
  combineDateTimeInTimezone,
  isoDateInTimezone,
  isoTimeInTimezone,
  roundedNowInTimezone,
  zonedPseudoDateToUtc,
} from "@/lib/locationTime";
import type {
  AppointmentFormErrors,
  AppointmentFormState,
} from "./AppointmentFormFields";

const REQUIRED_FIELDS: ReadonlyArray<[keyof AppointmentFormState, string]> = [
  ["clientId", "Pick a client"],
  ["petId", "Pick a pet"],
  ["serviceId", "Pick a service"],
  ["staffId", "Pick a groomer"],
  ["date", "Pick a date"],
  ["time", "Pick a time"],
];

export type AppointmentDialogProps = {
  appointmentId: Id<"appointments"> | "new";
  initialClientId?: Id<"clients">;
  initialPetId?: Id<"pets">;
  initialServiceId?: Id<"services">;
  initialStaffId?: Id<"memberships">;
  /**
   * Initial start time for a new booking. Can be a pseudo-Date in the
   * location's timezone (calendar-originated clicks already pass these) or a
   * real Date — the dialog converts to UTC ms using `locationTimezone` before
   * surfacing date/time strings.
   */
  initialStartTime?: Date;
  /**
   * IANA timezone for the active location. The dialog interprets all
   * date/time strings in this zone when building the UTC ms timestamps sent
   * to the backend, so a viewer in another timezone still books on the
   * shop's clock.
   */
  locationTimezone: string;
  onClose: () => void;
};

export function useAppointmentDialog(props: AppointmentDialogProps) {
  const isEdit = props.appointmentId !== "new";
  const existing = useQuery(
    api.appointments.get,
    isEdit ? { id: props.appointmentId as Id<"appointments"> } : "skip",
  );
  const me = useQuery(api.users.me);
  const { membership: clerkMembership } = useOrganization();
  const role = mapClerkOrgRole(clerkMembership?.role ?? null);
  const lockedStaff = role === "staff";
  const { current: currentLocation } = useCurrentLocation();

  const create = useMutation(api.appointments.create);
  const reschedule = useMutation(api.appointments.reschedule);
  const updateStatus = useMutation(api.appointments.updateStatus);
  const updateNotes = useMutation(api.appointments.updateNotes);

  const [state, setState] = useState<AppointmentFormState>(() => {
    // `initialStartTime` is a pseudo-Date in `locationTimezone` (calendar
    // clicks already build them that way; the FAB / sidebar paths produce
    // them via `roundedNowInTimezone`). Reinterpret as a UTC ms in that TZ
    // so we can re-extract the wall-clock date/time strings.
    const startPseudo =
      props.initialStartTime ??
      roundedNowInTimezone(props.locationTimezone);
    const startUtc = zonedPseudoDateToUtc(startPseudo, props.locationTimezone);
    return {
      clientId: props.initialClientId ?? null,
      petId: props.initialPetId ?? null,
      serviceId: props.initialServiceId ?? null,
      staffId: props.initialStaffId ?? null,
      date: isoDateInTimezone(startUtc, props.locationTimezone),
      time: isoTimeInTimezone(startUtc, props.locationTimezone),
      notes: "",
    };
  });
  const [errors, setErrors] = useState<AppointmentFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit || !lockedStaff || !me?.membership || state.staffId) return;
    setState((current) => ({ ...current, staffId: me.membership._id }));
  }, [isEdit, lockedStaff, me, state.staffId]);

  useEffect(() => {
    if (!existing) return;
    const next: AppointmentFormState = {
      clientId: existing.clientId,
      petId: existing.petId,
      serviceId: existing.serviceId,
      staffId: existing.staffId,
      // Existing appointments store `startTime` as UTC ms — extract the
      // wall-clock in the location TZ so the picker shows the shop's time,
      // not the viewer's.
      date: isoDateInTimezone(existing.startTime, props.locationTimezone),
      time: isoTimeInTimezone(existing.startTime, props.locationTimezone),
      notes: existing.notes ?? "",
    };
    setState(next);
    setInitialSnapshot(JSON.stringify(next));
  }, [existing, props.locationTimezone]);

  const isDirty = isEdit
    ? initialSnapshot === null || initialSnapshot !== JSON.stringify(state)
    : true;

  // Only the assigned groomer can Approve / Decline a pending appointment —
  // admins acting on someone else's row use Cancel / Reassign instead. This
  // mirrors the server-side guard in `appointments.updateStatus`.
  const isAssignedStaff = Boolean(
    existing && me?.membership && existing.staffId === me.membership._id,
  );

  function setField<K extends keyof AppointmentFormState>(
    key: K,
    value: AppointmentFormState[K],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next: AppointmentFormErrors = {};
    for (const [key, message] of REQUIRED_FIELDS) {
      if (!state[key]) next[key] = message;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const startTime = combineDateTimeInTimezone(
        state.date,
        state.time,
        props.locationTimezone,
      );
      if (isEdit && existing) {
        if (
          startTime !== existing.startTime ||
          state.staffId !== existing.staffId
        ) {
          await reschedule({
            id: existing._id,
            startTime,
            staffId: state.staffId ?? undefined,
          });
        }
        if ((state.notes || "") !== (existing.notes ?? "")) {
          await updateNotes({
            id: existing._id,
            notes: state.notes || undefined,
          });
        }
      } else {
        if (!currentLocation) {
          setServerError(
            "Pick a location before booking — your shop has no active location yet.",
          );
          return;
        }
        await create({
          clientUuid: generateClientUuid(),
          locationId: currentLocation._id,
          clientId: state.clientId!,
          petId: state.petId!,
          serviceId: state.serviceId!,
          staffId: state.staffId!,
          startTime,
          notes: state.notes || undefined,
        });
      }
      props.onClose();
    } catch (caught) {
      setServerError(formatAppointmentError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function transitionStatus(
    status: "scheduled" | "cancelled" | "declined",
  ) {
    if (!existing) return;
    setServerError(null);
    setCancelling(true);
    try {
      await updateStatus({ id: existing._id, status });
      setConfirmCancel(false);
      props.onClose();
    } catch (caught) {
      setServerError(formatAppointmentError(caught));
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  }

  return {
    isEdit,
    existing,
    state,
    setField,
    errors,
    serverError,
    submitting,
    cancelling,
    confirmCancel,
    setConfirmCancel,
    lockedStaff,
    role,
    isDirty,
    isAssignedStaff,
    handleSubmit,
    transitionStatus,
  };
}
