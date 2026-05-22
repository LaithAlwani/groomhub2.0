/**
 * Transactional email pipeline.
 *
 * Mutations schedule one of the three `send*` internal actions via
 * `ctx.scheduler.runAfter(0, internal.email.sendBookingConfirmation, …)`.
 * The action loads everything it needs through `loadEmailPayload` (an
 * internal query — actions can't read the DB directly), renders an inline
 * HTML email, and POSTs it to Resend.
 *
 * Env vars (set in the Convex dashboard, not the app's `.env.local`):
 *   - RESEND_API_KEY      — required to actually send. If missing the action
 *                           logs a warning and no-ops, so dev still works.
 *   - RESEND_FROM_ADDRESS — optional; defaults to onboarding@resend.dev which
 *                           only delivers back to the Resend account owner.
 *                           Real shops must verify a domain in Resend and
 *                           point this at e.g. "Posh Paws <hello@poshpaws.app>".
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

type EmailPayload = {
  clientEmail: string | null;
  clientFirstName: string;
  petName: string;
  serviceName: string;
  staffName: string;
  shopName: string;
  dateLabel: string;
  timeLabel: string;
  previousDateLabel?: string;
  previousTimeLabel?: string;
};

export const loadEmailPayload = internalQuery({
  args: {
    appointmentId: v.id("appointments"),
    previousStartTime: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<EmailPayload | null> => {
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

export const sendBookingConfirmation = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.email.loadEmailPayload, {
      appointmentId: args.appointmentId,
    });
    await deliver(payload, {
      subject: (p) => `Your appointment at ${p.shopName} is confirmed`,
      headline: "You're booked! 🐾",
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">Great news — ${escape(p.petName)}'s <strong>${escape(p.serviceName)}</strong> is confirmed with ${escape(p.staffName)}.</p>`,
    });
  },
});

export const sendBookingCancellation = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.email.loadEmailPayload, {
      appointmentId: args.appointmentId,
    });
    await deliver(payload, {
      subject: (p) => `Your appointment at ${p.shopName} was cancelled`,
      headline: "Appointment cancelled",
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">We're sorry — ${escape(p.petName)}'s <strong>${escape(p.serviceName)}</strong> on ${escape(p.dateLabel)} at ${escape(p.timeLabel)} has been cancelled.</p>` +
        `<p style="margin:0 0 12px;">Reply to this email or give us a call and we'll get a new slot booked.</p>`,
    });
  },
});

export const sendPetReady = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.email.loadEmailPayload, {
      appointmentId: args.appointmentId,
    });
    await deliver(payload, {
      subject: (p) => `${p.petName} is all done at ${p.shopName}! 🐾`,
      headline: (p) => `${p.petName} is ready for pickup`,
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">Good news — <strong>${escape(p.petName)}</strong>'s ${escape(p.serviceName)} is all done. They're freshly groomed and waiting for you whenever you're ready to swing by.</p>` +
        `<p style="margin:0 0 12px;">Thanks for trusting us with ${escape(p.petName)} today — give them a big head-scratch from ${escape(p.staffName)}.</p>`,
    });
  },
});

export const sendBookingReschedule = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    previousStartTime: v.number(),
  },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.email.loadEmailPayload, {
      appointmentId: args.appointmentId,
      previousStartTime: args.previousStartTime,
    });
    await deliver(payload, {
      subject: (p) => `Your appointment at ${p.shopName} was rescheduled`,
      headline: "New time for your appointment",
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">${escape(p.petName)}'s <strong>${escape(p.serviceName)}</strong> has been moved.</p>` +
        (p.previousDateLabel && p.previousTimeLabel
          ? `<p style="margin:0 0 12px;color:#71717a;">Was: ${escape(p.previousDateLabel)} at ${escape(p.previousTimeLabel)}</p>`
          : ""),
    });
  },
});

type Template = {
  subject: (payload: EmailPayload) => string;
  headline: string | ((payload: EmailPayload) => string);
  body: (payload: EmailPayload) => string;
};

async function deliver(
  payload: EmailPayload | null,
  template: Template,
): Promise<void> {
  if (!payload) return;
  if (!payload.clientEmail) {
    console.warn("email: client has no email on file; skipping");
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("email: RESEND_API_KEY not set; skipping send");
    return;
  }
  const from =
    process.env.RESEND_FROM_ADDRESS ?? "GroomHub <onboarding@resend.dev>";
  const subject = template.subject(payload);
  const headline =
    typeof template.headline === "function"
      ? template.headline(payload)
      : template.headline;
  const html = renderEmailHtml({
    headline,
    body: template.body(payload),
    payload,
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.clientEmail,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    console.error(
      "email: Resend send failed",
      response.status,
      await response.text(),
    );
  }
}

function renderEmailHtml(input: {
  headline: string;
  body: string;
  payload: EmailPayload;
}): string {
  const { headline, body, payload } = input;
  const details =
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;background:#f4f4f5;border-radius:10px;padding:16px;margin:8px 0 16px;">` +
    `<tr><td style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#27272a;line-height:1.55;">` +
    `<div style="font-weight:600;color:#18181b;">${escape(payload.petName)} · ${escape(payload.serviceName)}</div>` +
    `<div>${escape(payload.dateLabel)} at ${escape(payload.timeLabel)}</div>` +
    `<div>with ${escape(payload.staffName)}</div>` +
    `</td></tr></table>`;
  return (
    `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#27272a;">` +
    `<table cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e4e4e7;">` +
    `<tr><td>` +
    `<div style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;margin-bottom:6px;">${escape(payload.shopName)}</div>` +
    `<h1 style="margin:0 0 16px;font-size:22px;color:#18181b;">${escape(headline)}</h1>` +
    body +
    details +
    `<p style="margin:0 0 4px;color:#52525b;font-size:13px;">If anything's wrong, just reply to this email and we'll sort it.</p>` +
    `<p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;">— ${escape(payload.shopName)}</p>` +
    `</td></tr></table></body></html>`
  );
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
