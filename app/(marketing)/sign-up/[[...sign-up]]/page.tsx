"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { z } from "zod";

const detailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type Step = "details" | "verify";
type FieldErrors = Partial<Record<keyof z.infer<typeof detailsSchema>, string>>;

export default function SignUpPage() {
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (authLoaded && isSignedIn && !redirecting) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, redirecting, router]);

  const [step, setStep] = useState<Step>("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching" || redirecting;

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const parsed = detailsSchema.safeParse({ firstName, lastName, email, password });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    if (!signUp) return;

    const { error } = await signUp.password({
      emailAddress: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    if (error) {
      setServerError(error.message ?? "Sign-up failed");
      return;
    }

    const { error: sendErr } = await signUp.verifications.sendEmailCode();
    if (sendErr) {
      setServerError(sendErr.message ?? "Could not send verification code");
      return;
    }
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (code.trim().length < 4) {
      setServerError("Enter the code from your email");
      return;
    }
    if (!signUp) return;

    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) {
      setServerError(error.message ?? "Verification failed");
      return;
    }

    setRedirecting(true);
    const { error: finalErr } = await signUp.finalize();
    if (finalErr) {
      setRedirecting(false);
      setServerError(finalErr.message ?? "Could not complete sign-up");
      return;
    }
    // Full-page navigation so the proxy middleware reads fresh session cookies.
    window.location.assign("/dashboard");
  }

  async function handleGoogle() {
    if (!signUp) return;
    setServerError(null);
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectCallbackUrl: "/sso-callback",
    });
    if (error) setServerError(error.message ?? "Could not start Google sign-up");
  }

  if (redirecting) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Taking you to your dashboard…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {step === "details" ? "Create your GroomHub account" : "Verify your email"}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {step === "details"
          ? "Just a few details and you're in."
          : `We sent a 6-digit code to ${email}.`}
      </p>

      {step === "details" && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || !signUp}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                error={fieldErrors.firstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                error={fieldErrors.lastName}
                autoComplete="family-name"
              />
            </div>
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              error={fieldErrors.email}
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={fieldErrors.password}
              autoComplete="new-password"
            />
            <div id="clerk-captcha" />
            {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
            <button
              type="submit"
              disabled={busy || !signUp}
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        </>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <Field
            label="Verification code"
            value={code}
            onChange={setCode}
            autoComplete="one-time-code"
            inputMode="numeric"
          />
          {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
          <button
            type="submit"
            disabled={busy || !signUp}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
          <button
            type="button"
            onClick={() => setStep("details")}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Use a different email
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
      />
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
    >
      {children}
    </div>
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
