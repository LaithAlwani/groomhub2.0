import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { requireRole } from "./lib/rbac";
import { mapClerkOrgRole } from "./lib/roles";
import { readOrgClaims, softAuth } from "./lib/tenant";
import { speciesValidator, sexValidator } from "./schema";

/**
 * Convex backend for the legacy data importer at `/settings/import`. The
 * client wizard parses the file + applies a column mapping in the browser;
 * by the time it hits these functions every row is already typed.
 *
 * Three entry points:
 *   - `checkDuplicates` — single round-trip to flag preview rows that match
 *     existing clients by email or phone digits.
 *   - `commitBatch`     — admin-only batched insert (≤50 rows per call) for
 *     clients + their pets + their legacy appointment history.
 *   - `legacyAppointmentsForClient` — read for the client detail page.
 */

const phoneDigits = (raw: string | undefined): string =>
  (raw ?? "").replace(/\D/g, "");

const importClientValidator = v.object({
  fullName: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  addressLine1: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  country: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const importPetValidator = v.object({
  name: v.string(),
  species: speciesValidator,
  breed: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  sex: v.optional(sexValidator),
  sizeLb: v.optional(v.number()),
  notes: v.optional(v.string()),
});

const importLegacyValidator = v.object({
  petName: v.optional(v.string()),
  serviceName: v.optional(v.string()),
  staffName: v.optional(v.string()),
  dateLabel: v.optional(v.string()),
  timeLabel: v.optional(v.string()),
  priceLabel: v.optional(v.string()),
  notes: v.optional(v.string()),
});

/**
 * Each row in a batch:
 *   - `client` may be a brand-new client (insert) OR an existing one we
 *     should attach pets / legacy history to (referenced by id).
 *   - `pets` is appended to the client.
 *   - `legacy` is appended to the legacyAppointments table.
 * Every field is optional so a single row can describe "client only",
 * "client + pets", or "history pointed at an existing client".
 */
const importRowValidator = v.object({
  // Caller-generated unique row id — echoed back in the result so the UI
  // can mark the matching preview row as inserted / failed.
  rowId: v.string(),
  client: v.optional(
    v.union(
      v.object({ kind: v.literal("insert"), data: importClientValidator }),
      v.object({ kind: v.literal("existing"), id: v.id("clients") }),
    ),
  ),
  pets: v.optional(v.array(importPetValidator)),
  legacy: v.optional(v.array(importLegacyValidator)),
});

/**
 * Returns the set of (lowercased) emails and digits-only phones that already
 * exist on `clients` in the caller's org. The preview UI calls this once
 * with every email + phone in the file and uses the response to flag rows
 * as duplicates.
 *
 * Admin / superAdmin only — the legacy importer is admin-only.
 */
export const checkDuplicates = query({
  args: {
    emails: v.array(v.string()),
    phones: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return { emails: [], phones: [] };
    const inputEmails = new Set(
      args.emails
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    );
    const inputPhones = new Set(
      args.phones.map(phoneDigits).filter((value) => value.length > 0),
    );
    if (inputEmails.size === 0 && inputPhones.size === 0) {
      return { emails: [], phones: [] };
    }
    // Scan the org's clients once. `take(5000)` is a defensive cap — shops
    // with more than that should split their imports anyway. The UI calls
    // this from the preview step, so latency matters; this is the cheaper
    // path than per-row lookups.
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .take(5000);
    const matchedEmails = new Set<string>();
    const matchedPhones = new Set<string>();
    for (const row of clients) {
      if (row.deletedAt !== undefined) continue;
      if (row.email && inputEmails.has(row.email.trim().toLowerCase())) {
        matchedEmails.add(row.email.trim().toLowerCase());
      }
      const digits = phoneDigits(row.phone);
      if (digits.length > 0 && inputPhones.has(digits)) {
        matchedPhones.add(digits);
      }
    }
    return {
      emails: Array.from(matchedEmails),
      phones: Array.from(matchedPhones),
    };
  },
});

/**
 * Commits one chunk (≤50 rows) of the import. The wizard calls this in a
 * loop, advancing a progress bar per batch. Each row either lands cleanly
 * (counted in `created`) or fails (collected in `failures` with a reason)
 * — the batch as a whole does NOT abort on a single bad row, so partial
 * imports complete and the user can see exactly what couldn't be saved.
 *
 * Admin / superAdmin only.
 */
export const commitBatch = mutation({
  args: {
    batchId: v.string(),
    sourceSystem: v.optional(v.string()),
    rows: v.array(importRowValidator),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireRole(ctx, ["superAdmin", "admin"]);
    let createdClients = 0;
    let createdPets = 0;
    let createdLegacy = 0;
    const failures: Array<{ rowId: string; reason: string }> = [];
    const importedAt = Date.now();

    for (const row of args.rows) {
      try {
        let clientId: Id<"clients"> | null = null;
        if (row.client) {
          if (row.client.kind === "existing") {
            const existing = await ctx.db.get(row.client.id);
            if (!existing || existing.orgId !== orgId) {
              throw new Error("Existing client not found in this org.");
            }
            clientId = existing._id;
          } else {
            const data = row.client.data;
            const name = data.fullName.trim();
            if (name.length === 0) throw new Error("Missing client name.");
            clientId = await ctx.db.insert("clients", {
              orgId,
              fullName: name,
              phone: phoneDigits(data.phone) || undefined,
              email: data.email?.trim() || undefined,
              addressLine1: data.addressLine1?.trim() || undefined,
              addressLine2: data.addressLine2?.trim() || undefined,
              city: data.city?.trim() || undefined,
              state: data.state?.trim() || undefined,
              postalCode: data.postalCode?.trim() || undefined,
              country: data.country?.trim() || undefined,
              notes: data.notes?.trim() || undefined,
            });
            createdClients += 1;
          }
        }

        if (row.pets && row.pets.length > 0) {
          if (!clientId) {
            throw new Error("Pets row has no client to attach to.");
          }
          for (const pet of row.pets) {
            const petName = pet.name.trim();
            if (petName.length === 0) continue;
            await ctx.db.insert("pets", {
              orgId,
              clientId,
              name: petName,
              species: pet.species,
              breed: pet.breed?.trim() || undefined,
              birthDate: pet.birthDate?.trim() || undefined,
              sex: pet.sex,
              sizeLb: pet.sizeLb,
              notes: pet.notes?.trim() || undefined,
              vaccinations: [],
            });
            createdPets += 1;
          }
        }

        if (row.legacy && row.legacy.length > 0) {
          if (!clientId) {
            throw new Error("Legacy rows have no client to attach to.");
          }
          for (const entry of row.legacy) {
            await ctx.db.insert("legacyAppointments", {
              orgId,
              clientId,
              petName: entry.petName?.trim() || undefined,
              serviceName: entry.serviceName?.trim() || undefined,
              staffName: entry.staffName?.trim() || undefined,
              dateLabel: entry.dateLabel?.trim() || undefined,
              timeLabel: entry.timeLabel?.trim() || undefined,
              priceLabel: entry.priceLabel?.trim() || undefined,
              notes: entry.notes?.trim() || undefined,
              sourceSystem: args.sourceSystem?.trim() || undefined,
              importedAt,
              importBatchId: args.batchId,
            });
            createdLegacy += 1;
          }
        }
      } catch (caught) {
        failures.push({
          rowId: row.rowId,
          reason: caught instanceof Error ? caught.message : "Unknown error",
        });
      }
    }

    return {
      created: {
        clients: createdClients,
        pets: createdPets,
        legacy: createdLegacy,
      },
      failures,
    };
  },
});

/**
 * For appointment-history imports: given a list of emails + phones found in
 * the source file, return the existing client (id + fullName) each value
 * matches. Used by the preview step to attach legacy rows to the right
 * client and to surface "No matching client" rows so the user can fix the
 * source data before committing.
 */
export const matchClients = query({
  args: {
    emails: v.array(v.string()),
    phones: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const wantedEmails = new Set(
      args.emails
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    );
    const wantedPhones = new Set(
      args.phones.map(phoneDigits).filter((value) => value.length > 0),
    );
    if (wantedEmails.size === 0 && wantedPhones.size === 0) return [];
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (index) => index.eq("orgId", identity.orgId))
      .take(5000);
    type Match = {
      id: Id<"clients">;
      fullName: string;
      email: string | null;
      phone: string | null;
    };
    const result: Match[] = [];
    for (const row of clients) {
      if (row.deletedAt !== undefined) continue;
      const email = row.email?.trim().toLowerCase() ?? "";
      const phone = phoneDigits(row.phone);
      const matchEmail = email && wantedEmails.has(email);
      const matchPhone = phone && wantedPhones.has(phone);
      if (matchEmail || matchPhone) {
        result.push({
          id: row._id,
          fullName: row.fullName,
          email: matchEmail ? email : null,
          phone: matchPhone ? phone : null,
        });
      }
    }
    return result;
  },
});

/**
 * Reads imported legacy appointments for one client, newest first. Used by
 * the client detail page's "Imported history" section. Any signed-in
 * member of the org can read.
 */
export const legacyAppointmentsForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await softAuth(ctx);
    if (!identity) return [];
    const client = await ctx.db.get(args.clientId);
    if (!client || client.orgId !== identity.orgId) return [];
    const rows = await ctx.db
      .query("legacyAppointments")
      .withIndex("by_client", (index) => index.eq("clientId", args.clientId))
      .collect();
    return rows.sort((a, b) => b.importedAt - a.importedAt);
  },
});

/**
 * AI-assisted column mapping. Takes the parsed file's headers + a few
 * sample rows and asks Claude Haiku 4.5 to guess which GroomHub field
 * each source column belongs to. Returns a `header → target` map the
 * client merges into the existing dropdown state.
 *
 * Admin / superAdmin only. Required Convex env var:
 *   ANTHROPIC_API_KEY  — `sk-ant-...` from console.anthropic.com.
 * Set with:  npx convex env set ANTHROPIC_API_KEY sk-ant-...
 */
const IMPORT_MODE_TARGETS: Record<string, ReadonlyArray<string>> = {
  clients: [
    "skip",
    "client.fullName",
    "client.firstName",
    "client.middleName",
    "client.lastName",
    "client.email",
    "client.phone",
    "client.phone2",
    "client.phone3",
    "client.addressLine1",
    "client.city",
    "client.state",
    "client.postalCode",
    "client.country",
    "client.notes",
  ],
  clientsAndPets: [
    "skip",
    "client.fullName",
    "client.firstName",
    "client.middleName",
    "client.lastName",
    "client.email",
    "client.phone",
    "client.phone2",
    "client.phone3",
    "client.addressLine1",
    "client.city",
    "client.state",
    "client.postalCode",
    "client.country",
    "client.notes",
    "pet.name",
    "pet.species",
    "pet.breed",
    "pet.birthDate",
    "pet.sex",
    "pet.sizeLb",
    "pet.notes",
    "pet2.name",
    "pet2.species",
    "pet2.breed",
    "pet2.birthDate",
    "pet2.sex",
    "pet2.sizeLb",
    "pet2.notes",
    "pet3.name",
    "pet3.species",
    "pet3.breed",
    "pet3.birthDate",
    "pet3.sex",
    "pet3.sizeLb",
    "pet3.notes",
    // Inline last-appointment columns for the merged "clients + pets +
    // history" import. The clientEmail/clientPhone lookup fields stay out
    // — they only make sense in the standalone appointmentHistory mode.
    "history.petName",
    "history.serviceName",
    "history.staffName",
    "history.dateLabel",
    "history.timeLabel",
    "history.priceLabel",
    "history.notes",
  ],
  appointmentHistory: [
    "skip",
    "history.clientEmail",
    "history.clientPhone",
    "history.petName",
    "history.serviceName",
    "history.staffName",
    "history.dateLabel",
    "history.timeLabel",
    "history.priceLabel",
    "history.notes",
  ],
};

type AIImportMode = "clients" | "clientsAndPets" | "appointmentHistory";

export const suggestMappingFromAI = action({
  args: {
    mode: v.union(
      v.literal("clients"),
      v.literal("clientsAndPets"),
      v.literal("appointmentHistory"),
    ),
    headers: v.array(v.string()),
    samples: v.array(v.record(v.string(), v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ mode: AIImportMode; mapping: Record<string, string> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to use AI suggestions.");
    const claims = readOrgClaims(identity);
    const role = mapClerkOrgRole(claims?.orgRole ?? null);
    if (role !== "admin" && role !== "superAdmin") {
      throw new Error("Only admins can use AI suggestions.");
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI suggestions need ANTHROPIC_API_KEY set in Convex env.",
      );
    }

    const prompt = buildSuggestPrompt(args.headers, args.samples, args.mode);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Anthropic error:", response.status, body);
      throw new Error(
        `AI suggestion failed (${response.status}). Try again or map manually.`,
      );
    }
    const payload = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text =
      payload.content.find((part) => part.type === "text")?.text ?? "";
    const parsed = parseAIResponse(text, args.headers, args.mode);
    return parsed;
  },
});

function buildSuggestPrompt(
  headers: string[],
  samples: Array<Record<string, string>>,
  userMode: AIImportMode,
): string {
  const sampleTable = samples
    .slice(0, 3)
    .map((row, index) => {
      const values = headers
        .map((header) => `${header}=${truncate(row[header] ?? "")}`)
        .join(" | ");
      return `Row ${index + 1}: ${values}`;
    })
    .join("\n");
  return [
    "You are mapping a pet grooming shop's exported data file into GroomHub's schema.",
    "",
    "Step 1 — pick the best import mode. The shop currently has '" + userMode + "' selected, but override that if the data clearly fits another mode:",
    "- clients              → every row is a customer record (no pets)",
    "- clientsAndPets       → every row is a customer record with one pet attached",
    "- appointmentHistory   → every row is a past visit, matched to an existing customer by email/phone",
    "",
    "Step 2 — for the mode you chose, map each source column to ONE target field.",
    "Allowed target fields per mode:",
    ...Object.entries(IMPORT_MODE_TARGETS).map(
      ([modeName, targets]) =>
        `  ${modeName}: ${targets.join(", ")}`,
    ),
    "",
    'Use "skip" for source columns that have no good match.',
    "",
    "Source columns and three sample rows:",
    `Headers: ${headers.join(", ")}`,
    sampleTable || "(no sample rows)",
    "",
    "Reply with ONLY this exact format — a <result> block containing JSON. No prose, no markdown:",
    '<result>{"mode":"clientsAndPets","mapping":{"Owner Email":"client.email","Phone #":"client.phone","Random ID":"skip"}}</result>',
  ].join("\n");
}

function parseAIResponse(
  text: string,
  headers: string[],
  fallbackMode: AIImportMode,
): { mode: AIImportMode; mapping: Record<string, string> } {
  // Accept either the new <result>{ mode, mapping }</result> envelope or
  // the legacy <mapping>{...}</mapping> shape so a confused model still
  // gives us something usable.
  const resultMatch = text.match(/<result>([\s\S]*?)<\/result>/);
  const mappingMatch = text.match(/<mapping>([\s\S]*?)<\/mapping>/);
  const raw = resultMatch?.[1] ?? mappingMatch?.[1] ?? text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    console.log("[suggestMappingFromAI] could not parse:", text);
    return { mode: fallbackMode, mapping: {} };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { mode: fallbackMode, mapping: {} };
  }
  const envelope = parsed as Record<string, unknown>;
  // Legacy shape — `<mapping>{ "col": "target" }</mapping>` (no mode key)
  const rawMapping =
    typeof envelope.mapping === "object" && envelope.mapping !== null
      ? (envelope.mapping as Record<string, unknown>)
      : envelope;
  const mode: AIImportMode =
    envelope.mode === "clients" ||
    envelope.mode === "clientsAndPets" ||
    envelope.mode === "appointmentHistory"
      ? envelope.mode
      : fallbackMode;
  const allowed = new Set(IMPORT_MODE_TARGETS[mode]);
  const headerSet = new Set(headers);
  const mapping: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawMapping)) {
    if (!headerSet.has(key)) continue;
    if (typeof value !== "string") continue;
    if (!allowed.has(value)) continue;
    mapping[key] = value;
  }
  console.log("[suggestMappingFromAI] mode:", mode, "mapping:", mapping);
  return { mode, mapping };
}

function truncate(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}
