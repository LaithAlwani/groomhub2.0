"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type ExternalAccountResource = ClerkUser["externalAccounts"][number];
import { HelpCircle, Link2 as DefaultProviderIcon } from "lucide-react";
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
      <header className="mb-4 flex items-center gap-1.5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Connections
        </h2>
        <span
          tabIndex={0}
          role="img"
          aria-label="External providers you can sign in with. You need at least one sign-in method — keep your password set if you want to disconnect everything here."
          title="External providers you can sign in with. You need at least one sign-in method — keep your password set if you want to disconnect everything here."
          className="inline-flex h-4 w-4 cursor-help items-center justify-center text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus:text-zinc-600"
        >
          <HelpCircle size={14} aria-hidden />
        </span>
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
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <ProviderMark provider={account.provider} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {label} Account
                    </span>
                    {account.emailAddress && (
                      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {account.emailAddress}
                      </span>
                    )}
                  </div>
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
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                >
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

/**
 * Brand-coloured icon for a single OAuth provider. Google ships with its
 * official multi-colour mark (same SVG as `components/auth/GoogleButton`);
 * everything else falls back to a generic link icon so the row still has a
 * visual anchor.
 */
function ProviderMark({ provider }: { provider: string }) {
  if (provider === "oauth_google") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58Z"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <DefaultProviderIcon size={14} aria-hidden />
    </span>
  );
}
