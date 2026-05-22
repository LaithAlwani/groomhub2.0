"use client";

import { useEffect, useState } from "react";
import type { useSignUp } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type SignUpResource = ReturnType<typeof useSignUp>["signUp"];

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

type ProfileInput = z.infer<typeof profileSchema>;
type FieldErrors = Partial<Record<keyof ProfileInput, string>>;

/**
 * Renders only the missing-name fields on a partial sign-up.
 *
 * Two flows feed this step:
 * - OAuth gap (Google profile lacked a last name): `invitationTicket` is null
 *   and we submit via `signUp.update({firstName, lastName})`.
 * - Invitation acceptance: `invitationTicket` is the JWT from the email link.
 *   We re-apply the ticket WITH the names in a single call
 *   (`signUp.ticket({ticket, firstName, lastName})`) so the ticket context
 *   stays attached. A separate `update` after `ticket` has been observed to
 *   drop the invitation on some Clerk versions.
 */
export function SignUpCompleteStep({
  signUp,
  busy,
  invitationTicket,
  onCompleted,
}: {
  signUp: NonNullable<SignUpResource>;
  busy: boolean;
  invitationTicket: string | null;
  onCompleted: () => void;
}) {
  const [firstName, setFirstName] = useState(signUp.firstName ?? "");
  const [lastName, setLastName] = useState(signUp.lastName ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (signUp.firstName) setFirstName(signUp.firstName);
    if (signUp.lastName) setLastName(signUp.lastName);
  }, [signUp.firstName, signUp.lastName]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const parsed = profileSchema.safeParse({ firstName, lastName });
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

    if (invitationTicket) {
      // Re-apply the ticket with the names in one call so the invitation
      // context isn't lost between API hops.
      const ticketResult = await signUp.ticket({
        ticket: invitationTicket,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });
      if (ticketResult.error) {
        setServerError(
          ticketResult.error.message ?? "Could not accept the invitation",
        );
        return;
      }
    } else {
      const updateResult = await signUp.update({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });
      if (updateResult.error) {
        setServerError(updateResult.error.message ?? "Could not save your name");
        return;
      }
    }
    onCompleted();
  }

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
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {busy ? "Finishing up…" : "Continue"}
      </button>
    </form>
  );
}
