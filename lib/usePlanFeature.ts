"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FEATURE_MIN_PLAN,
  type Plan,
  type PlanFeature,
  planAllows,
} from "@/convex/lib/plans";

/**
 * Returns whether the active org's plan tier includes the named feature.
 * `loading` is true while the org query is in flight (e.g. during org switch);
 * UI should render a disabled-ish state until it settles, not assume blocked.
 */
export function usePlanFeature(feature: PlanFeature): {
  loading: boolean;
  allowed: boolean;
  currentPlan: Plan | null;
  requiredPlan: Plan;
} {
  const org = useQuery(api.organizations.getCurrent);
  const requiredPlan = FEATURE_MIN_PLAN[feature];
  if (org === undefined) {
    return { loading: true, allowed: false, currentPlan: null, requiredPlan };
  }
  if (org === null) {
    return { loading: false, allowed: false, currentPlan: null, requiredPlan };
  }
  const currentPlan = org.plan as Plan;
  return {
    loading: false,
    allowed: planAllows(currentPlan, feature),
    currentPlan,
    requiredPlan,
  };
}
