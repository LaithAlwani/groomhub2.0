"use client";

import { useState } from "react";
import { AlertTriangle, Clock, PhoneCall } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ReassignDialog } from "@/components/dashboard/ReassignDialog";
import { formatPhone } from "@/lib/phone";
import { AppointmentFormFields } from "./AppointmentFormFields";
import { AppointmentDialogFooter } from "./AppointmentDialogFooter";
import { AppointmentDialogSkeleton } from "./AppointmentDialogSkeleton";
import {
  useAppointmentDialog,
  type AppointmentDialogProps,
} from "./useAppointmentDialog";

export function AppointmentDialog(props: AppointmentDialogProps) {
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
    <>
      <DialogShell
        open
        onClose={props.onClose}
        busy={submitting || cancelling}
        title={isEdit ? "Edit appointment" : "New appointment"}
        maxWidth="lg"
      >
        <div className="px-5 py-5">
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
                editingAppointmentId={isEdit ? existing?._id : undefined}
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
      </DialogShell>
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
    </>
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

