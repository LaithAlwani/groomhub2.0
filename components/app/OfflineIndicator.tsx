"use client";

import { useEffect, useState } from "react";

/**
 * Tiny status pill that surfaces network state in the topbar. Renders nothing
 * when the browser is online so the bar stays clean; flips on as a flashing
 * red dot + "Offline" label the moment `window.offline` fires.
 *
 * Convex's WebSocket has its own connection awareness but that signal isn't
 * exposed to React directly — `navigator.onLine` is a good proxy because the
 * cases we care about (lost Wi-Fi, no signal) trip both at the same time.
 */
export function OfflineIndicator() {
  // Start optimistic — we don't know real status on the server. The effect
  // below corrects it on mount.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200"
    >
      <span aria-hidden className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      Offline
    </span>
  );
}
