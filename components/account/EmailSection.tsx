"use client";
import { formatError } from "@/lib/formatError";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, HelpCircle, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddEmailForm } from "./AddEmailForm";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type EmailAddressResource = ClerkUser["emailAddresses"][number];

/**
 * Lists the user's email addresses with primary swap + an inline add-email
 * mini-flow (see {@link AddEmailForm}). Once a new address is verified it
 * appears in the list and the existing "Make primary" button works on it.
 */
export function EmailSection() {
  const { user, isLoaded } = useUser();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<EmailAddressResource | null>(
    null,
  );

  if (!isLoaded || !user) return null;

  const primaryId = user.primaryEmailAddressId;
  // Pin the primary row to the top regardless of creation order; everything
  // else keeps Clerk's existing order (stable sort) so the list doesn't
  // shuffle every time a user re-renders.
  const emails = [...(user.emailAddresses ?? [])].sort((a, b) => {
    if (a.id === primaryId) return -1;
    if (b.id === primaryId) return 1;
    return 0;
  });
  const canRemoveAny = emails.length > 1;

  async function handleRemove() {
    if (!confirmRemove) return;
    setServerError(null);
    setSavedMessage(null);
    setBusyId(confirmRemove.id);
    try {
      await confirmRemove.destroy();
      setSavedMessage("Email removed.");
      setConfirmRemove(null);
    } catch (caught) {
      setServerError(
        formatError(caught, "Could not remove email"),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function makePrimary(emailId: string) {
    setServerError(null);
    setSavedMessage(null);
    setBusyId(emailId);
    try {
      await user!.update({ primaryEmailAddressId: emailId });
      setSavedMessage("Primary email updated.");
    } catch (caught) {
      setServerError(
        formatError(caught, "Could not update primary email"),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4 flex items-center gap-1.5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Emails
        </h2>
        <span
          tabIndex={0}
          role="img"
          aria-label="Your primary address is where notifications go and how you sign in."
          title="Your primary address is where notifications go and how you sign in."
          className="inline-flex h-4 w-4 cursor-help items-center justify-center text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus:text-zinc-600"
        >
          <HelpCircle size={14} aria-hidden />
        </span>
      </header>

      {adding && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Add a new email
            </p>
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label="Cancel"
              className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <X size={14} />
            </button>
          </div>
          <AddEmailForm
            onDone={() => {
              setAdding(false);
              setSavedMessage("New email added and verified.");
            }}
          />
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {emails.map((email) => {
          const isPrimary = email.id === primaryId;
          const isVerified = email.verification?.status === "verified";
          return (
            <li
              key={email.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
            >
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2
                  size={16}
                  className={
                    isVerified
                      ? "shrink-0 text-emerald-500"
                      : "shrink-0 text-zinc-300"
                  }
                  aria-hidden
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                    {email.emailAddress}
                  </span>
                  {isPrimary && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Primary
                    </span>
                  )}
                  {!isVerified && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Unverified
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
                {!isPrimary && canRemoveAny && (
                  <button
                    type="button"
                    aria-label="Remove email"
                    disabled={busyId === email.id}
                    onClick={() => setConfirmRemove(email)}
                    title="Remove this email"
                    className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!adding && (
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              <Plus size={12} />
              Add alternative email
            </button>
          </li>
        )}
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

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove this email?"
        description={
          confirmRemove ? (
            <>
              <strong>{confirmRemove.emailAddress}</strong> will no longer be
              tied to your account. You can&apos;t sign in or receive
              notifications at this address afterwards.
            </>
          ) : null
        }
        confirmLabel="Remove"
        tone="danger"
        busy={busyId === confirmRemove?.id}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </section>
  );
}
