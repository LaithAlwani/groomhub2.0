import type { Id } from "@/convex/_generated/dataModel";

/**
 * Pure functions that translate the wizard's column-mapping state plus the
 * parsed source rows into typed import rows ready for `commitBatch`.
 *
 * The wizard supports three import modes — pick which one in the Mapping
 * step's radio:
 *   - `clients`             — every row is a client (no pets).
 *   - `clientsAndPets`      — every row is a client + one pet attached.
 *   - `appointmentHistory`  — every row is a past visit to attach to an
 *                             EXISTING client (looked up by email / phone).
 *
 * The output `ImportRow` shape mirrors `convex/imports.ts` `importRowValidator`
 * exactly so we can pass it to the mutation without re-shaping.
 */

export type ImportMode = "clients" | "clientsAndPets" | "appointmentHistory";

/** Every supported target field. Used by the mapping dropdowns. */
export type TargetField =
  | "skip"
  | "client.fullName"
  | "client.firstName"
  | "client.middleName"
  | "client.lastName"
  | "client.email"
  | "client.phone"
  | "client.addressLine1"
  | "client.city"
  | "client.state"
  | "client.postalCode"
  | "client.country"
  | "client.notes"
  | "pet.name"
  | "pet.species"
  | "pet.breed"
  | "pet.birthDate"
  | "pet.sizeLb"
  | "pet.sex"
  | "pet.notes"
  | "pet2.name"
  | "pet2.species"
  | "pet2.breed"
  | "pet2.birthDate"
  | "pet2.sizeLb"
  | "pet2.sex"
  | "pet2.notes"
  | "pet3.name"
  | "pet3.species"
  | "pet3.breed"
  | "pet3.birthDate"
  | "pet3.sizeLb"
  | "pet3.sex"
  | "pet3.notes"
  | "history.clientEmail"
  | "history.clientPhone"
  | "history.petName"
  | "history.serviceName"
  | "history.staffName"
  | "history.dateLabel"
  | "history.timeLabel"
  | "history.priceLabel"
  | "history.notes";

export type ColumnMapping = Record<string, TargetField>;

/**
 * Per-pet-slot target field names. The clients+pets importer reads up
 * to three pets per row by walking this list; an empty `name` field
 * skips the slot. Keeps `buildPreview` from repeating itself three times.
 */
type PetSlotTargets = {
  name: TargetField;
  species: TargetField;
  breed: TargetField;
  birthDate: TargetField;
  sex: TargetField;
  sizeLb: TargetField;
  notes: TargetField;
};
const PET_SLOTS: ReadonlyArray<PetSlotTargets> = [
  {
    name: "pet.name",
    species: "pet.species",
    breed: "pet.breed",
    birthDate: "pet.birthDate",
    sex: "pet.sex",
    sizeLb: "pet.sizeLb",
    notes: "pet.notes",
  },
  {
    name: "pet2.name",
    species: "pet2.species",
    breed: "pet2.breed",
    birthDate: "pet2.birthDate",
    sex: "pet2.sex",
    sizeLb: "pet2.sizeLb",
    notes: "pet2.notes",
  },
  {
    name: "pet3.name",
    species: "pet3.species",
    breed: "pet3.breed",
    birthDate: "pet3.birthDate",
    sex: "pet3.sex",
    sizeLb: "pet3.sizeLb",
    notes: "pet3.notes",
  },
];

export type ImportRow = {
  rowId: string;
  client?:
    | { kind: "insert"; data: BuiltClient }
    | { kind: "existing"; id: Id<"clients"> };
  pets?: BuiltPet[];
  legacy?: BuiltLegacy[];
};

type BuiltClient = {
  fullName: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
};

type BuiltPet = {
  name: string;
  species: "dog" | "cat" | "other";
  breed?: string;
  birthDate?: string;
  sex?: "male" | "female";
  sizeLb?: number;
  notes?: string;
};

type BuiltLegacy = {
  petName?: string;
  serviceName?: string;
  staffName?: string;
  dateLabel?: string;
  timeLabel?: string;
  priceLabel?: string;
  notes?: string;
};

export type PreviewIssue = "missing-client-name" |
  "missing-history-lookup" | "missing-history-date" | "unknown-client" |
  "duplicate-email" | "duplicate-phone";

export type PreviewRow = {
  rowId: string;
  source: Record<string, string>;
  built: ImportRow;
  issues: PreviewIssue[];
  matchedClient: { id: Id<"clients">; fullName: string } | null;
  // User's decision for duplicates — "skip" or "insertNew". Default is "skip".
  resolution: "insert" | "skip" | "insertNew";
};

/**
 * Pick the most likely import mode from the file's headers alone. Runs on
 * upload so the mapping step opens with the radio already correct.
 * - `appointmentHistory` when headers hint at past visits AND there's a
 *   client-lookup column (email or phone).
 * - `clientsAndPets`     when headers mention pets / breeds / species.
 * - `clients`            as the default fall-through.
 * Deterministic — pure header inspection, no AI cost.
 */
export function detectImportMode(headers: string[]): ImportMode {
  const normalized = headers.map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const includesAny = (...needles: string[]): boolean =>
    normalized.some((header) =>
      needles.some((needle) => header.includes(needle)),
    );
  const looksLikeAppointment =
    includesAny("appointment", "visit", "groomer", "stylist", "checkin", "checkout") ||
    (includesAny("service") && includesAny("date"));
  const hasClientLookup = includesAny("email", "phone", "mobile", "cell");
  if (looksLikeAppointment && hasClientLookup) return "appointmentHistory";
  if (includesAny("pet", "breed", "species", "animal")) return "clientsAndPets";
  return "clients";
}

/**
 * Heuristic header-name → target mapping used to pre-fill the wizard's
 * dropdowns. Anything not matched here lands as "skip" — the user picks
 * from the dropdown manually.
 */
export function suggestMapping(
  headers: string[],
  mode: ImportMode,
): ColumnMapping {
  const result: ColumnMapping = {};
  for (const raw of headers) {
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    result[raw] = guess(normalized, mode);
  }
  return result;
}

function guess(key: string, mode: ImportMode): TargetField {
  if (mode === "appointmentHistory") {
    if (key.includes("email")) return "history.clientEmail";
    if (key.includes("phone")) return "history.clientPhone";
    if (key.includes("petname") || key === "pet") return "history.petName";
    if (key.includes("service")) return "history.serviceName";
    if (key.includes("groomer") || key.includes("staff") || key.includes("stylist"))
      return "history.staffName";
    if (key.includes("date") || key.includes("when")) return "history.dateLabel";
    if (key.includes("time")) return "history.timeLabel";
    if (key.includes("price") || key.includes("cost") || key.includes("total"))
      return "history.priceLabel";
    if (key.includes("note") || key.includes("comment")) return "history.notes";
    return "skip";
  }
  if (key.includes("fullname") || key.includes("ownername") || key === "name")
    return "client.fullName";
  if (key.includes("firstname") || key === "givenname" || key === "fname")
    return "client.firstName";
  if (
    key.includes("middlename") ||
    key === "midname" ||
    key === "mname" ||
    key === "middle"
  )
    return "client.middleName";
  if (
    key.includes("lastname") ||
    key === "surname" ||
    key === "familyname" ||
    key === "lname"
  )
    return "client.lastName";
  if (key.includes("email")) return "client.email";
  if (key.includes("phone") || key.includes("mobile") || key.includes("cell"))
    return "client.phone";
  if (key.includes("address") || key.includes("street"))
    return "client.addressLine1";
  if (key === "city") return "client.city";
  if (key === "state" || key === "province") return "client.state";
  if (key.includes("zip") || key.includes("postal")) return "client.postalCode";
  if (key === "country") return "client.country";
  if (mode === "clientsAndPets") {
    // Numbered slots (Pet Name 2 / Breed 2 / ...) come first so the
    // catch-all slot-1 rules don't swallow them. Contact-export XML
    // typically uses 1/2/3 suffixes.
    const slot2 = matchPetSlot(key, "2");
    if (slot2) return slot2;
    const slot3 = matchPetSlot(key, "3");
    if (slot3) return slot3;
    if (
      key === "petname" ||
      key === "petname1" ||
      (key.includes("pet") && key.includes("name"))
    )
      return "pet.name";
    if (key.includes("species") || key === "type") return "pet.species";
    if (key.includes("breed")) return "pet.breed";
    if (key.includes("birthdate") || key === "dob") return "pet.birthDate";
    if (key === "sex" || key === "gender") return "pet.sex";
    if (key.includes("weight") || key === "sizelb" || key === "lbs")
      return "pet.sizeLb";
  }
  if (key === "notes" || key === "comments") return "client.notes";
  return "skip";
}

/**
 * Map a normalized header like `petname2` / `breed2` / `species3` to the
 * matching pet-slot target. Returns null when the key isn't a numbered
 * pet column so the caller can fall through to slot-1 rules.
 */
function matchPetSlot(key: string, slot: "2" | "3"): TargetField | null {
  if (!key.endsWith(slot)) return null;
  const base = key.slice(0, -1);
  const prefix = slot === "2" ? "pet2" : "pet3";
  if (base === "petname" || (base.includes("pet") && base.includes("name")))
    return `${prefix}.name` as TargetField;
  if (base.includes("species") || base === "type")
    return `${prefix}.species` as TargetField;
  if (base.includes("breed")) return `${prefix}.breed` as TargetField;
  if (base.includes("birthdate") || base === "dob")
    return `${prefix}.birthDate` as TargetField;
  if (base === "sex" || base === "gender")
    return `${prefix}.sex` as TargetField;
  if (base.includes("weight") || base === "sizelb" || base === "lbs")
    return `${prefix}.sizeLb` as TargetField;
  return null;
}

/** Coerce species values from arbitrary text into our schema's strict union. */
function coerceSpecies(raw: string | undefined): "dog" | "cat" | "other" {
  const lower = (raw ?? "").toLowerCase();
  if (lower.startsWith("dog") || lower.startsWith("k9")) return "dog";
  if (lower.startsWith("cat") || lower.startsWith("feline")) return "cat";
  return "other";
}

function coerceSex(raw: string | undefined): "male" | "female" | undefined {
  const lower = (raw ?? "").toLowerCase().trim();
  if (lower.startsWith("m") || lower === "boy") return "male";
  if (lower.startsWith("f") || lower === "girl") return "female";
  return undefined;
}

function coerceLb(raw: string | undefined): number | undefined {
  const value = parseFloat((raw ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function get(
  row: Record<string, string>,
  mapping: ColumnMapping,
  target: TargetField,
): string | undefined {
  for (const [header, mapped] of Object.entries(mapping)) {
    if (mapped !== target) continue;
    const value = (row[header] ?? "").trim();
    if (value.length > 0) return value;
  }
  return undefined;
}

/**
 * Build import-ready rows from raw parsed input + the user's mapping.
 * Returns one `PreviewRow` per source row, with issues annotated so the
 * preview UI can colour-code (green / yellow / red).
 *
 * Duplicate detection (`duplicate-email` / `duplicate-phone`) needs the
 * caller to pass `knownEmails` + `knownPhones` from `checkDuplicates`.
 * Appointment-history matching against existing clients uses `clientLookup`
 * — a map from normalized email / phone → existing client id (built by
 * the caller).
 */
export function buildPreview(args: {
  mode: ImportMode;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  knownEmails: Set<string>;
  knownPhones: Set<string>;
  clientLookup: Map<string, { id: Id<"clients">; fullName: string }>;
}): PreviewRow[] {
  return args.rows.map((source, index) => {
    const rowId = String(index);
    const issues: PreviewIssue[] = [];
    let built: ImportRow = { rowId };
    let matchedClient: PreviewRow["matchedClient"] = null;
    const phoneDigits = (raw: string | undefined): string | undefined => {
      const digits = (raw ?? "").replace(/\D/g, "");
      return digits.length > 0 ? digits : undefined;
    };

    if (args.mode === "appointmentHistory") {
      const emailKey =
        get(source, args.mapping, "history.clientEmail")?.toLowerCase();
      const phoneKey = phoneDigits(
        get(source, args.mapping, "history.clientPhone"),
      );
      const hasLookup = Boolean(emailKey ?? phoneKey);
      if (!hasLookup) issues.push("missing-history-lookup");
      // Try email first, then phone — both feed the same lookup map.
      // Falling through means a wrong/missing email doesn't mask a good phone.
      const existing =
        (emailKey ? args.clientLookup.get(emailKey) : undefined) ??
        (phoneKey ? args.clientLookup.get(phoneKey) : undefined);
      if (hasLookup && !existing) issues.push("unknown-client");
      matchedClient = existing ?? null;
      const dateLabel = get(source, args.mapping, "history.dateLabel");
      if (!dateLabel) issues.push("missing-history-date");
      built = {
        rowId,
        client: existing
          ? { kind: "existing", id: existing.id }
          : undefined,
        legacy: [
          {
            petName: get(source, args.mapping, "history.petName"),
            serviceName: get(source, args.mapping, "history.serviceName"),
            staffName: get(source, args.mapping, "history.staffName"),
            dateLabel,
            timeLabel: get(source, args.mapping, "history.timeLabel"),
            priceLabel: get(source, args.mapping, "history.priceLabel"),
            notes: get(source, args.mapping, "history.notes"),
          },
        ],
      };
    } else {
      // `client.fullName` wins when mapped; otherwise stitch first/middle/last
      // together so vCard / Outlook exports (which split names across columns)
      // produce a single fullName for the clients table.
      const directFullName = get(source, args.mapping, "client.fullName");
      const firstName = get(source, args.mapping, "client.firstName");
      const middleName = get(source, args.mapping, "client.middleName");
      const lastName = get(source, args.mapping, "client.lastName");
      const composed = [firstName, middleName, lastName]
        .filter((part): part is string => Boolean(part && part.length > 0))
        .join(" ")
        .trim();
      const fullName = directFullName ?? (composed.length > 0 ? composed : undefined);
      if (!fullName) issues.push("missing-client-name");
      const email = get(source, args.mapping, "client.email")?.toLowerCase();
      const phone = phoneDigits(get(source, args.mapping, "client.phone"));
      if (email && args.knownEmails.has(email)) issues.push("duplicate-email");
      if (phone && args.knownPhones.has(phone)) issues.push("duplicate-phone");
      const clientData: BuiltClient | null = fullName
        ? {
            fullName,
            email,
            phone,
            addressLine1: get(source, args.mapping, "client.addressLine1"),
            city: get(source, args.mapping, "client.city"),
            state: get(source, args.mapping, "client.state"),
            postalCode: get(source, args.mapping, "client.postalCode"),
            country: get(source, args.mapping, "client.country"),
            notes: get(source, args.mapping, "client.notes"),
          }
        : null;
      const pets: BuiltPet[] = [];
      if (args.mode === "clientsAndPets") {
        // Each contact may carry up to three pets in the mapping (Pet
        // Name 1/2/3 + matching breed/species/etc.). Skip empty slots
        // silently — a missing pet doesn't block the client from
        // importing; the shop can attach pets later.
        for (const slot of PET_SLOTS) {
          const petName = get(source, args.mapping, slot.name);
          if (!petName) continue;
          pets.push({
            name: petName,
            species: coerceSpecies(get(source, args.mapping, slot.species)),
            breed: get(source, args.mapping, slot.breed),
            birthDate: get(source, args.mapping, slot.birthDate),
            sex: coerceSex(get(source, args.mapping, slot.sex)),
            sizeLb: coerceLb(get(source, args.mapping, slot.sizeLb)),
            notes: get(source, args.mapping, slot.notes),
          });
        }
      }
      built = {
        rowId,
        client: clientData ? { kind: "insert", data: clientData } : undefined,
        pets: pets.length > 0 ? pets : undefined,
      };
    }

    const isDup =
      issues.includes("duplicate-email") || issues.includes("duplicate-phone");
    return {
      rowId,
      source,
      built,
      issues,
      matchedClient,
      resolution: isDup ? "skip" : "insert",
    };
  });
}
