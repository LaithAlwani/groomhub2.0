/**
 * Parse a JSON or CSV import file whose contents already match GroomHub's
 * import schema into a typed `ClientImport[]`. There is NO column-mapping
 * step any more — the file is assumed to be shaped correctly:
 *
 *   [
 *     {
 *       "fullName": "Jane Doe",
 *       "email": "jane@example.com",
 *       "phone": "555-123-4567",
 *       "altPhones": ["555-000-0000"],
 *       "addressLine1": "123 Main St",
 *       "city": "Springfield", "state": "IL", "postalCode": "62704",
 *       "country": "USA", "notes": "VIP",
 *       "pets": [
 *         { "name": "Rex", "species": "dog", "breed": "Lab",
 *           "birthDate": "2020-01-01", "sex": "male", "sizeLb": 70, "notes": "" }
 *       ],
 *       "legacyAppointments": [
 *         { "petName": "Rex", "serviceName": "Full groom", "staffName": "Alex",
 *           "dateLabel": "2024-10-03", "timeLabel": "10:00 AM",
 *           "priceLabel": "$75", "notes": "" }
 *       ]
 *     }
 *   ]
 *
 * JSON supports the full nested shape above. CSV is one client per row with
 * the same flat field names; its `pets` / `legacyAppointments` / `altPhones`
 * cells may hold a JSON array string when a row needs them.
 */

export type PetImport = {
  name: string;
  species: "dog" | "cat" | "other";
  breed?: string;
  birthDate?: string;
  sex?: "male" | "female";
  sizeLb?: number;
  notes?: string;
};

export type LegacyAppointmentImport = {
  petName?: string;
  serviceName?: string;
  staffName?: string;
  dateLabel?: string;
  timeLabel?: string;
  priceLabel?: string;
  notes?: string;
};

export type ClientImport = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  altPhones?: string[];
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  pets: PetImport[];
  legacyAppointments: LegacyAppointmentImport[];
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB raw file cap

export async function parseImport(file: File): Promise<ClientImport[]> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large. Keep imports under 50 MB.");
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "json" || file.type === "application/json") {
    return parseJson(await file.text());
  }
  if (ext === "csv" || file.type === "text/csv") {
    return parseCsv(file);
  }
  throw new Error(
    `Unsupported file type "${ext}". Provide a JSON or CSV file that matches the import schema.`,
  );
}

function parseJson(text: string): ClientImport[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (caught) {
    throw new Error(
      `Could not parse JSON: ${caught instanceof Error ? caught.message : "invalid"}`,
    );
  }
  // Relational envelope: `{ clients: [...], pets: [...], legacyAppointments:
  // [...] }` where pets / legacy are sibling arrays joined to their client by
  // `clientRef`. This is the shape our exporter emits.
  if (
    isObject(parsed) &&
    Array.isArray(parsed.clients) &&
    (Array.isArray(parsed.pets) || Array.isArray(parsed.legacyAppointments))
  ) {
    return joinRelational(parsed);
  }
  // Otherwise treat pets / legacy as nested inside each client.
  const rawClients = findClientArray(parsed);
  if (rawClients.length === 0) {
    throw new Error("The file has no client records.");
  }
  return rawClients.map((raw) => toClientImport(raw));
}

/**
 * Accept either a bare `[ ... ]` array of clients, a `{ clients: [...] }` /
 * `{ data: [...] }` / `{ rows: [...] }` wrapper, or a single client object.
 */
function findClientArray(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed.filter(isObject);
  if (isObject(parsed)) {
    for (const key of ["clients", "data", "rows", "records"]) {
      const value = parsed[key];
      if (Array.isArray(value)) return value.filter(isObject);
    }
    return [parsed];
  }
  return [];
}

/**
 * Join a relational export into per-client `ClientImport`s. Pets and legacy
 * appointments are grouped by their `clientRef` foreign key and attached to
 * the matching client. Rows whose ref matches no client are dropped.
 */
function joinRelational(envelope: Record<string, unknown>): ClientImport[] {
  const clients = (envelope.clients as unknown[]).filter(isObject);
  if (clients.length === 0) {
    throw new Error("The file has no client records.");
  }
  const petsByRef = groupByRef(envelope.pets);
  const legacyByRef = groupByRef(envelope.legacyAppointments);
  return clients.map((raw) => {
    const ref = refOf(raw);
    const base = toClientImport(raw);
    const joinedPets = ref ? petsByRef.get(ref) : undefined;
    const joinedLegacy = ref ? legacyByRef.get(ref) : undefined;
    return {
      ...base,
      pets: joinedPets ? joinedPets.map(toPetImport) : base.pets,
      legacyAppointments: joinedLegacy
        ? joinedLegacy.map(toLegacyImport)
        : base.legacyAppointments,
    };
  });
}

/** Group child rows (pets / legacy) by the client foreign key they carry. */
function groupByRef(
  value: unknown,
): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  if (!Array.isArray(value)) return map;
  for (const item of value) {
    if (!isObject(item)) continue;
    const ref = refOf(item);
    if (!ref) continue;
    const list = map.get(ref);
    if (list) list.push(item);
    else map.set(ref, [item]);
  }
  return map;
}

/**
 * The join value tying a client to its pets / legacy rows.
 *   - On a child row (pet / legacy) this is the foreign key: `clientRef` or
 *     `clientId`.
 *   - On a client row this is its own identity: `_id` (Convex export) or an
 *     explicit `clientRef`.
 * The child foreign keys are tried first so a pet's own `_id` never wins over
 * its `clientId`.
 */
function refOf(row: Record<string, unknown>): string | undefined {
  return (
    str(row.clientRef) ??
    str(row.clientId) ??
    str(row.ref) ??
    str(row.id) ??
    str(row._id)
  );
}

async function parseCsv(file: File): Promise<ClientImport[]> {
  const { default: Papa } = await import("papaparse");
  return new Promise<ClientImport[]>((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const rows = (result.data as Record<string, unknown>[])
          .filter(isObject)
          .map(toClientImport);
        if (rows.length === 0) {
          reject(new Error("The CSV has no readable rows."));
          return;
        }
        resolve(rows);
      },
      error: (caught: Error) =>
        reject(new Error(`Could not parse CSV: ${caught.message}`)),
    });
  });
}

function toClientImport(raw: Record<string, unknown>): ClientImport {
  const firstName = str(raw.firstName);
  const lastName = str(raw.lastName);
  const composed = [firstName, lastName].filter(Boolean).join(" ").trim();
  const fullName = str(raw.fullName) ?? (composed.length > 0 ? composed : "");
  return {
    fullName,
    firstName,
    lastName,
    phone: str(raw.phone),
    altPhones: strList(raw.altPhones),
    email: str(raw.email),
    addressLine1: str(raw.addressLine1),
    addressLine2: str(raw.addressLine2),
    city: str(raw.city),
    state: str(raw.state),
    postalCode: str(raw.postalCode),
    country: str(raw.country),
    notes: str(raw.notes),
    pets: objList(raw.pets).map(toPetImport),
    legacyAppointments: objList(raw.legacyAppointments ?? raw.legacy).map(
      toLegacyImport,
    ),
  };
}

function toPetImport(raw: Record<string, unknown>): PetImport {
  return {
    name: str(raw.name) ?? "Unknown",
    species: coerceSpecies(str(raw.species)),
    breed: str(raw.breed),
    birthDate: str(raw.birthDate),
    sex: coerceSex(str(raw.sex)),
    sizeLb: coerceNumber(raw.sizeLb),
    notes: str(raw.notes),
  };
}

function toLegacyImport(raw: Record<string, unknown>): LegacyAppointmentImport {
  return {
    petName: str(raw.petName),
    serviceName: str(raw.serviceName),
    staffName: str(raw.staffName),
    dateLabel: str(raw.dateLabel),
    timeLabel: str(raw.timeLabel),
    priceLabel: str(raw.priceLabel),
    notes: str(raw.notes),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Read a scalar as a trimmed non-empty string, or undefined. */
function str(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/**
 * Read a list of strings from either a JSON array or a CSV cell holding a
 * JSON array / comma- or semicolon-separated values.
 */
function strList(value: unknown): string[] | undefined {
  const values = coerceArray(value)
    .map((entry) => str(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values : undefined;
}

/** Read a list of objects from a JSON array or a CSV cell holding one. */
function objList(value: unknown): Record<string, unknown>[] {
  return coerceArray(value).filter(isObject);
}

/**
 * Normalize a value into an array. Handles native arrays (JSON) plus CSV
 * cells that hold a JSON array string or delimiter-separated scalars.
 */
function coerceArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fall through to delimiter split
      }
    }
    return trimmed.split(/[;,]/).map((part) => part.trim());
  }
  return [];
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

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
