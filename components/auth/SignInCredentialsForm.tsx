"use client";

import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { AuthInput } from "./AuthInput";
import { AuthPrimaryButton } from "./AuthPrimaryButton";
import { SocialAuthButtons } from "./SocialAuthButtons";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { landingPage } from "@/lib/landingPage";

type SignInCopy = typeof landingPage.auth.signIn;
type FieldErrors = { email?: string; password?: string };

/** Email + password (first factor) step of sign-in, plus Google SSO. */
export function SignInCredentialsForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  fieldErrors,
  serverError,
  onSubmit,
  onGoogle,
  busy,
  ready,
  copy,
}: {
  email: string;
  password: string;
  onEmailChange: (next: string) => void;
  onPasswordChange: (next: string) => void;
  fieldErrors: FieldErrors;
  serverError: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onGoogle: () => void;
  busy: boolean;
  ready: boolean;
  copy: SignInCopy;
}) {
  const disabled = busy || !ready;
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthInput
          label="Email Address"
          required
          icon={Mail}
          type="email"
          value={email}
          onChange={onEmailChange}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="name@company.com"
        />
        <AuthInput
          label="Password"
          required
          icon={Lock}
          type="password"
          value={password}
          onChange={onPasswordChange}
          error={fieldErrors.password}
          autoComplete="current-password"
          trailingSlot={
            <Link
              href={copy.forgotPasswordHref}
              className="text-xs font-semibold text-orange-700 hover:underline dark:text-orange-400"
            >
              {copy.forgotPasswordLabel}
            </Link>
          }
        />
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <AuthPrimaryButton disabled={disabled}>
          {busy ? "Signing in…" : copy.submitLabel}
        </AuthPrimaryButton>
      </form>

      <SocialAuthButtons onGoogle={onGoogle} disabled={disabled} />

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        {copy.switchPrompt}{" "}
        <Link
          href={copy.switchHref}
          className="font-semibold text-orange-700 hover:underline dark:text-orange-400"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </>
  );
}
