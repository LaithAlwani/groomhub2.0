"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type ExternalAccountResource = ClerkUser["externalAccounts"][number];
import { Link2, Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const PROVIDER_LABEL: Record<string, string> = {
  oauth_google: "Google",
  oauth_apple: "Apple",
  oauth_microsoft: "Microsoft",
  oauth_github: "GitHub",
  oauth_facebook: "Facebook",
};

/**
 * Lists the user's linked OAuth providers (Google, Apple, etc.) with a
 * Disconnect button per row. The "last sign-in method" guard prevents the
 * user from locking themselves out — if they have no password AND only one
 * external account, the Disconnect button is disabled with an explanation.
 *
 * Disconnect uses `externalAccount.destroy()` — Clerk handles revoking the
 * token at the provider side too.
 */
export function ConnectedAccountsSection() {
  const { user, isLoaded } = useUser();
  const [confirmTarget, setConfirmTarget] =
    useState<ExternalAccountResource | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isLoaded || !user) return null;

  const accounts = user.externalAccounts ?? [];
  const hasPassword = user.passwordEnabled;
  const isLastSignInMethod = !hasPassword && accounts.length === 1;

  async function handleDisconnect() {
    if (!confirmTarget) return;
    setServerError(null);
    setBusy(true);
    try {
      await confirmTarget.destroy();
      setConfirmTarget(null);
    } catch (caught) {
      setServerError(
        caught instanceof Error
          ? caught.message
          : "Could not disconnect this account",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Connected accounts
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          External providers you can sign in with. You need at least one
          sign-in method — keep your password set if you want to disconnect
          everything here.
        </p>
      </header>

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No third-party accounts connected.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => {
            const label =
              PROVIDER_LABEL[account.provider] ?? account.provider;
            return (
              <li
                key={account.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Link2 size={16} className="text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {label}
                  </span>
                  {account.emailAddress && (
                    <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {account.emailAddress}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isLastSignInMethod}
                  onClick={() => setConfirmTarget(account)}
                  title={
                    isLastSignInMethod
                      ? "You need at least one sign-in method."
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                >
                  <Unplug size={12} />
                  Disconnect
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {serverError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {serverError}
        </p>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Disconnect ${
          confirmTarget ? PROVIDER_LABEL[confirmTarget.provider] ?? confirmTarget.provider : ""
        }?`}
        description={
          <>
            You won&apos;t be able to sign in with this provider anymore.
            Reconnecting later goes through the normal sign-in flow.
          </>
        }
        confirmLabel="Disconnect"
        tone="danger"
        busy={busy}
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  );
}
