import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  PUBLIC_LOCATION_TYPES,
  latinize,
  normalizeAddress,
  normalizeName,
  readCsvObjects,
  validatePublicLocations,
  writeFileAtomic,
} from "./lib/location-import-utils.mjs";

const projectRoot = process.cwd();
const baselinePath = path.resolve(projectRoot, "data/public-location-overrides.json");
const reviewPath = path.resolve(projectRoot, "data/internal/location-import-review.csv");
const outputPath = path.resolve(projectRoot, "data/store-locations.json");

function isTrue(value) {
  return String(value).trim().toLocaleLowerCase("sr-Latn") === "true";
}

function optionalString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function uniquePublicNames(names, primaryName) {
  const publicNameKey = (name) => latinize(name).replace(/\s+/g, " ").trim();
  const primaryKey = publicNameKey(primaryName);
  const seen = new Set([primaryKey]);
  return names
    .map((name) => String(name ?? "").trim())
    .filter(Boolean)
    .filter((name) => {
      const key = publicNameKey(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function publicCoordinateStatus(row) {
  if (["verified_manual", "geocoded_verified"].includes(row.coordinate_status)) {
    return "verified";
  }
  if (row.coordinate_status === "geocoded_preview") return "geocoded_preview";
  if (row.coordinate_status === "approximate") return "approximate";
  return "unavailable";
}

function rowToPublicLocation(row, alternativeNames = []) {
  const id = row.public_location_id.trim();
  const type = row.type.trim();
  const coordinateStatus = publicCoordinateStatus(row);
  const hasCoordinates = coordinateStatus !== "unavailable";
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!id || !row.display_name.trim() || !row.public_address.trim() || !row.public_city.trim()) {
    throw new Error(
      `Public review row ${row.source_bex_contact_id} is missing public_location_id, display_name, public_address or public_city.`,
    );
  }
  if (!PUBLIC_LOCATION_TYPES.has(type)) {
    throw new Error(`Public review row ${row.source_bex_contact_id} has invalid type ${type}.`);
  }
  if (hasCoordinates && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    throw new Error(`Public review row ${row.source_bex_contact_id} has invalid coordinates.`);
  }
  if (row.verification_status === "verified" && coordinateStatus !== "verified") {
    throw new Error(
      `Verified review row ${row.source_bex_contact_id} must have verified coordinates.`,
    );
  }

  const location = {
    id,
    name: row.display_name.trim(),
    address: row.public_address.trim(),
    city: row.public_city.trim(),
    type,
    verificationStatus: row.verification_status === "verified" ? "verified" : "pending",
    coordinateStatus,
    isPublic: true,
  };
  if (hasCoordinates) {
    location.latitude = latitude;
    location.longitude = longitude;
  }

  const aliases = uniquePublicNames(
    [row.source_name, ...alternativeNames],
    location.name,
  );
  const phone = optionalString(row.phone);
  const workingHours = optionalString(row.working_hours);
  const notes = optionalString(row.public_notes);
  const availableBrands = String(row.available_brands ?? "")
    .split(/[|;]/)
    .map((brand) => brand.trim())
    .filter(Boolean);

  if (aliases.length > 0) location.alternativeNames = aliases;
  if (phone) location.phone = phone;
  if (workingHours) location.workingHours = workingHours;
  if (availableBrands.length > 0) location.availableBrands = availableBrands;
  if (notes) location.notes = notes;

  return location;
}

function distanceKm(left, right) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLng = toRadians(right.longitude - left.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(left.latitude)) *
      Math.cos(toRadians(right.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

function matchesExistingBaseline(location, row, baselineLocation) {
  if (normalizeName(location.name) !== normalizeName(baselineLocation.name)) return false;

  const sourceStreet = normalizeAddress(row.street_and_number);
  const baselineAddress = normalizeAddress(baselineLocation.address);
  const sameStreet =
    sourceStreet.length >= 6 &&
    (sourceStreet.includes(baselineAddress) || baselineAddress.includes(sourceStreet));
  if (sameStreet) return true;

  if (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Number.isFinite(baselineLocation.latitude) &&
    Number.isFinite(baselineLocation.longitude)
  ) {
    return distanceKm(location, baselineLocation) <= 0.25;
  }

  return false;
}

async function readReview() {
  try {
    return await readCsvObjects(reviewPath);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8")).map((location) => ({
  ...location,
  coordinateStatus: location.coordinateStatus ?? "verified",
}));
const reviewRows = await readReview();
const publicRows = reviewRows.filter((row) => {
  if (!isTrue(row.is_public)) return false;
  const isVerified =
    row.review_status === "approved" && row.verification_status === "verified";
  const isPreview =
    row.review_status === "preview_approved" && row.verification_status === "pending";
  return isVerified || isPreview;
});

const mergedAliasesByTarget = new Map();
for (const row of reviewRows) {
  if (row.review_status !== "merged" || !row.merge_target_id.trim()) continue;
  const aliases = mergedAliasesByTarget.get(row.merge_target_id) ?? [];
  aliases.push(row.source_name, row.display_name);
  mergedAliasesByTarget.set(row.merge_target_id, aliases);
}

const previewEntries = publicRows.map((row) => ({
  location: rowToPublicLocation(
    row,
    mergedAliasesByTarget.get(row.public_location_id) ?? [],
  ),
  row,
}));

let mergedIntoBaseline = 0;
const newLocations = [];
for (const entry of previewEntries) {
  const matchingBaseline = baseline.find((location) =>
    matchesExistingBaseline(entry.location, entry.row, location),
  );
  if (!matchingBaseline) {
    newLocations.push(entry.location);
    continue;
  }

  matchingBaseline.alternativeNames = uniquePublicNames(
    [
      ...(matchingBaseline.alternativeNames ?? []),
      entry.location.name,
      ...(entry.location.alternativeNames ?? []),
    ],
    matchingBaseline.name,
  );
  if (matchingBaseline.alternativeNames.length === 0) {
    delete matchingBaseline.alternativeNames;
  }
  mergedIntoBaseline += 1;
}

const publicLocations = [...baseline, ...newLocations].sort(
  (left, right) =>
    left.city.localeCompare(right.city, "sr-Latn") ||
    left.name.localeCompare(right.name, "sr-Latn"),
);

const validation = validatePublicLocations(publicLocations);
await writeFileAtomic(outputPath, `${JSON.stringify(publicLocations, null, 2)}\n`);

console.log(
  `Public dataset generated: ${validation.locationCount} listed locations, ${validation.markerCount} markers, ${validation.listOnlyCount} list-only (${baseline.length} retained, ${newLocations.length} BEX preview, ${mergedIntoBaseline} merged into existing locations).`,
);
