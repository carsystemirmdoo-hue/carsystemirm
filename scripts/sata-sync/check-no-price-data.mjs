#!/usr/bin/env node
/**
 * SATA sync — PRICE GATE nad kompletnim opsegom synca: generisani podaci, izvorni model, zaključan
 * opseg, lokalizacija, izveštaji, dokumentacija, skripte i testovi. `price data stored` mora biti 0.
 */

import path from "node:path";

import { writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";
import { scanForMonetaryData } from "./lib/price-gate.mjs";

const targets = [
  path.join(REPO_ROOT, "data", "sata-sync"),
  PATHS.siteDataset,
  path.join(REPO_ROOT, "docs", "SATA_CATALOG_SYNC.md"),
  path.join(REPO_ROOT, "scripts", "sata-sync"),
  path.join(REPO_ROOT, "lib", "sata-catalog-products.ts"),
];
// Sopstveni izveštaj se ne skenira: on citira ono što je gate našao.
const REPORT = path.join(REPO_ROOT, "data", "sata-sync", "reports", "price-gate.generated.json");
const result = scanForMonetaryData(targets, { root: REPO_ROOT, exclude: [REPORT] });
const report = { priceDataStored: result.findings.length, filesScanned: result.files, namesMentioningPriceWord: result.namesMentioningPriceWord, findings: result.findings.slice(0, 50) };
writeJson(REPORT, report);
console.log(JSON.stringify(report, null, 1));
if (result.findings.length) process.exitCode = 1;
