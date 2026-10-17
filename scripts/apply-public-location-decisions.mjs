/**
 * Primenjuje data/public-location-decisions.json na data/store-locations.json.
 * Isto radi i scripts/build-public-locations.mjs na kraju generisanja, pa
 * odluke preživljavaju ponovni uvoz. Pokretanje bez internog CSV-a je bezbedno.
 *
 *   node scripts/apply-public-location-decisions.mjs [--check]
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { applyLocationDecisions } from "./lib/location-decisions.mjs";
import { validatePublicLocations, writeFileAtomic } from "./lib/location-import-utils.mjs";

const root = process.cwd();
const locationsPath = path.resolve(root, "data/store-locations.json");
const decisionsPath = path.resolve(root, "data/public-location-decisions.json");
const check = process.argv.includes("--check");

const locations = JSON.parse(await fs.readFile(locationsPath, "utf8"));
const decisions = JSON.parse(await fs.readFile(decisionsPath, "utf8"));
const { locations: next, summary } = applyLocationDecisions(locations, decisions);
validatePublicLocations(next);
const output = `${JSON.stringify(next, null, 2)}\n`;

if (check) {
  const current = await fs.readFile(locationsPath, "utf8");
  if (current !== output) {
    console.error("data/store-locations.json nije u koraku sa odlukama. Pokrenite: node scripts/apply-public-location-decisions.mjs");
    process.exit(1);
  }
  console.log("Odluke o lokacijama su primenjene.");
} else {
  await writeFileAtomic(locationsPath, output);
  const listed = next.filter((location) => location.verificationStatus !== "pending").length;
  console.log(
    `Odluke primenjene: ${summary.reviewed} revidirano, ${summary.merged} spojeno kao duplikat, ${summary.pending} ostaje nejavno; javno ukupno ${listed} od ${next.length}.`,
  );
}
