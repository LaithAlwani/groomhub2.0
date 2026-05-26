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
  // Foreign key into the `vaccines` catalog table. Soft-deleted catalog rows
  // stay referenceable so historical pet records render their original name.
  vaccineId: v.id("vaccines"),
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
  //
  // `locationIds` semantics:
  //   - `[]`     → member is at every location (admins, single-location orgs,
  //                the org creator). Default for boostrapped rows that have
  //                no per-location intent recorded.
  //   - non-empty → member is restricted to the listed locations. The invite
  //                flow seeds this from the inviting admin's active location.
  // Always filtered as `length === 0 || includes(locationId)` in JS — the
  // array is too small to index, and the membership list is bounded by
  // org size.
  memberships: defineTable({
    userId: v.id("users"),
    orgId: v.string(),
    role: roleValidator,
    isActive: v.boolean(),
    locationIds: v.array(v.id("locations")),
  })
    .index("by_user_org", ["userId", "orgId"])
    .index("by_org_active", ["orgId", "isActive"])
    .index("by_org_role", ["orgId", "role"]),

  // Short-lived bridge between "admin clicked Send invite" and the Clerk
  // `organizationMembership.created` webhook firing. Clerk's invite API
  // doesn't accept arbitrary metadata, so when the admin invites someone
  // from a specific location we record their intent here; the webhook
  // looks it up by `(orgId, email)`, copies the locationIds to the new
  // membership row, and deletes the intent.
  //
  // If the webhook fires before the intent is recorded (improbable but
  // possible — webhook latency vs the mutation+API call), the new
  // membership lands with `locationIds: []` (= all locations) and the
  // intent later resolves to a no-op. Admin can fix via the staff page.
  staffInviteIntents: defineTable({
    orgId: v.string(),
    email: v.string(),
    locationIds: v.array(v.id("locations")),
    createdAt: v.number(),
  }).index("by_org_email", ["orgId", "email"]),

  // Physical locations per shop. Every org has at least one — `seedFromClerk`
  // creates a "Main" location during onboarding. Adding a *second* location
  // requires the `enterprise` plan tier (see `convex/lib/plans.ts` →
  // `requirePlanFeature(ctx, orgId, "multipleLocations")`).
  //
  // `slug` is unique per org (reserved for the v2 public portal at
  // `/{orgSlug}/{locationSlug}`); the global org slug stays the org-level key.
  // `timezone` here is the authoritative clock for this location — used for
  // availability windows, calendar rendering, and reminder fire times. The
  // org-level `timezone` is the legacy single-location default; new code reads
  // the location's timezone instead.
  locations: defineTable({
    orgId: v.string(),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    currency: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    // Overrides the org's contactEmail as the Reply-To for emails about
    // appointments at this location. Falls back to org-level when unset.
    contactEmail: v.optional(v.string()),
    isActive: v.boolean(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_active", ["orgId", "isActive"])
    .index("by_org_slug", ["orgId", "slug"]),

  // Catalog of vaccine TYPES the shop tracks (e.g. "Rabies", "Bordetella").
  // Pet vaccinations on `pets.vaccinations[]` reference these rows by id so
  // groomers pick from a curated list instead of free-typing. Soft-delete
  // via `deletedAt` so historical pet records still render the right name.
  vaccines: defineTable({
    orgId: v.string(),
    name: v.string(),
    // Which species this vaccine applies to. Empty array = all species; the
    // pet form filters the dropdown by the pet's species, so an empty list
    // means "show this vaccine for every pet".
    species: v.array(speciesValidator),
    // Used by the pet form to pre-fill `expiresOn = today + N months` when
    // the groomer first picks a vaccine. Optional — leave blank for
    // one-shot vaccines or when the shop manages expiry manually.
    defaultIntervalMonths: v.optional(v.number()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_active", ["orgId", "isActive"]),

  // Service menu per shop. Soft-delete via `deletedAt`; superAdmin can hard-delete.
  // `priceCents` + `currency` are stored alongside payments going live (deferred);
  // for now they're just informational on the service card.
  //
  // `locationId` semantics:
  //   - `undefined` = org-wide service available at every location (default).
  //   - set        = location-only addition; only the named location lists it.
  // Org-wide services can be patched per-location via `serviceLocationOverrides`
  // (price / duration / isActive). See `convex/lib/serviceResolution.ts`.
  services: defineTable({
    orgId: v.string(),
    locationId: v.optional(v.id("locations")),
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
    .index("by_org_active", ["orgId", "isActive"])
    .index("by_org_location", ["orgId", "locationId"]),

  // Per-location overrides for org-wide services. A row exists only when the
  // location wants a different price, duration, or to hide the org-wide
  // service entirely (`isActive: false`). No row = inherit the org-wide
  // service unchanged.
  serviceLocationOverrides: defineTable({
    orgId: v.string(),
    serviceId: v.id("services"),
    locationId: v.id("locations"),
    priceCents: v.optional(v.number()),
    durationMin: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  })
    .index("by_service_location", ["serviceId", "locationId"])
    .index("by_org_location", ["orgId", "locationId"]),

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
    // The location the client most often visits. Used to prefill the booking
    // dialog's location field. Clients themselves are org-wide — this is just
    // a hint, not a scope.
    preferredLocationId: v.optional(v.id("locations")),
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
    locationId: v.id("locations"),
    staffId: v.id("memberships"),
    weekday: v.number(), // 0=Sunday … 6=Saturday (matches JS Date.getDay())
    startMin: v.number(),
    endMin: v.number(),
  })
    // `by_org_staff` stays for "all schedules for this staff across every
    // location" — used by the multi-location availability tabbed view.
    .index("by_org_staff", ["orgId", "staffId"])
    .index("by_org_location_staff", ["orgId", "locationId", "staffId"])
    .index("by_org_location_staff_weekday", [
      "orgId",
      "locationId",
      "staffId",
      "weekday",
    ]),

  // Bookings. `startTime`/`endTime` are ms-since-epoch (UTC). The org timezone
  // is applied at the UI layer when rendering. `clientUuid` is the offline-queue
  // idempotency key (any future replay finds the existing row and no-ops).
  appointments: defineTable({
    orgId: v.string(),
    locationId: v.id("locations"),
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
    .index("by_org_location_start", ["orgId", "locationId", "startTime"])
    .index("by_staff_start", ["staffId", "startTime"])
    .index("by_client", ["clientId"])
    .index("by_clientUuid", ["clientUuid"]),

  // Per-day override for the next ~60 days: PTO, extra shifts, holiday closures.
  // `date` is ISO YYYY-MM-DD in the org's timezone. `kind="off"` means the day
  // is unavailable; `kind="custom"` means `slots` replaces the weekly pattern
  // for that date. No row = use the weekly pattern.
  staffDayOverride: defineTable({
    orgId: v.string(),
    locationId: v.id("locations"),
    staffId: v.id("memberships"),
    date: v.string(),
    kind: v.union(v.literal("off"), v.literal("custom")),
    slots: v.optional(
      v.array(v.object({ startMin: v.number(), endMin: v.number() })),
    ),
  })
    .index("by_org_location_staff_date", [
      "orgId",
      "locationId",
      "staffId",
      "date",
    ]),

  pets: defineTable({
    orgId: v.string(),
    clientId: v.id("clients"),
    name: v.string(),
    species: speciesValidator,
    breed: v.optional(v.string()),
    coatType: v.optional(v.string()),
    sizeLb: v.optional(v.number()),
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
