export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "appointments",
  "auth",
  "billing",
  "calendar",
  "clients",
  "contact",
  "dashboard",
  "docs",
  "help",
  "home",
  "login",
  "logout",
  "onboarding",
  "pets",
  "pricing",
  "privacy",
  "public",
  "services",
  "settings",
  "sign-in",
  "sign-up",
  "signin",
  "signout",
  "signup",
  "sso-callback",
  "staff",
  "static",
  "support",
  "terms",
  "tos",
  "webhook",
  "webhooks",
  "www",
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export type SlugValidation =
  | { ok: true }
  | { ok: false; code: "SLUG_INVALID" | "SLUG_RESERVED" };

export function validateSlugShape(slug: string): SlugValidation {
  if (!SLUG_PATTERN.test(slug)) return { ok: false, code: "SLUG_INVALID" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, code: "SLUG_RESERVED" };
  return { ok: true };
}
