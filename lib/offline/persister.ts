import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

/**
 * IndexedDB-backed persister for TanStack Query.
 *
 * Why IndexedDB and not localStorage:
 *   - localStorage is sync but caps at ~5 MB and freezes the main thread on
 *     big writes; the full calendar cache for a busy salon can blow past that.
 *   - IndexedDB is async, GBs of room, and survives across tabs.
 *
 * `idb-keyval` keeps the API trivially small (get / set / del) which is all
 * `createAsyncStoragePersister` needs — it serialises the cache to one key
 * per app and writes it back on every cache change (throttled).
 *
 * The store key is namespaced ("groomhub-cache") so the app doesn't collide
 * with anything else sharing the origin's idb-keyval store. The persister's
 * `key` is what TanStack writes inside that namespace.
 */
const STORE_KEY = "groomhub-cache";

export function createIdbKeyValPersister() {
  return createAsyncStoragePersister({
    storage: {
      getItem: (key) => get<string | null>(key).then((value) => value ?? null),
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
    key: STORE_KEY,
    // Coalesce rapid-fire writes (e.g. as a Convex live query streams
    // updates) into one IndexedDB write per second.
    throttleTime: 1000,
  });
}
