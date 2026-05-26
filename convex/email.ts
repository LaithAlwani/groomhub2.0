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
      kind: "confirmation",
      subject: (p) => `Your appointment at ${p.shopName} is confirmed`,
      body: (p) =>
        `<p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0a1929;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Great news! Your grooming session for <strong>${escape(p.petName)}</strong> with ${escape(p.staffName)} is all set. We can&rsquo;t wait to see you and provide the professional care your pet deserves.</p>`,
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
      kind: "cancellation",
      subject: (p) => `Your appointment at ${p.shopName} was cancelled`,
      body: (p) =>
        `<p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0a1929;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">We&rsquo;re sorry &mdash; <strong>${escape(p.petName)}</strong>&rsquo;s appointment has been cancelled.</p>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Reply to this email or give us a call and we&rsquo;ll get a new slot booked whenever you&rsquo;re ready.</p>`,
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
      kind: "reschedule",
      subject: (p) => `Your appointment at ${p.shopName} was rescheduled`,
      body: (p) =>
        `<p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0a1929;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Heads up &mdash; we&rsquo;ve moved <strong>${escape(p.petName)}</strong>&rsquo;s grooming session to a new time. The updated details are below.</p>`,
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
      kind: "petReady",
      subject: (p) => `${p.petName} is all done at ${p.shopName}! 🐾`,
      body: (p) =>
        `<p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0a1929;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">Good news &mdash; <strong>${escape(p.petName)}</strong>&rsquo;s ${escape(p.serviceName)} is all done. They&rsquo;re freshly groomed and waiting for you whenever you&rsquo;re ready to swing by.</p>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Thanks for trusting us with ${escape(p.petName)} today &mdash; give them a big head-scratch from ${escape(p.staffName)}.</p>`,
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
      kind: "reminder",
      subject: (p) => `Reminder: ${p.petName}'s appointment tomorrow at ${p.shopName}`,
      body: (p) =>
        `<p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0a1929;">Hi ${escape(p.clientFirstName)},</p>` +
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">Just a friendly reminder that <strong>${escape(p.petName)}</strong>&rsquo;s grooming session with ${escape(p.staffName)} is coming up tomorrow.</p>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Need to change anything? Reply to this email or call us and we&rsquo;ll sort it out.</p>`,
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
    const locationFragment =
      payload.locationName && payload.locationName !== payload.shopName
        ? ` at ${escape(payload.locationName)}`
        : "";
    const html = renderStaffEmail({
      headline: "New booking needs your approval",
      body:
        `<p style="margin:0 0 12px;">Hi ${escape(payload.staffFirstName)},</p>` +
        `<p style="margin:0 0 12px;"><strong>${escape(payload.clientName)}</strong> just booked ${escape(payload.petName)} for <strong>${escape(payload.serviceName)}</strong>${locationFragment} on ${escape(payload.dateLabel)} at ${escape(payload.timeLabel)}.</p>` +
        `<p style="margin:0 0 12px;">Open GroomHub to confirm or decline.</p>`,
      shopName: payload.shopName,
      logoUrl: payload.logoUrl,
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
    const declineLocationFragment =
      payload.locationName && payload.locationName !== payload.shopName
        ? ` at ${escape(payload.locationName)}`
        : "";
    const html = renderStaffEmail({
      headline: "A booking was declined",
      body:
        `<p style="margin:0 0 12px;"><strong>${escape(payload.declinedByName)}</strong> declined ${escape(payload.clientName)}'s booking for ${escape(payload.petName)}${declineLocationFragment} on ${escape(payload.dateLabel)} at ${escape(payload.timeLabel)}.</p>` +
        `<p style="margin:0 0 12px;">Reassign or cancel it from your dashboard's declined queue.</p>`,
      shopName: payload.shopName,
      logoUrl: payload.logoUrl,
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

/**
 * Banner config per email situation. Drives the dark-navy hero block at the
 * top of every client email: icon (Unicode glyph in an orange circle) +
 * white headline. Each status reads as the same visual language so the
 * shop's brand stays consistent across the lifecycle.
 */
type EmailKind =
  | "confirmation"
  | "reschedule"
  | "cancellation"
  | "reminder"
  | "petReady";

const BANNER: Record<EmailKind, { icon: string; heading: string }> = {
  confirmation: { icon: "&#10003;", heading: "Appointment Confirmed!" },
  reschedule:   { icon: "&#10227;", heading: "Appointment Rescheduled" },
  cancellation: { icon: "&#10005;", heading: "Appointment Cancelled" },
  reminder:     { icon: "&#9200;",  heading: "Upcoming Appointment" },
  petReady:     { icon: "&#127998;", heading: "Your Pet is Ready!" },
};

type ClientTemplate = {
  kind: EmailKind;
  subject: (payload: ClientEmailPayload) => string;
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
  const html = renderClientEmail({
    kind: template.kind,
    body: template.body(payload),
    payload,
  });
  await sendRaw({
    to: payload.clientEmail,
    fromDisplayName: payload.shopName,
    subject: template.subject(payload),
    html,
    replyTo: payload.contactEmail ?? undefined,
  });
}

/* ──────────────────────── HTML templates ──────────────────────────────── */

function renderClientEmail(input: {
  kind: EmailKind;
  body: string;
  payload: ClientEmailPayload;
}): string {
  const banner = BANNER[input.kind];
  const petLabel = input.payload.petBreed
    ? `${escape(input.payload.petName)} (${escape(input.payload.petBreed)})`
    : escape(input.payload.petName);
  const bookingDetails = renderBookingDetails({
    petLabel,
    dateLabel: input.payload.dateLabel,
    timeLabel: input.payload.timeLabel,
    serviceName: input.payload.serviceName,
    previousDateLabel: input.payload.previousDateLabel,
    previousTimeLabel: input.payload.previousTimeLabel,
    showAsCancelled: input.kind === "cancellation",
  });
  return wrapShell({
    bannerIcon: banner.icon,
    bannerHeading: banner.heading,
    body: input.body,
    details: bookingDetails,
    payload: input.payload,
  });
}

function renderStaffEmail(input: {
  headline: string;
  body: string;
  shopName: string;
  logoUrl: string | null;
}): string {
  // Staff alerts reuse the same shell but skip the booking-details card —
  // staff already see the booking in the app. They get a simple navy banner
  // with the headline + the inline body text.
  return wrapShell({
    bannerIcon: "&#9888;",
    bannerHeading: input.headline,
    body: input.body,
    details: "",
    payload: {
      shopName: input.shopName,
      logoUrl: input.logoUrl,
      locationName: input.shopName,
      contactEmail: null,
      contactPhone: null,
    },
  });
}

function renderBookingDetails(input: {
  petLabel: string;
  dateLabel: string;
  timeLabel: string;
  serviceName: string;
  previousDateLabel?: string;
  previousTimeLabel?: string;
  showAsCancelled: boolean;
}): string {
  const row = (label: string, value: string) =>
    `<tr>` +
    `<td valign="top" style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;padding:6px 12px 6px 0;width:90px;white-space:nowrap;">${label}</td>` +
    `<td valign="top" style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:600;color:#0a1929;padding:6px 0;${input.showAsCancelled ? "text-decoration:line-through;color:#71717a;" : ""}">${value}</td>` +
    `</tr>`;
  const previousLine =
    input.previousDateLabel && input.previousTimeLabel
      ? row(
          "Previously",
          `<span style="color:#a1a1aa;font-weight:500;">${escape(input.previousDateLabel)} at ${escape(input.previousTimeLabel)}</span>`,
        )
      : "";
  return (
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff5ff;border:1px solid #dbeafe;border-radius:12px;padding:20px;margin:8px 0 24px;">` +
    `<tr><td>` +
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;font-weight:700;color:#0a1929;margin-bottom:12px;">Booking Details</div>` +
    `<table cellpadding="0" cellspacing="0" border="0" width="100%">` +
    row("Pet Name", input.petLabel) +
    row("Date", escape(input.dateLabel)) +
    row("Time", escape(input.timeLabel)) +
    row("Service", escape(input.serviceName)) +
    previousLine +
    `</table>` +
    `</td></tr></table>`
  );
}

function wrapShell(input: {
  bannerIcon: string;
  bannerHeading: string;
  body: string;
  details: string;
  payload: {
    shopName: string;
    logoUrl: string | null;
    locationName: string;
    locationAddressLine?: string;
    contactEmail: string | null;
    contactPhone: string | null;
  };
}): string {
  const { payload } = input;
  // Use the location name for the footer "Studio name" when the shop has
  // multiple locations; otherwise the shop name doubles as the studio name.
  const studioName = payload.locationName || payload.shopName;
  // Logo block: if the shop has uploaded a logo, embed it inside the circular
  // frame at the top of the email. Convex signed-storage URLs work fine in
  // every modern email client (Gmail / Outlook / Apple Mail / etc.). When
  // no logo is on file we fall back to the paw glyph that's been there
  // since the design landed.
  const logoBlock = payload.logoUrl
    ? `<img src="${payload.logoUrl}" alt="${escape(payload.shopName)}" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid #e4e4e7;background:#ffffff;" />`
    : `<div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:#ffffff;border:1px solid #e4e4e7;line-height:64px;text-align:center;font-size:28px;">&#128062;</div>`;
  const contactParts: string[] = [];
  if (payload.contactPhone)
    contactParts.push(escape(formatPhoneForEmail(payload.contactPhone)));
  if (payload.contactEmail)
    contactParts.push(
      `<a href="mailto:${escape(payload.contactEmail)}" style="color:#0a1929;text-decoration:none;">${escape(payload.contactEmail)}</a>`,
    );
  const contactRow =
    contactParts.length > 0
      ? `<div style="margin-top:4px;">${contactParts.join(" &bull; ")}</div>`
      : "";
  const year = new Date().getFullYear();

  return (
    `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#27272a;-webkit-font-smoothing:antialiased;">` +
    `<table cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;">` +
    // Logo strip — real shop logo when uploaded, paw glyph fallback otherwise
    `<tr><td align="center" style="padding:8px 0 20px;">` +
    logoBlock +
    `</td></tr>` +
    // Dark banner with icon + headline
    `<tr><td>` +
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a1929;border-radius:14px 14px 0 0;padding:36px 24px;">` +
    `<tr><td align="center">` +
    `<div style="display:inline-block;width:56px;height:56px;border-radius:50%;border:2px solid #f97316;color:#f97316;line-height:52px;text-align:center;font-size:26px;font-weight:bold;margin-bottom:14px;">${input.bannerIcon}</div>` +
    `<div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.01em;">${escape(input.bannerHeading)}</div>` +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    // Body content area
    `<tr><td style="background:#ffffff;padding:28px 28px 4px;">` +
    input.body +
    `</td></tr>` +
    // Booking details card
    (input.details
      ? `<tr><td style="background:#ffffff;padding:0 28px;">${input.details}</td></tr>`
      : "") +
    // Footer
    `<tr><td style="background:#ffffff;border-radius:0 0 14px 14px;padding:8px 28px 28px;text-align:center;font-size:13px;color:#52525b;line-height:1.6;">` +
    // Small pin icon labels the studio line as the LOCATION the appointment
    // is for — relevant once a shop has more than one location. Renders as
    // a red round-pushpin emoji in every modern email client.
    `<div style="font-weight:700;color:#0a1929;">` +
    `<span style="display:inline-block;margin-right:4px;color:#f97316;" aria-hidden="true">&#128205;</span>` +
    escape(studioName) +
    `</div>` +
    (payload.locationAddressLine
      ? `<div>${escape(payload.locationAddressLine)}</div>`
      : "") +
    contactRow +
    `<hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0 14px;" />` +
    `<div style="font-size:12px;color:#71717a;">&copy; ${year} GroomHub SaaS. All rights reserved.</div>` +
    `<div style="margin-top:10px;font-size:12px;">` +
    `Powered by <span style="color:#f97316;font-weight:700;">GroomHub</span>` +
    `</div>` +
    `</td></tr>` +
    `</table>` +
    `</body></html>`
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
