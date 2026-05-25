"use client";

import { useEffect } from "react";

/**
 * Tiny client island that registers `/sw.js` once per session, but only in
 * production builds. In dev (`npm run dev`) we deliberately unregister any
 * leftover SW because its caching collides with Turbopack HMR and turns
 * "save → see update" into "save → see five-minute-old stale HTML".
 *
 * Renders nothing — pure side-effect.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => {
        // Don't crash the app if SW registration fails — offline support is a
        // progressive enhancement, not a hard requirement.
        // eslint-disable-next-line no-console
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}
