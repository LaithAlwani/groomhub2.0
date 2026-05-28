/**
 * Dispatch a `File` (CSV / Excel / JSON / XML) to the right parser and
 * return a normalized `{ headers, rows }` shape the import wizard can
 * mapping-walk and preview.
 *
 * Every parser yields rows as `Record<string, string>` because the wizard
 * is column-mapping driven — the user picks which source column lands in
 * which GroomHub field, and downstream `applyMapping` does the typed
 * coercion. Keeping all source values as strings here makes the mapper
 * uniform regardless of input format.
 *
 * All four parsers (papaparse / xlsx / json / fast-xml-parser) are dynamic-
 * imported so the heavyweight `xlsx` bundle only loads when an Excel file
 * is actually picked.
 */

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB raw file cap

export async function parseFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large. Keep imports under 50 MB.");
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "csv" || file.type === "text/csv") return parseCsv(file);
  if (ext === "xlsx" || ext === "xls") return parseExcel(file);
  if (ext === "json" || file.type === "application/json") return parseJson(file);
  if (ext === "xml" || file.type === "application/xml" || file.type === "text/xml") {
    return parseXml(file);
  }
  throw new Error(
    `Unsupported file type "${ext}". Use CSV, Excel (.xlsx), JSON, or XML.`,
  );
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const { default: Papa } = await import("papaparse");
  return new Promise<ParsedFile>((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter(
          (header) => header.length > 0,
        );
        const rows = (result.data as Record<string, unknown>[]).map(
          (row) => normalizeRow(row, headers),
        );
        resolve({ headers, rows });
      },
      error: (caught: Error) =>
        reject(new Error(`Could not parse CSV: ${caught.message}`)),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  // SheetJS is heavy (~250 KB gzipped) — dynamic-import so other paths
  // don't pay for it.
  const xlsx = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = xlsx.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The spreadsheet has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  // `defval: ""` ensures missing cells round-trip as empty strings instead
  // of undefined — preserves column alignment in the mapping step.
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (rawRows.length === 0) {
    return { headers: [], rows: [] };
  }
  // Headers come from the first row's keys, ordered by xlsx's natural
  // column traversal. Sort drops, so we trust the lib's order.
  const headers = Object.keys(rawRows[0]);
  const rows = rawRows.map((row) => normalizeRow(row, headers));
  return { headers, rows };
}

async function parseJson(file: File): Promise<ParsedFile> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (caught) {
    throw new Error(
      `Could not parse JSON: ${caught instanceof Error ? caught.message : "invalid"}`,
    );
  }
  // Generic row-discovery: walk the parsed tree looking for the largest
  // array of objects. Supports any wrapper shape — `[ {...}, {...} ]`,
  // `{ "data": [...] }`, `{ "contacts": [...] }`, `{ "results": { "rows": [...] } }`,
  // etc. Ties broken by shallower depth so the obvious top-level array
  // wins over incidental nested ones.
  const arrays = findRowArrays(parsed);
  if (arrays.length > 0) {
    arrays.sort((a, b) => b.items.length - a.items.length || a.depth - b.depth);
    return materializeJsonRows(arrays[0].items);
  }
  // Single object at the root → treat as one row.
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return materializeJsonRows([parsed as Record<string, unknown>]);
  }
  throw new Error("Could not find any rows in the JSON.");
}

function materializeJsonRows(items: Record<string, unknown>[]): ParsedFile {
  const flatRows = items.map(flattenJsonRow);
  const headerSet = new Set<string>();
  for (const row of flatRows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = Array.from(headerSet);
  const rows = flatRows.map((row) => normalizeRow(row, headers));
  return { headers, rows };
}

/**
 * Surface nested structure as flat columns so the mapping wizard can see
 * everything in one screen:
 *   - Arrays of scalars (e.g. `phones: ["555-1212", "555-3434"]`) become
 *     numbered columns `phones.1`, `phones.2` — each maps individually
 *   - Nested objects with scalar fields flatten one level deep
 *     (`address: { street, city }` → `address.street`, `address.city`)
 * Anything deeper than that falls through to normalizeRow's JSON-stringify
 * branch.
 */
function flattenJsonRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (Array.isArray(value) && value.every(isJsonScalar)) {
      value.forEach((entry, index) => {
        result[`${key}.${index + 1}`] = entry;
      });
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const subEntries = Object.entries(value as Record<string, unknown>);
      const allScalar = subEntries.every(([, subValue]) =>
        isJsonScalar(subValue),
      );
      if (allScalar && subEntries.length > 0) {
        for (const [subKey, subValue] of subEntries) {
          result[`${key}.${subKey}`] = subValue;
        }
        continue;
      }
    }
    result[key] = value;
  }
  return result;
}

function isJsonScalar(value: unknown): boolean {
  if (value === null) return true;
  const type = typeof value;
  return type === "string" || type === "number" || type === "boolean";
}

async function parseXml(file: File): Promise<ParsedFile> {
  const { XMLParser } = await import("fast-xml-parser");
  const text = await file.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
  });
  const tree = parser.parse(text) as unknown;

  // Generic row-discovery: scan the entire parsed tree, collect every
  // array of objects, and pick the largest. Wins regardless of how many
  // wrapper tags sit between the document root and the repeating element.
  // Ties broken by shallower depth (closer to the root usually means
  // "the data" rather than something incidental like address books).
  const arrays = findRowArrays(tree);
  if (arrays.length > 0) {
    arrays.sort((a, b) => b.items.length - a.items.length || a.depth - b.depth);
    return materializeXmlRows(arrays[0].items);
  }

  // No arrays — fast-xml-parser collapses single-occurrence tags to a
  // bare object, so a one-record export looks like `{ root: { client: {...} } }`.
  // Walk down through single-key wrappers until we hit an object that
  // actually has scalar fields; treat that as a one-row import.
  const onlyRow = findSingleRowObject(tree);
  if (onlyRow) return materializeXmlRows([onlyRow]);

  throw new Error("Could not find any rows in the XML.");
}

function findRowArrays(
  node: unknown,
  depth = 0,
): Array<{ items: Record<string, unknown>[]; depth: number }> {
  const result: Array<{ items: Record<string, unknown>[]; depth: number }> = [];
  if (Array.isArray(node)) {
    const objectItems = node.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
    if (objectItems.length > 0) result.push({ items: objectItems, depth });
    for (const item of node) result.push(...findRowArrays(item, depth + 1));
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      result.push(...findRowArrays(value, depth + 1));
    }
  }
  return result;
}

function findSingleRowObject(
  node: unknown,
): Record<string, unknown> | null {
  let current = node;
  while (current && typeof current === "object" && !Array.isArray(current)) {
    const entries = Object.entries(current as Record<string, unknown>);
    if (entries.length === 0) return null;
    const hasScalar = entries.some(
      ([, value]) =>
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    );
    if (hasScalar) return current as Record<string, unknown>;
    // Pure wrapper — descend through its only child and keep looking.
    if (entries.length !== 1) return current as Record<string, unknown>;
    current = entries[0][1];
  }
  return null;
}

function materializeXmlRows(items: Record<string, unknown>[]): ParsedFile {
  // Two-pass flatten so contact-export style XML (Sections > Section >
  // Fields > Field name="X" value="Y") shows up in the mapping wizard
  // as one column per Field instead of one giant JSON blob.
  const flatRows = items.map((row) => flattenOneLevel(explodeNamedFields(row)));
  const headerSet = new Set<string>();
  for (const row of flatRows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = Array.from(headerSet);
  const rows = flatRows.map((row) => normalizeRow(row, headers));
  return { headers, rows };
}

/**
 * Walk one row and look for any `{ Name, Value }` pairs hiding under a
 * wrapper key (vCard / ABC Schedule / contact-export style XML uses
 * `<Sections><Section><Fields><Field Name="Phone" Value="..."/>...</Fields>...`
 * to attach arbitrary per-record fields). When found, lift each pair to
 * a top-level column on the row and drop the original wrapper key —
 * the result reads like a flat CSV row in the mapping UI.
 */
function explodeNamedFields(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const pairs = collectNameValuePairs(value);
    if (pairs.length === 0) {
      result[key] = value;
      continue;
    }
    // The wrapper key contributed Name/Value pairs — discard it, keep the lifted columns.
    for (const { name, val } of pairs) {
      result[name] = val;
    }
  }
  return result;
}

function collectNameValuePairs(
  node: unknown,
): Array<{ name: string; val: string }> {
  const pairs: Array<{ name: string; val: string }> = [];
  if (!node || typeof node !== "object") return pairs;
  if (Array.isArray(node)) {
    let matchedAny = false;
    for (const item of node) {
      if (isNamedValuePair(item)) {
        pairs.push(toNamedValuePair(item as Record<string, unknown>));
        matchedAny = true;
      }
    }
    if (matchedAny) return pairs;
    for (const item of node) pairs.push(...collectNameValuePairs(item));
    return pairs;
  }
  if (isNamedValuePair(node)) {
    pairs.push(toNamedValuePair(node as Record<string, unknown>));
    return pairs;
  }
  // Plain wrapper object — descend.
  for (const value of Object.values(node as Record<string, unknown>)) {
    pairs.push(...collectNameValuePairs(value));
  }
  return pairs;
}

function isNamedValuePair(node: unknown): boolean {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const obj = node as Record<string, unknown>;
  return (
    "Name" in obj &&
    "Value" in obj &&
    typeof obj.Name === "string"
  );
}

function toNamedValuePair(obj: Record<string, unknown>): {
  name: string;
  val: string;
} {
  const value = obj.Value;
  let val = "";
  if (typeof value === "string") val = value;
  else if (typeof value === "number" || typeof value === "boolean")
    val = String(value);
  return { name: String(obj.Name), val };
}

/**
 * Surface one level of nested objects as dotted keys so address blocks,
 * contact objects, etc. show up in the mapping step instead of being
 * JSON-stringified into a single illegible column. Anything deeper than
 * one level falls through to `normalizeRow`'s JSON-stringify branch.
 */
function flattenOneLevel(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const nested = value as Record<string, unknown>;
      const subEntries = Object.entries(nested);
      const allScalar = subEntries.every(
        ([, subValue]) =>
          subValue === null ||
          typeof subValue === "string" ||
          typeof subValue === "number" ||
          typeof subValue === "boolean",
      );
      if (allScalar && subEntries.length > 0) {
        for (const [subKey, subValue] of subEntries) {
          result[`${key}.${subKey}`] = subValue;
        }
        continue;
      }
    }
    result[key] = value;
  }
  return result;
}

function normalizeRow(
  source: Record<string, unknown>,
  headers: string[],
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const header of headers) {
    const value = source[header];
    if (value === null || value === undefined) {
      row[header] = "";
    } else if (typeof value === "string") {
      row[header] = value.trim();
    } else if (typeof value === "number" || typeof value === "boolean") {
      row[header] = String(value);
    } else {
      // Nested objects (occasional in JSON) are JSON-stringified so they
      // at least show up in the mapping UI rather than disappearing.
      row[header] = JSON.stringify(value);
    }
  }
  return row;
}
