"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SessionRow } from "./SessionRow";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type SessionWithActivitiesResource = Awaited<
  ReturnType<ClerkUser["getSessions"]>
>[number];

/**
 * Active sessions across every device the user is signed in on. Pulled via
 * `user.getSessions()` which returns sessions with activity info (browser,
 * OS, last-active time, approx location).
 *
 * Current session is marked and its individual revoke is disabled — only
 * the "Sign out of all other devices" CTA at the top revokes everywhere
 * else. That keeps the user from accidentally signing themselves out of
 * the page they're on by misclicking.
 */
export function SessionsSection() {
  const { user, isLoaded: userLoaded } = useUser();
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getSessions().then((rows) => {
      if (!cancelled) setSessions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!userLoaded || !user) return null;

  async function reload() {
    if (!user) return;
    const fresh = await user.getSessions();
    setSessions(fresh);
  }

  async function revokeOne(session: SessionWithActivitiesResource) {
    setError(null);
    setBusyId(session.id);
    try {
      await session.revoke();
      await reload();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not revoke session",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAllOthers() {
    if (!sessions || !currentSession) return;
    setError(null);
    setBusyId("all-others");
    try {
      const others = sessions.filter((row) => row.id !== currentSession.id);
      await Promise.all(others.map((row) => row.revoke()));
      await reload();
      setConfirmRevokeAll(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not revoke sessions",
      );
    } finally {
      setBusyId(null);
    }
  }

  const otherSessions = sessions?.filter((row) => row.id !== currentSession?.id) ?? [];
  const showRevokeAll = otherSessions.length > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Active sessions
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Every device you&apos;re signed in on. Revoke any you don&apos;t
            recognize.
          </p>
        </div>
        {showRevokeAll && (
          <button
            type="button"
            onClick={() => setConfirmRevokeAll(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <LogOut size={12} />
            Sign out everywhere else
          </button>
        )}
      </header>

      {sessions === null ? (
        <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isCurrent={session.id === currentSession?.id}
              busy={busyId === session.id}
              onRevoke={() => revokeOne(session)}
            />
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmRevokeAll}
        title="Sign out of every other device?"
        description={
          <>
            Anyone currently signed in on another browser or device will be
            forced back to the sign-in screen. This session stays active.
          </>
        }
        confirmLabel="Sign out everywhere else"
        tone="danger"
        busy={busyId === "all-others"}
        onConfirm={revokeAllOthers}
        onCancel={() => setConfirmRevokeAll(false)}
      />
    </section>
  );
}
