/**
 * Friendly, user-facing message for a sign-in that didn't reach `complete`.
 * The common `needs_second_factor` + email-code path is handled directly in the
 * sign-in flow (we send/verify the code), so this is only reached for steps we
 * don't support inline (authenticator app, SMS, backup codes) or odd states —
 * and it must never leak internal Clerk diagnostics to end users.
 */
export function describePendingStep(
  status: string,
  supportedSecondFactors: string[],
): string {
  switch (status) {
    case "needs_second_factor": {
      const list =
        supportedSecondFactors.length > 0
          ? supportedSecondFactors.join(", ")
          : "an extra step";
      return `This account needs an additional verification step (${list}) that isn't available here yet. Please contact us to finish signing in.`;
    }
    case "needs_new_password":
      return "This account needs a password reset before you can sign in — use the “Forgot password?” link.";
    case "needs_first_factor":
      return "That password wasn't accepted for this account.";
    case "needs_identifier":
      return "We couldn't find an account with that email address.";
    default:
      return "We couldn't finish signing you in. Please try again, or contact us if it keeps happening.";
  }
}
