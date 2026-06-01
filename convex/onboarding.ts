import { query } from "./_generated/server";
import { readMembershipForQuery } from "./lib/ensureMembership";
import { mapClerkOrgRole } from "./lib/roles";
import { softAuth } from "./lib/tenant";

/**
 * First-run state for the dashboard's role-aware onboarding card.
 *
 * Returns `null` while auth/membership is settling (org switch, fresh login).
 * For owners/admins it reports which setup steps are done via cheap `take(1)`
 * existence checks; for groomers it reports whether they've confirmed their
 * working hours (the inherited shop-hours seed leaves `availabilityConfirmedAt`
 * unset until they actively save). One small realtime query.
 */
export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const identity = await softAuth(ctx);
    if (!identity) return null;
    const { membership } = await readMembershipForQuery(ctx, identity);
    if (!membership) return null;

    const orgId = identity.orgId;
    const role = mapClerkOrgRole(identity.orgRole);

    if (role === "staff") {
      return {
        role: "staff" as const,
        availabilityConfirmed: membership.availabilityConfirmedAt !== undefined,
      };
    }

    const [services, clients, pets, appointments, hours] = await Promise.all([
      ctx.db
        .query("services")
        .withIndex("by_org", (index) => index.eq("orgId", orgId))
        .take(1),
      ctx.db
        .query("clients")
        .withIndex("by_org", (index) => index.eq("orgId", orgId))
        .take(1),
      ctx.db
        .query("pets")
        .withIndex("by_org", (index) => index.eq("orgId", orgId))
        .take(1),
      ctx.db
        .query("appointments")
        .withIndex("by_org", (index) => index.eq("orgId", orgId))
        .take(1),
      ctx.db
        .query("locationHours")
        .withIndex("by_org_location", (index) => index.eq("orgId", orgId))
        .take(1),
    ]);

    return {
      role: "admin" as const,
      hasShopHours: hours.length > 0,
      hasServices: services.length > 0,
      hasClient: clients.length > 0,
      hasPet: pets.length > 0,
      hasAppointment: appointments.length > 0,
    };
  },
});
