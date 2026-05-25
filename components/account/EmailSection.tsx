"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Mail, Plus, Trash2, X } from "lucide-react";
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

  const emails = user.emailAddresses ?? [];
  const primaryId = user.primaryEmailAddressId;
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
        caught instanceof Error ? caught.message : "Could not remove email",
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
        caught instanceof Error ? caught.message : "Could not update primary email",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Email addresses
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Your primary address is where notifications go and how you sign in.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Plus size={12} />
            Add email
          </button>
        )}
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
