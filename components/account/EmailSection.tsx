"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Mail } from "lucide-react";

/**
 * Lists the user's verified email addresses. Lets them set a different one as
 * primary (only verified emails are eligible — adding new addresses goes
 * through Clerk's verification flow which we'd build out separately).
 */
export function EmailSection() {
  const { user, isLoaded } = useUser();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  if (!isLoaded || !user) return null;

  const emails = user.emailAddresses ?? [];
  const primaryId = user.primaryEmailAddressId;

  async function makePrimary(emailId: string) {
    setServerError(null);
    setSavedMessage(null);
    setBusyId(emailId);
    try {
      await user!.update({ primaryEmailAddressId: emailId });
      setSavedMessage("Primary email updated.");
    } catch (caught) {
      setServerError(
        caught instanceof Error ? caught.message : "Could not update primary email",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Email addresses
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your primary address is where notifications go and how you sign in.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {emails.map((email) => {
          const isPrimary = email.id === primaryId;
          const isVerified = email.verification?.status === "verified";
          return (
            <li
              key={email.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Mail size={16} className="text-zinc-400" />
                <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                  {email.emailAddress}
                </span>
                {isPrimary && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Primary
                  </span>
                )}
                {!isVerified && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    Unverified
                  </span>
                )}
              </div>
              {!isPrimary && isVerified && (
                <button
                  type="button"
                  disabled={busyId === email.id}
                  onClick={() => makePrimary(email.id)}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {busyId === email.id ? "Saving…" : "Make primary"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {serverError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {serverError}
        </p>
      )}
      {savedMessage && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          {savedMessage}
        </p>
      )}
    </section>
  );
}
