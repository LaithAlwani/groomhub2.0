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
  serviceName: string;
  staffName: string;
  shopName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  // Live values used for the reminder's fire-time guard.
  actualStartTime: number;
  status: string;
  // Formatted in the org's timezone for display.
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
    const [client, pet, service, staff, org] = await Promise.all([
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
    ]);
    if (!client || !pet || !service || !staff || !org) return null;
    const staffUser = await ctx.db.get(staff.userId);
    const staffName = staffUser
      ? [staffUser.firstName, staffUser.lastName].filter(Boolean).join(" ") ||
        "your groomer"
      : "your groomer";
    return {
      clientEmail: client.email ?? null,
      clientFirstName: client.fullName.split(" ")[0] || "there",
      petName: pet.name,
      serviceName: service.name,
      staffName,
      shopName: org.name,
      contactEmail: org.contactEmail ?? null,
      contactPhone: org.contactPhone ?? null,
      actualStartTime: appointment.startTime,
      status: appointment.status,
      dateLabel: formatDateInTz(appointment.startTime, org.timezone),
      timeLabel: formatTimeInTz(appointment.startTime, org.timezone),
      previousDateLabel:
        args.previousStartTime !== undefined
          ? formatDateInTz(args.previousStartTime, org.timezone)
          : undefined,
      previousTimeLabel:
        args.previousStartTime !== undefined
          ? formatTimeInTz(args.previousStartTime, org.timezone)
          : undefined,
    };
  },
});

export const loadStaffEmailPayload = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args): Promise<StaffEmailPayload | null> => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;
    const [client, pet, service, staff, org] = await Promise.all([
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
    ]);
    if (!client || !pet || !service || !staff || !org) return null;
    const staffUser = await ctx.db.get(staff.userId);
    if (!staffUser) return null;
    return {
      staffEmail: staffUser.email || null,
      staffFirstName: staffUser.firstName || staffUser.email || "there",
      clientName: client.fullName,
      petName: pet.name,
      serviceName: service.name,
      shopName: org.name,
      dateLabel: formatDateInTz(appointment.startTime, org.timezone),
      timeLabel: formatTimeInTz(appointment.startTime, org.timezone),
    };
  },
});

export const loadAdminEmails = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;
    const [client, pet, declinedBy, org] = await Promise.all([
      ctx.db.get(appointment.clientId),
      ctx.db.get(appointment.petId),
      ctx.db.get(appointment.staffId),
      ctx.db
        .query("organizations")
        .withIndex("by_clerkOrgId", (index) =>
          index.eq("clerkOrgId", appointment.orgId),
        )
        .unique(),
    ]);
    if (!client || !pet || !declinedBy || !org) return null;
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
    return {
      adminEmails,
      declinedByName,
      clientName: client.fullName,
      petName: pet.name,
      shopName: org.name,
      dateLabel: formatDateInTz(appointment.startTime, org.timezone),
      timeLabel: formatTimeInTz(appointment.startTime, org.timezone),
    };
  },
});

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
