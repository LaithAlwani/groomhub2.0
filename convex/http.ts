import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { mapClerkOrgRole } from "./lib/roles";
import { verifyStandardWebhook } from "./lib/verifyWebhook";

const http = httpRouter();

type ClerkEvent = { type: string; data: Record<string, unknown> };
type WebhookCtx = Parameters<Parameters<typeof httpAction>[0]>[0];

/**
 * Clerk webhook endpoint.
 * URL to set in the Clerk dashboard:
 *   https://<deployment>.convex.site/clerk-webhook
 *
 * Required Convex env vars (set via `npx convex env set`):
 *   CLERK_WEBHOOK_SIGNING_SECRET   — whsec_... from the Clerk webhook page
 *   CLERK_JWT_ISSUER_DOMAIN        — used to derive Convex tokenIdentifier
 */
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
    if (!signingSecret || !issuerDomain) {
      console.error(
        "Missing CLERK_WEBHOOK_SIGNING_SECRET or CLERK_JWT_ISSUER_DOMAIN",
      );
      return new Response("Server not configured", { status: 500 });
    }

    const rawBody = await request.text();
    const verification = await verifyStandardWebhook(
      rawBody,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      signingSecret,
    );
    if (!verification.ok) {
      console.warn("Clerk webhook verification failed:", verification.reason);
      return new Response("Bad signature", { status: 400 });
    }

    const event = verification.payload as ClerkEvent;
    try {
      await dispatchClerkEvent(ctx, event, issuerDomain);
    } catch (caught) {
      console.error("Clerk webhook dispatch error for", event.type, caught);
      return new Response("Dispatch error", { status: 500 });
    }
    return new Response(null, { status: 204 });
  }),
});

async function dispatchClerkEvent(
  ctx: WebhookCtx,
  event: ClerkEvent,
  issuerDomain: string,
): Promise<void> {
  switch (event.type) {
    case "user.created":
      return await handleUserUpsert(ctx, event.data, issuerDomain);
    case "user.updated":
      return await handleUserUpdated(ctx, event.data);
    case "user.deleted":
      return await handleUserDeleted(ctx, event.data);
    case "organization.created":
    case "organization.updated":
      return await handleOrganizationUpsert(ctx, event.data);
    case "organizationMembership.created":
    case "organizationMembership.updated":
      return await handleMembershipUpsert(ctx, event.data, issuerDomain);
    case "organizationMembership.deleted":
      return await handleMembershipDeleted(ctx, event.data);
    default:
      // Unhandled event — fine, Clerk emits many we don't care about.
      return;
  }
}

async function handleUserUpsert(
  ctx: WebhookCtx,
  data: Record<string, unknown>,
  issuerDomain: string,
): Promise<void> {
  const profile = readUserProfile(data);
  const clerkUserId = data.id as string;
  await ctx.runMutation(internal.clerkSync.upsertUser, {
    clerkUserId,
    tokenIdentifier: `${issuerDomain}|${clerkUserId}`,
    email: profile.email ?? "",
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    avatarUrl: profile.avatarUrl,
  });
}

async function handleUserUpdated(
  ctx: WebhookCtx,
  data: Record<string, unknown>,
): Promise<void> {
  const profile = readUserProfile(data);
  await ctx.runMutation(internal.clerkSync.patchUserProfile, {
    clerkUserId: data.id as string,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatarUrl,
  });
}

async function handleUserDeleted(
  ctx: WebhookCtx,
  data: Record<string, unknown>,
): Promise<void> {
  await ctx.runMutation(internal.clerkSync.deactivateUserEverywhere, {
    clerkUserId: data.id as string,
  });
}

async function handleOrganizationUpsert(
  ctx: WebhookCtx,
  data: Record<string, unknown>,
): Promise<void> {
  await ctx.runMutation(internal.clerkSync.upsertOrganization, {
    clerkOrgId: data.id as string,
    name: data.name as string,
    slug: data.slug as string,
    // Present on `organization.created`, absent on `organization.updated`.
    creatorClerkUserId: (data.created_by as string | undefined) ?? undefined,
  });
}

async function handleMembershipUpsert(
  ctx: WebhookCtx,
  data: Record<string, unknown>,
  issuerDomain: string,
): Promise<void> {
  const organization = data.organization as { id: string };
  const publicUserData = data.public_user_data as ClerkPublicUserData;
  await ctx.runMutation(internal.clerkSync.upsertMembership, {
    clerkUserId: publicUserData.user_id,
    clerkOrgId: organization.id,
    tokenIdentifier: `${issuerDomain}|${publicUserData.user_id}`,
    email: publicUserData.identifier ?? "",
    firstName: publicUserData.first_name ?? "",
    lastName: publicUserData.last_name ?? "",
    avatarUrl: publicUserData.image_url ?? undefined,
    role: mapClerkOrgRole(data.role as string | undefined),
  });
}

async function handleMembershipDeleted(
  ctx: WebhookCtx,
  data: Record<string, unknown>,
): Promise<void> {
  const organization = data.organization as { id: string };
  const publicUserData = data.public_user_data as { user_id: string };
  await ctx.runMutation(internal.clerkSync.deactivateMembership, {
    clerkUserId: publicUserData.user_id,
    clerkOrgId: organization.id,
  });
}

type ClerkPublicUserData = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  identifier?: string;
};

type UserProfileSnapshot = {
  email: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  avatarUrl: string | undefined;
};

function readUserProfile(data: Record<string, unknown>): UserProfileSnapshot {
  const emailAddresses = (data.email_addresses ?? []) as Array<{
    id: string;
    email_address: string;
  }>;
  const primaryId = data.primary_email_address_id as string | null | undefined;
  const primary = emailAddresses.find((address) => address.id === primaryId);
  return {
    email:
      primary?.email_address ?? emailAddresses[0]?.email_address ?? undefined,
    firstName: (data.first_name as string | null) ?? undefined,
    lastName: (data.last_name as string | null) ?? undefined,
    avatarUrl: (data.image_url as string | null) ?? undefined,
  };
}

export default http;
