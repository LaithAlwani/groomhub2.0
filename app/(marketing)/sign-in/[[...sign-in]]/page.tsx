"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { z } from "zod";
import { Field } from "@/components/forms/Field";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { OrDivider } from "@/components/ui/OrDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SignInProgress } from "@/components/ui/SignInProgress";

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type Credentials = z.infer<typeof credentialsSchema>;
type FieldErrors = Partial<Record<keyof Credentials, string>>;

export default function SignInPage() {
  const { signIn, fetchStatus } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoaded && isSignedIn && !redirecting) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, redirecting, router]);

  const busy = fetchStatus === "fetching" || redirecting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0] as keyof FieldErrors;
        if (!nextErrors[fieldName]) nextErrors[fieldName] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    if (!signIn) return;

    const passwordResult = await signIn.password({
      identifier: parsed.data.email,
      password: parsed.data.password,
    });
    if (passwordResult.error) {
      setServerError(passwordResult.error.message ?? "Sign-in failed");
      return;
    }

    setRedirecting(true);
    const finalizeResult = await signIn.finalize({
      // No-op navigate so Clerk doesn't try to route us through its hosted
      // portal or session-tasks flow. We control the destination ourselves.
      navigate: () => undefined,
    });
    if (finalizeResult.error) {
      setRedirecting(false);
      setServerError(finalizeResult.error.message ?? "Could not complete sign-in");
      return;
    }
    window.location.assign("/dashboard");
  }

  async function handleGoogle() {
    setServerError(null);
    if (!signIn) {
      setServerError("Sign-in is still loading — give it a second and try again.");
      return;
    }
    const result = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectCallbackUrl: "/sso-callback",
    });
    if (result.error) {
      setServerError(result.error.message ?? "Could not start Google sign-in");
    }
  }

  if (redirecting) return <SignInProgress message="Signing you in…" />;

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Sign in to your GroomHub account.
      </p>

      <div className="mt-6">
        <GoogleButton
          onClick={handleGoogle}
          disabled={busy || !signIn}
          label="Continue with Google"
        />
      </div>
      <OrDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          autoComplete="current-password"
        />
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <button
          type="submit"
          disabled={busy || !signIn}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        New to GroomHub?{" "}
        <Link href="/sign-up" className="font-medium underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </section>
  );
}
