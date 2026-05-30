"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Activity, BarChart3, Crown, DollarSign, Scissors } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { mapClerkOrgRole } from "@/convex/lib/roles";
import { planAllows, type Plan } from "@/convex/lib/plans";
import { CriticalAlertsCard } from "./CriticalAlertsCard";
import { DeclinedQueueList } from "./DeclinedQueueList";
import { LockedWidgetTeaser } from "./LockedWidgetTeaser";
import { PendingApprovalsList } from "./PendingApprovalsList";
import { RevenueCard } from "./RevenueCard";
import { SalonHealthCard } from "./SalonHealthCard";
import { TodayList } from "./TodayList";
import { TopClientsCard } from "./TopClientsCard";
import { TopServicesCard } from "./TopServicesCard";
import { UpcomingTodayCard } from "./UpcomingTodayCard";
import { WeekMetricsCard } from "./WeekMetricsCard";

/**
 * Composes the dashboard from the right slice of widgets for the active
 * org's plan tier and the caller's role.
 *
 * Two independent dimensions:
 *   - **Plan tier** (`org.plan`) decides whether a widget renders live or
 *     as a `LockedWidgetTeaser` with an upgrade nudge.
 *   - **Role** decides whether owner-only financial cards (revenue, top
 *     clients) render at all. The underlying Convex queries also enforce
 *     these gates server-side — this is just to avoid sending blank UI.
 */
export function DashboardBody() {
  const org = useQuery(api.organizations.getCurrent);
  const { membership, isLoaded: orgLoaded } = useOrganization();

  if (org === undefined || !orgLoaded) {
    return <DashboardSkeleton />;
  }
  if (org === null) {
    return null;
  }

  const plan = (org.plan ?? "essential") as Plan;
  const role = mapClerkOrgRole(membership?.role ?? null);
  const isOwner = role === "superAdmin";
  const isAdminPlus = role === "superAdmin" || role === "admin";
  const allowsSalonHealth = planAllows(plan, "dashboardSalonHealth");
  const allowsAdvanced = planAllows(plan, "dashboardAdvancedAnalytics");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <div className="md:col-span-2">
        <TodayList />
      </div>
      <UpcomingTodayCard />

      <CriticalAlertsCard />
      {isOwner ? (
        <RevenueCard />
      ) : (
        // Hidden entirely for non-owners — the whole widget is sensitive.
        // Render an invisible spacer so the grid keeps the same shape; an
        // empty fragment would leave the next card jumping into this cell.
        <div className="hidden md:block" aria-hidden />
      )}
      <div className="md:col-span-2 xl:col-span-1">
        <PendingApprovalsList />
      </div>

      {isAdminPlus && (
        <div className="md:col-span-2 xl:col-span-3">
          <DeclinedQueueList />
        </div>
      )}

      {allowsSalonHealth ? (
        <SalonHealthCard />
      ) : (
        <LockedWidgetTeaser
          title="Salon health"
          icon={BarChart3}
          requiredPlan="professional"
          tagline="Track occupancy, available capacity, and how full your week is."
        />
      )}
      {allowsSalonHealth ? (
        <WeekMetricsCard />
      ) : (
        <LockedWidgetTeaser
          title="This week"
          icon={Activity}
          requiredPlan="professional"
          tagline="Booking volume vs last week, no-show rate, and weekly revenue."
        />
      )}
      {allowsAdvanced ? (
        <TopServicesCard />
      ) : (
        <LockedWidgetTeaser
          title="Top services"
          icon={Scissors}
          requiredPlan="enterprise"
          tagline="See which services drive the most bookings each month."
        />
      )}
      {allowsAdvanced && isOwner ? (
        <TopClientsCard />
      ) : !allowsAdvanced ? (
        <LockedWidgetTeaser
          title="Top clients by spend"
          icon={Crown}
          requiredPlan="enterprise"
          tagline="Identify your highest-value clients and reward loyalty."
        />
      ) : (
        // Enterprise plan + non-owner: card is hidden entirely. Spacer to
        // keep the grid balanced on xl.
        <div className="hidden xl:block" aria-hidden />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
