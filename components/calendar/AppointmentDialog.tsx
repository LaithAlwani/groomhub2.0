"use client";

import { useState } from "react";
import { AlertTriangle, Clock, PhoneCall, X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReassignDialog } from "@/components/dashboard/ReassignDialog";
import { formatPhone } from "@/lib/phone";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { AppointmentFormFields } from "./AppointmentFormFields";
import { AppointmentDialogFooter } from "./AppointmentDialogFooter";
import { AppointmentDialogSkeleton } from "./AppointmentDialogSkeleton";
import {
  useAppointmentDialog,
  type AppointmentDialogProps,
} from "./useAppointmentDialog";

export function AppointmentDialog(props: AppointmentDialogProps) {
  useBodyScrollLock();
  const {
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
  } = useAppointmentDialog(props);
  const canReassign = role === "admin" || role === "superAdmin";
  const [reassignOpen, setReassignOpen] = useState(false);

  const selectedClient = useQuery(
    api.clients.get,
    state.clientId ? { id: state.clientId } : "skip",
  );
  const showCallPrompt =
    selectedClient !== undefined && selectedClient !== null && !selectedClient.email;

  // In edit mode, hold the dialog body until the appointment query resolves
  // so the user doesn't see a flash of empty fields before they hydrate.
  const isLoading = isEdit && existing === undefined;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={submitting || cancelling ? undefined : props.onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? "Edit appointment" : "New appointment"}
          </h2>
          <button
            type="button"
            onClick={() =>
              !(submitting || cancelling) && props.onClose()
            }
            aria-label="Close"
            className="-mt-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} />
          </button>
        </div>
        {isLoading ? (
          <AppointmentDialogSkeleton onClose={props.onClose} />
        ) : (
          <>
            {existing?.status === "pendingApproval" && (
              <Banner tone="amber" icon={<Clock size={14} aria-hidden />}>
                {isAssignedStaff
                  ? "This booking is waiting on your approval. Confirm to send the client a confirmation email, or decline to send it back to admin."
                  : "This booking is waiting on the assigned groomer's approval. You can cancel or reassign it from here."}
              </Banner>
            )}
            {existing?.status === "declined" && canReassign && (
              <Banner tone="red" icon={<AlertTriangle size={14} aria-hidden />}>
                This booking was declined. Reassign it to a different groomer,
                or cancel it entirely. The client hasn&apos;t been notified yet.
              </Banner>
            )}
            {showCallPrompt && (
              <Banner tone="amber" icon={<PhoneCall size={14} aria-hidden />}>
                <strong>{selectedClient!.fullName}</strong> has no email on file.
                {selectedClient!.phone
                  ? ` Please call ${formatPhone(selectedClient!.phone)} to confirm.`
                  : " Please call them to confirm — no phone on file either."}
              </Banner>
            )}
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <AppointmentFormFields
                state={state}
                errors={errors}
                isEdit={isEdit}
                lockedClient={!isEdit && props.initialClientId !== undefined}
                lockedStaff={lockedStaff}
                onChange={setField}
              />
              {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
              <AppointmentDialogFooter
                isEdit={isEdit}
                status={existing?.status ?? null}
                canReassign={canReassign}
                isAssignedStaff={isAssignedStaff}
                isDirty={isDirty}
                submitting={submitting}
                cancelling={cancelling}
                onClose={props.onClose}
                onCancelAppointment={() => setConfirmCancel(true)}
                onApprove={() => transitionStatus("scheduled")}
                onDecline={() => transitionStatus("declined")}
                onReassign={() => setReassignOpen(true)}
              />
            </form>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this appointment?"
        description={
          <>
            The client will get a cancellation email. You can&apos;t undo this,
            but you can always book a fresh appointment afterwards.
          </>
        }
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        tone="danger"
        busy={cancelling}
        onConfirm={() => transitionStatus("cancelled")}
        onCancel={() => setConfirmCancel(false)}
      />
      {reassignOpen && existing && (
        <ReassignDialog
          appointmentId={existing._id}
          petName={existing.petName}
          clientName={existing.clientName}
          previousStaffName={existing.staffName}
          onClose={() => {
            setReassignOpen(false);
            props.onClose();
          }}
        />
      )}
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const className =
    tone === "amber"
      ? "mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
      : "mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200";
  return (
    <div className={className}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

