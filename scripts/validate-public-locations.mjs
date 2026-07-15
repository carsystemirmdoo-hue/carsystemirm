import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { validatePublicLocations } from "./lib/location-import-utils.mjs";

const projectRoot = process.cwd();
const publicDataPath = path.resolve(projectRoot, "data/store-locations.json");
const forbiddenPublicCsvPath = path.resolve(projectRoot, "public/Klijenti.csv");
const rawText = await fs.readFile(publicDataPath, "utf8");

if (/\b(?:pib|bex|sifra|šifra|source_bex|internal_note)\b/i.test(rawText)) {
  throw new Error("Public location dataset contains an internal-data keyword.");
}

try {
  await fs.access(forbiddenPublicCsvPath);
  throw new Error("Raw BEX CSV must not exist under public/.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const validation = validatePublicLocations(JSON.parse(rawText));
console.log(
  `Public location validation passed: ${validation.markerCount} markers, ${validation.listOnlyCount} list-only locations, ${validation.duplicateCoordinateGroups} shared-coordinate groups, no forbidden fields.`,
);
