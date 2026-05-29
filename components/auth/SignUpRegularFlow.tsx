"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignUpCompleteStep } from "@/components/auth/SignUpCompleteStep";
import { SignUpDetailsStep } from "@/components/auth/SignUpDetailsStep";
import { SignUpVerifyStep } from "@/components/auth/SignUpVerifyStep";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SignInProgress } from "@/components/ui/SignInProgress";
import { landingPage } from "@/lib/landingPage";

type Step = "details" | "verify" | "complete";

export function SignUpRegularFlow() {
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [stepOverride, setStepOverride] = useState<Step | null>(null);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const step = useMemo<Step>(() => {
    if (stepOverride) return stepOverride;
    const missing = signUp?.missingFields ?? [];
    const needsName =
      missing.includes("first_name") || missing.includes("last_name");
    const needsPassword = missing.includes("password");
    if (needsName && !needsPassword) return "complete";
    return "details";
  }, [stepOverride, signUp?.missingFields]);

  useEffect(() => {
    if (authLoaded && isSignedIn && !redirecting) {
      setRedirecting(true);
      router.replace("/dashboard");
    }
  }, [authLoaded, isSignedIn, redirecting, router]);

  const busy = fetchStatus === "fetching" || redirecting;
  const signUpCopy = landingPage.auth.signUp;
  const verifyCopy = landingPage.auth.verify;
  const completeCopy = landingPage.auth.completeProfile;

  async function handleFinalize() {
    if (!signUp) return;
    setRedirecting(true);
    setFinalizeError(null);
    const finalizeResult = await signUp.finalize({ navigate: () => undefined });
    if (finalizeResult.error) {
      setRedirecting(false);
      setFinalizeError(
        finalizeResult.error.message ?? "Could not finish sign-up.",
      );
      return;
    }
    window.location.assign("/dashboard");
  }

  // Cover the case where the user lands on /sign-up while already signed
  // in (post-SSO bounce, second tab, etc.) so the form doesn't paint for
  // a frame before the redirect fires. The `!finalizeError` guard yields
  // if `signUp.finalize` failed after the account was already created.
  if (redirecting || (isSignedIn && !finalizeError)) {
    return <SignInProgress message="Taking you to your dashboard…" />;
  }

  const title =
    step === "verify"
      ? verifyCopy.title
      : step === "complete"
        ? completeCopy.title
        : signUpCopy.title;
  const subtitle =
    step === "verify"
      ? verifyCopy.subtitleTemplate.replace("{email}", verifyEmail)
      : step === "complete"
        ? completeCopy.subtitle
        : signUpCopy.subtitle;

  return (
    <AuthCard
      title={title}
      subtitle={subtitle}
      policyText={step === "details" ? signUpCopy.policyText : undefined}
    >
      {finalizeError && (
        <div className="mb-4">
          <ErrorBanner>{finalizeError}</ErrorBanner>
        </div>
      )}

      {step === "details" && (
        <SignUpDetailsStep
          signUp={signUp}
          busy={busy}
          invitedEmail={null}
          isInvitation={false}
          onCodeSent={(email) => {
            setVerifyEmail(email);
            setStepOverride("verify");
          }}
          onAlreadyComplete={handleFinalize}
          onError={() => {}}
        />
      )}
      {step === "verify" && (
        <SignUpVerifyStep
          signUp={signUp}
          busy={busy}
          onVerified={handleFinalize}
          onBack={() => setStepOverride("details")}
        />
      )}
      {step === "complete" && signUp && (
        <SignUpCompleteStep
          signUp={signUp}
          busy={busy}
          invitationTicket={null}
          onCompleted={handleFinalize}
        />
      )}

      {step === "details" && (
        <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {signUpCopy.switchPrompt}{" "}
          <Link
            href={signUpCopy.switchHref}
            className="font-semibold text-orange-700 hover:underline dark:text-orange-400"
          >
            {signUpCopy.switchLabel}
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
