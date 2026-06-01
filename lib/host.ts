/**
 * Host-based routing switchboard.
 *
 * Phase 00 of the white-label work splits the product across hostnames:
 *   - `groomhub.ca` / `www.groomhub.ca` → the public marketing site
 *   - `app.groomhub.ca`                 → the authenticated app (Clerk-gated)
 *   - `<slug>.groomhub.ca`              → a tenant's white-label surface (Phase 3)
 *
 * The split only activates when `ROOT_DOMAIN` is configured. Without it — local
 * dev, preview deploys, any host we don't recognise — we return `"combined"`,
 * which means "serve marketing and app from the same host" (today's behaviour).
 * That keeps `localhost` and Vercel previews working untouched.
 *
 * This module is intentionally dependency-free so it can run in the Edge
 * middleware (`proxy.ts`).
 */
export type ResolvedHost =
  | { kind: "combined" }
  | { kind: "marketing"; rootDomain: string }
  | { kind: "app"; rootDomain: string }
  | { kind: "tenant"; rootDomain: string; slug: string };

/**
 * Normalises a `ROOT_DOMAIN` env value to a bare registrable host like
 * `groomhub.ca`, tolerating the common mistakes of pasting a full URL or the
 * `www.` host (`https://www.groomhub.ca/` → `groomhub.ca`). A bad value here
 * silently disables the host split *and* corrupts the Clerk CSP entries, so we
 * sanitise rather than trust the raw string.
 */
export function normalizeRootDomain(
  value: string | undefined | null,
): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "") // strip scheme
    .replace(/\/.*$/, "") // strip any path
    .replace(/:\d+$/, "") // strip port
    .replace(/^www\./, ""); // strip leading www.
  return cleaned || undefined;
}

export function resolveHost(hostHeader: string | null): ResolvedHost {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN);
  // Split not configured (dev / preview) → behave like one combined host.
  if (!rootDomain || !hostHeader) return { kind: "combined" };

  // Strip the port (`app.groomhub.ca:3000` → `app.groomhub.ca`).
  const host = hostHeader.split(":")[0].toLowerCase();

  // Apex + www are the marketing site.
  if (host === rootDomain || host === `www.${rootDomain}`) {
    return { kind: "marketing", rootDomain };
  }

  // Anything that isn't under the root domain (preview URLs, custom hosts we
  // don't yet map, localhost) stays combined so nothing breaks.
  const suffix = `.${rootDomain}`;
  if (!host.endsWith(suffix)) return { kind: "combined" };

  const subdomain = host.slice(0, -suffix.length);
  if (subdomain === "app") return { kind: "app", rootDomain };

  // A single-label subdomain is a tenant slug (handled in Phase 3). Multi-label
  // hosts (`a.b.groomhub.ca`) aren't tenants — leave them combined for now.
  if (subdomain && !subdomain.includes(".")) {
    return { kind: "tenant", rootDomain, slug: subdomain };
  }
  return { kind: "combined" };
}
