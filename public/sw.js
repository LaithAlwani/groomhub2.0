/*
 * GroomHub service worker — hand-rolled (no Serwist/Workbox) because Next 16
 * runs on Turbopack by default and the Workbox webpack plugins are unreliable
 * outside webpack.
 *
 * Strategies:
 *   - `/_next/static/*`, icons, manifest:        cache-first (fingerprinted, safe forever)
 *   - Navigation requests (HTML loads):          network-first → cache → /offline
 *   - RSC payloads (client-router soft navs):    network-first → cache → fail (Next falls back to MPA)
 *   - Convex (`*.convex.cloud`, WS):             bypass (TanStack handles offline reads)
 *   - Clerk (`*.clerk.*`):                       bypass (security)
 *   - Everything else GET:                       network-only
 *
 * Cache names are versioned. Bumping VERSION here wipes every old cache on
 * the next activation (see the cleanup in `activate`).
 *
 * Set DEBUG = true to log every fetch decision to the console — useful when
 * something's not being cached and you can't tell why. Leave false in prod.
 */

const VERSION = "v2";
const DEBUG = true;

const CACHE_STATIC = `groomhub-static-${VERSION}`;
const CACHE_PAGES = `groomhub-pages-${VERSION}`;
const CACHE_SHELL = `groomhub-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

function log(...args) {
  if (DEBUG) console.log("[sw]", ...args);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
        log("precached", OFFLINE_URL);
      } catch (error) {
        log("precache failed", error);
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.endsWith(`-${VERSION}`))
          .map((key) => {
            log("deleting old cache", key);
            return caches.delete(key);
          }),
      );
      await self.clients.claim();
      log("activated", VERSION);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Clerk's JS bundle lives on a per-instance subdomain
  // (e.g. big-ray-65.clerk.accounts.dev/npm/@clerk/clerk-js@6/...).
  // Cache it via stale-while-revalidate so a brief network blip — or a
  // full offline session — doesn't bring the whole app down with
  // "Failed to load Clerk JS". Auth API calls to the same hostname still
  // fall through to network-only below.
  if (isClerkStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC, "clerk"));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo_new.webp" ||
    url.pathname === "/logo_wide.webp"
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC, "static"));
    return;
  }

  const isRsc = request.headers.get("RSC") === "1";
  const isNavigation =
    request.mode === "navigate" || request.destination === "document";

  if (isNavigation) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }
  if (isRsc) {
    event.respondWith(rscNetworkFirst(request));
    return;
  }
});

function isClerkStaticAsset(url) {
  const isClerkHost =
    url.hostname.endsWith(".clerk.accounts.dev") ||
    url.hostname.endsWith(".clerk.com") ||
    url.hostname.endsWith(".clerk.dev");
  if (!isClerkHost) return false;
  // `/npm/...` is the Clerk JS bundle CDN path. Everything else on these
  // hostnames is auth API (must hit network) or session-tracking pixels.
  return (
    url.pathname.startsWith("/npm/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".svg")
  );
}

async function staleWhileRevalidate(request, cacheName, kind) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        log(kind, cached ? "REVALIDATE" : "FILL", request.url);
      }
      return response;
    })
    .catch((error) => {
      // Background refresh failed (offline / Clerk CDN down). If we have a
      // cached version, the caller already returned it — just swallow.
      if (cached) {
        log(kind, "REVALIDATE FAILED, using cache", request.url);
        return cached;
      }
      throw error;
    });
  if (cached) {
    log(kind, "HIT", request.url);
    return cached;
  }
  log(kind, "MISS → network", request.url);
  return networkPromise;
}

async function cacheFirst(request, cacheName, kind) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    log(kind, "HIT", request.url);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      log(kind, "FILL", request.url);
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      log("nav FILL", request.url);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      log("nav OFFLINE HIT", request.url);
      return cached;
    }
    log("nav OFFLINE MISS → /offline", request.url);
    const shellCache = await caches.open(CACHE_SHELL);
    const offline = await shellCache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response(
      "<!doctype html><title>Offline</title><h1>You're offline</h1>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function rscNetworkFirst(request) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      log("rsc FILL", request.url);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      log("rsc OFFLINE HIT", request.url);
      return cached;
    }
    // No cached RSC and offline — let the client router see a network error
    // so it falls back to MPA navigation, which our navigation handler will
    // serve (or send to /offline).
    log("rsc OFFLINE MISS → throw", request.url);
    return Response.error();
  }
}
