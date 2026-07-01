"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { SignInCodeForm } from "@/components/auth/SignInCodeForm";
import { SignInCredentialsForm } from "@/components/auth/SignInCredentialsForm";
import { useSignInFlow } from "@/components/auth/useSignInFlow";
import { SignInProgress } from "@/components/ui/SignInProgress";
import { landingPage } from "@/lib/landingPage";

export default function SignInPage() {
  const flow = useSignInFlow();
  const copy = landingPage.auth.signIn;

  if (flow.redirecting || (flow.isSignedIn && !flow.serverError)) {
    return <SignInProgress message="Signing you in…" />;
  }

  return (
    <AuthCard
      title={flow.mfaPhase ? "Check your email" : copy.title}
      subtitle={
        flow.mfaPhase
          ? "Enter the code we just sent to finish signing in."
          : copy.subtitle
      }
      policyText={copy.policyText}
    >
      {flow.mfaPhase ? (
        <SignInCodeForm
          email={flow.email}
          code={flow.code}
          onCodeChange={flow.setCode}
          onSubmit={flow.handleVerifyCode}
          onResend={flow.handleResendCode}
          error={flow.serverError}
          busy={flow.busy || !flow.ready}
        />
      ) : (
        <SignInCredentialsForm
          email={flow.email}
          password={flow.password}
          onEmailChange={flow.setEmail}
          onPasswordChange={flow.setPassword}
          fieldErrors={flow.fieldErrors}
          serverError={flow.serverError}
          onSubmit={flow.handleSubmit}
          onGoogle={flow.handleGoogle}
          busy={flow.busy}
          ready={flow.ready}
          copy={copy}
        />
      )}
    </AuthCard>
  );
}
