"use client";

import { useState } from "react";
import type { useSignUp } from "@clerk/nextjs";
import { KeyRound } from "lucide-react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthPrimaryButton } from "@/components/auth/AuthPrimaryButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { landingPage } from "@/lib/landingPage";

type SignUpResource = ReturnType<typeof useSignUp>["signUp"];

export function SignUpVerifyStep({
  signUp,
  busy,
  onVerified,
  onBack,
}: {
  signUp: SignUpResource;
  busy: boolean;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    if (code.trim().length < 4) {
      setServerError("Enter the code from your email");
      return;
    }
    if (!signUp) return;

    const verifyResult = await signUp.verifications.verifyEmailCode({
      code: code.trim(),
    });
    if (verifyResult.error) {
      setServerError(verifyResult.error.message ?? "Verification failed");
      return;
    }
    onVerified();
  }

  const copy = landingPage.auth.verify;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AuthInput
        label="Verification Code"
        icon={KeyRound}
        value={code}
        onChange={setCode}
        autoComplete="one-time-code"
        inputMode="numeric"
        placeholder="123456"
      />
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      <AuthPrimaryButton disabled={busy || !signUp}>
        {busy ? "Verifying…" : copy.submitLabel}
      </AuthPrimaryButton>
      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center text-xs font-semibold text-zinc-500 transition-colors hover:text-orange-700 dark:hover:text-orange-400"
      >
        ← {copy.backLabel}
      </button>
    </form>
  );
}
