"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * State backed by `localStorage` so a preference survives reloads and new
 * sessions. Reads via `useSyncExternalStore` — server-rendered as the default
 * (no hydration mismatch), then the stored value takes over on the client.
 * `parse` returns `null` for missing/invalid data so we fall back to the
 * default. Writes notify the same tab (the native `storage` event only fires
 * in other tabs).
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T | null,
  serialize: (value: T) => string,
): [T, (next: T) => void] {
  const getSnapshot = () => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const value = raw === null ? defaultValue : (parse(raw) ?? defaultValue);

  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, serialize(next));
        window.dispatchEvent(new StorageEvent("storage", { key }));
      } catch {
        // localStorage unavailable (private mode, quota) — preference just
        // won't persist; the UI still reflects the change for this session.
      }
    },
    [key, serialize],
  );

  return [value, setValue];
}
