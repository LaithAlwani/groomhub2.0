/**
 * Static fixtures used by `convex/seed.ts` to populate new shops on dev
 * deployments. Same names, breeds, services every run — deterministic by
 * design so the demo UI looks identical across shop creates.
 *
 * Vaccination expiry dates and appointment timestamps are computed at insert
 * time from `Date.now()` so they stay "recent" no matter when the seed runs.
 * Everything else here is hardcoded.
 *
 * Slugs (e.g. `"rabies"`, `"full-groom"`) are internal join keys — they let
 * the pet fixtures reference vaccines by name without needing the inserted
 * `Id<"vaccines">` at fixture-write time. The seed resolves them to real
 * ids during insert.
 */

import type { Infer } from "convex/values";
import type { speciesValidator, sexValidator } from "../schema";

type Species = Infer<typeof speciesValidator>;
type Sex = Infer<typeof sexValidator>;

export type VaccineFixture = {
  slug: string;
  name: string;
  species: Species[];
  defaultIntervalMonths: number;
  description: string;
};

export type ServiceFixture = {
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  species: Species[];
  color: string;
};

export type PetFixture = {
  name: string;
  species: Species;
  breed: string;
  coatType?: string;
  sizeLb?: number;
  birthYearsAgo: number;
  sex: Sex;
  isFixed: boolean;
  vaccineSlugs: string[];
};

export type ClientFixture = {
  firstName: string;
  lastName: string;
  phone: string;          // raw — gets normalized to digits-only at insert
  altPhones?: string[];
  email?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  pets: PetFixture[];
};

export type AppointmentFixture = {
  clientIndex: number;   // into CLIENT_FIXTURES
  petIndex: number;      // into that client's pets array
  serviceIndex: number;  // into SERVICE_FIXTURES
  daysAgo: number;
  hourLocal: number;     // 24h clock in the shop's timezone
};

// ──────────────────────────────────────────────────────────────────────────
// VACCINES — common grooming-shop catalog. Slugs are internal join keys.
// ──────────────────────────────────────────────────────────────────────────

export const VACCINE_FIXTURES: VaccineFixture[] = [
  { slug: "rabies", name: "Rabies", species: ["dog", "cat"], defaultIntervalMonths: 12, description: "Legally required in most jurisdictions." },
  { slug: "dhpp", name: "DHPP (Distemper / Hepatitis / Parainfluenza / Parvo)", species: ["dog"], defaultIntervalMonths: 12, description: "Core canine combination vaccine." },
  { slug: "bordetella", name: "Bordetella (Kennel Cough)", species: ["dog"], defaultIntervalMonths: 6, description: "Required for daycare and group settings." },
  { slug: "lyme", name: "Lyme Disease", species: ["dog"], defaultIntervalMonths: 12, description: "Recommended for dogs in tick-prone areas." },
  { slug: "leptospirosis", name: "Leptospirosis", species: ["dog"], defaultIntervalMonths: 12, description: "Annual; protects against bacterial infection from wildlife." },
  { slug: "canine-influenza", name: "Canine Influenza", species: ["dog"], defaultIntervalMonths: 12, description: "Dog flu vaccine; common at daycare and grooming facilities." },
  { slug: "fvrcp", name: "FVRCP (Rhinotracheitis / Calicivirus / Panleukopenia)", species: ["cat"], defaultIntervalMonths: 12, description: "Core feline combination vaccine." },
  { slug: "felv", name: "FeLV (Feline Leukemia)", species: ["cat"], defaultIntervalMonths: 12, description: "Recommended for outdoor cats and multi-cat households." },
];

// ──────────────────────────────────────────────────────────────────────────
// SERVICES — typical grooming menu. Colours match the calendar palette.
// ──────────────────────────────────────────────────────────────────────────

export const SERVICE_FIXTURES: ServiceFixture[] = [
  { name: "Full Groom", description: "Bath, blow-dry, haircut, nail trim, ear cleaning.", durationMin: 90, priceCents: 8000, species: ["dog", "cat"], color: "#f97316" },
  { name: "Bath & Brush", description: "Wash, blow-dry, brush-out. No haircut.", durationMin: 45, priceCents: 4000, species: ["dog", "cat"], color: "#0ea5e9" },
  { name: "Nail Trim", description: "Quick nail trim and file.", durationMin: 15, priceCents: 1500, species: ["dog", "cat"], color: "#10b981" },
  { name: "De-Shedding Treatment", description: "Specialized brush-out to reduce shedding for 4-6 weeks.", durationMin: 60, priceCents: 5500, species: ["dog", "cat"], color: "#8b5cf6" },
  { name: "Teeth Brushing", description: "Add-on dental care during a groom or bath.", durationMin: 20, priceCents: 2000, species: ["dog", "cat"], color: "#ef4444" },
];

// ──────────────────────────────────────────────────────────────────────────
// CLIENTS + PETS — 20 households, 1–3 pets each (~40 pets total).
// Phones use varied input formats so `normalizePhone` is exercised.
// Roughly half have email (mirrors real grooming shops).
// ──────────────────────────────────────────────────────────────────────────

export const CLIENT_FIXTURES: ClientFixture[] = [
  {
    firstName: "Alex", lastName: "Johnson",
    phone: "613-555-0101", email: "alex.johnson@example.com",
    addressLine1: "12 Maple St", city: "Ottawa", state: "ON", postalCode: "K1A 0B1", country: "CA",
    notes: "Prefers morning appointments.",
    pets: [
      { name: "Luna", species: "dog", breed: "Labrador Retriever", coatType: "Short", sizeLb: 65, birthYearsAgo: 4, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Casey", lastName: "Park",
    phone: "(613) 555-0102",
    addressLine1: "88 Cedar Ave", city: "Ottawa", state: "ON", postalCode: "K2P 1L4", country: "CA",
    pets: [
      { name: "Cooper", species: "dog", breed: "Golden Retriever", coatType: "Long", sizeLb: 75, birthYearsAgo: 6, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella"] },
      { name: "Milo", species: "cat", breed: "Domestic Shorthair", sizeLb: 11, birthYearsAgo: 3, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "fvrcp"] },
    ],
  },
  {
    firstName: "Morgan", lastName: "Lee",
    phone: "5550103", email: "morgan.lee@example.com",
    pets: [
      { name: "Daisy", species: "dog", breed: "Poodle", coatType: "Curly", sizeLb: 25, birthYearsAgo: 5, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella"] },
    ],
  },
  {
    firstName: "Jordan", lastName: "Rivera",
    phone: "613.555.0104", email: "jordan.r@example.com",
    addressLine1: "401 Birchwood Dr", city: "Kanata", state: "ON", postalCode: "K2T 1B5", country: "CA",
    notes: "Dog is reactive — handle solo.",
    pets: [
      { name: "Bruno", species: "dog", breed: "German Shepherd", coatType: "Double", sizeLb: 85, birthYearsAgo: 7, sex: "male", isFixed: false, vaccineSlugs: ["rabies", "dhpp", "leptospirosis"] },
      { name: "Whiskers", species: "cat", breed: "Maine Coon", sizeLb: 16, birthYearsAgo: 4, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "fvrcp", "felv"] },
      { name: "Patch", species: "cat", breed: "Tabby", sizeLb: 9, birthYearsAgo: 2, sex: "male", isFixed: true, vaccineSlugs: ["fvrcp"] },
    ],
  },
  {
    firstName: "Riley", lastName: "Singh",
    phone: "16135550105",
    pets: [
      { name: "Bella", species: "dog", breed: "Bichon Frise", coatType: "Curly", sizeLb: 14, birthYearsAgo: 8, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Taylor", lastName: "Brooks",
    phone: "613-555-0106", email: "tbrooks@example.com",
    addressLine1: "210 Wellington St", city: "Ottawa", state: "ON", postalCode: "K1A 0A6", country: "CA",
    pets: [
      { name: "Max", species: "dog", breed: "Beagle", coatType: "Short", sizeLb: 28, birthYearsAgo: 5, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "lyme"] },
      { name: "Rocky", species: "dog", breed: "Border Collie", coatType: "Medium", sizeLb: 42, birthYearsAgo: 3, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Sam", lastName: "Patel",
    phone: "613 555 0107",
    pets: [
      { name: "Coco", species: "cat", breed: "Ragdoll", sizeLb: 13, birthYearsAgo: 6, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "fvrcp"] },
    ],
  },
  {
    firstName: "Quinn", lastName: "Murphy",
    phone: "613-555-0108", email: "quinn.murphy@example.com",
    addressLine1: "55 Greenfield Ave", city: "Ottawa", state: "ON", postalCode: "K1S 1A2", country: "CA",
    notes: "Always books two pets back-to-back.",
    pets: [
      { name: "Buddy", species: "dog", breed: "Cocker Spaniel", coatType: "Long", sizeLb: 30, birthYearsAgo: 9, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella"] },
      { name: "Lucy", species: "dog", breed: "Cavalier King Charles Spaniel", coatType: "Long", sizeLb: 18, birthYearsAgo: 4, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Avery", lastName: "Chen",
    phone: "613-555-0109", email: "avery.c@example.com",
    pets: [
      { name: "Shadow", species: "cat", breed: "Russian Blue", sizeLb: 10, birthYearsAgo: 7, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "fvrcp"] },
    ],
  },
  {
    firstName: "Drew", lastName: "Walker",
    phone: "613-555-0110",
    addressLine1: "1900 Bank St", city: "Ottawa", state: "ON", postalCode: "K1V 7Z9", country: "CA",
    pets: [
      { name: "Charlie", species: "dog", breed: "Shih Tzu", coatType: "Long", sizeLb: 16, birthYearsAgo: 6, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
      { name: "Oreo", species: "dog", breed: "Mixed", coatType: "Short", sizeLb: 35, birthYearsAgo: 2, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella", "canine-influenza"] },
      { name: "Misty", species: "cat", breed: "Persian", sizeLb: 12, birthYearsAgo: 8, sex: "female", isFixed: true, vaccineSlugs: ["fvrcp"] },
    ],
  },
  {
    firstName: "Robin", lastName: "Foster",
    phone: "(613)5550111", email: "robin.foster@example.com",
    pets: [
      { name: "Bailey", species: "dog", breed: "Australian Shepherd", coatType: "Double", sizeLb: 50, birthYearsAgo: 4, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "lyme"] },
    ],
  },
  {
    firstName: "Jamie", lastName: "Nguyen",
    phone: "613-555-0112",
    addressLine1: "440 Albert St", city: "Ottawa", state: "ON", postalCode: "K1R 5B5", country: "CA",
    notes: "Allergic to oatmeal shampoo — use hypoallergenic.",
    pets: [
      { name: "Zoe", species: "dog", breed: "Yorkshire Terrier", coatType: "Long", sizeLb: 7, birthYearsAgo: 5, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Skyler", lastName: "Reed",
    phone: "613-555-0113", email: "skyler.reed@example.com",
    pets: [
      { name: "Duke", species: "dog", breed: "Great Dane", coatType: "Short", sizeLb: 140, birthYearsAgo: 6, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella"] },
      { name: "Pepper", species: "cat", breed: "Siamese", sizeLb: 9, birthYearsAgo: 3, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "fvrcp"] },
    ],
  },
  {
    firstName: "Cameron", lastName: "Hughes",
    phone: "613-555-0114",
    pets: [
      { name: "Ruby", species: "dog", breed: "Dachshund", coatType: "Short", sizeLb: 12, birthYearsAgo: 7, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Hayden", lastName: "Bell",
    phone: "613-555-0115", email: "hbell@example.com",
    addressLine1: "33 Sunset Lane", city: "Nepean", state: "ON", postalCode: "K2H 7B5", country: "CA",
    pets: [
      { name: "Tucker", species: "dog", breed: "Boxer", coatType: "Short", sizeLb: 70, birthYearsAgo: 5, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "leptospirosis"] },
      { name: "Sasha", species: "dog", breed: "Husky", coatType: "Double", sizeLb: 55, birthYearsAgo: 4, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "lyme"] },
    ],
  },
  {
    firstName: "Parker", lastName: "Adams",
    phone: "613-555-0116",
    pets: [
      { name: "Ollie", species: "dog", breed: "Maltese", coatType: "Long", sizeLb: 8, birthYearsAgo: 9, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
    ],
  },
  {
    firstName: "Reese", lastName: "Cooper",
    phone: "613-555-0117", email: "reese.cooper@example.com",
    addressLine1: "905 Carling Ave", city: "Ottawa", state: "ON", postalCode: "K1Y 4E9", country: "CA",
    notes: "Second cat is very anxious — short groom only.",
    pets: [
      { name: "Mochi", species: "cat", breed: "Bengal", sizeLb: 11, birthYearsAgo: 3, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "fvrcp", "felv"] },
      { name: "Toby", species: "cat", breed: "Domestic Longhair", sizeLb: 14, birthYearsAgo: 8, sex: "male", isFixed: true, vaccineSlugs: ["fvrcp"] },
    ],
  },
  {
    firstName: "Logan", lastName: "Mitchell",
    phone: "613-555-0118",
    pets: [
      { name: "Roxy", species: "dog", breed: "Pit Bull Mix", coatType: "Short", sizeLb: 55, birthYearsAgo: 5, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella"] },
    ],
  },
  {
    firstName: "Devon", lastName: "Khan",
    phone: "613-555-0119", email: "devon.khan@example.com",
    pets: [
      { name: "Sammy", species: "dog", breed: "Pomeranian", coatType: "Long", sizeLb: 9, birthYearsAgo: 6, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp"] },
      { name: "Biscuit", species: "dog", breed: "French Bulldog", coatType: "Short", sizeLb: 22, birthYearsAgo: 4, sex: "female", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "bordetella"] },
    ],
  },
  {
    firstName: "Pat", lastName: "Stewart",
    phone: "613-555-0120",
    addressLine1: "72 Highland Rd", city: "Ottawa", state: "ON", postalCode: "K1Y 0V3", country: "CA",
    pets: [
      { name: "Finn", species: "dog", breed: "Sheltie", coatType: "Long", sizeLb: 22, birthYearsAgo: 7, sex: "male", isFixed: true, vaccineSlugs: ["rabies", "dhpp", "lyme"] },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// APPOINTMENTS — 15 past completed bookings spread one per day going back
// from yesterday. Each picks a deterministic client/pet/service combo so
// the dashboard's "recent activity" view, calendar past view, and client
// history pages all have non-trivial data on day one.
// ──────────────────────────────────────────────────────────────────────────

export const APPOINTMENT_FIXTURES: AppointmentFixture[] = [
  { clientIndex: 0,  petIndex: 0, serviceIndex: 0, daysAgo: 1,  hourLocal: 10 },
  { clientIndex: 1,  petIndex: 0, serviceIndex: 1, daysAgo: 2,  hourLocal: 11 },
  { clientIndex: 2,  petIndex: 0, serviceIndex: 0, daysAgo: 3,  hourLocal: 9  },
  { clientIndex: 3,  petIndex: 0, serviceIndex: 3, daysAgo: 4,  hourLocal: 14 },
  { clientIndex: 4,  petIndex: 0, serviceIndex: 0, daysAgo: 5,  hourLocal: 10 },
  { clientIndex: 5,  petIndex: 1, serviceIndex: 1, daysAgo: 7,  hourLocal: 12 },
  { clientIndex: 6,  petIndex: 0, serviceIndex: 2, daysAgo: 8,  hourLocal: 9  },
  { clientIndex: 7,  petIndex: 0, serviceIndex: 0, daysAgo: 10, hourLocal: 13 },
  { clientIndex: 8,  petIndex: 0, serviceIndex: 4, daysAgo: 12, hourLocal: 10 },
  { clientIndex: 9,  petIndex: 1, serviceIndex: 0, daysAgo: 14, hourLocal: 11 },
  { clientIndex: 10, petIndex: 0, serviceIndex: 3, daysAgo: 16, hourLocal: 15 },
  { clientIndex: 11, petIndex: 0, serviceIndex: 1, daysAgo: 18, hourLocal: 10 },
  { clientIndex: 12, petIndex: 0, serviceIndex: 0, daysAgo: 21, hourLocal: 9  },
  { clientIndex: 14, petIndex: 0, serviceIndex: 0, daysAgo: 24, hourLocal: 14 },
  { clientIndex: 18, petIndex: 1, serviceIndex: 0, daysAgo: 28, hourLocal: 11 },
];
