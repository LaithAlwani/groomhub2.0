"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

type FormInput = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormInput, string>>;

/**
 * Accepts an organisation invitation via Clerk's legacy SignUpResource API.
 *
 * The new Future API's `signUp.ticket()` does *not* populate the invited
 * email address from organisation-invitation tickets (the JWT only carries
 * `oid`/`sid` — the email lives on the server-side invitation record).
 *
 * The legacy `signUp.create({ strategy: "ticket", ticket })` flow does the
 * lookup automatically: it populates `emailAddress`, marks it verified, and
 * applies the role + org membership on `setActive`. Well-documented, stable
 * across Clerk versions, and still fully supported in Clerk 7.
 *
 * Flow:
 *   1. `signUp.create({ strategy: "ticket", ticket })` — invitation context applied
 *   2. `signUp.update({ firstName, lastName })` — add the user's name
 *   3. `clerk.setActive({ session: signUp.createdSessionId })` — activate
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
  const clerk = useClerk();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!clerk.client) return;

    const legacySignUp = clerk.client.signUp;
    setSubmitting(true);
    try {
      // 1) Apply the ticket. Legacy API auto-attaches the invited email.
      await legacySignUp.create({
        strategy: "ticket",
        ticket: invitationTicket,
      });

      // 2) Provide the names. Required by Clerk's User & Authentication config.
      await legacySignUp.update({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });

      // 3) If everything's in order, activate the session.
      const sessionId = legacySignUp.createdSessionId;
      if (sessionId) {
        await clerk.setActive({ session: sessionId });
        onAccepted();
        return;
      }

      // No session — surface what Clerk thinks is still missing.
      setDiagnostic(
        `status=${legacySignUp.status ?? "unknown"}; missing=[${(legacySignUp.missingFields ?? []).join(", ") || "none"}]; unverified=[${(legacySignUp.unverifiedFields ?? []).join(", ") || "none"}]`,
      );
      setServerError(
        "Sign-up didn't finish. See the detail below for what's still needed.",
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
        disabled={isBusy || !clerk.client}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isBusy ? "Joining…" : "Join shop"}
      </button>
    </form>
  );
}
