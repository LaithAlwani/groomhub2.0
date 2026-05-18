"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useSignUp } from "@clerk/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

type FormInput = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormInput, string>>;

/**
 * Accepts an organisation invitation using Clerk's Future SignUp API.
 *
 * Clerk's Future `signUp.ticket()` doesn't populate the invited email for
 * `organization_invitation` tickets — the email lives only on the server
 * invitation record. We bridge the gap via a Convex action that calls
 * Clerk's Backend API to look up the email, then drive the Future API
 * normally: ticket → update(emailAddress) if needed → finalize.
 */
export function InvitationAcceptForm({
  invitationTicket,
  busy,
  onAccepted,
  onError,
}: {
  invitationTicket: string;
  busy: boolean;
  onAccepted: () => void;
  onError: (message: string) => void;
}) {
  const { signUp } = useSignUp();
  const lookupTicket = useAction(api.invitations.lookupTicket);

  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    lookupTicket({ ticket: invitationTicket })
      .then((info) => {
        if (cancelled) return;
        if (info?.email) setInvitedEmail(info.email);
      })
      .catch(() => {
        // Non-fatal — the form still works, the user just won't see their
        // email pre-displayed. The actual sign-up uses the ticket.
      });
    return () => {
      cancelled = true;
    };
  }, [invitationTicket, lookupTicket]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setDiagnostic(null);

    const parsed = schema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] as keyof FieldErrors;
        if (!nextErrors[fieldName]) nextErrors[fieldName] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    if (!signUp) return;

    setSubmitting(true);
    try {
      // Future API's `create({strategy:"ticket", ticket})` auto-verifies the
      // invited email server-side, so we skip the separate `signUp.ticket()`
      // → `signUp.update()` dance which leaves the email unverified.
      //
      // Clerk 7's published types omit the `ticket` field on
      // `SignUpFutureCreateParams`, but the runtime requires it
      // ("`ticket` is required when `strategy` is `ticket`."). Casting to
      // include it until the types catch up.
      type SignUpCreateParams = Parameters<typeof signUp.create>[0];
      const createResult = await signUp.create({
        strategy: "ticket",
        ticket: invitationTicket,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      } as SignUpCreateParams);
      if (createResult.error) {
        const message =
          createResult.error.message ?? "Could not accept the invitation";
        setServerError(message);
        onError(message);
        return;
      }

      if (signUp.createdSessionId) {
        const finalizeResult = await signUp.finalize({
          navigate: () => undefined,
        });
        if (finalizeResult.error) {
          const message =
            finalizeResult.error.message ?? "Could not finish sign-up";
          setServerError(message);
          onError(message);
          return;
        }
        onAccepted();
        return;
      }

      setDiagnostic(
        `status=${signUp.status ?? "unknown"}; missing=[${(signUp.missingFields ?? []).join(", ") || "none"}]; unverified=[${(signUp.unverifiedFields ?? []).join(", ") || "none"}]`,
      );
      setServerError(
        "Sign-up didn't finish. The detail below tells us exactly what's still required.",
      );
      onError("Sign-up didn't finish.");
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Could not accept the invitation";
      setServerError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = busy || submitting;

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      {invitedEmail && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Joining as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {invitedEmail}
          </span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          value={firstName}
          onChange={setFirstName}
          error={fieldErrors.firstName}
          autoComplete="given-name"
        />
        <Field
          label="Last name"
          value={lastName}
          onChange={setLastName}
          error={fieldErrors.lastName}
          autoComplete="family-name"
        />
      </div>
      <div id="clerk-captcha" />
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      {diagnostic && (
        <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {diagnostic}
        </pre>
      )}
      <button
        type="submit"
        disabled={isBusy || !signUp}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isBusy ? "Joining…" : "Join shop"}
      </button>
    </form>
  );
}
