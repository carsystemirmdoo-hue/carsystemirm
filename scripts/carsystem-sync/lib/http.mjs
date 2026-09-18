/**
 * Mrežni sloj synca: keš na disku + ograničena paralelnost.
 *
 * Keš je razlog zašto se normalizacija može ponoviti bez ponovnog scrapinga:
 * `--refresh` jedini ponovo kontaktira carsystem.org.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { USER_AGENT } from "./config.mjs";

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

export async function fetchBuffer(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw new Error(`${url}: ${lastError?.message ?? lastError}`);
}

/** @returns {Promise<{body: Buffer, fromCache: boolean}>} */
export async function cachedFetch(url, cacheFile, { refresh = false } = {}) {
  if (!refresh && existsSync(cacheFile)) {
    return { body: readFileSync(cacheFile), fromCache: true };
  }
  const body = await fetchBuffer(url);
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, body);
  return { body, fromCache: false };
}

export async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        out[index] = await worker(items[index], index);
      }
    }),
  );
  return out;
}

/** Stabilan JSON: isti ulaz → bajt-identičan fajl (idempotentnost se meri diff-om). */
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}
