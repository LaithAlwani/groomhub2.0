export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "appointments",
  "assets",
  "auth",
  "billing",
  "book",
  "booking",
  "calendar",
  "cdn",
  "clients",
  "contact",
  "dashboard",
  "docs",
  "embed",
  "help",
  "home",
  "login",
  "logout",
  "mail",
  "onboarding",
  "pets",
  "portal",
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
  "status",
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
