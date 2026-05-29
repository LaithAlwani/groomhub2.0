"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { BrandedLoader } from "@/components/ui/BrandedLoader";

/**
 * OAuth redirect lands here after Google/Apple sign-in. The
 * `AuthenticateWithRedirectCallback` component finishes the handshake — for
 * an existing user it just activates the session and pushes to `/dashboard`;
 * for a brand-new user it creates the account in Clerk first.
 *
 * The `<div id="clerk-captcha" />` is required when Clerk's Bot Sign-Up
 * Protection is enabled (which is the default on new instances). During
 * the new-account creation step the SDK injects a Cloudflare Turnstile
 * challenge into this div. If the div isn't present the SDK throws
 * "failed to load CAPTCHA" — see
 * https://clerk.com/docs/custom-flows/bot-sign-up-protection.
 *
 * Existing-user sign-ins don't trigger the captcha, so this only matters
 * the first time someone OAuths in.
 */
export default function SSOCallbackPage() {
  return (
    <>
      <BrandedLoader message="Signing you in…" />
      <div id="clerk-captcha" />
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
        continueSignUpUrl="/sign-up"
      />
    </>
  );
}
