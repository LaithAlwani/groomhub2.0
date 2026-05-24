"use client";

import { useState } from "react";
import { useClerk, useSignUp } from "@clerk/nextjs";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPrimaryButton } from "@/components/auth/AuthPrimaryButton";
import { InvitationAcceptForm } from "@/components/auth/InvitationAcceptForm";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SignInProgress } from "@/components/ui/SignInProgress";
import { landingPage } from "@/lib/landingPage";

export function SignUpInvitationFlow({
  invitationTicket,
  busy,
  authLoaded,
  isSignedIn,
  currentEmail,
}: {
  invitationTicket: string;
  busy: boolean;
  authLoaded: boolean;
  isSignedIn: boolean;
  currentEmail: string | null;
}) {
  const clerk = useClerk();
  const [redirecting, setRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const invitationCopy = landingPage.auth.invitation;

  if (redirecting) {
    return <SignInProgress message="Taking you to your dashboard…" />;
  }

  if (authLoaded && isSignedIn) {
    const currentUrl =
      typeof window !== "undefined" ? window.location.href : "/sign-up";
    const subtitle = currentEmail
      ? `You're currently signed in as ${currentEmail}. Sign out and we'll bring you right back here.`
      : "You're currently signed in. Sign out and we'll bring you right back here.";
    return (
      <AuthCard
        title="Sign out to accept this invitation"
        subtitle={subtitle}
      >
        <AuthPrimaryButton
          type="button"
          onClick={() => clerk.signOut(() => window.location.assign(currentUrl))}
        >
          Sign out and continue
        </AuthPrimaryButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={invitationCopy.title} subtitle={invitationCopy.subtitle}>
      {errorMessage && (
        <div className="mb-4">
          <ErrorBanner>{errorMessage}</ErrorBanner>
        </div>
      )}
      <InvitationAcceptForm
        invitationTicket={invitationTicket}
        busy={busy}
        onAccepted={() => {
          setRedirecting(true);
          window.location.assign("/dashboard");
        }}
        onError={setErrorMessage}
      />
    </AuthCard>
  );
}
