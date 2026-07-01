"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { z } from "zod";
import { describePendingStep } from "@/lib/auth/describePendingStep";

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type Credentials = z.infer<typeof credentialsSchema>;
type FieldErrors = Partial<Record<keyof Credentials, string>>;

/**
 * All state + handlers for the custom sign-in page: password (first factor),
 * the email-code second factor (`signIn.mfa`), Google SSO, and finalizing the
 * session. The page component just renders against what this returns.
 */
export function useSignInFlow() {
  const { signIn, fetchStatus } = useSignIn();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaPhase, setMfaPhase] = useState(false);
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoaded && isSignedIn && !redirecting) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, redirecting, router]);

  const busy = fetchStatus === "fetching" || redirecting;

  function secondFactorStrategies(): string[] {
    return (
      signIn?.supportedSecondFactors?.map((factor) =>
        "strategy" in factor ? factor.strategy : "unknown",
      ) ?? []
    );
  }

  async function completeSignIn() {
    if (!signIn) return;
    setRedirecting(true);
    const finalizeResult = await signIn.finalize({ navigate: () => undefined });
    if (finalizeResult.error) {
      setRedirecting(false);
      setServerError(
        finalizeResult.error.message ?? "Could not complete sign-in",
      );
      return;
    }
    window.location.assign("/dashboard");
  }

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
    if (signIn.status === "complete") {
      await completeSignIn();
      return;
    }
    // Email-code second factor: send it and move to the code step. Other
    // factors aren't supported inline — show a friendly message.
    if (signIn.status === "needs_second_factor") {
      const strategies = secondFactorStrategies();
      if (strategies.includes("email_code")) {
        const sent = await signIn.mfa.sendEmailCode();
        if (sent.error) {
          setServerError(
            sent.error.message ?? "Could not send a verification code",
          );
          return;
        }
        setCode("");
        setMfaPhase(true);
        return;
      }
      setServerError(describePendingStep(signIn.status, strategies));
      return;
    }
    setServerError(describePendingStep(signIn.status, secondFactorStrategies()));
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    if (!signIn) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length < 4) {
      setServerError("Enter the code from your email.");
      return;
    }
    const result = await signIn.mfa.verifyEmailCode({ code: trimmedCode });
    if (result.error) {
      setServerError(result.error.message ?? "That code didn't work — try again.");
      return;
    }
    if (signIn.status !== "complete") {
      setServerError("Couldn't complete sign-in. Please try again.");
      return;
    }
    await completeSignIn();
  }

  async function handleResendCode() {
    setServerError(null);
    if (!signIn) return;
    const sent = await signIn.mfa.sendEmailCode();
    if (sent.error) {
      setServerError(sent.error.message ?? "Could not resend the code");
    }
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

  return {
    ready: Boolean(signIn),
    busy,
    redirecting,
    isSignedIn,
    mfaPhase,
    email,
    password,
    code,
    fieldErrors,
    serverError,
    setEmail,
    setPassword,
    setCode,
    handleSubmit,
    handleVerifyCode,
    handleResendCode,
    handleGoogle,
  };
}
