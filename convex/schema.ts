import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("superAdmin"),
  v.literal("admin"),
  v.literal("staff"),
);

export default defineSchema({
  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    currency: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerkOrgId", ["clerkOrgId"])
    .index("by_slug", ["slug"]),

  // One row per Clerk user — the global identity mirror.
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    avatarUrl: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkUserId", ["clerkUserId"]),

  // One row per (user × org). Owns role + per-org isActive.
  // Tenant-scoped foreign keys point here (e.g. appointments.staffId).
  memberships: defineTable({
    userId: v.id("users"),
    orgId: v.string(),
    role: roleValidator,
    isActive: v.boolean(),
  })
    .index("by_user_org", ["userId", "orgId"])
    .index("by_org_active", ["orgId", "isActive"])
    .index("by_org_role", ["orgId", "role"]),
});
