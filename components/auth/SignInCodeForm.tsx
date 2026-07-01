"use client";

import { ShieldCheck } from "lucide-react";
import { AuthInput } from "./AuthInput";
import { AuthPrimaryButton } from "./AuthPrimaryButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

/**
 * Second-factor (email code) step of sign-in. Shown when Clerk reports
 * `needs_second_factor` and we've sent the code via `signIn.mfa.sendEmailCode`.
 */
export function SignInCodeForm({
  email,
  code,
  onCodeChange,
  onSubmit,
  onResend,
  error,
  busy,
}: {
  email: string;
  code: string;
  onCodeChange: (next: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onResend: () => void;
  error: string | null;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        For your security, we emailed a verification code to{" "}
        <strong className="text-zinc-900 dark:text-zinc-100">{email}</strong>.
        Enter it below to finish signing in.
      </p>
      <AuthInput
        label="Verification code"
        required
        icon={ShieldCheck}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={onCodeChange}
        placeholder="123456"
      />
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <AuthPrimaryButton disabled={busy}>
        {busy ? "Verifying…" : "Verify & sign in"}
      </AuthPrimaryButton>
      <button
        type="button"
        onClick={onResend}
        disabled={busy}
        className="w-full text-center text-sm font-semibold text-orange-700 hover:underline disabled:opacity-50 dark:text-orange-400"
      >
        Resend code
      </button>
    </form>
  );
}
