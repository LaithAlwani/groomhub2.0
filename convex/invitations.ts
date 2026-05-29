import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Looks up an organisation invitation by its ticket JWT.
 *
 * Clerk's Future `signUp.ticket()` doesn't populate `signUp.emailAddress`
 * for `organization_invitation` tickets — the email lives only on the
 * server-side invitation record, keyed by the IDs inside the JWT.
 *
 * We decode the JWT payload to read `oid` (organisation) and `sid`
 * (invitation), then query Clerk's Backend API to retrieve the invited
 * email so the client can hand it to the Future API.
 *
 * Required Convex env var:
 *   CLERK_SECRET_KEY  — `sk_...` from Clerk dashboard → API Keys.
 *
 * Set with:  npx convex env set CLERK_SECRET_KEY sk_test_...
 */
export const lookupTicket = action({
  args: { ticket: v.string() },
  handler: async (_ctx, args): Promise<{ email: string } | null> => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.error("CLERK_SECRET_KEY is not set in Convex env.");
      return null;
    }

    const payload = decodeJwtPayload(args.ticket);
    if (
      !payload ||
      payload.st !== "organization_invitation" ||
      typeof payload.oid !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${payload.oid}/invitations/${payload.sid}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!response.ok) {
      console.error(
        "Clerk invitation lookup failed:",
        response.status,
        await response.text().catch(() => ""),
      );
      return null;
    }

    const invitation = (await response.json()) as { email_address?: string };
    if (typeof invitation.email_address !== "string") return null;
    return { email: invitation.email_address };
  },
});

/**
 * Sends an organisation invitation via Clerk's Backend API with an
 * explicit `redirect_url`, so the email link always points at the host
 * the inviter sent it from (`window.location.origin`). The client SDK's
 * `organization.inviteMember(...)` doesn't accept `redirect_url` and
 * falls back to whatever's set in Clerk Dashboard → Customization →
 * Paths, which was the source of "invitation links go to localhost"
 * after we switched between dev/prod Clerk instances.
 *
 * Also records the local invite intent (for per-location scoping) before
 * dispatching to Clerk so the webhook can apply locationIds when the
 * membership lands.
 */
export const sendInvitation = action({
  args: {
    email: v.string(),
    role: v.string(),
    locationIds: v.array(v.id("locations")),
    redirectUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; error: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, error: "Not authenticated" };

    const orgId =
      (identity["org_id"] as string | undefined) ??
      (identity.orgId as string | undefined);
    if (!orgId) return { ok: false, error: "No active organization" };

    const inviterUserId = identity.subject;
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      return { ok: false, error: "CLERK_SECRET_KEY not set in Convex env" };
    }

    await ctx.runMutation(api.memberships.recordInviteIntent, {
      email: args.email,
      locationIds: args.locationIds,
    });

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: args.email,
          role: args.role,
          redirect_url: args.redirectUrl,
          inviter_user_id: inviterUserId,
        }),
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const parsed = safeParseClerkError(text);
      return { ok: false, error: parsed ?? `Clerk: ${response.status} ${text}` };
    }
    return { ok: true };
  },
});

function safeParseClerkError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      errors?: Array<{ message?: string; long_message?: string }>;
    };
    const first = parsed.errors?.[0];
    return first?.long_message ?? first?.message ?? null;
  } catch {
    return null;
  }
}

type DecodedPayload = {
  st?: string;
  oid?: unknown;
  sid?: unknown;
};

function decodeJwtPayload(jwt: string): DecodedPayload | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as DecodedPayload;
  } catch {
    return null;
  }
}
