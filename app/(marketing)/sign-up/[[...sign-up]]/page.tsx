"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, useClerk, useSignUp, useUser } from "@clerk/nextjs";
import { InvitationAcceptForm } from "@/components/auth/InvitationAcceptForm";
import { SignUpCompleteStep } from "@/components/auth/SignUpCompleteStep";
import { SignUpDetailsStep } from "@/components/auth/SignUpDetailsStep";
import { SignUpVerifyStep } from "@/components/auth/SignUpVerifyStep";
import { SignInProgress } from "@/components/ui/SignInProgress";

type Step = "details" | "verify" | "complete";

export default function SignUpPage() {
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();

  const invitationTicket =
    searchParams.get("__clerk_ticket") ??
    searchParams.get("__clerk_invitation_token");

  if (invitationTicket) {
    return (
      <InvitationFlow
        invitationTicket={invitationTicket}
        signUp={signUp}
        busy={fetchStatus === "fetching"}
        authLoaded={authLoaded}
        isSignedIn={Boolean(isSignedIn)}
        currentEmail={user?.primaryEmailAddress?.emailAddress ?? null}
        clerk={clerk}
      />
    );
  }

  return (
    <RegularSignUp
      signUp={signUp}
      fetchStatus={fetchStatus}
      authLoaded={authLoaded}
      isSignedIn={Boolean(isSignedIn)}
      router={router}
    />
  );
}

// ─── Invitation flow ────────────────────────────────────────────────────────
// Self-contained: read the ticket from the URL, render one form, submit one
// Clerk call, finalize, navigate. No multi-step machinery, no useEffect
// pre-applying the ticket. The form itself owns the entire acceptance.

function InvitationFlow({
  invitationTicket,
  signUp,
  busy,
  authLoaded,
  isSignedIn,
  currentEmail,
  clerk,
}: {
  invitationTicket: string;
  signUp: ReturnType<typeof useSignUp>["signUp"];
  busy: boolean;
  authLoaded: boolean;
  isSignedIn: boolean;
  currentEmail: string | null;
  clerk: ReturnType<typeof useClerk>;
}) {
  const [redirecting, setRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The legacy SignUpResource path inside InvitationAcceptForm activates the
  // session itself via `clerk.setActive`. We just navigate.
  async function handleAccepted() {
    setRedirecting(true);
    window.location.assign("/dashboard");
  }

  if (redirecting) {
    return <SignInProgress message="Taking you to your dashboard…" />;
  }

  // The orphan-account case: user is already signed in as someone else.
  // Sign them out and bring them back to this URL.
  if (authLoaded && isSignedIn) {
    const currentUrl =
      typeof window !== "undefined" ? window.location.href : "/sign-up";
    return (
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign out to accept this invitation
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;re currently signed in
          {currentEmail ? (
            <>
              {" "}as <span className="font-medium">{currentEmail}</span>
            </>
          ) : null}
          . Sign out and we&apos;ll bring you right back here.
        </p>
        <button
          type="button"
          onClick={() => clerk.signOut(() => window.location.assign(currentUrl))}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Sign out and continue
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Finish joining your shop
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;ve been invited to GroomHub. Confirm your details and you&apos;re in.
      </p>
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
        >
          {errorMessage}
        </div>
      )}
      <InvitationAcceptForm
        invitationTicket={invitationTicket}
        busy={busy}
        onAccepted={handleAccepted}
        onError={setErrorMessage}
      />
    </section>
  );
}

// ─── Regular (non-invitation) sign-up ───────────────────────────────────────

function RegularSignUp({
  signUp,
  fetchStatus,
  authLoaded,
  isSignedIn,
  router,
}: {
  signUp: ReturnType<typeof useSignUp>["signUp"];
  fetchStatus: "idle" | "fetching";
  authLoaded: boolean;
  isSignedIn: boolean;
  router: ReturnType<typeof useRouter>;
}) {
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

  if (redirecting) return <SignInProgress message="Taking you to your dashboard…" />;

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {step === "verify"
          ? "Verify your email"
          : step === "complete"
            ? "One more thing"
            : "Create your GroomHub account"}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {step === "verify"
          ? `We sent a 6-digit code to ${verifyEmail}.`
          : step === "complete"
            ? "Your Google account is missing a couple of details."
            : "Just a few details and you're in."}
      </p>

      {finalizeError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
        >
          {finalizeError}
        </div>
      )}

      <div className="mt-6">
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
      </div>

      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
