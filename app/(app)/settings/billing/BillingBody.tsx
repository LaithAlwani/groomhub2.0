"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Plan } from "@/convex/lib/plans";
import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard";
import { PlanSwitcher } from "@/components/billing/PlanSwitcher";
import { PaymentMethodSection } from "@/components/billing/PaymentMethodSection";
import { InvoiceList } from "@/components/billing/InvoiceList";
import { SubscribeDialog } from "@/components/billing/SubscribeDialog";
import { UpdateCardDialog } from "@/components/billing/UpdateCardDialog";
import { CancelDialog } from "@/components/billing/CancelDialog";

type DialogState =
  | { kind: "subscribe"; tier: Plan; clientSecret: string }
  | { kind: "updateCard"; clientSecret: string }
  | { kind: "cancel" }
  | null;

export function BillingBody() {
  const org = useQuery(api.organizations.getCurrent);
  const subscription = useQuery(api.subscriptions.getCurrent);
  const createSubscription = useAction(api.stripe.createSubscription);
  const updateSubscription = useAction(api.stripe.updateSubscription);
  const createSetupIntent = useAction(api.stripe.createSetupIntent);
  const resumeSubscription = useAction(api.stripe.resumeSubscription);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight") as Plan | null;

  const handleSwitchTier = async (tier: Plan) => {
    setError(null);
    setBusy(true);
    try {
      if (subscription) {
        await updateSubscription({ newTier: tier });
      } else {
        const result = await createSubscription({ tier });
        setDialog({ kind: "subscribe", tier, clientSecret: result.clientSecret });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCard = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await createSetupIntent({});
      setDialog({ kind: "updateCard", clientSecret: result.clientSecret });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setError(null);
    setBusy(true);
    try {
      await resumeSubscription({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (org === undefined || subscription === undefined) {
    return <BillingSkeleton />;
  }
  if (org === null) return null;

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <CurrentPlanCard
        effectivePlan={org.effectivePlan as Plan}
        isTrialing={org.isTrialing}
        trialEndsAt={org.trialEndsAt ?? null}
        subscription={subscription}
        onResume={handleResume}
        onCancel={() => setDialog({ kind: "cancel" })}
        busy={busy}
      />

      <PlanSwitcher
        currentSubscriptionTier={subscription?.plan ?? null}
        highlightedTier={highlight}
        onSelectTier={handleSwitchTier}
        busy={busy}
      />

      <PaymentMethodSection
        hasSubscription={subscription !== null}
        onUpdateCard={handleUpdateCard}
        busy={busy}
      />

      <InvoiceList hasSubscription={subscription !== null} />

      {dialog?.kind === "subscribe" && (
        <SubscribeDialog
          tier={dialog.tier}
          clientSecret={dialog.clientSecret}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "updateCard" && (
        <UpdateCardDialog
          clientSecret={dialog.clientSecret}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "cancel" && (
        <CancelDialog onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
