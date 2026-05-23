"use client";

import { useEffect, useState } from "react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { ExistingShopList } from "@/components/onboarding/ExistingShopList";
import {
  NewShopForm,
  NewShopFormError,
} from "@/components/onboarding/NewShopForm";
import { SignInProgress } from "@/components/ui/SignInProgress";

export default function CreateShopPage() {
  const { isLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: false },
  });
  const { orgId: activeOrgId } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const memberships = userMemberships?.data ?? [];

  // Post-invitation auto-join: if the user has memberships but no active org
  // (typical right after accepting an invite), activate the most recent one
  // and head to the dashboard. If they have multiple shops they can switch
  // afterwards via <OrganizationSwitcher>.
  useEffect(() => {
    if (!isLoaded || !setActive || autoJoining || submitting) return;
    if (activeOrgId) return;
    if (memberships.length === 0) return;

    const targetOrgId = memberships[0].organization.id;
    setAutoJoining(true);
    (async () => {
      try {
        await setActive({ organization: targetOrgId });
        window.location.assign("/dashboard");
      } catch (caught) {
        setAutoJoining(false);
        setServerError(
          caught instanceof Error
            ? caught.message
            : "Could not open your shop",
        );
      }
    })();
  }, [isLoaded, setActive, autoJoining, submitting, activeOrgId, memberships]);

  async function handleSwitchToExisting(organizationId: string) {
    if (!setActive) return;
    setSubmitting(true);
    try {
      await setActive({ organization: organizationId });
      window.location.assign("/dashboard");
    } catch (caught) {
      setSubmitting(false);
      setServerError(
        caught instanceof Error ? caught.message : "Could not switch shops",
      );
    }
  }

  if (!isLoaded) return <WizardSkeleton />;
  if (autoJoining) return <SignInProgress message="Opening your shop…" />;

  return (
    <section className="mx-auto w-full max-w-xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your shop</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        This becomes your booking workspace. You can invite staff and configure
        services in a moment.
      </p>

      <ExistingShopList
        memberships={memberships}
        disabled={submitting}
        onSwitch={handleSwitchToExisting}
      />

      <NewShopForm
        submitting={submitting}
        onSubmitStart={() => {
          setSubmitting(true);
          setServerError(null);
        }}
        onSubmitError={(message) => {
          setSubmitting(false);
          setServerError(message);
        }}
      />

      {serverError && (
        <div className="mt-4">
          <NewShopFormError message={serverError} />
        </div>
      )}
    </section>
  );
}

function WizardSkeleton() {
  return (
    <section className="mx-auto w-full max-w-xl px-6 py-12">
      <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </section>
  );
}
