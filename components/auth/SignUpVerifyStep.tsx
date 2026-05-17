"use client";

import { useState } from "react";
import type { useSignUp } from "@clerk/nextjs";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

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

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <Field
        label="Verification code"
        value={code}
        onChange={setCode}
        autoComplete="one-time-code"
        inputMode="numeric"
      />
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      <button
        type="submit"
        disabled={busy || !signUp}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {busy ? "Verifying…" : "Verify and continue"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Use a different email
      </button>
    </form>
  );
}
