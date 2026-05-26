/**
 * Internal queries used by `convex/email.ts`. Lives in a sibling V8-runtime
 * file because `convex/email.ts` opts into the Node runtime (`"use node"`)
 * to call nodemailer, and Node-runtime files cannot contain queries.
 *
 * Three payload shapes:
 *  - `loadClientEmailPayload` — to email the pet's owner.
 *  - `loadStaffEmailPayload`  — to email the assigned groomer.
 *  - `loadAdminEmails`        — to email every active admin/superAdmin in the org.
 */

import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export type ClientEmailPayload = {
  clientEmail: string | null;
  clientFirstName: string;
  petName: string;
  // Breed surfaces in the Booking Details card next to the pet name, e.g.
  // "Cooper (Golden Retriever)". Undefined when the pet record has no
  // breed recorded.
  petBreed?: string;
  serviceName: string;
  staffName: string;
  shopName: string;
  // Signed Convex storage URL for the shop logo. `null` when the shop
  // hasn't uploaded a logo — the email template falls back to a paw glyph.
  logoUrl: string | null;
  locationName: string;
  // Single line "123 Main St · City, State 12345" — undefined when no address.
  locationAddressLine?: string;
  contactEmail: string | null;
  contactPhone: string | null;
  // Live values used for the reminder's fire-time guard.
  actualStartTime: number;
  status: string;
  // Formatted in the location's timezone for display.
  dateLabel: string;
  timeLabel: string;
  previousDateLabel?: string;
  previousTimeLabel?: string;
};

export type StaffEmailPayload = {
  staffEmail: string | null;
  staffFirstName: string;
  clientName: string;
  petName: string;
  serviceName: string;
  shopName: string;
  logoUrl: string | null;
  locationName: string;
  dateLabel: string;
  timeLabel: string;
};

export const loadClientEmailPayload = internalQuery({
  args: {
    appointmentId: v.id("appointments"),
    previousStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ClientEmailPayload | null> => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;
    const [client, pet, service, staff, org, location] = await Promise.all([
      ctx.db.get(appointment.clientId),
      ctx.db.get(appointment.petId),
      ctx.db.get(appointment.serviceId),
      ctx.db.get(appointment.staffId),
      ctx.db
        .query("organizations")
        .withIndex("by_clerkOrgId", (index) =>
          index.eq("clerkOrgId", appointment.orgId),
        )
        .unique(),
      ctx.db.get(appointment.locationId),
    ]);
    if (!client || !pet || !service || !staff || !org || !location) return null;
    const staffUser = await ctx.db.get(staff.userId);
    const staffName = staffUser
      ? [staffUser.firstName, staffUser.lastName].filter(Boolean).join(" ") ||
        "your groomer"
      : "your groomer";
    // Per-location Reply-To + phone take precedence over the org-level values;
    // location-level contactPhone reuses the org-level phone since the
    // schema currently only exposes phone on the location.
    const contactEmail = location.contactEmail ?? org.contactEmail ?? null;
    const contactPhone = location.phone ?? org.contactPhone ?? null;
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;
    return {
      clientEmail: client.email ?? null,
      clientFirstName: client.fullName.split(" ")[0] || "there",
      petName: pet.name,
      petBreed: pet.breed?.trim() || undefined,
      serviceName: service.name,
      staffName,
      shopName: org.name,
      logoUrl,
      locationName: location.name,
      locationAddressLine: formatAddressLine(location),
      contactEmail,
      contactPhone,
      actualStartTime: appointment.startTime,
      status: appointment.status,
      dateLabel: formatDateInTz(appointment.startTime, location.timezone),
      timeLabel: formatTimeInTz(appointment.startTime, location.timezone),
      previousDateLabel:
        args.previousStartTime !== undefined
          ? formatDateInTz(args.previousStartTime, location.timezone)
          : undefined,
      previousTimeLabel:
        args.previousStartTime !== undefined
          ? formatTimeInTz(args.previousStartTime, location.timezone)
          : undefined,
    };
  },
});

export const loadStaffEmailPayload = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args): Promise<StaffEmailPayload | null> => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;
    const [client, pet, service, staff, org, location] = await Promise.all([
      ctx.db.get(appointment.clientId),
      ctx.db.get(appointment.petId),
      ctx.db.get(appointment.serviceId),
      ctx.db.get(appointment.staffId),
      ctx.db
        .query("organizations")
        .withIndex("by_clerkOrgId", (index) =>
          index.eq("clerkOrgId", appointment.orgId),
        )
        .unique(),
      ctx.db.get(appointment.locationId),
    ]);
    if (!client || !pet || !service || !staff || !org || !location) return null;
    const staffUser = await ctx.db.get(staff.userId);
    if (!staffUser) return null;
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;
    return {
      staffEmail: staffUser.email || null,
      staffFirstName: staffUser.firstName || staffUser.email || "there",
      clientName: client.fullName,
      petName: pet.name,
      serviceName: service.name,
      shopName: org.name,
      logoUrl,
      locationName: location.name,
      dateLabel: formatDateInTz(appointment.startTime, location.timezone),
      timeLabel: formatTimeInTz(appointment.startTime, location.timezone),
    };
  },
});

export const loadAdminEmails = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;
    const [client, pet, declinedBy, org, location] = await Promise.all([
      ctx.db.get(appointment.clientId),
      ctx.db.get(appointment.petId),
      ctx.db.get(appointment.staffId),
      ctx.db
        .query("organizations")
        .withIndex("by_clerkOrgId", (index) =>
          index.eq("clerkOrgId", appointment.orgId),
        )
        .unique(),
      ctx.db.get(appointment.locationId),
    ]);
    if (!client || !pet || !declinedBy || !org || !location) return null;
    const declinedByUser = await ctx.db.get(declinedBy.userId);
    const declinedByName = declinedByUser
      ? [declinedByUser.firstName, declinedByUser.lastName]
          .filter(Boolean)
          .join(" ") || "A groomer"
      : "A groomer";
    const adminRows = await ctx.db
      .query("memberships")
      .withIndex("by_org_role", (index) =>
        index.eq("orgId", appointment.orgId).eq("role", "admin"),
      )
      .collect();
    const superAdminRows = await ctx.db
      .query("memberships")
      .withIndex("by_org_role", (index) =>
        index.eq("orgId", appointment.orgId).eq("role", "superAdmin"),
      )
      .collect();
    const adminEmails: string[] = [];
    for (const membership of [...adminRows, ...superAdminRows]) {
      if (!membership.isActive) continue;
      const adminUser = await ctx.db.get(membership.userId);
      if (adminUser?.email) adminEmails.push(adminUser.email);
    }
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;
    return {
      adminEmails,
      declinedByName,
      clientName: client.fullName,
      petName: pet.name,
      shopName: org.name,
      logoUrl,
      locationName: location.name,
      dateLabel: formatDateInTz(appointment.startTime, location.timezone),
      timeLabel: formatTimeInTz(appointment.startTime, location.timezone),
    };
  },
});

/**
 * Renders a one-line address from a location row, e.g. "123 Main St ·
 * Toronto, ON M5V 2T6". Returns undefined when no street + city/state are
 * set so the email footer omits the row cleanly instead of showing an empty
 * dot-separated label.
 */
function formatAddressLine(location: {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): string | undefined {
  const street = [location.addressLine1, location.addressLine2]
    .filter(Boolean)
    .join(", ");
  const cityState = [location.city, location.state, location.postalCode]
    .filter(Boolean)
    .join(", ");
  const segments = [street, cityState].filter((value) => value.length > 0);
  if (segments.length === 0) return undefined;
  return segments.join(" · ");
}

function formatDateInTz(timestamp: number, timezone: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeInTz(timestamp: number, timezone: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
