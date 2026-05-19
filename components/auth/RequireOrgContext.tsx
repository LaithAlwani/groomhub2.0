"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Client-side guard for routes under `(app)/`. Server-side `(app)/layout.tsx`
 * already redirects users without an active org to `/onboarding/create-shop`,
 * but Next 16's `cacheComponents` can leave us on the page with stale auth
 * state in certain transitions. If we land on an authed page without
 * `useAuth().orgId`, force the navigation client-side.
 */
export function RequireOrgContext() {
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (!orgId) {
      router.replace("/onboarding/create-shop");
    }
  }, [isLoaded, isSignedIn, orgId, router]);

  return null;
}
