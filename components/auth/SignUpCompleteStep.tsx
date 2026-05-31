"use client";

import { useEffect, useState } from "react";
import type { useSignUp } from "@clerk/nextjs";
import { User } from "lucide-react";
import { z } from "zod";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthPrimaryButton } from "@/components/auth/AuthPrimaryButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { landingPage } from "@/lib/landingPage";

type SignUpResource = ReturnType<typeof useSignUp>["signUp"];

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

type ProfileInput = z.infer<typeof profileSchema>;
type FieldErrors = Partial<Record<keyof ProfileInput, string>>;

/**
 * Renders only the missing-name fields on a partial sign-up. See header
 * comment in the previous revision for the two flows that feed this step.
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

  const submitLabel = landingPage.auth.completeProfile.submitLabel;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <AuthInput
          label="First Name"
          required
          icon={User}
          value={firstName}
          onChange={setFirstName}
          error={fieldErrors.firstName}
          autoComplete="given-name"
        />
        <AuthInput
          label="Last Name"
          required
          icon={User}
          value={lastName}
          onChange={setLastName}
          error={fieldErrors.lastName}
          autoComplete="family-name"
        />
      </div>
      <div id="clerk-captcha" />
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      <AuthPrimaryButton disabled={busy}>
        {busy ? "Finishing up…" : submitLabel}
      </AuthPrimaryButton>
    </form>
  );
}
