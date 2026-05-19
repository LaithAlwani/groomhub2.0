"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { useSignUp } from "@clerk/nextjs";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
});

type FormInput = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormInput, string>>;

/**
 * Accepts an organisation invitation using Clerk's Future SignUp API.
 *
 * Two paths:
 *   - New email: `signUp.create({strategy:"ticket"})` creates the user,
 *     auto-verifies the invited email, mints a session.
 *   - Existing email: Clerk rejects sign-up ("verification strategy is not
 *     valid for this account"). We detect that, switch to a "Sign in to
 *     accept" panel, and rely on `PendingInvitationsBanner` to surface the
 *     pending invitation after the user signs in.
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
  const { signUp } = useSignUp();
  const lookupTicket = useAction(api.invitations.lookupTicket);

  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    lookupTicket({ ticket: invitationTicket })
      .then((info) => {
        if (cancelled) return;
        if (info?.email) setInvitedEmail(info.email);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [invitationTicket, lookupTicket]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

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
    if (!signUp) return;

    setSubmitting(true);
    try {
      type SignUpCreateParams = Parameters<typeof signUp.create>[0];
      const createResult = await signUp.create({
        strategy: "ticket",
        ticket: invitationTicket,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      } as SignUpCreateParams);

      if (createResult.error) {
        const message =
          createResult.error.message ?? "Could not accept the invitation";
        if (isAccountExistsError(message)) {
          setAccountExists(true);
          return;
        }
        setServerError(message);
        onError(message);
        return;
      }

      if (!signUp.createdSessionId) {
        const message = "Sign-up didn't finish. Try again or contact support.";
        setServerError(message);
        onError(message);
        return;
      }

      const finalizeResult = await signUp.finalize({
        navigate: () => undefined,
      });
      if (finalizeResult.error) {
        const message =
          finalizeResult.error.message ?? "Could not finish sign-up";
        setServerError(message);
        onError(message);
        return;
      }
      onAccepted();
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

  if (accountExists) {
    return (
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          You already have an account
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We found a GroomHub account
          {invitedEmail ? (
            <>
              {" "}for <span className="font-medium">{invitedEmail}</span>
            </>
          ) : null}
          . Sign in and your invitation will be waiting on the dashboard.
        </p>
        {invitedEmail && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Important: sign in with{" "}
            <span className="font-medium">{invitedEmail}</span>. Invitations
            are tied to the email they were sent to, so a different account
            won&apos;t pick this one up.
          </p>
        )}
        <Link
          href="/sign-in"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      {invitedEmail && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Joining as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {invitedEmail}
          </span>
        </p>
      )}
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
        disabled={submitting || busy || !signUp}
        className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting || busy ? "Joining…" : "Join shop"}
      </button>
    </form>
  );
}

function isAccountExistsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("verification strategy is not valid") ||
    lower.includes("identifier exists") ||
    lower.includes("already exists")
  );
}
