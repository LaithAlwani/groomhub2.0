/**
 * Client-side URL helpers for the marketing/app host split (Phase 00).
 *
 * The marketing site lives on the apex (`groomhub.ca`) but every auth/app route
 * lives on `app.groomhub.ca`. So a marketing "Log in" button must point at the
 * app host. When `NEXT_PUBLIC_ROOT_DOMAIN` is set we rewrite known app paths to
 * an absolute app-host URL; otherwise (local dev / previews, where both run on
 * one host) we return the path unchanged so client-side navigation still works.
 *
 * The middleware in `proxy.ts` also redirects these paths off the marketing
 * host, so this is purely a UX optimisation that avoids the extra redirect hop.
 */
import { normalizeRootDomain } from "./host";

const ROOT_DOMAIN = normalizeRootDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN);

// Paths that belong to the app host. Kept in sync with the app routes guarded
// in `proxy.ts`.
const APP_PATH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/dashboard",
  "/account",
  "/onboarding",
];

function isAppPath(href: string): boolean {
  return APP_PATH_PREFIXES.some(
    (prefix) =>
      href === prefix ||
      href.startsWith(`${prefix}/`) ||
      href.startsWith(`${prefix}?`),
  );
}

/**
 * Rewrites a marketing link to the app host when it targets an app/auth route.
 * In-page anchors (`#pricing`) and marketing pages (`/privacy`, `/terms`) pass
 * through untouched, so it's safe to wrap every marketing href with this.
 */
export function marketingHref(href: string): string {
  if (!ROOT_DOMAIN) return href;
  return isAppPath(href) ? `https://app.${ROOT_DOMAIN}${href}` : href;
}
