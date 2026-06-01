import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Sanitise ROOT_DOMAIN to a bare host (`groomhub.ca`) so a URL-style value such
// as `https://www.groomhub.ca` doesn't corrupt the Clerk CSP entries below
// (which would block clerk-js). Mirrors `normalizeRootDomain` in `lib/host.ts`,
// inlined here to avoid importing app modules into the Next config loader.
const rootDomain = process.env.ROOT_DOMAIN?.trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/.*$/, "")
  .replace(/:\d+$/, "")
  .replace(/^www\./, "");

// Clerk serves clerk-js + its Frontend API from `*.clerk.accounts.dev` on a
// development instance, but from a CUSTOM domain (`clerk.<root>` and the account
// portal `accounts.<root>`) on a production instance. Both must be allow-listed
// or clerk-js fails to load ("Failed to load Clerk JS") and EVERY auth flow —
// email and OAuth alike — breaks. The prod hosts are only added when ROOT_DOMAIN
// is set, so dev behaviour is unchanged.
const clerkHosts = [
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
  ...(rootDomain
    ? [`https://clerk.${rootDomain}`, `https://accounts.${rootDomain}`]
    : []),
].join(" ");

// Permissive CSP that lets Clerk + Convex + Next dev (which needs inline scripts
// for HMR and eval for React error overlays) run without violations. Tighten
// before launch — see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
// for the nonce-based pattern.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${clerkHosts} https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline' ${clerkHosts}`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${clerkHosts} https://clerk-telemetry.com wss://*.convex.cloud https://*.convex.cloud https://*.convex.site`,
  `frame-src 'self' ${clerkHosts} https://challenges.cloudflare.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${clerkHosts}`,
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev-only. Lets the host-split test domains (apex + app subdomain on lvh.me,
  // which both resolve to 127.0.0.1) load Next's HMR/dev resources without the
  // cross-origin block. Ignored entirely in production builds.
  allowedDevOrigins: ["lvh.me", "app.lvh.me"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          // Lets the SW (served at the root) claim scope over the entire
          // origin. Without this Chrome restricts the scope to the SW's
          // own directory.
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
