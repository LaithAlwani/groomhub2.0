"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Signing you in…</p>
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
        continueSignUpUrl="/sign-up"
      />
    </div>
  );
}
