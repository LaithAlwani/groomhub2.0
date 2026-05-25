"use client";

import { useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const CONFIRM_PHRASE = "delete my account";

/**
 * The "leave forever" card. Two layers of protection:
 *
 *   1. **Server-side block** — `api.memberships.myBlockingOwnerships` returns
 *      every shop where the caller is the only active `superAdmin` AND there
 *      are other active members. While that list is non-empty the Delete
 *      button is disabled — deleting would orphan a multi-member shop.
 *   2. **UX block** — even when the server is happy, the user has to type
 *      the literal phrase `delete my account` into the confirmation modal
 *      before the final button enables.
 *
 * On confirm: `user.delete()` (Clerk wipes the user across all sessions and
 * orgs) → `clerk.signOut(... → "/")` lands them on the marketing page.
 * The `user.deleted` Clerk webhook → `convex/clerkSync.ts` already handles
 * the cascade: `users.isActive = false`, every membership `isActive = false`.
 */
export function DangerZoneSection() {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  const blockingOwnerships = useQuery(api.memberships.myBlockingOwnerships);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded || !user) return null;

  const isBlocked = (blockingOwnerships?.length ?? 0) > 0;

  async function handleDelete() {
    if (!user) return;
    if (typed.trim() !== CONFIRM_PHRASE) return;
    setError(null);
    setBusy(true);
    try {
      await user.delete();
      // setActive(null) doesn't fire user.deleted reliably across tabs —
      // signOut+navigate is the canonical Clerk recipe for this.
      await clerk.signOut(() => {
        window.location.assign("/");
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not delete your account",
      );
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/40 p-6 dark:border-red-900/40 dark:bg-red-950/20">
      <header className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
          <AlertTriangle size={16} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-red-900 dark:text-red-100">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-red-800/80 dark:text-red-200/70">
            Permanently delete your GroomHub account. This signs you out of
            every device and removes your access to every shop. Past
            appointments stay in your shop&apos;s history.
          </p>
        </div>
      </header>

      {isBlocked && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Transfer ownership first.</p>
          <p className="mt-1">
            You&apos;re the sole owner of{" "}
            {blockingOwnerships
              ?.map((row) => row.orgName)
              .join(", ")}
            . Promote another member to owner (or remove all other members)
            before deleting your account.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={isBlocked}
        onClick={() => {
          setTyped("");
          setError(null);
          setConfirmOpen(true);
        }}
        title={
          isBlocked
            ? "You can't delete your account while you're the sole owner of a shop with other members."
            : undefined
        }
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        <Trash2 size={14} />
        Delete account
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete your account?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              This wipes your GroomHub identity across every shop and signs
              you out everywhere. You can&apos;t undo this.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Type <strong>{CONFIRM_PHRASE}</strong> to confirm.
              </span>
              <input
                type="text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            )}
          </div>
        }
        confirmLabel="Delete forever"
        tone="danger"
        busy={busy}
        disableConfirm={typed.trim() !== CONFIRM_PHRASE}
        onConfirm={handleDelete}
        onCancel={() => {
          if (busy) return;
          setConfirmOpen(false);
        }}
      />
    </section>
  );
}
