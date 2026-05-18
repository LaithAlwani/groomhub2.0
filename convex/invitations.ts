import { v } from "convex/values";
import { action } from "./_generated/server";

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
