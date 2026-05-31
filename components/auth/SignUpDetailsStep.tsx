"use client";

import { useEffect, useState } from "react";
import type { useSignUp } from "@clerk/nextjs";
import { Lock, Mail, User } from "lucide-react";
import { z } from "zod";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthPrimaryButton } from "@/components/auth/AuthPrimaryButton";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { landingPage } from "@/lib/landingPage";

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
  invitedEmail: string | null;
  isInvitation: boolean;
  onCodeSent: (email: string) => void;
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

  const submitLabel = landingPage.auth.signUp.submitLabel;

  return (
    <>
      {isInvitation && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          You&apos;ve been invited to GroomHub
          {invitedEmail ? (
            <>
              {" "}as <span className="font-medium">{invitedEmail}</span>
            </>
          ) : null}
          . Finish creating your account to join the shop.
        </div>
      )}

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
            placeholder="Alex"
          />
          <AuthInput
            label="Last Name"
            required
            icon={User}
            value={lastName}
            onChange={setLastName}
            error={fieldErrors.lastName}
            autoComplete="family-name"
            placeholder="Johnson"
          />
        </div>
        <AuthInput
          label="Email Address"
          required
          icon={Mail}
          type="email"
          value={email}
          onChange={invitedEmail ? () => {} : setEmail}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="alex@example.com"
          readOnly={Boolean(invitedEmail)}
        />
        <AuthInput
          label="Password"
          required
          icon={Lock}
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <div id="clerk-captcha" />
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <AuthPrimaryButton disabled={busy || !signUp}>
          {busy ? "Creating account…" : submitLabel}
        </AuthPrimaryButton>
      </form>

      {!isInvitation && (
        <SocialAuthButtons onGoogle={handleGoogle} disabled={busy || !signUp} />
      )}
    </>
  );
}
