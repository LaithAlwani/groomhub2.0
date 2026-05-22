"use client";

import { useEffect, useState } from "react";
import type { useSignUp } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { OrDivider } from "@/components/ui/OrDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";

type SignUpResource = ReturnType<typeof useSignUp>["signUp"];

const detailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type DetailsInput = z.infer<typeof detailsSchema>;
type FieldErrors = Partial<Record<keyof DetailsInput, string>>;

export function SignUpDetailsStep({
  signUp,
  busy,
  invitedEmail,
  isInvitation,
  onCodeSent,
  onAlreadyComplete,
  onError,
}: {
  signUp: SignUpResource;
  busy: boolean;
  /** Pre-fill + lock the email field. Null until Clerk applies the ticket. */
  invitedEmail: string | null;
  /** True the moment we detect an invitation ticket in the URL, even before it resolves. */
  isInvitation: boolean;
  onCodeSent: (email: string) => void;
  /** Called when sign-up is already complete (e.g. invitation pre-verified the email). */
  onAlreadyComplete: () => void;
  onError: (message: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const parsed = detailsSchema.safeParse({ firstName, lastName, email, password });
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

    const passwordResult = await signUp.password({
      emailAddress: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    if (passwordResult.error) {
      const message = passwordResult.error.message ?? "Sign-up failed";
      setServerError(message);
      onError(message);
      return;
    }

    // Invitation tickets pre-verify the invited email address, so the sign-up
    // is already complete the moment a password is attached — no code email
    // needed. Trying to send one would discard the invitation context.
    if (signUp.status === "complete") {
      onAlreadyComplete();
      return;
    }

    const sendResult = await signUp.verifications.sendEmailCode();
    if (sendResult.error) {
      const message = sendResult.error.message ?? "Could not send verification code";
      setServerError(message);
      onError(message);
      return;
    }
    onCodeSent(parsed.data.email);
  }

  async function handleGoogle() {
    if (!signUp) return;
    setServerError(null);
    const result = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectCallbackUrl: "/sso-callback",
    });
    if (result.error) {
      setServerError(result.error.message ?? "Could not start Google sign-up");
    }
  }

  return (
    <>
      {isInvitation && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          You&apos;ve been invited to GroomHub
          {invitedEmail ? (
            <>
              {" "}as <span className="font-medium">{invitedEmail}</span>
            </>
          ) : null}
          . Finish creating your account to join the shop.
        </div>
      )}

      {!isInvitation && (
        <>
          <GoogleButton
            onClick={handleGoogle}
            disabled={busy || !signUp}
            label="Continue with Google"
          />
          <OrDivider />
        </>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={invitedEmail ? () => {} : setEmail}
          error={fieldErrors.email}
          autoComplete="email"
          readOnly={Boolean(invitedEmail)}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <div id="clerk-captcha" />
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <button
          type="submit"
          disabled={busy || !signUp}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </>
  );
}
