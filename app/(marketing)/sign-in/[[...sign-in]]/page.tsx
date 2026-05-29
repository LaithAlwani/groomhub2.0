"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { Lock, Mail } from "lucide-react";
import { z } from "zod";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthPrimaryButton } from "@/components/auth/AuthPrimaryButton";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SignInProgress } from "@/components/ui/SignInProgress";
import { landingPage } from "@/lib/landingPage";

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
  const copy = landingPage.auth.signIn;

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

  // Render the branded loader as soon as Clerk reports an active session,
  // not just when we kick off the redirect ourselves. Otherwise the form
  // paints for one frame after the SSO callback bounces back here.
  if (redirecting || isSignedIn) {
    return <SignInProgress message="Signing you in…" />;
  }

  return (
    <AuthCard
      title={copy.title}
      subtitle={copy.subtitle}
      policyText={copy.policyText}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Email Address"
          icon={Mail}
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="name@company.com"
        />
        <AuthInput
          label="Password"
          icon={Lock}
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
          trailingSlot={
            <Link
              href={copy.forgotPasswordHref}
              className="text-xs font-semibold text-orange-700 hover:underline dark:text-orange-400"
            >
              {copy.forgotPasswordLabel}
            </Link>
          }
        />
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        <AuthPrimaryButton disabled={busy || !signIn}>
          {busy ? "Signing in…" : copy.submitLabel}
        </AuthPrimaryButton>
      </form>

      <SocialAuthButtons onGoogle={handleGoogle} disabled={busy || !signIn} />

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        {copy.switchPrompt}{" "}
        <Link
          href={copy.switchHref}
          className="font-semibold text-orange-700 hover:underline dark:text-orange-400"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </AuthCard>
  );
}
