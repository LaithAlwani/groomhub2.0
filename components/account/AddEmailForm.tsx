"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

// `@clerk/types` isn't installed as a separate package — derive the
// resource type from the SDK method's return type instead.
type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type EmailAddressResource = Awaited<
  ReturnType<ClerkUser["createEmailAddress"]>
>;

/**
 * Two-step inline form for adding a new email to the signed-in user.
 *
 * Step 1: input address → `user.createEmailAddress` returns an unverified
 *         `EmailAddressResource` → auto-call `prepareVerification`.
 * Step 2: 6-digit code field → `attemptVerification` → on success, fire
 *         `onDone` so the parent collapses the form and refreshes its list
 *         (Clerk's `useUser` hook reflects the new email automatically).
 *
 * Stays inside the EmailSection card — no modal. If the user cancels mid-
 * verification the in-progress `EmailAddressResource` lives on Clerk's
 * side; they can either delete it via Clerk's portal or restart the flow.
 */
export function AddEmailForm({ onDone }: { onDone: () => void }) {
  const { user } = useUser();
  const [phase, setPhase] = useState<"input" | "code">("input");
  const [emailValue, setEmailValue] = useState("");
  const [pending, setPending] = useState<EmailAddressResource | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const trimmed = emailValue.trim();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await user.createEmailAddress({ email: trimmed });
      await created.prepareVerification({ strategy: "email_code" });
      setPending(created);
      setPhase("code");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add this email",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length < 4) {
      setError("Enter the code from your email.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await pending.attemptVerification({ code: trimmedCode });
      onDone();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Verification failed",
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase === "code") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-2">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          We sent a 6-digit code to <strong>{emailValue}</strong>.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-lg bg-linear-to-b from-orange-500 to-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-none disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleStartAdd} className="flex flex-col gap-2">
      <input
        type="email"
        autoComplete="email"
        value={emailValue}
        onChange={(event) => setEmailValue(event.target.value)}
        placeholder="you@example.com"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-lg bg-linear-to-b from-orange-500 to-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-none disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {busy ? "Sending code…" : "Send verification code"}
      </button>
    </form>
  );
}
