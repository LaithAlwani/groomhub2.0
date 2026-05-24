"use client";

import { useSearchParams } from "next/navigation";
import { useAuth, useSignUp, useUser } from "@clerk/nextjs";
import { SignUpInvitationFlow } from "@/components/auth/SignUpInvitationFlow";
import { SignUpRegularFlow } from "@/components/auth/SignUpRegularFlow";

export default function SignUpPage() {
  const { fetchStatus } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const invitationTicket =
    searchParams.get("__clerk_ticket") ??
    searchParams.get("__clerk_invitation_token");

  if (invitationTicket) {
    return (
      <SignUpInvitationFlow
        invitationTicket={invitationTicket}
        busy={fetchStatus === "fetching"}
        authLoaded={authLoaded}
        isSignedIn={Boolean(isSignedIn)}
        currentEmail={user?.primaryEmailAddress?.emailAddress ?? null}
      />
    );
  }

  return <SignUpRegularFlow />;
}
