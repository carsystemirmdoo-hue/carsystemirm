#!/usr/bin/env node
/**
 * SATA sync — provera srpskog sadržaja protiv zvaničnog ulaza (anti-invention).
 *
 *  1. Svaka porodica u opsegu ima tekst, i tekst je pisan za TRENUTNI zvanični ulaz (`sourceHash`).
 *  2. Svaki broj u srpskom tekstu postoji u zvaničnom ulazu te porodice (naziv, slogan, opis,
 *     nazivi artikala). Izvor i tekst se normalizuju ISTO: bez razmaka, tačke i zareza.
 *  3. Nema rizičnih tvrdnji (status distributera, cene, garancije koje izvor ne navodi).
 *
 *   node scripts/sata-sync/check-localization.mjs           provera
 *   node scripts/sata-sync/check-localization.mjs --stamp   upiši trenutni `sourceHash` (posle PREGLEDA teksta)
 */

import { readFileSync, writeFileSync } from "node:fs";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const stamp = process.argv.includes("--stamp");
const file = JSON.parse(readFileSync(PATHS.localizationFamilies, "utf8"));
const input = readJson(PATHS.localizationInput);
if (!input) throw new Error("Nedostaje localization-input — `node scripts/sata-sync/plan.mjs`.");

const squash = (text) => String(text ?? "").replace(/[\s.,]/g, "");
const FORBIDDEN = [/zvani[čc]n\w* distributer/i, /ovla[šs][ćc]en\w* (zastupnik|distributer|servis)/i, /ekskluzivn/i, /\b(cena|cene|popust|akcij)\w*/i, /\b\d+\s*(rsd|eur|€|din\.|dinar)/i, /garancij/i, /najbolj/i];

const failures = [];
for (const [id, official] of Object.entries(input)) {
  const entry = file.families[id];
  if (!entry) { failures.push({ id, problem: "MISSING" }); continue; }
  if (stamp) entry.sourceHash = official.sourceHash;
  else if (entry.sourceHash !== official.sourceHash) failures.push({ id, problem: "STALE_SOURCE_HASH", expected: official.sourceHash, found: entry.sourceHash ?? null });

  for (const field of ["productType", "shortDescription", "purpose"]) if (!entry[field]?.trim()) failures.push({ id, problem: `EMPTY_${field}` });
  const haystack = squash([official.officialName, official.tagline, official.officialDescription, official.defaultArticleName, ...official.articleNames].join(" "));
  const text = [entry.displayName, entry.productType, entry.shortDescription, entry.purpose].filter(Boolean).join(" ");
  // „2K”, „1K” su oznake sistema i moraju postojati u izvoru kao i svaki drugi broj.
  for (const number of text.match(/\d+(?:[.,]\d+)?/g) ?? []) if (!haystack.includes(squash(number))) failures.push({ id, problem: "NUMBER_NOT_IN_SOURCE", number });
  for (const pattern of FORBIDDEN) if (pattern.test(text)) failures.push({ id, problem: "FORBIDDEN_WORDING", pattern: String(pattern) });
}
for (const id of Object.keys(file.families)) if (!input[id]) failures.push({ id, problem: "NOT_IN_SCOPE" });

if (stamp) writeFileSync(PATHS.localizationFamilies, `${JSON.stringify(file, null, 2)}\n`);
console.log(JSON.stringify({ families: Object.keys(input).length, localized: Object.keys(file.families).length, stamped: stamp, failures }, null, 1));
if (failures.length) process.exitCode = 1;
