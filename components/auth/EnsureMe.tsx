"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

const RETRY_DELAYS_MS = [400, 800, 1600];

/**
 * Fires the `users.ensureMe` mutation once the user has a Clerk session with
 * an active org. The mutation returns `null` when Convex's cached JWT hasn't
 * yet picked up the new `org_id` claim — in that case we retry on a short
 * backoff until the row materialises.
 */
export function EnsureMe() {
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const ensure = useMutation(api.users.ensureMe);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) return;
    attemptRef.current = 0;
    let cancelled = false;

    async function tryEnsure() {
      while (!cancelled) {
        try {
          const result = await ensure();
          if (result) return;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("ensureMe failed", err);
          return;
        }
        const delay = RETRY_DELAYS_MS[attemptRef.current];
        if (delay === undefined) return;
        attemptRef.current += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    tryEnsure();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, orgId, ensure]);

  return null;
}
