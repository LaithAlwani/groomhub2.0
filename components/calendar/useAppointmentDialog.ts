"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { formatAppointmentError } from "@/lib/appointmentErrors";
import {
  combineLocalIso,
  isoDateFromDate,
  isoTimeFromDate,
  roundedNow,
} from "@/lib/time";
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
  initialStartTime?: Date;
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

  const create = useMutation(api.appointments.create);
  const reschedule = useMutation(api.appointments.reschedule);
  const updateStatus = useMutation(api.appointments.updateStatus);
  const updateNotes = useMutation(api.appointments.updateNotes);

  const [state, setState] = useState<AppointmentFormState>(() => {
    const start = props.initialStartTime ?? roundedNow();
    return {
      clientId: props.initialClientId ?? null,
      petId: props.initialPetId ?? null,
      serviceId: props.initialServiceId ?? null,
      staffId: props.initialStaffId ?? null,
      date: isoDateFromDate(start),
      time: isoTimeFromDate(start),
      notes: "",
      status: "scheduled",
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
    const start = new Date(existing.startTime);
    const next: AppointmentFormState = {
      clientId: existing.clientId,
      petId: existing.petId,
      serviceId: existing.serviceId,
      staffId: existing.staffId,
      date: isoDateFromDate(start),
      time: isoTimeFromDate(start),
      notes: existing.notes ?? "",
      status: existing.status,
    };
    setState(next);
    setInitialSnapshot(JSON.stringify(next));
  }, [existing]);

  const isDirty = isEdit
    ? initialSnapshot === null || initialSnapshot !== JSON.stringify(state)
    : true;

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
      const startTime = combineLocalIso(state.date, state.time);
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
        if (state.status !== existing.status) {
          await updateStatus({ id: existing._id, status: state.status });
        }
        if ((state.notes || "") !== (existing.notes ?? "")) {
          await updateNotes({
            id: existing._id,
            notes: state.notes || undefined,
          });
        }
      } else {
        await create({
          clientUuid: crypto.randomUUID(),
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
    handleSubmit,
    transitionStatus,
  };
}
