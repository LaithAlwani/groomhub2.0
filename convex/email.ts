"use node";

/**
 * Transactional email pipeline (Node runtime — uses nodemailer for SMTP).
 *
 * The "use node" directive opts every action in this file into Convex's Node
 * runtime, which means we can import npm packages like nodemailer. The
 * trade-off: Node-runtime files cannot contain queries — all internal queries
 * live in `convex/emailPayloads.ts` (V8) and we reach them via
 * `ctx.runQuery(internal.emailPayloads.X)`.
 *
 * Env vars (set in the Convex dashboard, not the app's `.env.local`):
 *   - SMTP_HOST           — e.g. smtp.zeptomail.com, smtp-relay.brevo.com
 *   - SMTP_PORT           — 587 (STARTTLS) or 465 (TLS)
 *   - SMTP_USER           — provider-issued
 *   - SMTP_PASS           — provider-issued (secret)
 *   - EMAIL_FROM_ADDRESS  — verified sender, e.g. bookings@groomhub.app
 *   - EMAIL_FROM_NAME     — optional fallback display name (defaults "GroomHub")
 *
 * If any of the SMTP envs is missing the action logs a warning and no-ops,
 * so dev / local can run without email setup.
 */

import { v } from "convex/values";
import nodemailer, { type Transporter } from "nodemailer";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type {
  ClientEmailPayload,
  StaffEmailPayload,
} from "./emailPayloads";

/* ───────────────────────── Client-facing emails ───────────────────────── */

export const sendBookingConfirmation = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadClientEmailPayload,
      { appointmentId: args.appointmentId },
    );
    await deliverToClient(payload, {
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
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadClientEmailPayload,
      { appointmentId: args.appointmentId },
    );
    await deliverToClient(payload, {
      subject: (p) => `Your appointment at ${p.shopName} was cancelled`,
      headline: "Appointment cancelled",
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">We're sorry — ${escape(p.petName)}'s <strong>${escape(p.serviceName)}</strong> on ${escape(p.dateLabel)} at ${escape(p.timeLabel)} has been cancelled.</p>` +
        `<p style="margin:0 0 12px;">Reply to this email or give us a call and we'll get a new slot booked.</p>`,
    });
  },
});

export const sendBookingReschedule = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    previousStartTime: v.number(),
  },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadClientEmailPayload,
      {
        appointmentId: args.appointmentId,
        previousStartTime: args.previousStartTime,
      },
    );
    await deliverToClient(payload, {
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

export const sendPetReady = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadClientEmailPayload,
      { appointmentId: args.appointmentId },
    );
    await deliverToClient(payload, {
      subject: (p) => `${p.petName} is all done at ${p.shopName}! 🐾`,
      headline: (p) => `${p.petName} is ready for pickup`,
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">Good news — <strong>${escape(p.petName)}</strong>'s ${escape(p.serviceName)} is all done. They're freshly groomed and waiting for you whenever you're ready to swing by.</p>` +
        `<p style="margin:0 0 12px;">Thanks for trusting us with ${escape(p.petName)} today — give them a big head-scratch from ${escape(p.staffName)}.</p>`,
    });
  },
});

/**
 * 24-hour reminder. Scheduled on confirm / reschedule with the booking's
 * `startTime` baked into `expectedStartTime`. Self-validates at fire time so
 * cancellations and reschedules don't need to track cancellation handles.
 */
export const sendBookingReminder = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    expectedStartTime: v.number(),
  },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadClientEmailPayload,
      { appointmentId: args.appointmentId },
    );
    if (!payload) return;
    // Reschedule moved the appointment — a newer reminder is scheduled.
    if (payload.actualStartTime !== args.expectedStartTime) return;
    // Cancelled / no-show / completed / etc — skip.
    if (payload.status !== "scheduled" && payload.status !== "checkedIn") return;
    await deliverToClient(payload, {
      subject: (p) => `Reminder: ${p.petName}'s appointment tomorrow at ${p.shopName}`,
      headline: "See you tomorrow! 🐾",
      body: (p) =>
        `<p style="margin:0 0 12px;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;">Just a friendly reminder that ${escape(p.petName)}'s <strong>${escape(p.serviceName)}</strong> with ${escape(p.staffName)} is coming up on ${escape(p.dateLabel)} at ${escape(p.timeLabel)}.</p>` +
        `<p style="margin:0 0 12px;">Need to change anything? Reply to this email or call us and we'll sort it out.</p>`,
    });
  },
});

/* ───────────────────────── Staff-facing emails ────────────────────────── */

export const sendPendingApprovalToGroomer = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadStaffEmailPayload,
      { appointmentId: args.appointmentId },
    );
    if (!payload || !payload.staffEmail) {
      console.warn("email: staff has no email; skipping pending approval ping");
      return;
    }
    const html = renderStaffEmail({
      headline: "New booking needs your approval",
      body:
        `<p style="margin:0 0 12px;">Hi ${escape(payload.staffFirstName)},</p>` +
        `<p style="margin:0 0 12px;"><strong>${escape(payload.clientName)}</strong> just booked ${escape(payload.petName)} for <strong>${escape(payload.serviceName)}</strong> on ${escape(payload.dateLabel)} at ${escape(payload.timeLabel)}.</p>` +
        `<p style="margin:0 0 12px;">Open GroomHub to confirm or decline.</p>`,
      shopName: payload.shopName,
    });
    await sendRaw({
      to: payload.staffEmail,
      fromDisplayName: payload.shopName,
      subject: `New booking needs your approval at ${payload.shopName}`,
      html,
    });
  },
});

export const sendDeclinedToAdmins = internalAction({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.emailPayloads.loadAdminEmails,
      { appointmentId: args.appointmentId },
    );
    if (!payload) return;
    if (payload.adminEmails.length === 0) {
      console.warn("email: no admin emails on file; skipping decline alert");
      return;
    }
    const html = renderStaffEmail({
      headline: "A booking was declined",
      body:
        `<p style="margin:0 0 12px;"><strong>${escape(payload.declinedByName)}</strong> declined ${escape(payload.clientName)}'s booking for ${escape(payload.petName)} on ${escape(payload.dateLabel)} at ${escape(payload.timeLabel)}.</p>` +
        `<p style="margin:0 0 12px;">Reassign or cancel it from your dashboard's declined queue.</p>`,
      shopName: payload.shopName,
    });
    await Promise.all(
      payload.adminEmails.map((to) =>
        sendRaw({
          to,
          fromDisplayName: payload.shopName,
          subject: `${payload.declinedByName} declined a booking at ${payload.shopName}`,
          html,
        }),
      ),
    );
  },
});

/* ──────────────────────────── Transport ───────────────────────────────── */

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

async function sendRaw(params: {
  to: string;
  fromDisplayName: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      "email: SMTP not configured (missing SMTP_HOST/PORT/USER/PASS); skipping send",
    );
    return;
  }
  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS ?? "no-reply@groomhub.local";
  const fallbackName = process.env.EMAIL_FROM_NAME ?? "GroomHub";
  const displayName = params.fromDisplayName || fallbackName;
  const from = `"${displayName.replace(/"/g, "")}" <${fromAddress}>`;
  try {
    const result = await transporter.sendMail({
      from,
      to: params.to,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
    });
    // `result.response` is the raw "250 OK" line from the SMTP server when
    // delivery is accepted; `messageId` is the RFC 822 Message-ID. Logging
    // both lets you confirm in the Convex logs that the mail was actually
    // handed off to the provider (not just that the action ran).
    console.info(
      `email: sent to=${params.to} subject="${params.subject}" id=${result.messageId} response=${result.response}`,
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error(
      `email: SMTP send FAILED to=${params.to} subject="${params.subject}" error=${message}`,
    );
  }
}

/**
 * One-shot diagnostic action. Run from the Convex dashboard (Functions →
 * email → sendTest → Run) or the CLI:
 *
 *     npx convex run email:sendTest '{"to":"support@meepletron.com"}'
 *
 * Sends a tiny "GroomHub SMTP test" message through the same `sendRaw`
 * pipeline the real emails use. The Convex log will tell you exactly which
 * leg failed (missing env vars, SMTP auth, etc.) without needing to set up
 * a full booking. Returns the recipient so the dashboard shows a result.
 */
export const sendTest = action({
  args: { to: v.string() },
  handler: async (_ctx, args) => {
    const config = {
      SMTP_HOST: process.env.SMTP_HOST ?? "(unset)",
      SMTP_PORT: process.env.SMTP_PORT ?? "(unset)",
      SMTP_USER: process.env.SMTP_USER ?? "(unset)",
      SMTP_PASS: process.env.SMTP_PASS ? "(set)" : "(unset)",
      EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS ?? "(unset)",
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ?? "(unset)",
    };
    console.info(`email: sendTest config ${JSON.stringify(config)}`);
    await sendRaw({
      to: args.to,
      fromDisplayName: "GroomHub Test",
      subject: "GroomHub SMTP test",
      html: `<p>If you're reading this in <strong>${args.to}</strong>, the SMTP path is healthy.</p>`,
    });
    return { to: args.to, config };
  },
});

type ClientTemplate = {
  subject: (payload: ClientEmailPayload) => string;
  headline: string | ((payload: ClientEmailPayload) => string);
  body: (payload: ClientEmailPayload) => string;
};

async function deliverToClient(
  payload: ClientEmailPayload | null,
  template: ClientTemplate,
): Promise<void> {
  if (!payload) return;
  if (!payload.clientEmail) {
    console.warn("email: client has no email on file; skipping");
    return;
  }
  const subject = template.subject(payload);
  const headline =
    typeof template.headline === "function"
      ? template.headline(payload)
      : template.headline;
  const html = renderClientEmail({
    headline,
    body: template.body(payload),
    payload,
  });
  await sendRaw({
    to: payload.clientEmail,
    fromDisplayName: payload.shopName,
    subject,
    html,
    replyTo: payload.contactEmail ?? undefined,
  });
}

/* ──────────────────────── HTML templates ──────────────────────────────── */

function renderClientEmail(input: {
  headline: string;
  body: string;
  payload: ClientEmailPayload;
}): string {
  const { headline, body, payload } = input;
  const details =
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;background:#f4f4f5;border-radius:10px;padding:16px;margin:8px 0 16px;">` +
    `<tr><td style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#27272a;line-height:1.55;">` +
    `<div style="font-weight:600;color:#18181b;">${escape(payload.petName)} · ${escape(payload.serviceName)}</div>` +
    `<div>${escape(payload.dateLabel)} at ${escape(payload.timeLabel)}</div>` +
    `<div>with ${escape(payload.staffName)}</div>` +
    `</td></tr></table>`;
  const contactLines: string[] = [];
  if (payload.contactPhone)
    contactLines.push(`Call us at ${escape(formatPhoneForEmail(payload.contactPhone))}`);
  if (payload.contactEmail)
    contactLines.push(`Email us at ${escape(payload.contactEmail)}`);
  const contactRow =
    contactLines.length > 0
      ? `<p style="margin:0 0 4px;color:#52525b;font-size:13px;">${contactLines.join(" · ")}</p>`
      : "";
  return wrapShell({ accent: payload.shopName, headline, body, details, contactRow, signoff: payload.shopName });
}

function renderStaffEmail(input: {
  headline: string;
  body: string;
  shopName: string;
}): string {
  return wrapShell({
    accent: input.shopName,
    headline: input.headline,
    body: input.body,
    details: "",
    contactRow: "",
    signoff: input.shopName,
  });
}

function wrapShell(input: {
  accent: string;
  headline: string;
  body: string;
  details: string;
  contactRow: string;
  signoff: string;
}): string {
  return (
    `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#27272a;">` +
    `<table cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e4e4e7;">` +
    `<tr><td>` +
    `<div style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;margin-bottom:6px;">${escape(input.accent)}</div>` +
    `<h1 style="margin:0 0 16px;font-size:22px;color:#18181b;">${escape(input.headline)}</h1>` +
    input.body +
    input.details +
    input.contactRow +
    `<p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;">— ${escape(input.signoff)}</p>` +
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

function formatPhoneForEmail(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}
