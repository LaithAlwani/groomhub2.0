"use client";

import { landingPage } from "@/lib/landingPage";

/**
 * "Or continue with" divider + Google / Apple button pair. Apple is
 * intentionally a no-op until we wire `signIn.sso({ strategy: "oauth_apple" })`
 * (requires the Apple OAuth credential in Clerk's dashboard). Render it
 * disabled-but-visible so the layout matches the design today.
 */
export function SocialAuthButtons({
  onGoogle,
  disabled,
}: {
  onGoogle: () => void;
  disabled?: boolean;
}) {
  const { socials, dividerLabel } = landingPage.auth;

  return (
    <>
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            {dividerLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onGoogle}
          disabled={disabled}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-[#00273c] transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <GoogleMark />
          {socials.googleLabel}
        </button>
        <button
          type="button"
          disabled
          aria-disabled
          // TODO: wire Apple OAuth via signIn.sso({ strategy: "oauth_apple" })
          // once the Apple credential is added to Clerk.
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-[#00273c] transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <AppleMark />
          {socials.appleLabel}
        </button>
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="fill-current"
    >
      <path d="M17.05 20.28c-.96 0-2.04-.68-3.32-.68-1.29 0-2.43.66-3.26.66-2.79 0-5.46-4.55-5.46-8.24 0-3.66 2.31-5.61 4.52-5.61 1.17 0 2.13.7 2.94.7.77 0 1.95-.76 3.25-.76 1.4 0 4.14.47 5.28 2.09-2.79 1.62-2.33 5.23.47 6.46-1.11 2.65-2.58 4.79-4.42 5.38zM15.11 4.52c-.61-.74-1.02-1.78-.91-2.81 1.48.06 2.53 1.03 3.1 1.74.56.7.94 1.73.86 2.7-.85.07-1.9-.41-2.42-1.13z" />
    </svg>
  );
}
