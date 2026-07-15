import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  createImportSummary,
  createReview,
  parseBexExport,
  readCsvObjects,
  serializeCsv,
  writeFileAtomic,
} from "./lib/location-import-utils.mjs";

const projectRoot = process.cwd();
const inputPath = path.resolve(projectRoot, "_incoming/Klijenti.csv");
const reviewPath = path.resolve(projectRoot, "data/internal/location-import-review.csv");
const summaryPath = path.resolve(projectRoot, "data/internal/location-import-summary.json");

async function readPreviousReview() {
  try {
    return await readCsvObjects(reviewPath);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const sourceText = await fs.readFile(inputPath, "utf8");
const parsed = parseBexExport(sourceText);
const previousRows = await readPreviousReview();
const { duplicatePairs, reviewRows } = createReview(parsed.records, previousRows);
const summary = createImportSummary(parsed, reviewRows, duplicatePairs);

await writeFileAtomic(reviewPath, `${serializeCsv(reviewRows)}\r\n`);
await writeFileAtomic(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(`BEX import analyzed: ${summary.source.dataRows} data rows.`);
console.log(
  `Review: ${summary.entities.physicalPersons} physical persons, ${summary.quality.impreciseAddressRows} imprecise addresses, ${summary.quality.exactAddressDuplicateGroups} duplicate-address groups.`,
);
console.log(
  `Preview publication: ${summary.privacy.automaticallyPublic} legal-entity markers approved, ${summary.quality.autoMergedRows} obvious duplicate rows merged, ${summary.privacy.pendingManualReview} rows require manual confirmation.`,
);

if (parsed.invalidRows.length > 0) {
  console.error(`Invalid BEX rows: ${JSON.stringify(parsed.invalidRows)}`);
  process.exitCode = 1;
}
