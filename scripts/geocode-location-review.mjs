import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  readCsvObjects,
  serializeCsv,
  writeFileAtomic,
} from "./lib/location-import-utils.mjs";

const projectRoot = process.cwd();
const reviewPath = path.resolve(projectRoot, "data/internal/location-import-review.csv");
const cachePath = path.resolve(projectRoot, "data/internal/geocoding-cache.json");
const allowNetwork = process.argv.includes("--allow-network");
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = Math.min(200, Math.max(1, Number(limitArgument?.split("=")[1] ?? 150)));
const endpoint = process.env.NOMINATIM_ENDPOINT ?? "https://nominatim.openstreetmap.org";
const userAgent =
  process.env.NOMINATIM_USER_AGENT?.trim() ??
  "CarsystemLocationPreview/1.0 (office@carsystemirm.com)";
const minimumRequestIntervalMs = 1100;

if (!allowNetwork) {
  throw new Error(
    "Network geocoding is opt-in. Read docs/LOCATION_IMPORT_WORKFLOW.md, then rerun with --allow-network.",
  );
}
if (!userAgent || !/(@|https?:\/\/)/.test(userAgent)) {
  throw new Error(
    "Set NOMINATIM_USER_AGENT to an application identifier with a contact email or URL.",
  );
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function isTrue(value) {
  return String(value).trim().toLocaleLowerCase("sr-Latn") === "true";
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cleanPart(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isPreciseResult(result) {
  if (!result) return false;
  if (result.hasHouseNumber) return true;
  return new Set([
    "building",
    "commercial",
    "company",
    "house",
    "industrial",
    "office",
    "retail",
    "shop",
  ]).has(result.addressType) || new Set(["building", "shop", "office"]).has(result.type);
}

const rows = await readCsvObjects(reviewPath);
const cache = await readCache();
const candidates = rows
  .filter(
    (row) =>
      row.source_status === "active" &&
      row.entity_kind === "legal_entity" &&
      ["preview_approved", "ready_for_geocoding", "approved"].includes(
        row.review_status,
      ) &&
      isTrue(row.is_public) &&
      isTrue(row.geocoding_approved) &&
      !row.latitude.trim() &&
      !row.longitude.trim(),
  )
  .slice(0, limit);

let lastNetworkRequestAt = 0;
let networkRequestCount = 0;

async function search(query) {
  const cacheKey = `search:${query}`;
  if (Object.hasOwn(cache, cacheKey)) return cache[cacheKey];

  const waitMs = minimumRequestIntervalMs - (Date.now() - lastNetworkRequestAt);
  if (waitMs > 0) await delay(waitMs);

  const url = new URL("/search", endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "rs");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent,
    },
  });
  lastNetworkRequestAt = Date.now();
  networkRequestCount += 1;

  if (!response.ok) {
    throw new Error(`Nominatim request failed with status ${response.status}.`);
  }

  const matches = await response.json();
  const match = matches[0];
  const result = match
    ? {
        addressType: String(match.addresstype ?? ""),
        category: String(match.category ?? ""),
        displayName: String(match.display_name ?? ""),
        hasHouseNumber: Boolean(match.address?.house_number),
        importance: Number(match.importance ?? 0),
        latitude: Number(match.lat),
        longitude: Number(match.lon),
        type: String(match.type ?? ""),
      }
    : null;

  cache[cacheKey] = result;
  await writeFileAtomic(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
  return result;
}

for (let index = 0; index < candidates.length; index += 1) {
  const row = candidates[index];
  const city = cleanPart(row.public_city || row.city);
  const street = cleanPart(row.street_and_number || row.public_address);
  const hasPreciseInput = row.address_precision === "usable_for_review";
  let result = null;
  let coordinateStatus = "geocode_no_result";

  if (city && hasPreciseInput && street) {
    result = await search(`${street}, ${city}, Srbija`);
    if (result) {
      coordinateStatus = isPreciseResult(result) ? "geocoded_preview" : "approximate";
    }
  }

  if (!result && city) {
    result = await search(`${city}, Srbija`);
    if (result) coordinateStatus = "approximate";
  }

  if (result) {
    row.latitude = String(result.latitude);
    row.longitude = String(result.longitude);
    row.geocode_importance = String(result.importance);
    row.geocode_match_name = result.displayName;
  }
  row.coordinate_status = coordinateStatus;

  console.log(
    `Geocoding ${index + 1}/${candidates.length}: ${coordinateStatus} (${networkRequestCount} network requests).`,
  );
}

await writeFileAtomic(reviewPath, `${serializeCsv(rows)}\r\n`);
const statusCounts = candidates.reduce((counts, row) => {
  counts[row.coordinate_status] = (counts[row.coordinate_status] ?? 0) + 1;
  return counts;
}, {});

console.log(
  `Geocoding finished for ${candidates.length} preview-approved legal entities: ${JSON.stringify(statusCounts)}.`,
);
