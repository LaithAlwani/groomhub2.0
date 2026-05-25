#!/usr/bin/env node
/*
 * Post-build helper. Walks `.next/static/` and writes a JSON list of every
 * JS / CSS / WOFF2 URL into `public/sw-precache-manifest.json`. The SW reads
 * this list at install time and `cache.addAll`s every entry so that hard-
 * reloading any route while offline doesn't hit a `ChunkLoadError`.
 *
 * Wired via `package.json` → `"build": "next build && node scripts/generate-sw-manifest.mjs"`.
 * Failing here is non-fatal — the SW falls back to runtime caching if the
 * manifest is missing.
 */
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, posix, sep } from "node:path";

const cwd = process.cwd();
const STATIC_DIR = join(cwd, ".next", "static");
const PUBLIC_DIR = join(cwd, "public");
const OUT_FILE = join(PUBLIC_DIR, "sw-precache-manifest.json");

if (!existsSync(STATIC_DIR)) {
  console.warn(
    "[sw-manifest] .next/static not found — was this run after `next build`? Skipping.",
  );
  process.exit(0);
}
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });

/** Match any asset the browser would need to hydrate a route. */
const ASSET_RE = /\.(js|css|woff2?)$/i;

/** @param {string} dir @param {string} urlPrefix @returns {string[]} */
function walk(dir, urlPrefix) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childPath = join(dir, entry.name);
    // URL paths use forward slashes regardless of OS.
    const childUrl = posix.join(urlPrefix, entry.name.split(sep).join("/"));
    if (entry.isDirectory()) {
      out.push(...walk(childPath, childUrl));
    } else if (entry.isFile() && ASSET_RE.test(entry.name)) {
      out.push(childUrl);
    }
  }
  return out;
}

const urls = walk(STATIC_DIR, "/_next/static");
writeFileSync(OUT_FILE, JSON.stringify(urls), "utf8");
console.log(
  `[sw-manifest] wrote ${urls.length} entries → public/sw-precache-manifest.json`,
);
