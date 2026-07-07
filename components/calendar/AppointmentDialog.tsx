"use client";

import { PhoneCall } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogShell } from "@/components/ui/DialogShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatPhone } from "@/lib/phone";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
    isDirty,
    handleSubmit,
    transitionStatus,
  } = useAppointmentDialog(props);

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
              {showCallPrompt && (
                <Banner icon={<PhoneCall size={14} aria-hidden />}>
                  <strong>{selectedClient!.fullName}</strong> has no email on
                  file.
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
                {isEdit && existing && (
                  <Link
                    href={`/appointments/${existing._id}`}
                    className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-blue-700 transition-colors hover:underline dark:text-blue-300"
                  >
                    <ExternalLink size={14} />
                    Open full view (photos &amp; forms)
                  </Link>
                )}
                {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
                <AppointmentDialogFooter
                  isEdit={isEdit}
                  status={existing?.status ?? null}
                  isDirty={isDirty}
                  submitting={submitting}
                  cancelling={cancelling}
                  onClose={props.onClose}
                  onCancelAppointment={() => setConfirmCancel(true)}
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
    </>
  );
}

function Banner({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
