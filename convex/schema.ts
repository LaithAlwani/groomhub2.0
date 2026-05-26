import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("superAdmin"),
  v.literal("admin"),
  v.literal("staff"),
);

export const speciesValidator = v.union(
  v.literal("dog"),
  v.literal("cat"),
  v.literal("other"),
);

export const vaccinationValidator = v.object({
  type: v.string(),
  expiresOn: v.string(), // ISO date YYYY-MM-DD in the org's timezone
  verified: v.boolean(),
});

export const sexValidator = v.union(v.literal("male"), v.literal("female"));

export default defineSchema({
  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    currency: v.string(),
    plan: v.union(
      v.literal("essential"),
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    // Convex storage id for the shop's logo. UI resolves the URL via
    // `ctx.storage.getUrl(...)` (e.g. in `organizations.bySlug` for the public
    // portal). Uploaded during onboarding from `NewShopForm`.
    logoStorageId: v.optional(v.id("_storage")),
    primaryColor: v.optional(v.string()),
    // Shop contact info — used as the Reply-To header and the footer of every
    // transactional email. Both optional so onboarding doesn't require them up
    // front; the shop owner fills them in via /settings/shop.
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    // Soft-delete timestamp. Set when the last active member of the org has
    // their account deleted (see `convex/clerkSync.ts`). Once set:
    //   - `bySlug` / `isSlugAvailable` / `getCurrent` treat the row as gone,
    //     so the slug is immediately free for another shop to claim.
    //   - The Clerk org is deleted via the Backend API in the same flow so
    //     the Clerk dashboard stays clean.
    //   - The Convex row + every dependent table stay around for 30 days
    //     of audit-trail latitude, then `convex/orgCleanup.ts`'s daily cron
    //     hard-deletes everything.
    deletedAt: v.optional(v.number()),
  })
    .index("by_clerkOrgId", ["clerkOrgId"])
    .index("by_slug", ["slug"])
    .index("by_deletedAt", ["deletedAt"]),

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

  // Service menu per shop. Soft-delete via `deletedAt`; superAdmin can hard-delete.
  // `priceCents` + `currency` are stored alongside payments going live (deferred);
  // for now they're just informational on the service card.
  services: defineTable({
    orgId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    durationMin: v.number(),
    priceCents: v.number(),
    currency: v.string(),
    species: v.array(speciesValidator),
    color: v.optional(v.string()),
    isActive: v.boolean(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_active", ["orgId", "isActive"]),

  // Pet owner record per shop. Soft-delete via `deletedAt`; superAdmin can hard-delete.
  // `search_name` is the prefix/fuzzy index used by the clients list quick search.
  clients: defineTable({
    orgId: v.string(),
    fullName: v.string(),
    // Stored as digits-only (e.g. "5551234567"). Display surfaces format as
    // xxx-xxx-xxxx via `lib/phone.ts`.
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .searchIndex("search_name", {
      searchField: "fullName",
      filterFields: ["orgId", "deletedAt"],
    }),

  // Pets belong to one client. Soft-delete via `deletedAt`; appointment history
  // referencing a removed pet stays readable.
  // Recurring weekly availability per staff member. Multiple rows are allowed
  // per (staff, weekday) so split shifts and lunch breaks are modelled as gaps
  // (e.g. Mon 540–720 and Mon 780–1020 = “9–12, 13–17”).
  // Times are minutes from midnight in the org's timezone.
  staffWeeklySchedule: defineTable({
    orgId: v.string(),
    staffId: v.id("memberships"),
    weekday: v.number(), // 0=Sunday … 6=Saturday (matches JS Date.getDay())
    startMin: v.number(),
    endMin: v.number(),
  })
    .index("by_org_staff", ["orgId", "staffId"])
    .index("by_org_staff_weekday", ["orgId", "staffId", "weekday"]),

  // Bookings. `startTime`/`endTime` are ms-since-epoch (UTC). The org timezone
  // is applied at the UI layer when rendering. `clientUuid` is the offline-queue
  // idempotency key (any future replay finds the existing row and no-ops).
  appointments: defineTable({
    orgId: v.string(),
    clientId: v.id("clients"),
    petId: v.id("pets"),
    staffId: v.id("memberships"),
    serviceId: v.id("services"),
    startTime: v.number(),
    endTime: v.number(),
    status: v.union(
      v.literal("pendingApproval"),
      // Groomer declined an admin-booked appointment; sits in an admin queue
      // until reassigned (→ pendingApproval) or cancelled (→ cancelled).
      v.literal("declined"),
      v.literal("scheduled"),
      v.literal("checkedIn"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("noShow"),
      v.literal("cancelled"),
    ),
    priceCentsSnapshot: v.number(),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("refunded"),
    ),
    paymentIntentId: v.optional(v.string()),
    notes: v.optional(v.string()),
    clientUuid: v.string(),
    createdBy: v.id("memberships"),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_start", ["orgId", "startTime"])
    .index("by_staff_start", ["staffId", "startTime"])
    .index("by_client", ["clientId"])
    .index("by_clientUuid", ["clientUuid"]),

  // Per-day override for the next ~60 days: PTO, extra shifts, holiday closures.
  // `date` is ISO YYYY-MM-DD in the org's timezone. `kind="off"` means the day
  // is unavailable; `kind="custom"` means `slots` replaces the weekly pattern
  // for that date. No row = use the weekly pattern.
  staffDayOverride: defineTable({
    orgId: v.string(),
    staffId: v.id("memberships"),
    date: v.string(),
    kind: v.union(v.literal("off"), v.literal("custom")),
    slots: v.optional(
      v.array(v.object({ startMin: v.number(), endMin: v.number() })),
    ),
  })
    .index("by_org_staff_date", ["orgId", "staffId", "date"]),

  pets: defineTable({
    orgId: v.string(),
    clientId: v.id("clients"),
    name: v.string(),
    species: speciesValidator,
    breed: v.optional(v.string()),
    coatType: v.optional(v.string()),
    sizeKg: v.optional(v.number()),
    birthDate: v.optional(v.string()), // ISO date YYYY-MM-DD
    sex: v.optional(sexValidator),
    // `true` = spayed (female) or neutered (male); UI picks the label by sex.
    isFixed: v.optional(v.boolean()),
    temperament: v.optional(v.string()),
    medicalConditions: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    vaccinations: v.array(vaccinationValidator),
    // Convex storage id for the pet's main photo. UI uses a placeholder when
    // unset. `update`/`hardDelete` clean up the storage object so we don't
    // orphan files. Upload URLs are generated via `pets.generateImageUploadUrl`.
    imageStorageId: v.optional(v.id("_storage")),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_client", ["clientId"]),
});
