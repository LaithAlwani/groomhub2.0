"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { type PlanFeature } from "@/convex/lib/plans";
import { usePlanFeature } from "@/lib/usePlanFeature";

const PLAN_LABEL: Record<string, string> = {
  essential: "Essential",
  professional: "Professional",
  enterprise: "Enterprise",
};

type Props = {
  feature: PlanFeature;
  children: ReactNode;
  /**
   * Custom upgrade nudge. If omitted, renders the default lock card with
   * "Upgrade to <PlanName>" prose. Pass `null` to render nothing on a block.
   */
  fallback?: ReactNode | null;
};

/**
 * Renders `children` when the org's plan tier includes the named feature,
 * otherwise renders an upgrade nudge. Server-side, the relevant mutation
 * still calls `requirePlanFeature` — this component is UX polish, not the
 * authoritative gate.
 */
export function PlanFeatureGate({ feature, children, fallback }: Props) {
  const { loading, allowed, requiredPlan } = usePlanFeature(feature);
  if (loading) return null;
  if (allowed) return <>{children}</>;
  if (fallback === null) return null;
  if (fallback !== undefined) return <>{fallback}</>;
  const planLabel = PLAN_LABEL[requiredPlan] ?? requiredPlan;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <Lock size={16} className="mt-0.5 shrink-0 text-zinc-500" />
      <div>
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          Upgrade to {planLabel}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          This feature is included with the {planLabel} plan.
        </p>
      </div>
    </div>
  );
}
