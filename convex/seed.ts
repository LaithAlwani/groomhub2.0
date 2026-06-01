import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizePhone } from "./lib/phone";
import { isDevDeployment } from "./lib/seedGating";
import {
  APPOINTMENT_FIXTURES,
  CLIENT_FIXTURES,
  SERVICE_FIXTURES,
  VACCINE_FIXTURES,
} from "./lib/seedFixtures";

/**
 * Populates a freshly-created shop with demo data so the dashboard,
 * calendar, clients page, etc. are non-empty from the first visit.
 *
 * Gated by `isDevDeployment()` — the dev Convex backend is the only place
 * this runs. Scheduled (not run inline) from `seedFromClerk` so a seed
 * failure can never break org creation, and the user doesn't wait for
 * ~90 inserts before the "Creating shop…" screen finishes.
 *
 * Idempotent: if the org already has any clients, the seed no-ops.
 */
export const populateShop = internalMutation({
  args: {
    orgId: v.string(),
    locationId: v.id("locations"),
    staffId: v.id("memberships"),
  },
  handler: async (ctx, args) => {
    if (!isDevDeployment()) return;
    if (await alreadySeeded(ctx, args.orgId)) return;

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) =>
        index.eq("clerkOrgId", args.orgId),
      )
      .unique();
    if (!org) return;
    const currency = org.currency;

    const vaccineIdsBySlug = await insertVaccines(ctx, args.orgId);
    const serviceIds = await insertServices(ctx, args.orgId, currency);
    const { clientIds, petIdsByClient } = await insertClientsAndPets(
      ctx,
      args.orgId,
      args.locationId,
      vaccineIdsBySlug,
    );
    await insertAppointments(ctx, {
      orgId: args.orgId,
      locationId: args.locationId,
      staffId: args.staffId,
      serviceIds,
      clientIds,
      petIdsByClient,
      currency,
    });
  },
});

/**
 * Seeds a new shop's starter CATALOG — the default services + vaccines — on
 * EVERY deployment, including production. Unlike `populateShop` this is real
 * reference data (not demo clients/pets/appointments), so it deliberately is
 * NOT gated by `isDevDeployment()`: a brand-new shop lands on a usable services
 * menu and vaccine list, which makes onboarding far easier.
 *
 * Scheduled (not run inline) from `seedFromClerk` so a seed failure can never
 * break org creation. Idempotent per table — skips services or vaccines if the
 * org already has any — so a scheduler retry can't create duplicates.
 */
export const seedCatalog = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (index) =>
        index.eq("clerkOrgId", args.orgId),
      )
      .unique();
    if (!org) return;

    const existingVaccines = await ctx.db
      .query("vaccines")
      .withIndex("by_org", (index) => index.eq("orgId", args.orgId))
      .take(1);
    if (existingVaccines.length === 0) {
      await insertVaccines(ctx, args.orgId);
    }

    const existingServices = await ctx.db
      .query("services")
      .withIndex("by_org", (index) => index.eq("orgId", args.orgId))
      .take(1);
    if (existingServices.length === 0) {
      await insertServices(ctx, args.orgId, org.currency);
    }
  },
});

async function alreadySeeded(ctx: MutationCtx, orgId: string): Promise<boolean> {
  const existing = await ctx.db
    .query("clients")
    .withIndex("by_org", (index) => index.eq("orgId", orgId))
    .take(1);
  return existing.length > 0;
}

async function insertVaccines(
  ctx: MutationCtx,
  orgId: string,
): Promise<Map<string, Id<"vaccines">>> {
  const idsBySlug = new Map<string, Id<"vaccines">>();
  for (const vaccine of VACCINE_FIXTURES) {
    const id = await ctx.db.insert("vaccines", {
      orgId,
      name: vaccine.name,
      species: vaccine.species,
      defaultIntervalMonths: vaccine.defaultIntervalMonths,
      description: vaccine.description,
      isActive: true,
    });
    idsBySlug.set(vaccine.slug, id);
  }
  return idsBySlug;
}

async function insertServices(
  ctx: MutationCtx,
  orgId: string,
  currency: string,
): Promise<Id<"services">[]> {
  const ids: Id<"services">[] = [];
  for (const service of SERVICE_FIXTURES) {
    const id = await ctx.db.insert("services", {
      orgId,
      // Org-wide: every location lists these services without needing a
      // per-location row.
      locationId: undefined,
      name: service.name,
      description: service.description,
      durationMin: service.durationMin,
      priceCents: service.priceCents,
      currency,
      species: service.species,
      color: service.color,
      isActive: true,
    });
    ids.push(id);
  }
  return ids;
}

async function insertClientsAndPets(
  ctx: MutationCtx,
  orgId: string,
  locationId: Id<"locations">,
  vaccineIdsBySlug: Map<string, Id<"vaccines">>,
): Promise<{
  clientIds: Id<"clients">[];
  petIdsByClient: Id<"pets">[][];
}> {
  const clientIds: Id<"clients">[] = [];
  const petIdsByClient: Id<"pets">[][] = [];
  // Vaccinations are seeded with a six-month-old expiry so some land in the
  // past (visible as "due") and some still pending — gives the pet card a
  // realistic mix without random.
  const sixMonthsFromNowIso = isoDateMonthsFromNow(6);
  const todayIso = todayIsoUtc();

  for (const client of CLIENT_FIXTURES) {
    const fullName = `${client.firstName} ${client.lastName}`;
    const clientId = await ctx.db.insert("clients", {
      orgId,
      fullName,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: normalizePhone(client.phone),
      altPhones: client.altPhones?.map(normalizePhone),
      email: client.email,
      addressLine1: client.addressLine1,
      city: client.city,
      state: client.state,
      postalCode: client.postalCode,
      country: client.country,
      notes: client.notes,
      preferredLocationId: locationId,
    });
    clientIds.push(clientId);

    const petIds: Id<"pets">[] = [];
    for (const pet of client.pets) {
      const vaccinations = pet.vaccineSlugs
        .map((slug) => vaccineIdsBySlug.get(slug))
        .filter((id): id is Id<"vaccines"> => id !== undefined)
        .map((vaccineId, index) => ({
          vaccineId,
          // Stagger two vaccinations: first half use a near-future expiry,
          // second half use today so they read as "due".
          expiresOn: index % 2 === 0 ? sixMonthsFromNowIso : todayIso,
          verified: true,
        }));
      const petId = await ctx.db.insert("pets", {
        orgId,
        clientId,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        coatType: pet.coatType,
        sizeLb: pet.sizeLb,
        birthDate: isoDateYearsAgo(pet.birthYearsAgo),
        sex: pet.sex,
        isFixed: pet.isFixed,
        vaccinations,
      });
      petIds.push(petId);
    }
    petIdsByClient.push(petIds);
  }
  return { clientIds, petIdsByClient };
}

async function insertAppointments(
  ctx: MutationCtx,
  args: {
    orgId: string;
    locationId: Id<"locations">;
    staffId: Id<"memberships">;
    serviceIds: Id<"services">[];
    clientIds: Id<"clients">[];
    petIdsByClient: Id<"pets">[][];
    currency: string;
  },
): Promise<void> {
  const now = Date.now();
  let uuidSequence = 0;
  for (const fixture of APPOINTMENT_FIXTURES) {
    const clientId = args.clientIds[fixture.clientIndex];
    const pets = args.petIdsByClient[fixture.clientIndex];
    const petId = pets?.[fixture.petIndex];
    const serviceId = args.serviceIds[fixture.serviceIndex];
    if (!clientId || !petId || !serviceId) continue;
    const service = await ctx.db.get(serviceId);
    if (!service) continue;

    const startTime = computeStartTime(now, fixture.daysAgo, fixture.hourLocal);
    const endTime = startTime + service.durationMin * 60 * 1000;
    uuidSequence += 1;

    await ctx.db.insert("appointments", {
      orgId: args.orgId,
      locationId: args.locationId,
      clientId,
      petId,
      staffId: args.staffId,
      serviceId,
      startTime,
      endTime,
      status: "completed",
      priceCentsSnapshot: service.priceCents,
      paymentStatus: "paid",
      clientUuid: `seed-${args.orgId}-${uuidSequence}`,
      createdBy: args.staffId,
      createdAt: startTime,
    });
  }
}

function computeStartTime(now: number, daysAgo: number, hourLocal: number): number {
  // Step back `daysAgo` days then anchor to `hourLocal` o'clock. UTC-based —
  // the booking display layer renders in the location's tz, so visually the
  // hour will skew by the tz offset. Good enough for seed data; the user
  // won't be comparing to a Toronto wall clock down to the minute.
  const base = new Date(now);
  base.setDate(base.getDate() - daysAgo);
  base.setHours(hourLocal, 0, 0, 0);
  return base.getTime();
}

function isoDateYearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return formatIsoDate(date);
}

function isoDateMonthsFromNow(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatIsoDate(date);
}

function todayIsoUtc(): string {
  return formatIsoDate(new Date());
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
