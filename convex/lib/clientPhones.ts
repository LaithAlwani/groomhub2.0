import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { phoneEntryNumber, phoneSearchDigits } from "./phone";

/**
 * Maintains the `clientPhones` search-index table (one row per client per phone
 * digit-variant), which replaces the old whole-table `scanPhoneMatches`. A
 * prefix (area-code) search is a range scan on `digits`; a suffix (last-N)
 * search is a range scan on `digitsReversed`. Rebuilt from the client doc
 * whenever `phone`/`altPhones` change.
 */

const reverseDigits = (digits: string): string =>
  digits.split("").reverse().join("");

/** Delete every `clientPhones` row for a client (bounded batches). */
export async function deleteClientPhones(
  ctx: MutationCtx,
  clientId: Id<"clients">,
): Promise<void> {
  // A client has only a handful of phone rows, but loop in bounded batches to
  // respect Convex's no-`.collect()`-for-deletes guidance.
  for (;;) {
    const rows = await ctx.db
      .query("clientPhones")
      .withIndex("by_client", (index) => index.eq("clientId", clientId))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length < 100) break;
  }
}

/**
 * Rebuild a client's `clientPhones` rows from its primary + alt phones. Stores
 * both the full-E.164 and national digit forms (`phoneSearchDigits`) so a
 * "613…" prefix search still hits a "+1613…" stored number, deduped by digits.
 */
export async function refreshClientPhones(
  ctx: MutationCtx,
  client: Doc<"clients">,
): Promise<void> {
  await deleteClientPhones(ctx, client._id);
  const numbers = [
    client.phone,
    ...(client.altPhones ?? []).map(phoneEntryNumber),
  ];
  const seen = new Set<string>();
  for (const raw of numbers) {
    for (const digits of phoneSearchDigits(raw)) {
      if (digits.length === 0 || seen.has(digits)) continue;
      seen.add(digits);
      await ctx.db.insert("clientPhones", {
        orgId: client.orgId,
        clientId: client._id,
        digits,
        digitsReversed: reverseDigits(digits),
      });
    }
  }
}
